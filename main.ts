import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, WorkspaceLeaf } from 'obsidian';
import { EditorPosition, TFile } from 'obsidian';
import { InlineType, LineType, ArticlePart, InlinePart, InlineChange } from "./core" 
import { FormatSettings, DEFAULT_SETTINGS } from './core'
import { splitArticle, splitLine, formatLine, getLineTypeFromArticleParts, isPositionBefore, reparseArticleParts} from './core'
// Remember to rename these classes and interfaces!

interface EditorSelectionChange{
	begin: EditorPosition,
	end: EditorPosition,
	text: string,
	selection: boolean,
	selectionAnchor: EditorPosition,
	selectionHead: EditorPosition
}

interface ParseArticle{
	check: boolean;
	beginLineNumber: number;
}

export default class EasyTypingPlugin extends Plugin {
	settings: FormatSettings;
	keyUpdateCursor: Set<string>;
	articleParts: ArticlePart[];
	selectionTextChange: EditorSelectionChange|null;
	prevCursor: EditorPosition;
	reparseArticle: ParseArticle;
	editorChanged: boolean;

	selectedText: string;
	charBeforeCursor: string;
	charAfterCursor: string;
	keyDownFlag: boolean;

	ctrlDownLineIndex: number;
	async onload() {
		await this.loadSettings();
		this.prevCursor = {line:0, ch:0};
		this.selectionTextChange = null;
		this.editorChanged = false;
		this.keyUpdateCursor = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

		this.articleParts = null;
		this.reparseArticle = {
			check: true,
			beginLineNumber: 0
		};

		this.keyDownFlag = false;
		this.selectedText = "";
		this.charBeforeCursor = "";
		this.charAfterCursor = "";
		this.ctrlDownLineIndex = 0;

		this.addCommand({
			id: "easy-typing-format-selection",
			name: "format selected text",
			callback: () => this.formatSelection(),
			hotkeys: [{
				modifiers: ['Ctrl', 'Shift'],
				key: "s"
			}],
		});

		this.addCommand({
			id: "easy-typing-format-switch",
			name: "switch autoformat",
			callback: () => this.switchAutoFormatting(),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: "tab"
			}],
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EasyTypingSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('editor-change', this.handleChange));
		this.registerEvent(this.app.workspace.on('editor-paste', this.handlePaste));
		this.registerEvent(this.app.workspace.on('file-open', this.handleFileOpen));
		this.registerEvent(this.app.workspace.on('click', this.handleClick));
		// this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf)=>{
		// 	console.log("===>leaf change!");
		// 	console.log(leaf.getDisplayText());
		// 	console.log(leaf.view.getViewType());
		// }));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'keyup', this.handleKeyup);
		this.registerDomEvent(document, 'keydown', this.handleKeydown)
		this.registerDomEvent(document, 'beforeinput', this.handleBeforeInput);
		// this.registerDomEvent(document, 'select', (ev: Event)=>{console.log('select'); this.handleSelect(ev);});
		this.registerDomEvent(document, 'selectionchange', this.handleSelectBegin);
		// this.registerDomEvent(document, 'change', (ev: Event)=>{console.log('Change:', ev)});

	}

	onunload() {

	}

	getEditor=():Editor|null=>
	{
		let editor = null;
		let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if(markdownView)
		{
			editor = markdownView.editor;
		}
		if(editor === null && this.settings.Debug) console.log('can\'t get editor');
		return editor;
	}

	formatSelection = ():void=>
	{
		if(this.settings.Debug)
		{
			console.log("Begin format Selection");
		}
		let editor = this.getEditor();
		if(!editor) return;

		if(!editor.somethingSelected() || editor.getSelection()==='') return;

		let selection = editor.listSelections()[0];
		let lineBeginReparse = selection.anchor.line;
		if(lineBeginReparse>selection.head.line)
		{
			lineBeginReparse = selection.head.line;
		}
		this.reparseArticle = {check: true, beginLineNumber:lineBeginReparse};

		let selectedArticle = editor.getSelection();
		let articleParts = splitArticle(selectedArticle);
		let lines = selectedArticle.split('\n');
		let result = "";
		for(let i=0; i<articleParts.length; i++)
		{
			if(articleParts[i].type!=LineType.text)
            {
                for(let j=articleParts[i].begin; j<articleParts[i].end;j++)
                {
                    let line = lines[j];
                    result += line + '\n';
                }
            }
			else
			{
				// 对每行进行格式化
				for(let j=articleParts[i].begin; j<articleParts[i].end;j++)
                {
                    let line = lines[j];
                    let newline = formatLine(line, {line:0, ch:line.length}, this.settings)[0];
					result += newline + '\n';
                }
			}
		}
		result = result.substring(0, result.length-1);
		editor.replaceSelection(result);
		this.updateArticleParts(editor);
		if(this.settings.Debug)
		{
			new Notice("Format Selection Done!");
			console.log("End format Selection");
		}
	}

	switchAutoFormatting()
    {
        this.settings.AutoFormatting = this.settings.AutoFormatting? false:true;
        let status = this.settings.AutoFormatting?'on':'off';
        new Notice('Autoformat is '+ status +'!');
    }

	handleBeforeInput=(ev: InputEvent):void=>
	{
		if(this.settings.Debug) console.log("===> Before Input");
		if(!this.settings.FullWidthCharacterEnhance) return;
		let editor = this.getEditor();
		if(!editor) return;

		// obsidian 在 live preview 模式下会有错误选中区域的 Bug
		let specialChar = new Set(['【', '】','·', '=', '“', '”', '《', '》', '‘', '’', '（', '）', '￥']);

		if(editor.somethingSelected() && editor.getSelection()!=""){
			// console.log('Before Change Selection:', editor.getSelection(), "替换内容",ev.data);
			if(ev.data.length!=1 || specialChar.has(editor.getSelection())) return;

			let selectedFormatRange = editor.listSelections()[0];
			let begin: EditorPosition;
			let end: EditorPosition;
			let anchor: EditorPosition;
			let head: EditorPosition;
			if(isPositionBefore(selectedFormatRange.anchor, selectedFormatRange.head))
			{
				begin = selectedFormatRange.anchor;
				
			}
			else{
				begin = selectedFormatRange.head;
			}
			end = {line: begin.line, ch: begin.ch+1};
			anchor = {line: selectedFormatRange.anchor.line, ch: selectedFormatRange.anchor.ch+1};
			head = {line: selectedFormatRange.head.line, ch: selectedFormatRange.head.ch+1};

			let text: string;
			switch(ev.data)
			{
				case '【':
				case '】':
					text = "["+editor.getSelection()+"]";
					break;
				case '·':
					text = "`"+editor.getSelection()+"`";
					this.reparseArticle.check = true;
					this.reparseArticle.beginLineNumber = begin.line
					break;
				case '￥':
				case '¥':
					text = "$"+editor.getSelection()+"$";
					this.reparseArticle.check = true;
					this.reparseArticle.beginLineNumber = begin.line
					break;
				case '“':
				case '”':
					text = "“"+editor.getSelection()+"”";
					break;
				case '‘':
				case '’':
					text = '‘'+editor.getSelection()+'’';
					break;
				case '《':
				case '》':
					text = '《'+editor.getSelection()+'》';
					break;
                case '（':
                case '）':
					console.log("I am here")
                    text = '（'+editor.getSelection()+'）';
					break;
                case '{':
                case '}':
                    text = '{'+editor.getSelection()+'}';
					break;
				default:
					this.prevCursor = begin;
					let regReparse = /^[\-\$\`]|[\-\$\`]\s*$|\n/m;
					let reg = /[-\`\$]/;
					if(regReparse.test(editor.getSelection()) || reg.test(ev.data))
					{
						this.reparseArticle.check = true;
						this.reparseArticle.beginLineNumber = begin.line
					}
					this.selectionTextChange = null;					
					return;
			}

			this.selectionTextChange = {
				begin: begin,
				end: end,
				text: text,
				selection: true,
				selectionAnchor:anchor,
				selectionHead: head
			}
		}
	}

	handleKeydown=(evt: KeyboardEvent):void=>
	{
		// console.log('key down', evt.key, evt.ctrlKey, evt.shiftKey);
		if(this.settings.Debug)
        {
            console.log('=========================')
            console.log('keydown:', evt.key);
        }

		let editor = this.getEditor();
		if(!editor) return;
		this.keyDownFlag = true;
		if(evt.key === 'Control') this.ctrlDownLineIndex = editor.getCursor().line;
		// console.log('text after key down:', editor.getLine(editor.getCursor().line));
	}
	
	handleKeyup=(evt: KeyboardEvent):void=>
	{
		if(this.settings.Debug)
        {
            console.log('=========================')
            console.log('keyup:', evt.key);
        }

		let editor = this.getEditor();
		if(!editor) return;
		this.keyDownFlag = false;

		if(evt.key === 'Process')
		{
			return;
		}

		// 更新选中的文本，用于后续删除键触发时判断是否需要重新解析文本
		if(evt.key!='Backspace' && evt.key!='Enter' && evt.key!='Delete')
		{
			this.updateSelection(editor);
		}
		// if(this.keyUpdateCursor.has(evt.key))		

		// 处理选中文本的情况下按键使用特定的全角符号
		if(this.selectionTextChange && this.settings.AutoFormatting)
		{
			editor.replaceRange(this.selectionTextChange.text, this.selectionTextChange.begin, this.selectionTextChange.end);
			editor.setSelection(this.selectionTextChange.selectionAnchor, this.selectionTextChange.selectionHead);
			this.prevCursor = this.selectionTextChange.selectionHead;
			this.selectionTextChange = null;
			this.editorChanged = false;
			return;
		}
		this.selectionTextChange = null;
		
		// 在以下情况下插件不响应
		if(!this.editorChanged || this.settings.AutoFormatting===false)
		{
            this.prevCursor = editor.getCursor();
			this.editorChanged = false;
			return;
		}

		// 处理撤回、反撤回和剪切，需要重新解析文档
		if(evt.ctrlKey && (evt.key==='z' || evt.key==='y' || evt.key==='x'))
		{
			let lineReparseBegin = editor.getCursor().line;
			if(lineReparseBegin>this.ctrlDownLineIndex)
			{
				lineReparseBegin = this.ctrlDownLineIndex;
			}
			this.reparseArticle = {check: true, beginLineNumber: lineReparseBegin};
			this.updateArticleParts(editor);
			this.prevCursor = editor.getCursor();
			this.editorChanged = false;
			// console.log('reparse begin:', lineReparseBegin);
			return;
		}

		// 删除文本后需要重新解析文本
		let regTestReparse = /^[\-\$`]|[\-\$\`]\s*$|\n|\$\$|---|```/gm;
		// let setTestReparse = new Set(['\n', '-', '$', '`']);
		switch(evt.key)
		{
			case 'Backspace':
				if((this.selectedText!="" && !regTestReparse.test(this.selectedText)) || 
				    (this.selectedText==="" && !regTestReparse.test(this.charBeforeCursor)))
				{
					this.reparseArticle.check = false;
				}
				else{
					this.reparseArticle = {check: true, beginLineNumber:editor.getCursor().line};
				}
				this.updateSelection(editor);
				this.prevCursor = editor.getCursor();
				this.editorChanged = false;
				this.updateArticleParts(editor);
				return;
			case 'Delete':
				if((this.selectedText!="" && !regTestReparse.test(this.selectedText)) || 
				    (this.selectedText==="" && !regTestReparse.test(this.charAfterCursor)))
				{
					this.reparseArticle.check = false;
				}
				else{
					this.reparseArticle = {check: true, beginLineNumber:editor.getCursor().line};
				}
				this.updateSelection(editor);
				this.prevCursor = editor.getCursor();
				this.editorChanged = false;
				this.updateArticleParts(editor);
				return;
			case 'Enter':
				let prevLineIndex = editor.getCursor().line-1;
				prevLineIndex = prevLineIndex>0?prevLineIndex:0;
				if(!evt.ctrlKey) this.reparseArticle = {check: true, beginLineNumber:editor.getCursor().line-1};
				///if get new line, format Prev line
				this.updateArticleParts(editor);
				if(this.isTextPart(prevLineIndex))
				{
					let prevLineEndCursor = {line: prevLineIndex, ch: editor.getLine(prevLineIndex).length}				
					this.updateLine(editor, prevLineIndex, prevLineEndCursor, this.settings, prevLineEndCursor, editor.getCursor());
				}
				this.updateSelection(editor);
				this.prevCursor = editor.getCursor();
				this.editorChanged = false;
				return;
			default:
				break;
		}
		
		let cursor = editor.getCursor();
		// 当光标前几个字符为 "$$" / "```" / "---" 时，从当前行重新解析全文
		{
			
			let twoCharactersBeforeCursor = editor.getRange(
                {line: cursor.line, ch:cursor.ch-2},
                {line: cursor.line, ch:cursor.ch}
            );
			let threeCharactersBeforeCursor = editor.getRange(
                {line: cursor.line, ch:cursor.ch-3},
                {line: cursor.line, ch:cursor.ch}
            );

			if(twoCharactersBeforeCursor === "$$" || threeCharactersBeforeCursor === "```" || threeCharactersBeforeCursor == "---")
			{
				this.reparseArticle = {check: true, beginLineNumber: cursor.line};
			}
		}

		// 中文全角符号连续输入增强功能
		if(this.settings.FullWidthCharacterEnhance && !editor.somethingSelected())
        {
			
            let twoCharactersBeforeCursor = editor.getRange(
				{line: cursor.line, ch:cursor.ch-2},
				{line: cursor.line, ch:cursor.ch}
			);
			let charBeforeCursor = editor.getRange(
				{line: cursor.line, ch:cursor.ch-1},
				{line: cursor.line, ch:cursor.ch}
			);
            // let twoCharactersNearCursor = editor.getRange(
            //     {line: cursor.line, ch:cursor.ch-1},
            //     {line: cursor.line, ch:cursor.ch+1}
            // );
            let character2cursor1 = editor.getRange(
                {line: cursor.line, ch:cursor.ch-2},
                {line: cursor.line, ch:cursor.ch+1}
            );
            let twoCharactersAfterCursor = editor.getRange(
                {line: cursor.line, ch:cursor.ch},
                {line: cursor.line, ch:cursor.ch+2}
            );
			
            switch(evt.key)
            {
                case '$':
                case '￥':
                case '¥':
                    if(twoCharactersBeforeCursor === '￥￥' || twoCharactersBeforeCursor === '¥¥')
                    {
                        editor.replaceRange(
                            '$$',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
						this.reparseArticle = {check: true, beginLineNumber:cursor.line};
                    }
					else if(twoCharactersBeforeCursor === '$$')
					{
						editor.setCursor({line: cursor.line, ch:cursor.ch-1});
						this.reparseArticle = {check: true, beginLineNumber:cursor.line};
					}
                    else if(character2cursor1==='$￥$' || character2cursor1==='$¥$')
                    {
                        editor.replaceRange(
                            '$$',
                            {line: cursor.line, ch:cursor.ch-1},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor(cursor);
						this.reparseArticle = {check: true, beginLineNumber:cursor.line};
                    }
                    break;
                
                case '[':
                case '【':
                    if(twoCharactersBeforeCursor === '[[' && twoCharactersAfterCursor!=']]' &&!editor.somethingSelected())
                    {
                        editor.replaceRange(
                            '[[]]',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor(cursor);
                    }
                    break;
                
                case '`':
                case '·':
                    if(twoCharactersBeforeCursor === '··')
                    {
                        editor.replaceRange(
                            '``',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
						this.reparseArticle = {check: true, beginLineNumber:cursor.line};
                    }
                    else if(character2cursor1==='`·`')
                    {
                        editor.replaceRange(
                            '`',
                            {line: cursor.line, ch:cursor.ch-1},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch+1});
						this.reparseArticle = {check: true, beginLineNumber:cursor.line};
                    }
                    break;
                case '：':
                case ':':
                    if(twoCharactersBeforeCursor === '：：')
                    {
                        editor.replaceRange(
                            ':',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
				case `,`:
				case `，`:
					if(twoCharactersBeforeCursor === '，，')
                    {
                        editor.replaceRange(
                            ',',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
                case '、':
                case '/':
					if(cursor.ch===1 && charBeforeCursor==='、')
					{
						editor.replaceRange(
                            '/',
                            {line: cursor.line, ch:cursor.ch-1},
                            {line: cursor.line, ch:cursor.ch}
                        );
					}
                    else if(twoCharactersBeforeCursor === '、、')
                    {
                        editor.replaceRange(
                            '/',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
                case '。':
                case '.':
                    if(twoCharactersBeforeCursor === '。。')
                    {
                        editor.replaceRange(
                            '.',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
				case `;`:
				case `；`:
					if(twoCharactersBeforeCursor === '；；')
                    {
                        editor.replaceRange(
                            ';',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
                case '(':
                case '（':
                    if(twoCharactersBeforeCursor === '（（')
                    {
                        editor.replaceRange(
                            '()',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
                case '》':
                case '>':
					if(cursor.ch===1 && charBeforeCursor==='》')
					{
						editor.replaceRange(
                            '>',
                            {line: cursor.line, ch:cursor.ch-1},
                            {line: cursor.line, ch:cursor.ch}
                        );
					}
                    else if(twoCharactersBeforeCursor === '》》')
                    {
                        editor.replaceRange(
                            '>',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
					else if(twoCharactersBeforeCursor === '>》')
					{
						editor.replaceRange(
                            '>',
                            {line: cursor.line, ch:cursor.ch-1},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor(cursor);
					}
                    break;
                case '<':
                case '《':
                    if(twoCharactersBeforeCursor === '《《')
                    {
                        editor.replaceRange(
                            '<',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
				case '!':
				case '！':
					if(twoCharactersBeforeCursor === '！！')
                    {
                        editor.replaceRange(
                            '!',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
				case '|':
				case '｜':
					if(twoCharactersBeforeCursor === '｜｜')
                    {
                        editor.replaceRange(
                            '|',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    break;
                default:
                    break;
            }
        }
		cursor = editor.getCursor();
		this.updateSelection(editor);

		// 重新解析全文
		this.updateArticleParts(editor);

		// 在非文本行编辑时，无需格式化
		if(getLineTypeFromArticleParts(cursor.line, this.articleParts) !=LineType.text)
		{
			this.prevCursor = editor.getCursor();
			this.editorChanged = false;
            return;
		}

		//------------------对文本进行格式化---------------------
		this.updateLine(editor, cursor.line, cursor, this.settings, this.prevCursor);
		this.prevCursor = editor.getCursor();
		this.editorChanged = false;
	}

	isTextPart=(lineIndex:number):boolean=>
	{
		if(getLineTypeFromArticleParts(lineIndex, this.articleParts) === LineType.text)
		{
            return true;
		}
		return false;
	}

	handleClick=()=>
	{
		if(this.settings.Debug) console.log('===>Click event triggered');
		let editor = this.getEditor();
		if(!editor) return;
		this.prevCursor = editor.getCursor();
		this.updateSelection(editor);
	}

	handleFileOpen=(file: TFile | null):void=>
	{
		if(file!=null)
		{
			if(this.settings.Debug) console.log("===>File open:", file.vault.getName()+'/'+file.path);
			this.reparseArticle = {check: true, beginLineNumber: 0};
			this.articleParts = null;
		}
		
	}

	handlePaste=(evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView):void=>
	{
		let cursor = editor.getCursor();
		if(this.settings.Debug)
		{
			console.log('===>Before-Paste');
			// console.log(editor.getLine(cursor.line));
		}
		this.reparseArticle = {check: true, beginLineNumber: cursor.line};
		this.updateArticleParts(editor);
	}

	handleChange=(editor: Editor, markdownView: MarkdownView):void=>
	{
		if(this.settings.Debug)
		{
			console.log('===>Change Event');
			// console.log(editor.getLine(editor.getCursor().line));
		}		
		this.editorChanged = true;
	}

	handleSelectBegin=(ev: Event):void=>
	{
		if(this.keyDownFlag) return;
		if(this.settings.Debug)
		{
			console.log("===>Select Event");
		}
		let editor = this.getEditor();
		if(!editor) return;
		this.updateSelection(editor);
	}

	updateArticleParts=(editor: Editor):void=>
	{
		if(this.reparseArticle.check || this.articleParts === null)
		{
			this.articleParts = reparseArticleParts(editor.getValue(), this.articleParts, this.reparseArticle.beginLineNumber, this.settings.Debug);
			this.reparseArticle.check = false;
			// if(this.settings.Debug) this.printArticleParts(editor);
		}
	}

	printArticleParts=(editor: Editor):void=>
	{
		let article = editor.getValue();
		let lines = article.split('\n');
		console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
		for (let i=0;i<this.articleParts.length; i++)
		{
			console.log("Article Part:", this.articleParts[i].type, this.articleParts[i].begin, this.articleParts[i].end);
			for(let j=this.articleParts[i].begin; j<this.articleParts[i].end;j++)
			{
				console.log(lines[j]);
			}
		}
		console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
	}

	updateSelection=(editor: Editor):void=>
	{
		this.selectedText = editor.getSelection();
		this.updateCharAroundCursor(editor);
	}

	updateCharAroundCursor=(editor: Editor):void=>
	{
		// if(this.settings.Debug) console.log("update selection:\n" + this.selectedText);
		if(this.selectedText!="") return;
		let cursor = editor.getCursor();
		
		if(cursor.ch!=0){
			this.charBeforeCursor = editor.getRange({line:cursor.line, ch:cursor.ch-1}, cursor);
		}
		else{
			this.charBeforeCursor = cursor.line!=0?"\n":"";
		}

		if(cursor.ch != editor.getLine(cursor.line).length)
		{
			this.charAfterCursor = editor.getRange(cursor, {line:cursor.line, ch:cursor.ch+1});
		}
		else{
			this.charAfterCursor = cursor.line!=editor.lineCount()-1?"\n":"";
		}

		// if(this.settings.Debug)
		// {
		// 	console.log("charBeforeCursor", this.charBeforeCursor);
		// 	console.log("charAfterCursor", this.charAfterCursor);
		// }
	}

	updateLine=(editor: Editor, lineIndex: number, curCursor: EditorPosition, settings: FormatSettings, 
		prevCursor?: EditorPosition, setCursor?: EditorPosition):void=>
	{
		let formattedChange = formatLine(editor.getLine(lineIndex), curCursor, this.settings, this.prevCursor);
		let resultLine = formattedChange[0];
		let resultCurosrCh: number = formattedChange[1];
		let inlineChangeList: InlineChange[]= formattedChange[2];

		// let originLineString = editor.getLine(lineIndex);
		// let cursorLineBegin = {line: lineIndex, ch:0};
		// let cursorLineEnd = {line: lineIndex, ch:originLineString.length};
		// editor.replaceRange(originLineString, cursorLineBegin, cursorLineEnd);

		// Apply Changes
		if(inlineChangeList.length != 0)
        {
            let offset = 0;
            for(let i=0;i<inlineChangeList.length;i++)
            {
                let changeBegin:EditorPosition = {
                    line: lineIndex,
                    ch: inlineChangeList[i].begin+offset
                }
                let changeEnd:EditorPosition = {
                    line: lineIndex,
                    ch: inlineChangeList[i].end+offset
                }
                offset += inlineChangeList[i].text.length - inlineChangeList[i].origin.length;
                editor.replaceRange(inlineChangeList[i].text, changeBegin, changeEnd);
            }
			if(!setCursor)
			{
				editor.setCursor({
					line: lineIndex,
					ch: resultCurosrCh
				});
			}
			else
			{
				editor.setCursor(setCursor);
			}
			// console.log('cursor ch', resultCurosrCh);            
			editor.focus();
        }
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class EasyTypingSettingTab extends PluginSettingTab {
	plugin: EasyTypingPlugin;

	constructor(app: App, plugin: EasyTypingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		// containerEl.createEl('h2', {text: 'Settings for Easy Typing.'});

        containerEl.createEl('a', {text: 'More detail is in Github: easy-typing-obsidian', href:'https://github.com/Yaozhuwa/easy-typing-obsidian'});
		containerEl.createEl('h2', {text: '总开关 (Master Switch)'});

		new Setting(containerEl)
		.setName("Auto formatting when typing")
		.setDesc("是否在编辑文档时自动格式化文本")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.AutoFormatting)
			.onChange(async (value)=>{
				this.plugin.settings.AutoFormatting = value;
				console.log("AutoFormatting:",value);
				await this.plugin.saveSettings();
			});
		});

		containerEl.createEl('h2', {text: '详细规则开关 (Sub Switches)'});

		new Setting(containerEl)
		.setName("Full-Width symbol input enhancement")
		.setDesc("全角符号输入增强")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.FullWidthCharacterEnhance).onChange(async (value)=>{
				this.plugin.settings.FullWidthCharacterEnhance = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between Chinese and English/number")
		.setDesc("在中文和英文/数字间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.ChineseEnglishSpace).onChange(async (value)=>{
				this.plugin.settings.ChineseEnglishSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Delete the Space between Chinese characters")
		.setDesc("在中文字符间去除空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.ChineseNoSpace).onChange(async (value)=>{
				this.plugin.settings.ChineseNoSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Smartly insert space between text and punctuation")
		.setDesc("在文本和标点间智能空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.PunctuationSpace).onChange(async (value)=>{
				this.plugin.settings.PunctuationSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Capitalize the first letter of every sentence")
		.setDesc("英文每个句首字母大写")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.Capitalization).onChange(async (value)=>{
				this.plugin.settings.Capitalization = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between inline code and text")
		.setDesc("在 `行内代码` 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.InlineCodeSpace).onChange(async (value)=>{
				this.plugin.settings.InlineCodeSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between inline formula and text")
		.setDesc("在 $行内公式$ 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.InlineFormulaSpace).onChange(async (value)=>{
				this.plugin.settings.InlineFormulaSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between link and text")
		.setDesc("在 [[wikilink]] mdlink 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.LinkSpace).onChange(async (value)=>{
				this.plugin.settings.LinkSpace = value;
				await this.plugin.saveSettings();
			});
		});

        new Setting(containerEl)
		.setName("Smart Space between link and text")
		.setDesc("在 [[wikilink]] mdlink 和文本间智能空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.LinkSmartSpace).onChange(async (value)=>{
				this.plugin.settings.LinkSmartSpace = value;
				await this.plugin.saveSettings();
			});
		});

		containerEl.createEl('h2', {text: '自定义正则 (Custom regular expressions)'});
        new Setting(containerEl)
		.setName("User Defined RegExp Switch")
		.setDesc("自定义正则表达式开关，匹配到的内容不进行格式化")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value)=>{
				this.plugin.settings.UserDefinedRegSwitch = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between User Defined Part(selected by RegExp) and text")
		.setDesc("在用户自定义区块(正则表达式选择)和文本之间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.UserPartSpace).onChange(async (value)=>{
				this.plugin.settings.UserPartSpace = value;
				await this.plugin.saveSettings();
			});
		});

        new Setting(containerEl)
		.setName("User defined RegExp to ignore, one expression per line")
		.setDesc("用户自定义正则表达式，匹配到的内容不进行格式化，每行一个表达式，行尾不要随意加空格")
		.addTextArea((text) =>
			text
			.setPlaceholder(':\\w*:\n{{.*?}}')
			.setValue(this.plugin.settings.UserDefinedRegExp)
			.onChange(async (value) => {
				this.plugin.settings.UserDefinedRegExp = value;
                if(this.plugin.settings.Debug) console.log("regExp changed:", value);
				await this.plugin.saveSettings();
			})
		);

        containerEl.createEl('a', {text: 'RegExp: 正则表达式', href:'https://javascript.ruanyifeng.com/stdlib/regexp.html#'});

        containerEl.createEl('h2', {text: 'Debug'});
        new Setting(containerEl)
		.setName("Print debug info in console")
		.setDesc("在控制台输出调试信息")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.Debug).onChange(async (value)=>{
				this.plugin.settings.Debug = value;
				await this.plugin.saveSettings();
			});
		});

	}
}
