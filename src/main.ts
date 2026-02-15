import {Editor, MarkdownView, Menu, Notice, Platform, Plugin, WorkspaceLeaf} from 'obsidian';
import {EditorState, Prec, Transaction, TransactionSpec} from '@codemirror/state';
import {DEFAULT_SETTINGS, EasyTypingSettings, EasyTypingSettingTab, PairString} from "./settings"
import {EditorView, keymap, ViewUpdate} from '@codemirror/view';
import {
	getTypeStrOfTransac,
	print,
	setDebug,
	string2pairstring,
} from './utils'
import {getPosLineType, LineFormater, LineType} from './core'
import { isCodeBlockInPos, getCodeBlockInfoInPos } from './syntax';
import { tabstopsStateField, removeAllTabstops, addTabstopsEffect, isInsideCurTabstop, hasTabstops } from './tabstops_state_field';
import { tabstopSpecsToTabstopGroups } from './tabstop';
import { RuleEngine, TxContext, RuleType, RuleScope } from './rule_engine';
import { RuleManager } from './rule_manager';
import { toggleComment } from './comment_toggle';
import { triggerCvtRule, triggerPuncRectify } from './rule_processor';
import { isCurrentFileExclude as isCurrentFileExcludeFn, formatArticle, formatSelectionOrCurLine, preFormatOneLine, formatOneLine, deleteBlankLines, convert2CodeBlock, switchAutoFormatting } from './formatting_commands';
import { handleTabDown, handleEnter, handleBackspace, handleShiftEnter, handleModA, goNewLineAfterCurLine, selectBlockInCursor, onKeyup } from './keyboard_handlers';


export default class EasyTypingPlugin extends Plugin {
	settings: EasyTypingSettings;
	halfToFullSymbolMap: Map<string, string>;
	Formater: LineFormater;
	CurActiveMarkdown: string;

	lang: string;

	compose_begin_pos: number;
	compose_end_pos: number;
	compose_need_handle: boolean;

	onFormatArticle: boolean;
	TaboutPairStrs: PairString[];
	ruleManager: RuleManager;
	get ruleEngine(): RuleEngine { return this.ruleManager.ruleEngine; }


	async onload() {
		await this.loadSettings();
		this.ruleManager = new RuleManager(this.app, this.manifest, this.settings, () => this.saveSettings());
		await this.ruleManager.initRuleEngine();
		this.halfToFullSymbolMap = new Map([
			[".", "。"],
			[",", "，"],
			['?', '？'],
			['!', '！']
		]);

		let TaboutPairStrs = ["【|】", "（|）", "《|》", "\u201C|\u201D", "\u2018|\u2019",
						   "「|」", "『|』", "'|'", "\"|\"", "$$|$$", '$|$', '__|__', '_|_',
							"==|==", "~~|~~", "**|**", '*|*', "[[|]]", '[|]',"{|}", "(|)", "<|>"];
		this.TaboutPairStrs = TaboutPairStrs.map((s:string)=>string2pairstring(s));

		this.CurActiveMarkdown = "";

		this.compose_need_handle = false;

		this.Formater = new LineFormater();

		this.onFormatArticle = false;

		// 确保 settings 已正确加载
		if (!this.settings) {
			console.error('EasyTyping: Settings not loaded properly, using defaults');
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
		}
		
		setDebug(this.settings.debug);

		this.registerEditorExtension([
			EditorState.transactionFilter.of(this.transactionFilterPlugin),
			EditorView.updateListener.of(this.viewUpdatePlugin),
			Prec.highest(EditorView.domEventHandlers({
				"keyup": (event: KeyboardEvent, view: EditorView) => onKeyup(this, event, view)
			})),
			tabstopsStateField.extension,
		]);


		this.registerEditorExtension(Prec.highest(keymap.of([
			{
				key: "Tab",
				run: (v: EditorView): boolean => handleTabDown(this, v)
			},
			{
				key: "Enter",
				run: (v: EditorView): boolean => handleEnter(this, v)
			},
			{
				key: "Mod-a",
				run: (v: EditorView): boolean => handleModA(this, v)
			},
			{
                key: "Backspace",
                run: (v: EditorView): boolean => {
					if (!this.settings.BetterBackspace) return false;
                    return handleBackspace(v);
                }
            },
			{
				key: "Shift-Enter",
				run: (v: EditorView): boolean => handleShiftEnter(this, v)
			},
		])));

		this.lang = window.localStorage.getItem('language');
		let command_name_map = this.getCommandNameMap();

		this.addCommand({
			id: "easy-typing-format-article",
			name: command_name_map.get("format_article"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				formatArticle(this, editor, view);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "s"
			}],
		});

