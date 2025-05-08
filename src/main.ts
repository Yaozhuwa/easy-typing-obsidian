import {Editor, MarkdownView, Menu, Notice, Platform, Plugin, WorkspaceLeaf} from 'obsidian';
import {EditorSelection, EditorState, Prec, Transaction, TransactionSpec} from '@codemirror/state';
import {ConvertRule, DEFAULT_SETTINGS, EasyTypingSettings, EasyTypingSettingTab, PairString, StrictLineMode} from "./settings"
import {EditorView, keymap, ViewUpdate} from '@codemirror/view';
import {
	getTypeStrOfTransac,
	offsetToPos,
	print,
	setDebug,
	ruleStringList2RuleList,
	string2pairstring,
	isRegexp,
	replacePlaceholders,
	parseTheAfterPattern,
	taboutCursorInPairedString,
} from './utils'
import {getPosLineType, getPosLineType2, LineFormater, LineType} from './core'
import {ensureSyntaxTree, syntaxTree} from "@codemirror/language";
import { selectCodeBlockInPos, isCodeBlockInPos, getCodeBlockInfoInPos, getQuoteInfoInPos } from './syntax';
import { consumeAndGotoNextTabstop, tabstopsStateField, isInsideATabstop, removeAllTabstops, addTabstopsAndSelect, addTabstops, addTabstopsEffect, isInsideCurTabstop, hasTabstops } from './tabstops_state_field';
import { tabstopSpecsToTabstopGroups } from './tabstop';


export default class EasyTypingPlugin extends Plugin {
	settings: EasyTypingSettings;
	selectionReplaceMapInitalData: [string, PairString][];
	SelectionReplaceMap: Map<string, PairString>;
	SymbolPairsMap: Map<string, string>;
	halfToFullSymbolMap: Map<string, string>;
	BasicConvRules: ConvertRule[];
	FW2HWSymbolRules: ConvertRule[];
	Formater: LineFormater;
	IntrinsicDeleteRules: ConvertRule[];
	IntrinsicAutoPairRulesPatch: ConvertRule[];
	CurActiveMarkdown: string;

	QuoteSpaceRules: ConvertRule[];
	ExtraBasicConvRules: ConvertRule[];

	UserDeleteRules: ConvertRule[];
	UserConvertRules: ConvertRule[];
	lang: string;

	compose_begin_pos: number;
	compose_end_pos: number;
	compose_need_handle: boolean;

	onFormatArticle: boolean;
	TaboutPairStrs: PairString[];


	async onload() {
		await this.loadSettings();
		this.selectionReplaceMapInitalData = [
			["【", { left: "[", right: "]" }], ["￥", { left: "$", right: "$" }], ["·", { left: "`", right: "`" }], ['¥', { left: "$", right: "$" }],
			["《", { left: "《", right: "》" }], ["“", { left: "“", right: "”" }], ["”", { left: "“", right: "”" }], ["（", { left: "（", right: "）" }],
			["<", { left: "<", right: ">" }], ["\"", { left: "\"", right: "\"" }], ["'", { left: "'", right: "'" }],
			['「', { left: '「', right: '」' }], ['『', { left: '『', right: '』' }],
		];
		this.refreshSelectionReplaceRule();
		this.SymbolPairsMap = new Map<string, string>();
		let SymbolPairs = ["【】", "（）", "《》", "“”", "‘’", "「」", "『』", '[]', '()', '{}', '""', "''"]
		for (let pairStr of SymbolPairs) this.SymbolPairsMap.set(pairStr.charAt(0), pairStr.charAt(1));

		this.halfToFullSymbolMap = new Map([
			[".", "。"],
			[",", "，"],
			['?', '？'],
			['!', '！']
		]);

		let BasicConvRuleStringList: Array<[string, string]> = [['··|', '`|`'], ["！【【|】",'![[|]]'],['！【【|', '![[|]]'],
		["【【|】", "[[|]]"], ['【【|', "[[|]]"], ["！「「|」",'![[|]]'],['！「「|', '![[|]]'], ["「「|」", "[[|]]"], ['「「|', "[[|]]"],
		['￥￥|', '$|$'], ['$￥|$', "$$\n|\n$$"],['¥¥|','$|$'], ['$¥|$', "$$\n|\n$$"],["$$|$", "$$\n|\n$$"], ['$$|', "$|$"],
		['\n》|', "\n> |"], ["\n、|", "\n/|"]];
		let ExtraBasicConvRuleStringList: Array<[string, string]> = [['r/(?<=^|\\n)(\\s*>*) ?[>》]/|', '[[0]]> |']];
		let QuoteSpaceRuleStringList: Array<[string, string]> = [['r/(?<=^|\\n)(\\s*>+)([^ >》]+)/|', '[[0]] [[1]]|']];
		
		this.ExtraBasicConvRules = ruleStringList2RuleList(ExtraBasicConvRuleStringList);
		this.QuoteSpaceRules = ruleStringList2RuleList(QuoteSpaceRuleStringList);
		this.BasicConvRules = ruleStringList2RuleList(BasicConvRuleStringList);
		let FW2HWSymbolRulesStrList: Array<[string, string]> = [["。。|", ".|"], ["！！|", "!|"], ["；；|", ";|"], ["，，|", ",|"],
		["：：|", ":|"], ['？？|', '?|'], ['（（|）', "(|)"], ['（（|', '(|)'], ["““|”", "\"|\""], ["“”|”", "\"|\""], ["‘‘|’", "'|'"], ["‘’|’", "'|'"],
		["》》|", ">|"], ["《《|》", "<|"], ['《《|', "<|"]];
		this.FW2HWSymbolRules = ruleStringList2RuleList(FW2HWSymbolRulesStrList);
		let fw2hw_rule_0: ConvertRule = {before:{left:'｜｜', right:''}, after:{left:'|', right:''}};
		this.FW2HWSymbolRules.push(fw2hw_rule_0)

		let DeleteRulesStrList: Array<[string, string]> = [["$|$", "|"], ['==|==', '|'], ['$$\n|\n$$', "|"]];
		this.IntrinsicDeleteRules = ruleStringList2RuleList(DeleteRulesStrList);

		let autoPairRulesPatchStrList: Array<[string, string]> = [["【】|】", "【】|"], ["（）|）", "（）|"],
		["<>|>", "<>|"], ["《》|》", "《》|"], ["「」|」", "「」|"], ["『』|』", "『』|"], ["()|)", "()|"], ['[]|]', '[]|'],
		["{}|}", "{}|"], ["''|'", "''|"], ['""|"', '""|'],
		];
		this.IntrinsicAutoPairRulesPatch = ruleStringList2RuleList(autoPairRulesPatchStrList);

		let TaboutPairStrs = ["【|】", "（|）", "《|》", "“|”", "‘|’", 
						   "「|」", "『|』", "'|'", "\"|\"", "$$|$$", '$|$', '__|__', '_|_',
							"==|==", "~~|~~", "**|**", '*|*', "[[|]]", '[|]',"{|}", "(|)", "<|>"];
		this.TaboutPairStrs = TaboutPairStrs.map((s:string)=>string2pairstring(s));

		this.refreshUserDeleteRule();
		this.refreshUserConvertRule();

		this.CurActiveMarkdown = "";

		this.compose_need_handle = false;

		this.Formater = new LineFormater();

		this.onFormatArticle = false;

		setDebug(this.settings.debug);

		this.registerEditorExtension([
			EditorState.transactionFilter.of(this.transactionFilterPlugin),
			EditorView.updateListener.of(this.viewUpdatePlugin),
			Prec.highest(EditorView.domEventHandlers({
				"keyup": this.onKeyup
			})),
			tabstopsStateField.extension,
		]);


		this.registerEditorExtension(Prec.highest(keymap.of([
			{
				key: "Tab",
				run: (view: EditorView): boolean => {
					const success = this.handleTabDown(view);
					return success;
				}
			},
			{
				key: "Enter",
				run: (view: EditorView): boolean => {
					const success = this.handleEnter(view);
					return success;
				}
			},
			{
				key: "Mod-a", 
				run: (view: EditorView): boolean => {
					// console.log('handle mod a in code block')
					const success = this.handleModA(view);
					return success;
				}
			},
			{
                key: "Backspace",
                run: (view: EditorView): boolean => {
					if (!this.settings.BetterBackspace) return false;
                    return this.handleBackspace(view);
                }
            },
			{
				key: "Shift-Enter",
				run: (view: EditorView): boolean => {
					const success = this.handleShiftEnter(view);
					return success;
				}
			},
		])));

		this.lang = window.localStorage.getItem('language');
		let command_name_map = this.getCommandNameMap();

		this.addCommand({
			id: "easy-typing-format-article",
			name: command_name_map.get("format_article"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.formatArticle(editor, view);
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
				this.selectBlockInCurser(editor.cm as EditorView);
			},
		});

		this.addCommand({
			id: "easy-typing-format-selection",
			name: command_name_map.get("format_selection"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.formatSelectionOrCurLine(editor, view);
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
				this.deleteBlankLines(editor);
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
				this.goNewLineAfterCurLine(editor.cm as EditorView);
			},
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
		});

		this.addCommand({
			id: "easy-typing-insert-codeblock",
			name: command_name_map.get("insert_codeblock"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.convert2CodeBlock(editor);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "n"
			}],
		});