		this.addCommand({
			id: "easy-typing-select-block",
			name: command_name_map.get("select_block"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				selectBlockInCursor(this, editor.cm as EditorView);
			},
		});

		this.addCommand({
			id: "easy-typing-format-selection",
			name: command_name_map.get("format_selection"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				formatSelectionOrCurLine(this, editor, view);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "l"
			}],
		});

		this.addCommand({
			id: "easy-typing-delete-blank-line",
			name: command_name_map.get("delete_blank_line"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				deleteBlankLines(this, editor);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "k"
			}],
		});

		this.addCommand({
			id: "easy-typing-goto-new-line-after-cur-line",
			name: command_name_map.get("goto_new_line_after_cur_line"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				goNewLineAfterCurLine(this, editor.cm as EditorView);
			},
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
		});

		this.addCommand({
			id: "easy-typing-insert-codeblock",
			name: command_name_map.get("insert_codeblock"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				convert2CodeBlock(this, editor);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "n"
			}],
		});

		this.addCommand({
			id: "easy-typing-format-switch",
			name: command_name_map.get("switch_autoformat"),
			callback: () => switchAutoFormatting(this),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: "tab"
			}],
		});

		this.addCommand({
			id: "easy-typing-paste-without-format",
			name: command_name_map.get("paste_wo_format"),
			editorCallback: (editor) => this.normalPaste(editor),
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "v",
				},
			],
		});


		this.addCommand({
			id: "easy-typing-toggle-comment",
			name: command_name_map.get("toggle_comment"),
			editorCallback: (editor: Editor, view: MarkdownView) => toggleComment(editor.cm as EditorView),
			hotkeys: [{ modifiers: ["Mod"], key: "/" }],
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EasyTypingSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf) => {
			if (leaf.view.getViewType() == 'markdown') {
				let file = this.app.workspace.getActiveFile();
				if (file != null && this.CurActiveMarkdown != file.path) {
					this.CurActiveMarkdown = file.path;
					if (this.settings?.debug)
						new Notice('new md-file open: ' + file.path)
				}
			}
		}));

		//判断当前是否为MAC系统
		if (Platform.isMacOS && this.settings.FixMacOSContextMenu) {
			// 检测鼠标右键呼出菜单的事件
			this.registerEvent(this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				// console.log('editor-menu', menu, editor, view);
				if (editor.listSelections().length != 1) return;
				let selection = editor.listSelections()[0];
				let selected = editor.getSelection();
				// console.log('selected', selected, selected=='\n');
				// console.log('selection', selection);
				if (selected=='\n')
				{
					editor.setSelection(selection.anchor, selection.anchor);
				}
			}));
		}

		// this.registerEvent(this.app.workspace.on('file-open', (file: TFile | null) => {
		// 	if (file != null) {
		// 		let editor = this.getEditor();
		// 		if (editor === null) return;
		// 		this.ContentParser.parseNewArticle(editor.getValue());
		// 		if (this.settings?.debug) {
		// 			new Notice("EasyTyping: Parse New Article: " + file.vault.getName() + '/' + file.path);
		// 			// if (this.settings.debug) this.ContentParser.print();
		// 		}
		// 	}
		// }));
		console.log("Easy Typing Plugin loaded.")
	}

	onunload() {
		console.log("Easy Typing Plugin unloaded.")
	}

	getDefaultIndentChar = () => {
		// console.log('useTab, tabSize', this.app.vault.config.useTab, this.app.vault.config.tabSize);
		let useTab = this.app.vault.config.useTab === undefined ? true : false;
		let tabSize = this.app.vault.config.tabSize == undefined ? 4 : this.app.vault.config.tabSize;
		let default_indent = useTab ? '\t' : ' '.repeat(tabSize);
		return default_indent;
	}

	transactionFilterPlugin = (tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		const changes: TransactionSpec[] = [];
		if (!tr.docChanged) return tr;
		let selected = tr.startState.selection.asSingle().main.anchor != tr.startState.selection.asSingle().main.head;

		let changeTypeStr = getTypeStrOfTransac(tr);

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let changedStr = tr.startState.sliceDoc(fromA, toA);
			let changestr_ = changedStr.replace(/\s/g, '0')
			let insertedStr = inserted.sliceString(0);
			if (this.settings?.debug)
			{
				console.log("[TransactionFilter] type, fromA, toA, changed, fromB, toB, inserted");
				console.log(changeTypeStr, fromA, toA, changedStr,fromB, toB, insertedStr);
			}

			// 表格编辑时直接返回，解决表格内容编辑有时候会跳出聚焦状态的 Bug
			if (getPosLineType(tr.startState, fromA)==LineType.table) return tr;

			// ========== Selection Replace ============
			if (this.settings.SelectionEnhance) {
				if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA != toA && ((fromB + 1 === toB)||insertedStr=='——'||insertedStr=='……')) {
					const selCtx: TxContext = {
						kind: RuleType.SelectKey,
						docText: tr.startState.doc.toString(),
						selection: { from: fromA, to: toA },
						inserted: insertedStr,
						changeType: changeTypeStr,
						scopeHint: RuleScope.All,
						key: insertedStr,
						debug: this.settings?.debug,
					};
					const selResult = this.ruleEngine.process(selCtx);
					if (selResult) {
						const tabstopGroups = tabstopSpecsToTabstopGroups(selResult.tabstops);
						if (tabstopGroups.length > 0) {
							changes.push({
								changes: { from: selResult.matchRange.from, to: selResult.matchRange.to, insert: selResult.newText },
								selection: tabstopGroups[0].toEditorSelection(),
								effects: [addTabstopsEffect.of(tabstopGroups)],
								userEvent: "EasyTyping.change"
							});
						} else {
							changes.push({
								changes: { from: selResult.matchRange.from, to: selResult.matchRange.to, insert: selResult.newText },
								selection: { anchor: selResult.cursor },
								userEvent: "EasyTyping.change"
							});
						}
						tr = tr.startState.update(...changes);
						return tr;
					}
				}
			}

			// 在代码块中粘贴时智能添加缩进
			if (this.settings.BetterCodeEdit && changeTypeStr.contains('paste') && fromA==fromB && 
					isCodeBlockInPos(tr.startState, fromA)){
				print("检测到在代码块中粘贴")
				let line = tr.startState.doc.lineAt(fromB).text;
				let base_indent_num = getCodeBlockInfoInPos(tr.startState, fromA)?.indent;
				let base_indent = base_indent_num==0 ? '' : ' '.repeat(base_indent_num);
				let inserted_lines = insertedStr.split('\n');
				
				if(inserted_lines.length>1){
					// 找出所有行的最小共同缩进
					let min_indent_space = Infinity;
					for (let line of inserted_lines){
						if (!/^\s*$/.test(line)) {  // 忽略空行
							let indent = line.match(/^\s*/)[0].length;
							min_indent_space = Math.min(min_indent_space, indent);
						}
					}

					// 删除每行的最小缩进，并给除第一行以外的行添加基础缩进
					let adjusted_lines = inserted_lines.map((line:string, index:number) => {
						let trimmed_line = line.substring(min_indent_space);
						trimmed_line = trimmed_line.replace(/[\t]/g, this.getDefaultIndentChar())
						if (index === 0) {
							return trimmed_line;  // 第一行不添加额外缩进
						} else {
							return base_indent + trimmed_line;  // 其他行添加基础缩进
						}
					});

					// console.log('default indent: ', this.getDefaultIndentChar().length)
					let new_insertedStr = adjusted_lines.join('\n');
					changes.push({
						changes: {from: fromA, to: toA, insert: new_insertedStr},
						selection: {anchor: fromA+new_insertedStr.length},
						userEvent: "EasyTyping.change"
					});
					tr = tr.startState.update(...changes);
					return tr;
				}				
			}

			// 在引用块或者列表块中粘贴时，自动添加缩进和引用/列表符号
			if (this.settings.BaseObEditEnhance && changeTypeStr.contains('paste') && fromA==fromB && fromA == tr.startState.doc.lineAt(toA).to){
				// 检查是否在列表或引用块中
				const lineContent = tr.startState.doc.lineAt(toA).text;
				const listMatch = lineContent.match(/^(\s*)([-*+] \[.\]|[-*+]|\d+\.)\s/);
				const quoteMatch = lineContent.match(/^(\s*)(>+)(\s)?/);
				if (listMatch || quoteMatch){
					let prefix = listMatch ? listMatch[1]+listMatch[2]+' ' : quoteMatch[1]+quoteMatch[2]+' ';
					let indent_num = listMatch ? listMatch[1].length : quoteMatch[1].length;
					let indent_str = indent_num==0 ? '' : ' '.repeat(indent_num);
					let inserted_lines = insertedStr.split('\n');
					// 找出所有行的最小共同缩进
					let min_indent_space = Infinity;
					for (let line of inserted_lines){
						if (!/^\s*$/.test(line)) {  // 忽略空行
							let indent = line.match(/^\s*/)[0].length;
							min_indent_space = Math.min(min_indent_space, indent);
						}
					}
					// 考虑粘贴列表时
					let paste_list = true;
					for (let line of inserted_lines){
						if (line.match(/^(\s*)([-*+] \[.\]|[-*+]|\d+\.)\s/) || /^\s*$/.test(line)){
							continue;
						}
						else {
							let indent = line.match(/^\s*/)[0].length;
							if (indent < min_indent_space+2){
								paste_list = false;
								break;
							}
						}
					}

					let adjusted_lines:string[] = [];
					if (paste_list && listMatch){
						adjusted_lines = inserted_lines.map((line:string, index:number) => {
							let trimmed_line = line.substring(min_indent_space);
							trimmed_line = trimmed_line.replace(/[\t]/g, this.getDefaultIndentChar())
							if (index === 0) {
								trimmed_line = trimmed_line.replace(/^([-*+] \[.\]|[-*+]|\d+\.)\s/, '');
								return trimmed_line;  // 第一行不添加额外缩进
							} else {
								return indent_str + trimmed_line;  // 其他行添加基础缩进
							}
						});
					}
					else {
						// 删除每行的最小缩进，并给除第一行以外的行添加基础缩进
						adjusted_lines = inserted_lines.map((line:string, index:number) => {
							let trimmed_line = line.substring(min_indent_space);
							trimmed_line = trimmed_line.replace(/[\t]/g, this.getDefaultIndentChar())
							if (index === 0) {
								return trimmed_line;  // 第一行不添加额外缩进
							} else {
								return prefix + trimmed_line;  // 其他行添加基础缩进
							}
						});
					}

					let new_insertedStr = adjusted_lines.join('\n');
					changes.push({
						changes: {from: fromA, to: toA, insert: new_insertedStr},
						selection: {anchor: fromA+new_insertedStr.length},
						userEvent: "EasyTyping.change"
					});
					tr = tr.startState.update(...changes);
					return tr;
				}
			}
			

			if (selected) return tr;

			// let test_s = "¥"
			// console.log( '¥', test_s == '￥')

			// 尝试解决微软旧版输入法的问题~
			if (this.settings.TryFixMSIME && 
				changeTypeStr == "input.type.compose" && 
				changedStr == '' && /^[\u4e00-\u9fa5]+$/.test(insertedStr)){
				print("MS-IME Compose detected:", insertedStr);
				tr = tr.startState.update(...changes);
				return tr;
			}

			let codeblockinfo = getCodeBlockInfoInPos(tr.startState, toA);
			// print(codeblockinfo, toA)
			// 列表下的代码块删除功能优化
			if (this.settings.BetterCodeEdit && changeTypeStr == "delete.backward" && !selected &&
				codeblockinfo && toA>tr.startState.doc.lineAt(codeblockinfo.start_pos).to
			) {
				let line_number = tr.startState.doc.lineAt(toA).number;
				let cur_line = tr.startState.doc.lineAt(toA);
				let list_code_indent = codeblockinfo.indent;

				if (list_code_indent !== 0) {
					print('list_code, indent: ', list_code_indent);
					if (toA == cur_line.from + list_code_indent) {
						changes.push({ changes: { from: tr.startState.doc.line(line_number-1).to, to: toA, insert: '' }, userEvent: "EasyTyping.change" });
						tr = tr.startState.update(...changes);
						return tr;
					}
					if (fromA>=cur_line.from && fromA < cur_line.from+list_code_indent && toA>cur_line.from+list_code_indent){
						changes.push({ changes: { from: cur_line.from+list_code_indent, to: toA, insert: '' }, userEvent: "EasyTyping.change" });
						tr = tr.startState.update(...changes);
						return tr;
					}
				}
			}

			// ========== delete code block pair ============
			if (changeTypeStr === "delete.backward") {
				// 处理删除代码块
				let line_content = tr.startState.doc.lineAt(toA).text;
				let next_line_content = tr.startState.doc.sliceString(toA, toA + line_content.length+1);
				if (/^\s*```$/.test(line_content) && '\n'+line_content==next_line_content) {
					changes.push({
						changes:{
							from: toA-3,
							to: toA+line_content.length+1,
							insert: ''
						},
						selection: { anchor: toA - 3 },
						userEvent: "EasyTyping.change"
					});
					tr = tr.startState.update(...changes);
					return tr;
				}
			}

			// Unified delete rules (intrinsic + user) via RuleEngine
			if (changeTypeStr === "delete.backward") {
				const delCtx: TxContext = {
					kind: RuleType.Delete,
					docText: tr.startState.doc.toString(),
					selection: { from: toA, to: toA },
					inserted: '',
					changeType: changeTypeStr,
					scopeHint: RuleScope.All,
					debug: this.settings?.debug,
				};
				const delResult = this.ruleEngine.process(delCtx);
				if (delResult) {
					const tabstopGroups = tabstopSpecsToTabstopGroups(delResult.tabstops);
					if (tabstopGroups.length > 0) {
						changes.push({
							changes: { from: delResult.matchRange.from, to: delResult.matchRange.to, insert: delResult.newText },
							selection: tabstopGroups[0].toEditorSelection(),
							effects: [addTabstopsEffect.of(tabstopGroups)],
							userEvent: "EasyTyping.change"
						});
					} else {
						changes.push({
							changes: { from: delResult.matchRange.from, to: delResult.matchRange.to, insert: delResult.newText },
							selection: { anchor: delResult.cursor },
							userEvent: "EasyTyping.change"
						});
					}
					tr = tr.startState.update(...changes);
					return tr;
				}
			}

			// 处理英文输入法下输入代码块
			if (changeTypeStr == 'input.type' && insertedStr =='`\n```' && this.settings.BaseObEditEnhance){
				const line_content = tr.startState.doc.lineAt(fromA).text;
				if (/^\s*``$/.test(line_content)){
					changes.push({
						changes: {from: fromA, to: toA, insert: '`\n'+line_content+'`'},
						selection: { anchor: fromA + 1 },
						userEvent: "EasyTyping.change"
					});
					tr = tr.startState.update(...changes);
					return tr;
				}
			}
			
			// 通常单字输入
			if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA === toA && fromB + 1 === toB) {
				// if (this.settings.debug) console.log("Input.type => ", insertedStr)
				// =========== basic convert rules ============
				// not support undo and redo
				if (this.settings.BaseObEditEnhance) {
					// 处理英文标点下``|的情况，光标自动跳转到中间
					if (insertedStr === '`' && 
						toA-tr.startState.doc.lineAt(toA).from>2 && 
						tr.startState.sliceDoc(toA-1, toA) === '`'
						&& tr.startState.sliceDoc(toA-2, toA-1) != '`'){
						changes.push({
							changes: {from:toA, insert:'`'},
							selection: { anchor: toA }, userEvent: "EasyTyping.change" 
						});
						tr = tr.startState.update(...changes);
						return tr;
					}

					// 处理中文输入法下输入代码块
					if (insertedStr == '·'){
						let line_content = tr.startState.doc.lineAt(fromA).text;
						let ch_pos = fromA - tr.startState.doc.lineAt(fromA).from;
						if (/^\s*``$/.test(line_content) && ch_pos==line_content.length-1){
							changes.push({
								changes: {from: fromA+1, to: toA+1, insert: '`\n'+line_content+'`'},
								selection: { anchor: fromA + 2 },
								userEvent: "EasyTyping.change"
							});
							tr = tr.startState.update(...changes);
							return tr;
						}
					}
				}
			}

		})
		return tr;
	}

	async normalPaste(editor: Editor): Promise<void> {
		let clipboardText = await navigator.clipboard.readText();
		if (clipboardText === null || clipboardText === "") return;

		if (this.settings?.debug) console.log("Normal Paste!!")
		const editorView = editor.cm as EditorView;
		let mainSelection = editorView.state.selection.asSingle().main;
		editorView.dispatch({
			changes: { from: mainSelection.from, to: mainSelection.to, insert: clipboardText },
			selection: {anchor: mainSelection.from + clipboardText.length},
			userEvent: "EasyTyping.paste"
		});
	}

	viewUpdatePlugin = (update: ViewUpdate) => {
		if (this.onFormatArticle === true) return;

		let cursor_changed = update.transactions.find(tr => tr.selection) != null;
		// console.log('cursor_changed', cursor_changed)
		
		if (hasTabstops(update.view) && (update.docChanged || cursor_changed) && !update.view.composing && !isInsideCurTabstop(update.view)) {
			removeAllTabstops(update.view);
		}
		if (hasTabstops(update.view) && update.transactions.find(tr => tr.isUserEvent("undo"))){
			removeAllTabstops(update.view);
		}

		let notSelected = true;
		let mainSelection = update.view.state.selection.asSingle().main;
		if (mainSelection.anchor != mainSelection.head) notSelected = false;
		if (!update.docChanged) return;

		let isExcludeFile = isCurrentFileExcludeFn(this);
		// console.log(this.CurActiveMarkdown, isExcludeFile)

		// if (this.settings.debug) console.log("-----ViewUpdateChange-----");
		let tr = update.transactions[0]
		let changeType = getTypeStrOfTransac(tr);

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let insertedStr = inserted.sliceString(0);
			let changedStr = tr.startState.doc.sliceString(fromA, toA);
			if (this.settings?.debug){
				console.log("[ViewUpdate] type, fromA, toA, changed, fromB, toB, inserted");
				console.log(changeType, fromA, toA, changedStr, fromB, toB, insertedStr)
				console.log("==>[Composing]", update.view.composing)
			}

			// table 内部不做处理，直接返回 => 配合 Obsidian 的机制
			if (getPosLineType(update.view.state, fromB) == LineType.table) {
				return;
			}

			let cursor = update.view.state.selection.asSingle().main;

			if (update.view.composing){
				if (this.compose_need_handle){
					this.compose_end_pos = cursor.anchor;
				}
				else{
					this.compose_need_handle = true;
					this.compose_begin_pos = fromA;
					this.compose_end_pos = cursor.anchor;
				}
				return;
			}

			let change_from = fromB;
			let change_to = toB;
			let composeEnd = false;
			if (this.compose_need_handle){
				composeEnd = true;
				this.compose_need_handle = false;
				change_from = this.compose_begin_pos;
				change_to = this.compose_end_pos;
			}

			if (changeType.contains('EasyTyping') || changeType=='undo' || changeType=='redo') return;
			// 判断每次输入结束
			if (changeType != 'none' && notSelected && changedStr.length<1 && !changeType.includes('delete')) {
				// 用户自定义转化规则
				if (triggerCvtRule(this, update.view, mainSelection.anchor)) return;
				if (composeEnd && triggerPuncRectify(this, update.view, change_from)) return;

				// 判断格式化文本
				// console.log("ready to format");
				// console.log("check is exclue file:", isExcludeFile)
				if (this.settings.AutoFormat && notSelected && !isExcludeFile &&
					 (changeType != 'none' || insertedStr=="\n")) {
					
					if (getPosLineType(update.view.state, change_from) == LineType.text || getPosLineType(update.view.state, change_from) == LineType.table){
						let changes = this.Formater.formatLineOfDoc(update.state, this.settings, change_from, cursor.anchor, insertedStr);
						if (changes != null) {
							update.view.dispatch(...changes[0]);
							update.view.dispatch(changes[1]);
							return;
						}
					}
				}
			}

			// 粘贴时自动格式化
			if (this.settings.AutoFormat && !isExcludeFile && changeType == "input.paste" && !Platform.isIosApp) {
				let updateLineStart = update.state.doc.lineAt(fromB).number;
				let updateLineEnd = update.state.doc.lineAt(toB).number;
				if (updateLineStart == updateLineEnd && getPosLineType(update.view.state, toB) == LineType.text) {
					let changes = this.Formater.formatLineOfDoc(update.state, this.settings, fromB, toB, insertedStr);
					if (changes != null) {
						update.view.dispatch(...changes[0]);
						// update.view.dispatch(changes[1]);
						return;
					}
				}
				else {
					let all_changes: TransactionSpec[] = [];
					let inserted_array = insertedStr.split("\n");
					let update_start = fromB
					for (let i = updateLineStart; i <= updateLineEnd; i++) {
						let real_inserted = inserted_array[i - updateLineStart];
						// console.log('real_inserted', real_inserted.replace(/\n/g, '\\n'))
						// console.log('update_doc_text', update.state.doc.sliceString(update_start, update_start + real_inserted.length).replace(/\n/g, '\\n'))
						let changes = this.Formater.formatLineOfDoc(update.state, this.settings, update_start, update_start + real_inserted.length, real_inserted);
						// console.log('changes', changes)
						if (changes != null) {
							all_changes.push(...changes[0]);
						}
						update_start += real_inserted.length + 1;
					}
					if (all_changes.length > 0) {
						update.view.dispatch(...all_changes);
						return;
					}
				}
			}
		});	// iterchanges end
	}

	isCurrentFileExclude(): boolean {
		return isCurrentFileExcludeFn(this);
	}

	getCommandNameMap(): Map<string, string> {
		const lang = window.localStorage.getItem('language');

		let command_name_map_en = new Map([
			["format_article", "Format current article"],
			["format_selection", "Format selected text or current line"],
			["delete_blank_line", "Delete blank lines of the selected or whole article"],
			["insert_codeblock", "Insert code block w/wo selection"],
			["switch_autoformat", "Switch autoformat"],
			["paste_wo_format", "Paste without format"],
			["toggle_comment", "Toggle comment"],
			["goto_new_line_after_cur_line", "Go to new line after current line"],
			['select_block', "Select current text block"]

		]);

		let command_name_map_zh_TW = new Map([
			["format_article", "格式化全文"],
			["format_selection", "格式化選中部分/當前行"],
			["delete_blank_line", "刪除選中部分/全文的多餘空白行"],
			["insert_codeblock", "插入代碼塊"],
			["switch_autoformat", "切換自動格式化開關"],
			["paste_wo_format", "無格式化粘貼"],
			["toggle_comment", "切換註釋"],
			["goto_new_line_after_cur_line", "跳到當前行後的新行"],
			['select_block', "選擇當前文本塊"]
		]);

		let command_name_map_zh = new Map([
			["format_article", "格式化全文"],
			["format_selection", "格式化选中部分/当前行"],
			["delete_blank_line", "刪除选中部分/全文的多余空白行"],
			["insert_codeblock", "插入代码块"],
			["switch_autoformat", "切换自动格式化开关"],
			["paste_wo_format", "无格式化粘贴"],
			["toggle_comment", "切换注释"],
			["goto_new_line_after_cur_line", "跳到当前行后新行"],
			['select_block', "选择当前文本块"]
		]);

		let command_name_map_ru = new Map([
			["format_article", "Форматировать текущую статью"],
			["format_selection", "Форматировать выделенный текст или текущую строку"],
			["delete_blank_line", "Удалить пустые строки в выделенном или всей статье"],
			["insert_codeblock", "Вставить блок кода с/без выделением"],
			["switch_autoformat", "Переключить автоформатирование"],
			["paste_wo_format", "Вставить без форматирования"],
			["toggle_comment", "Переключить комментарий"],
			["goto_new_line_after_cur_line", "Перейти к новой строке после текущей"],
			['select_block', "Выбрать текущий текстовый блок"]
		]);

		let command_name_map = command_name_map_en;
		if (lang == 'zh') {
			command_name_map = command_name_map_zh;
		}
		else if (lang == 'zh-TW') {
			command_name_map = command_name_map_zh_TW;
		}
		else if (lang == "ru") {
			command_name_map = command_name_map_ru;
		}

		return command_name_map;
	}

	getEditor = (): Editor | null => {
		let editor = null;
		let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView) {
			editor = markdownView.editor;
		}
		if (editor === null) console.log('can\'t get editor');
		return editor;
	}

	async loadSettings() {
		try {
			const userData = await this.loadData();
			this.settings = Object.assign({}, DEFAULT_SETTINGS, userData || {});
		} catch (error) {
			console.error('EasyTyping: Failed to load settings, using defaults:', error);
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}