		this.addCommand({
			id: "easy-typing-format-switch",
			name: command_name_map.get("switch_autoformat"),
			callback: () => this.switchAutoFormatting(),
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
			editorCallback: (editor: Editor, view: MarkdownView) => this.toggleComment(editor.cm as EditorView),
			hotkeys: [{ modifiers: ["Mod"], key: "/" }],
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EasyTypingSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf) => {
			if (leaf.view.getViewType() == 'markdown') {
				let file = this.app.workspace.getActiveFile();
				if (file != null && this.CurActiveMarkdown != file.path) {
					this.CurActiveMarkdown = file.path;
					if (this.settings.debug)
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
		// 		if (this.settings.debug) {
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
			if (this.settings.debug)
			{
				console.log("[TransactionFilter] type, fromA, toA, changed, fromB, toB, inserted");
				console.log(changeTypeStr, fromA, toA, changedStr,fromB, toB, insertedStr);
			}

			// 表格编辑时直接返回，解决表格内容编辑有时候会跳出聚焦状态的 Bug
			if (getPosLineType(tr.startState, fromA)==LineType.table) return tr;

			// ========== Selection Replace ============
			if (this.settings.SelectionEnhance) {
				if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA != toA && ((fromB + 1 === toB)||insertedStr=='——'||insertedStr=='……')) {
					if (this.SelectionReplaceMap.has(insertedStr)) {
						changes.push({ changes: { from: fromA, insert: this.SelectionReplaceMap.get(insertedStr)?.left }, userEvent: "EasyTyping.change" })
						changes.push({ changes: { from: toA, insert: this.SelectionReplaceMap.get(insertedStr)?.right }, userEvent: "EasyTyping.change" })
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

			// ========== delete pair symbol ============
			if (changeTypeStr === "delete.backward" && this.settings.IntrinsicSymbolPairs) {
				if (this.SymbolPairsMap.has(changedStr) && this.SymbolPairsMap.get(changedStr) === tr.startState.sliceDoc(toA, toA + 1)) {
					changes.push({ changes: { from: fromA, to: toA + 1 }, userEvent: "EasyTyping.change" });
					tr = tr.startState.update(...changes);
					return tr;
				}

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

				for (let rule of this.IntrinsicDeleteRules) {
					let left = tr.startState.doc.sliceString(toA - rule.before.left.length, toA);
					let right = tr.startState.doc.sliceString(toA, toA + rule.before.right.length);
					if (left === rule.before.left && right === rule.before.right) {
						changes.push({
							changes: {
								from: toA - rule.before.left.length,
								to: toA + rule.before.right.length,
								insert: rule.after.left + rule.after.right
							},
							selection: { anchor: toA - rule.before.left.length + rule.after.left.length },
							userEvent: "EasyTyping.change"
						});
						tr = tr.startState.update(...changes);
						return tr;
					}
				}
			}

			// UserDefined Delete Rule
			if (changeTypeStr == "delete.backward") {
				for (let rule of this.UserDeleteRules) {
					let leftDocStr = tr.startState.doc.sliceString(0, toA);
					let rightDocStr = tr.startState.doc.sliceString(toA);
					let leftRegexpStr = rule.before.left;
					if (isRegexp(rule.before.left)){
						leftRegexpStr = leftRegexpStr.slice(2, -1);
					}else{
						leftRegexpStr = leftRegexpStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					}
					
					let leftRegexp = new RegExp(leftRegexpStr+"$");
					let leftMatch = leftDocStr.match(leftRegexp);
					if (leftMatch){
						let leftMatchStr = leftMatch[0];
						// 选择 leftMatch[0] 之后的所有匹配
						let matchList = leftMatch.slice(1);
						let matchPosBegin = toA - leftMatchStr.length;
						let rightRegexpStr = rule.before.right;
						if (isRegexp(rule.before.right)){
							rightRegexpStr = rightRegexpStr.slice(2, -1);
						}else{
							// $& 表示匹配的子串
							rightRegexpStr = rightRegexpStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
						}
						let rightRegexp = new RegExp('^'+rightRegexpStr);
						let rightMatch = rightDocStr.match(rightRegexp);
						if(rightMatch){
							let rightMatchStr = rightMatch[0];
							let matchPosEnd = toA + rightMatchStr.length;
							matchList.push(...rightMatch.slice(1));
							// 左右都匹配成功，开始替换字符串
							// let replaceLeft = replacePlaceholders(rule.after.left, matchList);
							// let replaceRight = replacePlaceholders(rule.after.right, matchList);
							let [new_string, tabstops] = parseTheAfterPattern(rule.after_pattern, matchList);
							const updatedTabstops = tabstops.map(tabstop => ({
								...tabstop, // 展开现有的属性
								from: tabstop.from + matchPosBegin, // 增加from属性的值
								to: tabstop.to + matchPosBegin // 增加to属性的值
							}));
							let tabstopGroups = tabstopSpecsToTabstopGroups(updatedTabstops);
							changes.push({
								changes: {
									from: matchPosBegin,
									to: matchPosEnd,
									insert: new_string
								},
								selection: tabstopGroups[0].toEditorSelection(),
								effects:  [addTabstopsEffect.of(tabstopGroups)],
								userEvent: "EasyTyping.change"
							});
							tr = tr.startState.update(...changes);
							return tr;
						}
					}
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

					for (let rule of this.BasicConvRules) {
						if (insertedStr != rule.before.left.charAt(rule.before.left.length - 1)) continue;
						// 处理文档第 0 行
						if (rule.before.left.charAt(0) === '\n' && offsetToPos(tr.state.doc, fromA).line === 0 && toB - rule.before.left.length + 1 === 0) {
							let left = tr.state.doc.sliceString(toB - rule.before.left.length + 1, toB);
							let right = tr.state.doc.sliceString(toB, toB + rule.before.right.length);
							if (left === rule.before.left.substring(1) && right === rule.before.right) {
								changes.push({
									changes: {
										from: toA - rule.before.left.length + 2,
										to: toA + rule.before.right.length,
										insert: rule.after.left.substring(1) + rule.after.right
									},
									selection: { anchor: toA - rule.before.left.length + rule.after.left.length + 1 },
									userEvent: "EasyTyping.change"
								});
								tr = tr.startState.update(...changes);
								return tr;
							}
						}
						// 通常情况处理
						else {
							let left = tr.state.doc.sliceString(toB - rule.before.left.length, toB);
							let right = tr.state.doc.sliceString(toB, toB + rule.before.right.length);
							if (left === rule.before.left && right === rule.before.right) {
								changes.push({
									changes: {
										from: toA - rule.before.left.length + 1,
										to: toA + rule.before.right.length,
										insert: rule.after.left + rule.after.right
									},
									selection: { anchor: toA - rule.before.left.length + rule.after.left.length + 1 },
									userEvent: "EasyTyping.change"
								});
								tr = tr.startState.update(...changes);
								return tr;
							}
						}
					}
				}

				if (this.settings.FW2HWEnhance) {
					for (let rule of this.FW2HWSymbolRules) {
						if (insertedStr != rule.before.left.charAt(rule.before.left.length - 1)) continue;
						let left = tr.state.doc.sliceString(toB - rule.before.left.length, toB);
						let right = tr.state.doc.sliceString(toB, toB + rule.before.right.length);
						if (left === rule.before.left && right === rule.before.right) {
							changes.push({
								changes: {
									from: toA - rule.before.left.length + 1,
									to: toA + rule.before.right.length,
									insert: rule.after.left + rule.after.right
								},
								selection: { anchor: toA - rule.before.left.length + rule.after.left.length + 1 },
								userEvent: "EasyTyping.change"
							});
							tr = tr.startState.update(...changes);
							return tr;
						}
					}
				}

				// ================ auto pair =================
				// let PairValidSet = new Set(["", " ","\n"])
				// let charAfterCursor = tr.startState.sliceDoc(toA, toA+1);
				if (this.settings.IntrinsicSymbolPairs) {
					for (let rule of this.IntrinsicAutoPairRulesPatch) {
						if (insertedStr != rule.before.left.charAt(rule.before.left.length - 1)) continue;
						let left = tr.state.doc.sliceString(toB - rule.before.left.length, toB);
						let right = tr.state.doc.sliceString(toB, toB + rule.before.right.length);
						if (left === rule.before.left && right === rule.before.right) {
							changes.push({
								changes: {
									from: toA - rule.before.left.length + 1,
									to: toA + rule.before.right.length,
									insert: rule.after.left + rule.after.right
								},
								selection: { anchor: toA - rule.before.left.length + rule.after.left.length + 1 },
								userEvent: "EasyTyping.change"
							});
							tr = tr.startState.update(...changes);
							return tr;
						}
					}

					if (this.SymbolPairsMap.has(insertedStr) && insertedStr!="'") {
						changes.push({
							changes: { from: fromA, to: toA, insert: insertedStr + this.SymbolPairsMap.get(insertedStr) },
							selection: { anchor: fromA + 1 },
							userEvent: "EasyTyping.change"
						});
						tr = tr.startState.update(...changes);
						return tr;
					}
					else if (insertedStr === "'") {
						let charBeforeCursor = tr.startState.sliceDoc(fromA - 1, fromA);
						if (['', ' ', '\n'].includes(charBeforeCursor)) {
							changes.push({
								changes: { from: fromA, to: toA, insert: "''" },
								selection: { anchor: fromA + 1 },
								userEvent: "EasyTyping.change"
							});
							tr = tr.startState.update(...changes);
							return tr;
						}
					}

					// handle autopair for "”" and "’"
					if (insertedStr === '”' || insertedStr === '’') {
						let tempStr = insertedStr === "”" ? "“”" : "‘’";
						changes.push({
							changes: { from: fromA, to: toA, insert: tempStr },
							selection: { anchor: fromA + 1 },
							userEvent: "EasyTyping.change"
						});
						tr = tr.startState.update(...changes);
						return tr;
					}
				}
			}
		})
		return tr;
	}

	async normalPaste(editor: Editor): Promise<void> {
		let clipboardText = await navigator.clipboard.readText();
		if (clipboardText === null || clipboardText === "") return;

		if (this.settings.debug) console.log("Normal Paste!!")
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

		let isExcludeFile = this.isCurrentFileExclude();
		// console.log(this.CurActiveMarkdown, isExcludeFile)

		// if (this.settings.debug) console.log("-----ViewUpdateChange-----");
		let tr = update.transactions[0]
		let changeType = getTypeStrOfTransac(tr);

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let insertedStr = inserted.sliceString(0);
			let changedStr = tr.startState.doc.sliceString(fromA, toA);
			if (this.settings.debug){
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
			if (changeType != 'none' && notSelected && !changeType.includes('delete')) {
				// 用户自定义转化规则
				if (this.triggerCvtRule(update.view, mainSelection.anchor)) return;
				if (composeEnd && this.triggerPuncRectify(update.view, change_from)) return;

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

	private readonly handleTabDown = (view: EditorView) => {
		if (consumeAndGotoNextTabstop(view)){
			return true;
		}

		if (!this.settings.Tabout) return false;

		let state = view.state;
		let doc = state.doc
		const tree = syntaxTree(state);
		const s = view.state.selection;
		if (s.ranges.length > 1) return false;
		const pos = s.main.to;
		let line = doc.lineAt(pos)

		// Debug info
		// console.log(line.text)
		// for (let p=line.from; p<=line.to; p+=1){
		// 	const token = tree.resolve(p, 1).name
		// 	console.log(p-line.from, token)
		// }
		// return true;

		if (s.main.from==s.main.to && isCodeBlockInPos(state, pos)){
			const default_indent = this.getDefaultIndentChar();
			view.dispatch({
				changes: {
					from: s.main.from,
					insert: default_indent
				},
				selection: {
					anchor: s.main.from + default_indent.length
				}
			})
			return true;
		}
		// return true;

		// 当光标在行内代码内部
		if (this.settings.BetterCodeEdit && pos - line.from != 0 && tree.resolve(pos - 1, 1).name.contains('inline-code')) {
			if (tree.resolve(pos, 1).name.contains('formatting-code_inline-code')) {
				view.dispatch({
					selection: { anchor: pos + 1, head: pos + 1 }
				})
				return true;
			}

			for (let p = pos + 1; p < line.to && tree.resolve(p, 1).name.contains('inline-code'); p += 1) {
				// 如果找到 ` 则光标跳到其后
				if (tree.resolve(p, 1).name.contains('formatting-code_inline-code')) {
					view.dispatch({
						selection: { anchor: p, head: p }
					})
					return true;
				}
				// 如果没找到 ` 则直接跳到行尾
				if (p == line.to - 1 && tree.resolve(p, 1).name.contains('inline-code')) {
					view.dispatch({
						selection: { anchor: p + 1, head: p + 1 }
					})
					return true;
				}
			}
		}

		// 当光标在行内代码外部，并在选中文本的情况下，tab将会跳出到pairstring的外部
		let selection = view.state.selection.asSingle().main;
		let selected = selection.anchor != selection.head;
		if (selected){
			let new_anchor = selection.anchor<selection.head?selection.anchor:selection.head;
			let new_head = selection.anchor>selection.head?selection.anchor:selection.head;
			// console.log("selection", selection.anchor, selection.head)

			for (let pstr of this.TaboutPairStrs){
				if (doc.sliceString(new_anchor-pstr.left.length, new_anchor) == pstr.left &&
					doc.sliceString(new_head, new_head+pstr.right.length) == pstr.right){
						view.dispatch({
							selection: { anchor: new_head+pstr.right.length, head: new_head+pstr.right.length }
						})
						return true;
					}
			}
		}
		else {
			let taboutRes = taboutCursorInPairedString(line.text, pos-line.from, this.TaboutPairStrs);
			if (taboutRes.isSuccess){
				view.dispatch({
					selection: { anchor: taboutRes.newPosition+line.from }
				})
				return true;
			}
		}

		return false;
	}

	private readonly handleEnter = (view: EditorView) => {

		let state = view.state;
		let doc = state.doc
		const tree = syntaxTree(state);
		const s = view.state.selection;
		if (s.ranges.length > 1) return false;
		const pos = s.main.to;
		let line = doc.lineAt(pos);
		let codeBlockInfo = getCodeBlockInfoInPos(state, pos);

		// console.log(line.text, getPosLineType2(state, pos))
		// for (let p=line.from; p<=line.to; p+=1){
		// 	const token = tree.resolve(p, 1).name
		// 	console.log(p-line.from, token)
		// }
		// return true;

		if (this.settings.CollapsePersistentEnter){
			// console.log('handleEnter', pos, line.text);
			const editor = this.app.workspace.getActiveViewOfType(MarkdownView).editor;
			let fold_offsets: Set<number> = editor.getFoldOffsets();
			let all_foldable_lines: {from: number, to: number}[] = editor.getAllFoldableLines();

			let folded_lines: {from: number, to: number}[] = [];
			for (let offset of fold_offsets){
				let folded = all_foldable_lines.find(l => l.from == offset);
				if (folded){
					folded_lines.push(folded);
				}
			}
			// 判断当前 cursor pos 是否在 folded_lines 中，如果有找到该范围，否则不处理
			// let folded_line = folded_lines.find(l => pos > l.from - doc.lineAt(l.from).text.length && pos <= l.to);
			let folded_line = folded_lines.find(l => pos >= l.from && pos <= l.to);
			if (folded_line){
				let folded_first_line = doc.lineAt(folded_line.from).text;
				// 判断是不是 Markdown 标题行，如果是则新建同级标题行，如果不是标题行则不处理
				let reg_headings = /^#+ /;
				if (reg_headings.test(folded_first_line)){
					let heading_level = folded_first_line.match(/^#+/)?.[0].length;
					let new_heading_level = heading_level;
					let new_heading_line = '\n' + '#'.repeat(new_heading_level) + ' ';
					let folded_last_line = doc.lineAt(folded_line.to).text;
					let folded_last_line_is_blank = /^\s*$/.test(folded_last_line);

					let new_heading_line_pos = editor.offsetToPos(folded_line.to);
					let new_cursor_pos = {line: new_heading_line_pos.line+1, ch: new_heading_level+1};

					if(this.settings.StrictModeEnter && !folded_last_line_is_blank && (this.app.vault.config.strictLineBreaks || false)){
						new_heading_line = '\n\n' + '#'.repeat(new_heading_level) + ' ';
						new_cursor_pos = {line: new_heading_line_pos.line+2, ch: new_heading_level+1};
					}

					editor.replaceRange(new_heading_line, new_heading_line_pos);
					editor.setCursor(editor.offsetToPos(folded_line.from));
					editor.exec('toggleFold');
					editor.setCursor(new_cursor_pos);				
					return true;
				}
			}
		}

		if (this.settings.BetterCodeEdit && codeBlockInfo && codeBlockInfo.code_start_pos !== doc.lineAt(codeBlockInfo.start_pos).to 
			&& pos >= codeBlockInfo.code_start_pos && pos <= codeBlockInfo.code_end_pos ){
			let line_indent_str = line.text.match(/^\s*/)?.[0] || '';
			view.dispatch({
				changes: {from: pos, to: pos, insert: '\n'+line_indent_str},
				selection: {anchor: pos + line_indent_str.length + 1, head: pos + line_indent_str.length + 1},
				userEvent: "EasyTyping.handleEnter"
			})
			return true;
		}

		if (!this.settings.StrictModeEnter) return false;
		let strictLineBreaks = this.app.vault.config.strictLineBreaks || false;
		if (!strictLineBreaks) return false;

		// 如果当前行为空白行，不做处理
		if (/^\s*$/.test(line.text)) return false;

		// 如果光标在当前行首，不做处理
		if (pos==line.from) return false;

		if (getPosLineType2(state, pos) == LineType.quote){
			let reg_quote = /^(\s*)(>+ ?)/
			let quote_match = line.text.match(reg_quote);
			if (!quote_match) return false;
			let quote_indent_str = quote_match?.[1] || '';
			let quote_level = quote_match?.[2].length || 0;
			let quote_content = line.text.slice(quote_match[0].length);

			if (quote_content.trim() == '') return false;
			else{
				let space_str = '  ';
				if (quote_content.endsWith('  ')) space_str = '';
				let inserted_str = space_str + '\n' + quote_match[0];
				if (this.settings.StrictLineMode == StrictLineMode.EnterTwice){
					inserted_str = '\n' + quote_match[0]+'\n' + quote_match[0];
				}
				view.dispatch({
					changes: {from: pos, to: pos, insert: inserted_str},
					selection: {anchor: pos + inserted_str.length},
					userEvent: "EasyTyping.handleEnter"
				})
				return true;
			}
		}

		let space_str = '  ';
		if (line.text.endsWith('  ')) space_str = '';
		// 如下一行非空白行，不做处理
		if (line.number < doc.lines && !/^\s*$/.test(doc.line(line.number+1).text)){
			if (this.settings.StrictLineMode != StrictLineMode.TwoSpace) return false;
		}

		if (this.settings.StrictLineMode == StrictLineMode.TwoSpace && 
			getPosLineType2(state, pos) == LineType.text) {
			let inserted_str = space_str + '\n';
			view.dispatch({
				changes: {from: pos, to: pos, insert: inserted_str},
				selection: {anchor: pos + inserted_str.length, head: pos + inserted_str.length},
				userEvent: "EasyTyping.handleEnter"
			})
			return true;
		}

		if (getPosLineType2(state, pos) == LineType.text || 
			(codeBlockInfo && pos == codeBlockInfo.end_pos && codeBlockInfo.indent == 0)) {
			view.dispatch({
				changes: {
					from: pos,
					to: pos,
					insert: '\n\n'
				},
				selection: { anchor: pos + 2 },
				userEvent: "EasyTyping.handleEnter"
			})
			return true;
		}

		return false;
	}

	getBlockLinesInPos(state: EditorState, pos: number): [number, number] {
		const strictLineBreaks = this.app.vault.config.strictLineBreaks || false;
		let line = state.doc.lineAt(pos);
		// if (!strictLineBreaks) {
		// 	return [line.number, line.number];
		// }

		let block_start = line.number;
		let block_end = line.number;
		let reg_headings = /^#+ /;
		for (let i = line.number-1; i >= 1; i--) {
			let line = state.doc.line(i);
			if (getPosLineType2(state, line.from) == LineType.text &&
				line.text !== '' && !reg_headings.test(line.text)){
				block_start = i;
				continue;
			}
			break;
		}
		for (let i = line.number+1; i <= state.doc.lines; i++) {
			let line = state.doc.line(i);
			if (getPosLineType2(state, line.from) == LineType.text &&
				line.text !== '' && !reg_headings.test(line.text)){
				block_end = i;
				continue;
			}
			break;
		}
		return [block_start, block_end];
	}

	selectBlockInCurser(view: EditorView): boolean {
		let selection = view.state.selection.main;
		let line = view.state.doc.lineAt(selection.head);
		if (/^\s*$/.test(line.text)) return false;
		let [block_start, block_end] = this.getBlockLinesInPos(view.state, selection.head);
		view.dispatch({
			selection: {anchor: view.state.doc.line(block_start).from, head: view.state.doc.line(block_end).to},
			userEvent: "EasyTyping.selectBlockInCurser"
		});
		return true;
	}

	private readonly handleModA = (view: EditorView) => {
		let selection = view.state.selection.main;
		let line = view.state.doc.lineAt(selection.anchor);
		let line_type = getPosLineType2(view.state, selection.anchor);
		let is_in_code_block = isCodeBlockInPos(view.state, selection.anchor);
		
		if (this.settings.EnhanceModA && 
			line_type == LineType.text &&
			!is_in_code_block
		) {
			let [block_start, block_end] = this.getBlockLinesInPos(view.state, selection.head);
			// // 检查是否已选中整个block
			if (selection.anchor <= view.state.doc.line(block_start).from && selection.head >= view.state.doc.line(block_end).to) {
				return false;
			}
			// 检查是否已选中当前行
			if (selection.anchor == line.from && selection.head == line.to) {
				// 如果block范围大于当前行，选中整个block
				if (block_start != block_end) {
					view.dispatch({
						selection: {
							anchor: view.state.doc.line(block_start).from,
							head: view.state.doc.line(block_end).to
						},
						userEvent: "EasyTyping.handleModA"
					});
					return true;
				}
				return false; // block等于当前行时，直接返回false
			}
			// 首次选中当前行
			view.dispatch({
				selection: {anchor: line.from, head: line.to},
				userEvent: "EasyTyping.handleModA"
			});
			return true;
		}

		let quote_info = getQuoteInfoInPos(view.state, selection.head);
		if (this.settings.EnhanceModA && quote_info){
			// 第一次，选中当前 quote 行内容；第二次选中整个 quote 块，第三次不处理
			if (selection.anchor == quote_info.start_pos && selection.head == quote_info.end_pos){
				return false;
			}
			else if (selection.anchor == quote_info.cur_start_pos && selection.head == quote_info.cur_end_pos){
				view.dispatch({
					selection: {anchor: quote_info.start_pos, head: quote_info.end_pos},
					userEvent: "EasyTyping.handleModA"
				});
				return true;
			}
			else{
				view.dispatch({
					selection: {anchor: quote_info.cur_start_pos, head: quote_info.cur_end_pos},
					userEvent: "EasyTyping.handleModA"
				});
				return true;
			}
		}

		if (this.settings.EnhanceModA && line_type == LineType.list){
			// 第一次 Mod+A 选中当前列表行的内容（不包括indent），
			// 第二次选中当前列表行及其子列表，
			// 第三次选中整个列表
			// 第四次选中全文
			const reg_list = /^(\s*)([-*+] \[[^\]]\]|[-*+]|\d+\.)\s/;
			let reg_code_block = /^\s+```/;
			const listMatch = line.text.match(reg_list);
			if (!listMatch) {
				if (!reg_code_block.test(line.text)){
					let cur_indent = line.text.match(/^\s*/)?.[0].length || 0;
					let selection_list: {anchor: number, head: number}[] = [];
					selection_list.push({anchor: line.from+cur_indent, head: line.to});
					let list_start_line = line.number;
					for (let i = line.number - 1; i >= 1; i--) {
						const prevLine = view.state.doc.line(i);
						if (getPosLineType2(view.state, prevLine.from) == LineType.list){
							list_start_line = i;
							break;
						}
					}
					let list_s_match = view.state.doc.line(list_start_line).text.match(reg_list);
					let list_s_start_idx = list_s_match?.[0].length || 0;
					selection_list.push({anchor: view.state.doc.line(list_start_line).from+list_s_start_idx, head: line.to});

					if (selection.anchor <= selection_list[0].anchor && selection.head >= selection_list[0].head){
						view.dispatch({selection: selection_list[1], userEvent: "EasyTyping.handleModA"});
						return true;
					}
					else{
						view.dispatch({selection: selection_list[0], userEvent: "EasyTyping.handleModA"});
						return true;
					}
				}
			}
			else{
				const cur_indent = listMatch[1].length;
				let selection_list: {anchor: number, head: number}[] = [];
				// selection_list.push({anchor: 0, head: view.state.doc.length});
				// 当前行内容
				const contentStart = line.from + listMatch[0].length;
				selection_list.push({anchor: contentStart, head: line.to});

				// 当前行及其子列表
				let endLine = line.number;
				for (let i = line.number + 1; i <= view.state.doc.lines; i++) {
					const nextLine = view.state.doc.line(i);
					const nextMatch = nextLine.text.match(/^(\s*)/);
					if (!nextMatch || nextMatch[0].length <= cur_indent) break;
					endLine = i;
				}
				let list_block_selection = {anchor: line.from, head: view.state.doc.line(endLine).to};
				selection_list.push(list_block_selection);

				// 整个列表
				let list_start_line = line.number;
				for (let i = line.number - 1; i >= 1; i--) {
					const prevLine = view.state.doc.line(i);
					const prevMatch = prevLine.text.match(/^(\s*)/);
					if (getPosLineType2(view.state, prevLine.from) == LineType.list || (prevMatch && prevMatch[0].length >= 2)) {
						list_start_line = i;
					}
					else{
						break;
					}
				}
				let list_end_line = line.number;
				for (let i = line.number + 1; i <= view.state.doc.lines; i++) {
					const nextLine = view.state.doc.line(i);
					const nextMatch = nextLine.text.match(/^(\s*)/);
					if (getPosLineType2(view.state, nextLine.from) == LineType.list|| (nextMatch && nextMatch[0].length >= 2)) {
						list_end_line = i;
					}
					else{
						break;
					}
				}
				let list_all_selection = {anchor: view.state.doc.line(list_start_line).from, head: view.state.doc.line(list_end_line).to};
				if (list_all_selection.anchor != list_block_selection.anchor || list_all_selection.head != list_block_selection.head){
					selection_list.push(list_all_selection);
				}

				// 选中全文
				selection_list.push({anchor: 0, head: view.state.doc.length});
				
				// 从后往前，依次检查 selection_list 中的 selection 是否被选中
				// 如果被选中，则 dispatch 下一个索引的selection
				let hit_idx = -1;
				for (let i = selection_list.length - 1; i >= 0; i--) {
					const sel = selection_list[i];
					if (selection.anchor <= sel.anchor && selection.head >= sel.head) {
						hit_idx = i;
						break;
					}
				}
				hit_idx += 1;
				if (hit_idx < selection_list.length){
					view.dispatch({selection: selection_list[hit_idx], userEvent: "EasyTyping.handleModA"});
					return true;
				}
				return false;
			}
		}

		if (!this.settings.BetterCodeEdit) return false;
		let mainSelection = view.state.selection.asSingle().main;

		return selectCodeBlockInPos(view, mainSelection);
	}

	private readonly onKeyup = (event: KeyboardEvent, view: EditorView) => {
		if (this.settings.debug) {
			// console.log("Keyup:", event.key, event.shiftKey, event.ctrlKey||event.metaKey);
			console.log("Keyup:", event.key);
		}
		this.handleEndComposeTypeKey(event, view);
	}

	toggleComment(view: EditorView): boolean {
		const state = view.state;
        const selection = state.selection.main;
        const codeBlockInfo = getCodeBlockInfoInPos(state, selection.from);

        if (codeBlockInfo){
			return this.toggleCodeBlockComment(view);
		}
		return this.toggleMarkdownComment(selection.from, selection.to, view);
	}

	toggleCodeBlockComment(view: EditorView): boolean {
        const state = view.state;
        const selection = state.selection.main;
        const codeBlockInfo = getCodeBlockInfoInPos(state, selection.from);

        if (!codeBlockInfo) return false; // 不在代码块内，不执行操作

        const language = codeBlockInfo.language;
        const commentSymbol = this.getCommentSymbol(language.toLowerCase());

        if (!commentSymbol) return false; // 未知语言，不执行操作

        let changes: { from: number; to: number; insert: string }[] = [];

        if (selection.from === selection.to) {
            // 没有选中文本，注释当前行
            const line = state.doc.lineAt(selection.from);
            let change = this.toggleCodeBlockLineComment(line.from, line.to, 
				state.doc.sliceString(line.from, line.to), commentSymbol, selection.from);
			if (change && change.selection){
				changes.push(change);
				view.dispatch({
					changes,
					selection: change.selection,
					userEvent: "EasyTyping.toggleComment"
				});
				return true;
			}
			else if (change){
				changes.push(change);
			}
			
        } else {
            // 有选中文本，注释选中的行
            const fromLine = state.doc.lineAt(selection.from);
            const toLine = state.doc.lineAt(selection.to);
            for (let i = fromLine.number; i <= toLine.number; i++) {
                const line = state.doc.line(i);
                let change = this.toggleCodeBlockLineComment(line.from, line.to, state.doc.sliceString(line.from, line.to), commentSymbol);
				if (change){
					changes.push(change);
				}
            }
        }

        view.dispatch({ changes, userEvent: "EasyTyping.toggleComment" });
        return true;
    }

	toggleCodeBlockLineComment(from: number, to: number, text: string, 
		commentSymbol: string | { start: string; end: string }, 
		cursor_pos?: number): { from: number; to: number; insert: string, selection?: {anchor: number, head: number} } | null {
		
		if (text.trim() == '' && cursor_pos){
			if (typeof commentSymbol === 'string'){
				let new_pos = cursor_pos + commentSymbol.length + 1;
				return {
					from: cursor_pos,
					to: cursor_pos,
					insert: commentSymbol + ' ',
					selection: {anchor: new_pos, head: new_pos}
				}
			}
			else{
				let new_pos = cursor_pos + commentSymbol.start.length + 1;
				return {
					from: cursor_pos,
					to: cursor_pos,
					insert: commentSymbol.start + '  ' + commentSymbol.end,
					selection: {anchor: new_pos, head: new_pos}
				}
			}
		}
		if (text.trim() == '') return null;
		if (typeof commentSymbol === 'string') {
			// 处理单行注释符号
			const trimmedText = text.trimStart();
			if (trimmedText.startsWith(commentSymbol)) {
				const commentIndex = text.indexOf(commentSymbol);
				return {
					from: from + commentIndex,
					to: from + commentIndex + commentSymbol.length + (trimmedText.startsWith(commentSymbol + ' ') ? 1 : 0),
					insert: ''
				};
			} else {
				const indent = text.length - trimmedText.length;
				return {
					from: from + indent,
					to: from + indent,
					insert: commentSymbol + ' '
				};
			}
		} else {
			// 处理块注释符号（如CSS的 /* */）
			const trimmedText = text.trim();
			if (trimmedText.startsWith(commentSymbol.start) && trimmedText.endsWith(commentSymbol.end)) {
				// 移除注释
				const commentStartIndex = text.indexOf(commentSymbol.start);
				return {
					from: from + commentStartIndex,
					to: to,
					insert: trimmedText.slice(commentSymbol.start.length+1, -commentSymbol.end.length-1)
				};
			} else {
				// 添加注释
				const indent = text.length - text.trimStart().length;
				return {
					from: from + indent,
					to: to,
					insert: `${commentSymbol.start} ${trimmedText} ${commentSymbol.end}`
				};
			}
		}
	}
	
	toggleMarkdownComment(from: number, to: number, view: EditorView): boolean {
		const state = view.state;
		const doc = state.doc;
		const changes = [];
	
		if (from === to) {
			const currentText = doc.sliceString(from - 3, to + 3);
			if (currentText === "%%  %%") {
				// 如果当前文本是 %%  %%，则删除它
				changes.push({
					from: from - 3,
					to: to + 3,
					insert: ""
				});
				view.dispatch({
					changes,
					selection: {anchor: from - 3, head: from - 3},
					userEvent: "EasyTyping.toggleComment"
				});
				return true;
			}
			// 没有选中文字，在当前位置插入 %%  %%
			changes.push({
				from: from,
				to: to,
				insert: "%%  %%"
			});
			
			// 设置光标位置到 %% 之间
			const newPos = from + 3;
			view.dispatch({
				changes,
				selection: {anchor: newPos, head: newPos},
				userEvent: "EasyTyping.toggleComment"
			});
		} else {
			// 有文字选中，在选中部分左右加上 %%
			const selectedText = doc.sliceString(from, to);
			
			// 检查是否已经被 %% 包围
			if (selectedText.startsWith("%%") && selectedText.endsWith("%%")) {
				// 如果已经被注释，则移除注释
				changes.push({
					from: from,
					to: to,
					insert: selectedText.slice(2, -2)
				});
			} else {
				// 如果没有被注释，则添加注释
				changes.push({
					from: from,
					to: to,
					insert: `%%${selectedText}%%`
				});
			}
			
			view.dispatch({changes, userEvent: "EasyTyping.toggleComment"});
		}
	
		return true;
	}

	getCommentSymbol(language: string): string | { start: string; end: string } | null {
		const commentSymbols: { [key: string]: string | { start: string; end: string } } = {
			'js': '//',
			'javascript': '//',
			'ts': '//',
			'typescript': '//',
			'py': '#',
			'python': '#',
			'rb': '#',
			'ruby': '#',
			'java': '//',
			'c': '//',
			'cpp': '//',
			'cs': '//',
			'go': '//',
			'rust': '//',
			'swift': '//',
			'kotlin': '//',
			'php': '//',
			'css': { start: '/*', end: '*/' },
			'scss': { start: '/*', end: '*/' },
			'sql': '--',
			'shell': '#',
			'bash': '#',
			'powershell': '#',
			'html': { start: '<!--', end: '-->' },
			'matlab': '%',
			'markdown': { start: '%%', end: '%%' },
		};
	
		return commentSymbols[language] || null;
	}

	handleShiftEnter(view: EditorView): boolean {
		const state = view.state;
		const doc = state.doc;
		const selection = state.selection.main;
		
		if (selection.anchor != selection.head) return false;
		
		// 获取当前行的信息
		const line = doc.lineAt(selection.head);
		const lineContent = line.text;

		const taskListMatch = lineContent.match(/^(\s*)([-*+] \[.\])\s/);

		if (taskListMatch){
			const [, indent, listMarker] = taskListMatch;
			let inserted = '\n' + indent + '  ';
			view.dispatch({
				changes: [{from: selection.anchor, insert: inserted}],
				selection: {anchor: selection.anchor + inserted.length, head: selection.anchor + inserted.length},
				userEvent: "EasyTyping.handleShiftEnter"
			});
			return true;
		}

		return false;
	}

	goNewLineAfterCurLine(view: EditorView): boolean {
		const state = view.state;
		const doc = state.doc;
		const selection = state.selection.main;
	
		// 获取当前行的信息
		const line = doc.lineAt(selection.head);
		const lineContent = line.text;
	
		// 检查是否在列表或引用块中
		const listMatch = lineContent.match(/^(\s*)([-*+] \[.\]|[-*+]|\d+\.)\s/);
		const quoteMatch = lineContent.match(/^(\s*)(>+ ?)/);
	
		let changes;
		let newCursorPos;
	
		let prefix = '';
		if (listMatch) {
			// 继续列表
			const [, indent, listMarker] = listMatch;
			// console.log(indent, listMarker);
			if (['-', '*', '+'].includes(listMarker)){
				prefix = indent + listMarker + ' ';
			}
			else if (listMarker.match(/[-*+] \[.\]/)){
				prefix = indent + listMarker.replace(/\[.\]/g, '[ ]') + ' ';
			}
			else {
				prefix = indent + (parseInt(listMarker) + 1) + '. ';
			}

		} else if (quoteMatch) {
			// 继续引用，保持相同的引用级别，确保每个 > 后有一个空格
			prefix = quoteMatch[1]+quoteMatch[2];
		}
	
		changes = [{from: line.to, insert: '\n' + prefix}];
		newCursorPos = line.to + 1 + prefix.length;
	
		// 创建一个新的事务
		const tr = state.update({
			changes: changes,
			selection: {anchor: newCursorPos, head: newCursorPos},
			userEvent: "EasyTyping.goNewLineAfterCurLine"
		});
	
		view.dispatch(tr);
	
		return true;
	}


	handleBackspace(view: EditorView): boolean {
        const state = view.state;
        const doc = state.doc;
        const selection = state.selection.main;
		if (selection.anchor != selection.head) return false;

		const line = doc.lineAt(selection.from);
		const lineContent = line.text;

		// 检查是否是空的列表项或引用项
		const listMatchEmpty = lineContent.match(/^\s*([-*+]|\d+\.) $/);
		const quoteMatchEmpty = lineContent.match(/^(\s*)(>+) ?$/);

		if ((listMatchEmpty || quoteMatchEmpty) && selection.anchor == line.to) {
			let changes;
			let newCursorPos;

			if (quoteMatchEmpty) {
				// 处理引用项
				const quote_indent_str = quoteMatchEmpty[1]
				const quoteLevel = quoteMatchEmpty[2].length;
				if (quoteLevel > 1) {
					if (line.number > 1) {
						const prevLine = doc.line(line.number - 1);
						const prevLineContent = prevLine.text;
						const prevQuoteMatchEmpty = prevLineContent.match(/^(\s*)(>+) ?$/);

						if (prevQuoteMatchEmpty && 
							prevQuoteMatchEmpty[1] == quote_indent_str && 
							prevQuoteMatchEmpty[2].length == quoteLevel) {
							let temp_line = quote_indent_str + '>'.repeat(quoteLevel - 1) + ' ';
							let inseted = temp_line + '\n' + temp_line
							changes = [{ from: prevLine.from, to: line.to, insert: inseted }];
							newCursorPos = prevLine.from + inseted.length;
						}
						else{
							// 多级引用，降低一级
							const newQuotePrefix = '>' .repeat(quoteLevel - 1) + ' ';
							changes = [{ from: line.from, to: line.to, insert: newQuotePrefix }];
							newCursorPos = line.from + newQuotePrefix.length;
						}
					}else{
						// 多级引用，降低一级
						const newQuotePrefix = '>' .repeat(quoteLevel - 1) + ' ';
						changes = [{ from: line.from, to: line.to, insert: newQuotePrefix }];
						newCursorPos = line.from + newQuotePrefix.length;
					}
					
				} else {
					// 单级引用
					if (line.number > 1) {
						const prevLine = doc.line(line.number - 1);
						const prevLineContent = prevLine.text;
						const prevQuoteMatch = prevLineContent.match(/^\s*(>+)/);

						if (prevQuoteMatch) {
							// 上一行也是引用，删除当前行并将光标移到上一行末尾
							changes = [{ from: prevLine.to, to: line.to, insert: '' }];
							newCursorPos = prevLine.to;
						} else {
							// 上一行不是引用，只删除当前行
							changes = [{ from: line.from, to: line.to, insert: '' }];
							newCursorPos = line.from;
						}
					} else {
						// 这是文档的第一行，只删除当前行
						changes = [{ from: line.from, to: line.to, insert: '' }];
						newCursorPos = line.from;
					}
				}
			} else {
				// 处理列表项
				if (line.number > 1) {
					const prevLine = doc.line(line.number - 1);
					const prevLineContent = prevLine.text;
					const prevListMatch = prevLineContent.match(/^\s*([-*+]|\d+\.)\s/);

					if (prevListMatch) {
						// 前一行也是列表项，删除当前行并将光标移到前一行末尾
						changes = [{ from: prevLine.to, to: line.to, insert: '' }];
						newCursorPos = prevLine.to;
					} else {
						// 前一行不是列表项，只删除当前行
						changes = [{ from: line.from, to: line.to, insert: '' }];
						newCursorPos = line.from;
					}
				} else {
					// 这是文档的第一行，只删除当前行
					changes = [{ from: line.from, to: line.to, insert: '' }];
					newCursorPos = line.from;
				}

				// 检查后续行是否是有序列表，并更新其编号
				let nextLineNumber = line.number + 1;
				const currentIndent = lineContent.match(/^\s*/)[0];
				const currentListMatch = lineContent.match(/^\s*(\d+)\.\s/);
				let expectedNextNumber = currentListMatch ? parseInt(currentListMatch[1], 10) + 1 : null;

				while (nextLineNumber <= doc.lines && expectedNextNumber !== null) {
					const nextLine = doc.line(nextLineNumber);
					const nextLineContent = nextLine.text;
					const nextListMatch = nextLineContent.match(/^\s*(\d+)\.\s/);

					if (nextListMatch) {
						const nextIndent = nextLineContent.match(/^\s*/)[0];
						if (nextIndent !== currentIndent) {
							break;
						}
						const nextListNumber = parseInt(nextListMatch[1], 10);
						if (nextListNumber === expectedNextNumber) {
							const newNextLineContent = nextLineContent.replace(/^\s*\d+\.\s/, `${nextIndent}${nextListNumber - 1}. `);
							changes.push({ from: nextLine.from, to: nextLine.to, insert: newNextLineContent });
							expectedNextNumber++;
						} else {
							break;
						}
					} else {
						break;
					}
					nextLineNumber++;
				}
			}

			const tr = state.update({
				changes: changes,
				selection: { anchor: newCursorPos, head: newCursorPos },
				userEvent: "EasyTyping.handleBackspace"
			});

			view.dispatch(tr);
			return true;
		}

		return false;
    }

	triggerCvtRule = (view: EditorView, cursor_pos: number):boolean => {
		let rules: ConvertRule[] = [];
		if (this.settings.QuoteSpace) rules = rules.concat(this.ExtraBasicConvRules);
		if (this.settings.QuoteSpace) rules = rules.concat(this.QuoteSpaceRules);
		rules = rules.concat(this.UserConvertRules);
		for (let rule of rules) {
			let leftDocStr = view.state.doc.sliceString(0, cursor_pos);
			let rightDocStr = view.state.doc.sliceString(cursor_pos);
			let leftRegexpStr = rule.before.left;
			if (isRegexp(rule.before.left)){
				leftRegexpStr = leftRegexpStr.slice(2, -1);
			}else{
				leftRegexpStr = leftRegexpStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			}
			
			let leftRegexp = new RegExp(leftRegexpStr+"$");
			let leftMatch = leftDocStr.match(leftRegexp);
			if (leftMatch){
				let leftMatchStr = leftMatch[0];
				// 选择 leftMatch[0] 之后的所有匹配
				let matchList = leftMatch.slice(1);
				let matchPosBegin = cursor_pos - leftMatchStr.length;
				let rightRegexpStr = rule.before.right;
				if (isRegexp(rule.before.right)){
					rightRegexpStr = rightRegexpStr.slice(2, -1);
				}else{
					// $& 表示匹配的子串
					rightRegexpStr = rightRegexpStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				}
				let rightRegexp = new RegExp('^'+rightRegexpStr);
				let rightMatch = rightDocStr.match(rightRegexp);
				if(rightMatch){
					let rightMatchStr = rightMatch[0];
					let matchPosEnd = cursor_pos + rightMatchStr.length;
					matchList.push(...rightMatch.slice(1));
					// 左右都匹配成功，开始替换字符串
					// let replaceLeft = replacePlaceholders(rule.after.left, matchList);
					// let replaceRight = replacePlaceholders(rule.after.right, matchList);
					let [new_string, tabstops] = parseTheAfterPattern(rule.after_pattern, matchList);
					const updatedTabstops = tabstops.map(tabstop => ({
						...tabstop, // 展开现有的属性
						from: tabstop.from + matchPosBegin, // 增加from属性的值
						to: tabstop.to + matchPosBegin // 增加to属性的值
					}));
					view.dispatch({
						changes: {
							from: matchPosBegin,
							to: matchPosEnd,
							insert: new_string
						},
						userEvent: "EasyTyping.change"
					});
					addTabstopsAndSelect(view, tabstopSpecsToTabstopGroups(updatedTabstops));
					return true;
				}
			}
		}
		return false;
	}

	triggerPuncRectify = (view: EditorView, change_from_pos: number):boolean => {
		if (this.settings.PuncRectify &&
			/[,.?!]/.test(view.state.doc.sliceString(change_from_pos - 1, change_from_pos))) {
			let punc = view.state.doc.sliceString(change_from_pos - 1, change_from_pos)
			if (change_from_pos > 2 && /[^\u4e00-\u9fa5]/.test(view.state.doc.sliceString(change_from_pos - 2, change_from_pos - 1))) { }
			else {
				view.dispatch({
					changes: {
						from: change_from_pos - 1,
						to: change_from_pos,
						insert: this.halfToFullSymbolMap.get(punc)
					},
					// selection: { anchor: toB - rule.before.left.length + rule.after.left.length },
					userEvent: "EasyTyping.change"
				})
				return true;
			}
		}
		return false;
	}

	handleEndComposeTypeKey = (event: KeyboardEvent, view: EditorView) => {
		if ((['Enter', 'Process', ' ', 'Shift'].contains(event.key) || /\d/.test(event.key)) &&
			this.compose_need_handle) {
			let cursor = view.state.selection.asSingle().main;
			if (cursor.head != cursor.anchor) return;
			let insertedStr = view.state.doc.sliceString(this.compose_begin_pos, cursor.anchor);
			// console.log("inserted str", insertedStr);
			this.compose_need_handle = false;
			if (this.triggerCvtRule(view, cursor.anchor)) return;
			if (this.triggerPuncRectify(view, this.compose_begin_pos)) return;
			if (this.settings.AutoFormat && !this.isCurrentFileExclude()){
				if (getPosLineType(view.state, cursor.anchor) != LineType.text) return;
				let changes = this.Formater.formatLineOfDoc(view.state, this.settings,
					this.compose_begin_pos, cursor.anchor, insertedStr);
				if (changes != null) {
					view.dispatch(...changes[0]);
					view.dispatch(changes[1]);
					return;
				}
			}
		}
	}

	formatArticle = (editor: Editor, view: MarkdownView): void => {
		const editorView = editor.cm as EditorView;
		const tree = ensureSyntaxTree(editorView.state, editorView.state.doc.length);
		if (!tree){
			new Notice('EasyTyping: Syntax tree is not ready yet, please wait a moment and try again later!', 5000);
			return;
		}

		this.onFormatArticle = true;
		
		let lineCount = editor.lineCount();
		let new_article = "";
		let cs = editor.getCursor();
		let ch = 0;
		for (let i = 0; i < lineCount; i++) {
			if (i != 0) new_article += '\n';
			if (i != cs.line) {
				new_article += this.preFormatOneLine(editor, i + 1)[0];
			}
			else {
				let newData = this.preFormatOneLine(editor, i + 1, cs.ch);
				new_article += newData[0];
				ch = newData[1];
			}
		}
		editor.setValue(new_article);
		editor.setCursor({ line: cs.line, ch: ch });

		this.onFormatArticle = false;

		new Notice("EasyTyping: Format Article Done!");
	}

	isCurrentFileExclude(): boolean {
		if (this.CurActiveMarkdown == "") {
			let file = this.app.workspace.getActiveFile();
			if (file != null && this.CurActiveMarkdown != file.path) {
				this.CurActiveMarkdown = file.path;
			}
			else {
				return true;
			}
		}
		let excludePaths = this.settings.ExcludeFiles.split('\n');
		for (let epath of excludePaths) {
			if (epath.charAt(0) == '/') epath = epath.substring(1);
			if (this.CurActiveMarkdown == epath) return true;
			let len = epath.length;
			if (this.CurActiveMarkdown.substring(0, len) == epath && (this.CurActiveMarkdown.charAt(len) == '/' || this.CurActiveMarkdown.charAt(len) == '\\' ||
				epath.charAt(len - 1) == "/" || epath.charAt(len - 1) == "\\")) {
				return true;
			}
		}
		return false;
	}

	formatSelectionOrCurLine = (editor: Editor, view: MarkdownView): void => {
		if (!editor.somethingSelected() || editor.getSelection() === '') {
			let lineNumber = editor.getCursor().line;
			let newLineData = this.preFormatOneLine(editor, lineNumber + 1, editor.getCursor().ch);
			editor.replaceRange(newLineData[0], { line: lineNumber, ch: 0 }, { line: lineNumber, ch: editor.getLine(lineNumber).length });
			editor.setSelection({ line: lineNumber, ch: newLineData[1] });
			return;
		}
		let selection = editor.listSelections()[0];
		let begin = selection.anchor.line;
		let end = selection.head.line;
		if (begin > end) {
			let temp = begin;
			begin = end;
			end = temp;
		}
		// console.log(begin, end)
		let new_lines = "";
		for (let i = begin; i <= end; i++) {
			if (i != begin) new_lines += '\n';
			new_lines += this.preFormatOneLine(editor, i + 1)[0];
		}
		editor.replaceRange(new_lines, { line: begin, ch: 0 }, { line: end, ch: editor.getLine(end).length });
		if (selection.anchor.line < selection.head.line) {
			editor.setSelection({ line: selection.anchor.line, ch: 0 }, { line: selection.head.line, ch: editor.getLine(selection.head.line).length });
		}
		else {
			editor.setSelection({ line: selection.anchor.line, ch: editor.getLine(selection.anchor.line).length }, { line: selection.head.line, ch: 0 });
		}
	}

	// param: lineNumber is (1-based), 废弃函数
	formatOneLine = (editor: Editor, lineNumber: number): void => {
		const editorView = editor.cm as EditorView;
		let state = editorView.state;
		let line = state.doc.line(lineNumber)

		if (getPosLineType(state, line.from) == LineType.text || getPosLineType(state, line.from) == LineType.table) {
			let oldLine = line.text;
			let newLine = this.Formater.formatLine(state, lineNumber, this.settings, oldLine.length, 0)[0];
			if (oldLine != newLine) {
				editor.replaceRange(newLine, { line: lineNumber - 1, ch: 0 }, { line: lineNumber - 1, ch: oldLine.length });
				editor.setCursor({ line: lineNumber - 1, ch: editor.getLine(lineNumber - 1).length });
			}
		}
		return;
	}

	// param: lineNumber is (1-based)
	preFormatOneLine = (editor: Editor, lineNumber: number, ch: number = -1): [string, number] => {
		const editorView = editor.cm as EditorView;
		let state = editorView.state;
		let line = state.doc.line(lineNumber)

		let newLine = line.text;
		let newCh = 0;
		let curCh = line.text.length;
		if (ch != -1) {
			curCh = ch;
		}
		if (getPosLineType(state, line.from) == LineType.text || getPosLineType(state, line.from) == LineType.table) {
			let newLineData = this.Formater.formatLine(state, lineNumber, this.settings, curCh, 0);
			newLine = newLineData[0];
			newCh = newLineData[1];
		}

		return [newLine, newCh];
	}

	deleteBlankLines = (editor: Editor): void => {
		if (this.settings.debug) {
			console.log('config.strictLineBreaks', this.app.vault.getConfig("strictLineBreaks"));
			// return;
		}
		let strictLineBreaks = this.app.vault.config.strictLineBreaks || false;

		const editorView = editor.cm as EditorView;
		let state = editorView.state;
		let doc = state.doc
		
		const tree = ensureSyntaxTree(state, doc.length);
		if (!tree){
			new Notice('EasyTyping: Syntax tree is not ready yet, please wait a moment and try again later!', 5000);
			return;
		}
		
		let start_line = 1;
		let end_line = doc.lines;
		let line_num = doc.lines;
		const selected = editor.somethingSelected() && editor.getSelection() != '';
		if (selected) {
			let selection = editor.listSelections()[0];
			let begin = selection.anchor.line + 1;
			let end = selection.head.line + 1;
			if (begin > end) {
				let temp = begin;
				begin = end;
				end = temp;
			}
			start_line = begin;
			end_line = end
		}

		// if(this.settings.debug){
		// 	let line_index = editor.getCursor().line + 1;
		// 	let content = editor.getLine(editor.getCursor().line);
		// 	console.log(content);
		// 	for (let i=0;i<content.length;i++){
		// 		let node = tree.resolve(doc.line(line_index).from+i, 1);
		// 		console.log(i, node.name)
		// 	}
		// 	return;
		// }

		let delete_index: number[] = [];
		let blank_reg = /^\s*$/;
		let remain_next_blank = false;

		if (start_line != 1) {
			let node = tree.resolve(doc.line(start_line - 1).from, 1);
			if (node.name.contains('list') || node.name.contains('quote') || node.name.contains('blockid')) {
				remain_next_blank = true;
			}
		}
		if (end_line != line_num && !blank_reg.test(doc.line(end_line + 1).text)) {
			end_line += 1;
		}

		for (let i = start_line; i <= end_line; i++) {
			let line = doc.line(i);
			let pos = line.from;
			let node = tree.resolve(pos, 1);

			// 对于空白行
			if (blank_reg.test(line.text) && !remain_next_blank) {
				delete_index.push(i);
				continue;
			}
			else if (blank_reg.test(line.text) && remain_next_blank) {
				remain_next_blank = false;
				continue;
			}

			if (node.name.contains('hr') && delete_index[delete_index.length - 1] == i - 1) {
				delete_index.pop()
			}
			else if (node.name.contains('list') || node.name.contains('quote') || node.name.contains('blockid')) {
				remain_next_blank = true;
			}
			else {
				remain_next_blank = false;
			}
		}
		// console.log("delete_index",delete_index)
		let newContent = "";
		for (let i = 1; i < line_num; i++) {
			if (!delete_index.contains(i)) {
				newContent += doc.line(i).text + '\n';
			}
		}
		if (!delete_index.contains(line_num)) {
			newContent += doc.line(line_num).text
		}

		editor.setValue(newContent);
		// this.ContentParser.reparse(editor.getValue(), 0);
	}

	switchAutoFormatting() {
		this.settings.AutoFormat = !this.settings.AutoFormat;
		let status = this.settings.AutoFormat ? 'on' : 'off';
		new Notice('EasyTyping: Autoformat is ' + status + '!');
	}

	convert2CodeBlock(editor: Editor) {
		if (this.settings.debug) console.log("----- EasyTyping: insert code block-----");
		if (editor.somethingSelected && editor.getSelection() != "") {
			let selected = editor.getSelection();
			let selectedRange = editor.listSelections()[0];
			let anchor = selectedRange.anchor;
			let head = selectedRange.head;

			let replacement = "```\n" + selected + "\n```";
			// make sure anchor < head
			if (anchor.line > head.line || (anchor.line == head.line && anchor.ch > head.ch)) {
				let temp = anchor;
				anchor = head;
				head = temp;
			}
			let dstLine = anchor.line;
			if (anchor.ch != 0) {
				replacement = '\n' + replacement;
				dstLine += 1;
			}
			if (head.ch != editor.getLine(head.line).length) {
				replacement = replacement + '\n';
			}
			editor.replaceSelection(replacement);
			editor.setCursor({ line: dstLine, ch: 3 });
		}
		else {
			let cs = editor.getCursor();
			let replace = "```\n```";
			let dstLine = cs.line;
			if (cs.ch != 0) {
				replace = "\n" + replace;
				dstLine += 1;
			}
			if (cs.ch != editor.getLine(cs.line).length) {
				replace = replace + '\n';
			}
			editor.replaceRange(replace, cs);
			editor.setCursor({ line: dstLine, ch: 3 });
		}

	}

	refreshSelectionReplaceRule() {
		this.SelectionReplaceMap = new Map(this.selectionReplaceMapInitalData);
		for (let i = 0; i < this.settings.userSelRepRuleTrigger.length; i++) {
			let trigger = this.settings.userSelRepRuleTrigger[i];
			let lefts = this.settings.userSelRepRuleValue[i].left;
			let rights = this.settings.userSelRepRuleValue[i].right;

			this.SelectionReplaceMap.set(trigger, { left: lefts, right: rights });
		}
	}

	addUserSelectionRepRule(trigger: string, left: string, right: string): boolean {
		if (this.settings.userSelRepRuleTrigger.includes(trigger)) return false;
		this.settings.userSelRepRuleTrigger.push(trigger)
		this.settings.userSelRepRuleValue.push({ left: left, right: right });
		this.refreshSelectionReplaceRule();
		return true;
	}

	deleteUserSelectionRepRule(idx: number): void {
		if (idx < 0 || idx >= this.settings.userSelRepRuleTrigger.length) return;
		this.settings.userSelRepRuleTrigger.splice(idx, 1);
		this.settings.userSelRepRuleValue.splice(idx, 1);
		this.refreshSelectionReplaceRule();
	}

	updateUserSelectionRepRule(idx: number, left: string, right: string) {
		if (idx < 0 || idx >= this.settings.userSelRepRuleTrigger.length) return;
		this.settings.userSelRepRuleValue[idx].left = left;
		this.settings.userSelRepRuleValue[idx].right = right;
		this.refreshSelectionReplaceRule();
	}

	refreshUserDeleteRule() {
		this.UserDeleteRules = ruleStringList2RuleList(this.settings.userDeleteRulesStrList);
	}

	addUserDeleteRule(before: string, after: string) {
		this.settings.userDeleteRulesStrList.push([before, after]);
		this.refreshUserDeleteRule();
	}

	deleteUserDeleteRule(idx: number) {
		if (idx >= this.settings.userDeleteRulesStrList.length || idx < 0) return;
		this.settings.userDeleteRulesStrList.splice(idx, 1);
		this.refreshUserDeleteRule();
	}

	updateUserDeleteRule(idx: number, before: string, after: string) {
		if (idx >= this.settings.userDeleteRulesStrList.length || idx < 0) return;
		this.settings.userDeleteRulesStrList[idx][0] = before;
		this.settings.userDeleteRulesStrList[idx][1] = after;
		this.refreshUserDeleteRule();
	}

	refreshUserConvertRule() {
		this.UserConvertRules = ruleStringList2RuleList(this.settings.userConvertRulesStrList);
	}

	addUserConvertRule(before: string, after: string) {
		this.settings.userConvertRulesStrList.push([before, after]);
		this.refreshUserConvertRule();
	}

	deleteUserConvertRule(idx: number) {
		if (idx >= this.settings.userConvertRulesStrList.length || idx < 0) return;
		this.settings.userConvertRulesStrList.splice(idx, 1);
		this.refreshUserConvertRule();
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

	updateUserConvertRule(idx: number, before: string, after: string) {
		if (idx >= this.settings.userConvertRulesStrList.length || idx < 0) return;
		this.settings.userConvertRulesStrList[idx][0] = before;
		this.settings.userConvertRulesStrList[idx][1] = after;
		this.refreshUserConvertRule();
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}