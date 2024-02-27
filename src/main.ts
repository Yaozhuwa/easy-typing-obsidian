import { App, Editor, Menu, EditorSelection, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, WorkspaceLeaf, TFile } from 'obsidian';
import { EditorState, Extension, StateField, Transaction, TransactionSpec, Text } from '@codemirror/state';
import { SelectionRange, Prec } from "@codemirror/state";
import { EasyTypingSettingTab, EasyTypingSettings, DEFAULT_SETTINGS, PairString, ConvertRule } from "./settings"
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { posToOffset, offsetToPos, string2pairstring, ruleStringList2RuleList, getTypeStrOfTransac } from './utils'
import { LineFormater, getPosLineType, getPosLineType2, LineType } from './core'
import { syntaxTree } from "@codemirror/language";
import { Platform } from "obsidian";
import { print } from './utils';

declare module "obsidian" {
	// add type safety for the undocumented methods, 
	// COPY FROM https://github.com/chrisgrieser/obsidian-smarter-md-hotkeys/tree/master
	// interface Editor {
	// 	cm: {
	// 		findWordAt?: (pos: EditorPosition) => EditorSelection;
	// 		state?: { wordAt: (offset: number) => { from: number, to: number} };
	// 	};
	// }
	// interface App {
	// 	commands: { executeCommandById: (commandID: string) => void };
	// }
	interface Vault {
		setConfig: (config: string, newValue: boolean) => void;
		getConfig: (config: string) => boolean;
	}
}

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

	UserDeleteRules: ConvertRule[];
	UserConvertRules: ConvertRule[];
	lang: string;

	compose_begin_pos: number;
	compose_end_pos: number;
	compose_need_handle: boolean;

	onFormatArticle: boolean;
	TaboutPairStrs: PairString[];
	saved_table_viewupdate: ViewUpdate;

	async onload() {
		await this.loadSettings();
		this.selectionReplaceMapInitalData = [
			["【", { left: "[", right: "]" }], ["￥", { left: "$", right: "$" }], ["·", { left: "`", right: "`" }],
			["《", { left: "《", right: "》" }], ["“", { left: "“", right: "”" }], ["”", { left: "“", right: "”" }], ["（", { left: "（", right: "）" }],
			["<", { left: "<", right: ">" }]
		];
		this.refreshSelectionReplaceRule();
		this.SymbolPairsMap = new Map<string, string>();
		let SymbolPairs = ["【】", "（）", "《》", "“”", "‘’", "「」", "『』", '[]', '()', '{}']
		for (let pairStr of SymbolPairs) this.SymbolPairsMap.set(pairStr.charAt(0), pairStr.charAt(1));

		this.halfToFullSymbolMap = new Map([
			[".", "。"],
			[",", "，"],
			['?', '？'],
			['!', '！']
		]);

		let BasicConvRuleStringList: Array<[string, string]> = [['··|', '`|`'], ["！【【|】",'![[|]]'],['！【【|', '![[|]]'],
		["【【|】", "[[|]]"], ['【【|', "[[|]]"], ['￥￥|', '$|$'], ['$￥|$', "$$\n|\n$$"],['¥¥|','$|$'], ['$¥|$', "$$\n|\n$$"],["$$|$", "$$\n|\n$$"], ['$$|', "$|$"],
		[">》|", ">>|"], ['\n》|', "\n>|"], [" 》|", " >|"], ["\n、|", "\n/|"]];
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
		["<>|>", "<>|"], ["《》|》", "《》|"], ["「」|」", "「」|"], ["『』|』", "『』|"], ["()|)", "()|"], ['[]|]', '[]|']
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

		this.saved_table_viewupdate = null;

		this.registerEditorExtension([
			EditorState.transactionFilter.of(this.transactionFilterPlugin),
			EditorView.updateListener.of(this.viewUpdatePlugin),
			Prec.highest(EditorView.domEventHandlers({
				"keyup": this.onKeyup
			}))
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
			}
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
				modifiers: ['Ctrl', 'Shift'],
				key: "s"
			}],
		});

		this.addCommand({
			id: "easy-typing-format-selection",
			name: command_name_map.get("format_selection"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.formatSelectionOrCurLine(editor, view);
			},
			hotkeys: [{
				modifiers: ['Ctrl', 'Shift'],
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
				modifiers: ['Ctrl', 'Shift'],
				key: "k"
			}],
		});

		this.addCommand({
			id: "easy-typing-insert-codeblock",
			name: command_name_map.get("insert_codeblock"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.convert2CodeBlock(editor);
			},
			hotkeys: [{
				modifiers: ['Ctrl', 'Shift'],
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
	}

	onunload() {
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
			// if (this.settings.debug)
			// {
			// 	console.log("TransactionFilter catch change:",changeTypeStr, fromA, toA, changedStr,fromB, toB, insertedStr);
			// }

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

			if (selected) return tr;

			// 尝试解决微软旧版输入法的问题~
			if (changeTypeStr == "input.type.compose" && changedStr == '' && /^[\u4e00-\u9fa5]+$/.test(insertedStr)){
				print("MS-IME Compose detected:", insertedStr);
				tr = tr.startState.update(...changes);
				return tr;
			}

			// UserDefined Delete Rule
			if (changeTypeStr == "delete.backward") {
				for (let rule of this.UserDeleteRules) {
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

			// ========== delete pair symbol ============
			if (changeTypeStr === "delete.backward" && this.settings.IntrinsicSymbolPairs) {
				if (this.SymbolPairsMap.has(changedStr) && this.SymbolPairsMap.get(changedStr) === tr.startState.sliceDoc(toA, toA + 1)) {
					changes.push({ changes: { from: fromA, to: toA + 1 }, userEvent: "EasyTyping.change" });
					tr = tr.startState.update(...changes);
					return tr;
				}

				// 处理删除代码块
				let line_content = tr.startState.doc.lineAt(fromA).text;
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

					if (this.SymbolPairsMap.has(insertedStr)) {
						changes.push({
							changes: { from: fromA, to: toA, insert: insertedStr + this.SymbolPairsMap.get(insertedStr) },
							selection: { anchor: fromA + 1 },
							userEvent: "EasyTyping.change"
						});
						tr = tr.startState.update(...changes);
						return tr;
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

		editor.replaceSelection(clipboardText);
	}

	viewUpdatePlugin = (update: ViewUpdate) => {
		
		if (this.onFormatArticle === true) return;

		// console.log(tree);
		// if (this.settings.debug) console.log("-------ViewUpdate---------");
		let notSelected = true;
		let mainSelection = update.view.state.selection.asSingle().main;
		if (mainSelection.anchor != mainSelection.head) notSelected = false;
		// ------ Debug ------------
		// if (notSelected){
		// 	// this.Formater.parseLineWithSyntaxTree(update.state, update.state.doc.lineAt(mainSelection.anchor).number);
		// 	const tree = syntaxTree(update.state);
		// 	let pos = mainSelection.anchor;
		// 	let node = tree.resolve(pos, 1);
		// 	console.log(node.name, node.from, node.to, update.state.doc.sliceString(node.from, node.to));
		// }

		if (!update.docChanged) return;
		// console.log('------------- viewUpdatePlugin -------------')
		let isExcludeFile = this.isCurrentFileExclude();
		// console.log(this.CurActiveMarkdown, isExcludeFile)

		// if (this.settings.debug) console.log("-----ViewUpdateWChange-----");
		let tr = update.transactions[0]
		let changeType = getTypeStrOfTransac(tr);

		let need_update:boolean = true;
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let insertedStr = inserted.sliceString(0);
			let changedStr = tr.startState.doc.sliceString(fromA, toA);
			if (this.settings.debug)
				console.log("ViewUpdate Catch Change-> Type: " + changeType + ", ", 'fromA-toA-changedStr:', fromA, toA, changedStr, "fromB-toB-insertedStr:", fromB, toB, insertedStr);
			if (changeType!='none' && getPosLineType(update.view.state, fromB) == LineType.table){
				this.saved_table_viewupdate = update;
				if (this.settings.debug) console.log('save table viewupdate, and skip viewUpdatePlugin');
				need_update = false;
			}
		});

		if (!need_update) return;
		if (this.saved_table_viewupdate != null && changeType == 'none'){
			this.viewUpdateFn(this.saved_table_viewupdate);
			this.saved_table_viewupdate = null;
		}
		this.viewUpdateFn(update);
	}

	viewUpdateFn = (update: ViewUpdate) => {
		if (this.onFormatArticle === true) return;

		// console.log(tree);

		// if (this.settings.debug) console.log("-------ViewUpdate---------");
		let notSelected = true;
		let mainSelection = update.view.state.selection.asSingle().main;
		if (mainSelection.anchor != mainSelection.head) notSelected = false;
		if (!update.docChanged) return;

		let isExcludeFile = this.isCurrentFileExclude();
		// console.log(this.CurActiveMarkdown, isExcludeFile)

		// if (this.settings.debug) console.log("-----ViewUpdateWChange-----");
		let tr = update.transactions[0]
		let changeType = getTypeStrOfTransac(tr);

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let insertedStr = inserted.sliceString(0);
			let changedStr = tr.startState.doc.sliceString(fromA, toA);
			// if (this.settings.debug)
			// 	console.log("ViewUpdate Catch Change-> Type: " + changeType + ", ", 'fromA-toA-changedStr:', fromA, toA, changedStr, "fromB-toB-insertedStr:", fromB, toB, insertedStr);

			// 找到光标位置，比较和 toB 的位置是否相同，相同且最终插入文字为中文，则为中文输入结束的状态
			let cursor = update.view.state.selection.asSingle().main;
			let ChineseRegExp = /^[\u4e00-\u9fa5【】·￥《》？：；’‘”“「」、。，（）！——……\d]+$/;
			let chineseEndFlag = changeType == "input.type.compose" &&
				cursor.anchor == cursor.head && cursor.anchor === toB &&
				ChineseRegExp.test(insertedStr);

			if (changeType != "input.type.compose") this.compose_need_handle = false;
			if (this.settings.AutoFormat && notSelected && !isExcludeFile &&
				(getPosLineType(update.view.state, fromB) == LineType.text || getPosLineType(update.view.state, fromB) == LineType.table)) {
				if (changeType == "input.type.compose") {
					if (!/^\d$/.test(insertedStr)){
						if (this.compose_need_handle == false) {
							this.compose_begin_pos = fromB;
							this.compose_end_pos = toB;
							this.compose_need_handle = true;
						}
						else {
							this.compose_end_pos = toB;
							if (this.compose_begin_pos == this.compose_end_pos) {
								this.compose_need_handle = false;
							}
						}
						if (chineseEndFlag) this.compose_need_handle = false;
					}
					else{
						if (this.compose_need_handle) {
							this.compose_end_pos = toB;
							if (this.compose_begin_pos == this.compose_end_pos) {
								this.compose_need_handle = false;
							}
							chineseEndFlag = this.compose_need_handle?false:chineseEndFlag;
						}
					}
					
				}
				if (chineseEndFlag) this.compose_need_handle = false;
				// console.log("Compose", chineseEndFlag, this.compose_need_handle);
			}


			// 判断每次输入结束
			if (changeType == 'input.type' || changeType == "input" || chineseEndFlag || changeType == 'none') {
				// 用户自定义转化规则
				for (let rule of this.UserConvertRules) {
					// if (insertedStr != rule.before.left.substring(rule.before.left.length - insertedStr.length)) continue;
					let left = update.view.state.doc.sliceString(toB - rule.before.left.length, toB);
					let right = update.view.state.doc.sliceString(toB, toB + rule.before.right.length);
					if (left === rule.before.left && right === rule.before.right) {
						update.view.dispatch({
							changes: {
								from: toB - rule.before.left.length,
								to: toB + rule.before.right.length,
								insert: rule.after.left + rule.after.right
							},
							selection: { anchor: toB - rule.before.left.length + rule.after.left.length },
							userEvent: "EasyTyping.change"
						})
						return;
					}
				}

				if (this.settings.PuncRectify && chineseEndFlag && this.compose_begin_pos > 1 &&
					/[,.?!]/.test(update.view.state.doc.sliceString(this.compose_begin_pos - 1, this.compose_begin_pos))) {
					let punc = update.view.state.doc.sliceString(this.compose_begin_pos - 1, this.compose_begin_pos)
					if (this.compose_begin_pos > 2 &&
						/[\s\n\w]/.test(update.view.state.doc.sliceString(this.compose_begin_pos - 2, this.compose_begin_pos - 1))) { }
					else {
						update.view.dispatch({
							changes: {
								from: this.compose_begin_pos - 1,
								to: this.compose_begin_pos,
								insert: this.halfToFullSymbolMap.get(punc)
							},
							// selection: { anchor: toB - rule.before.left.length + rule.after.left.length },
							userEvent: "EasyTyping.change"
						})
						return;
					}
				}

				// 判断格式化文本
				// console.log("ready to format");
				// console.log("check is exclue file:", isExcludeFile)
				if (this.settings.AutoFormat && notSelected && !isExcludeFile &&
					 (changeType != 'none' || insertedStr=="\n")) {
					
					if (getPosLineType(update.view.state, fromB) == LineType.text || getPosLineType(update.view.state, fromB) == LineType.table){
						let changes = this.Formater.formatLineOfDoc(update.state, this.settings, fromB, cursor.anchor, insertedStr);
						if (changes != null) {
							update.view.dispatch(...changes[0]);
							update.view.dispatch(changes[1]);
							return;
						}
					}
					
				}
			}

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

		// 当光标在行内代码内部
		if (pos - line.from != 0 && tree.resolve(pos - 1, 1).name.contains('inline-code')) {
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
			console.log("selection", selection.anchor, selection.head)

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


		return false;
	}

	private readonly handleEnter = (view: EditorView) => {
		// console.log("this.settings.EnterTwice", this.settings.EnterTwice)
		if (!this.settings.EnterTwice) return false;

		// const basePath = (this.app.vault.adapter as any).basePath
		// let config_path = basePath + "/" + this.app.vault.configDir + "/app.json";
		// let config = JSON.parse(fs.readFileSync(config_path, 'utf-8'))
		// let strictLineBreaks = config.strictLineBreaks || false;
		let strictLineBreaks = this.app.vault.getConfig("strictLineBreaks");
		if (!strictLineBreaks) return false;

		let state = view.state;
		let doc = state.doc
		const tree = syntaxTree(state);
		const s = view.state.selection;
		if (s.ranges.length > 1) return false;
		const pos = s.main.to;
		let line = doc.lineAt(pos)

		// console.log(line.text, getPosLineType2(state, pos))
		// for (let p=line.from; p<=line.to; p+=1){
		// 	const token = tree.resolve(p, 1).name
		// 	console.log(p-line.from, token)
		// }
		if (/^\s*$/.test(line.text)) return false;
		else if (getPosLineType2(state, pos) == LineType.text) {
			view.dispatch({
				changes: {
					from: pos,
					to: pos,
					insert: '\n\n'
				},
				selection: { anchor: pos + 2 },
				userEvent: "EasyTyping.change"
			})
			return true;
		}

		return false;
	}

	private readonly onKeyup = (event: KeyboardEvent, view: EditorView) => {
		if (this.settings.debug) {
			// console.log("Keyup:", event.key, event.shiftKey, event.ctrlKey||event.metaKey);
			console.log("Keyup:", event.key);
		}
		this.handleEndComposeTypeKey(event, view);
	}

	handleEndComposeTypeKey = (event: KeyboardEvent, view: EditorView) => {
		if (!this.settings.TryFixChineseIM) return;
		if (['Enter', 'Process', ' ', 'Shift'].contains(event.key) && this.settings.AutoFormat &&
			this.compose_need_handle && !this.isCurrentFileExclude()) {
			let cursor = view.state.selection.asSingle().main;
			if (getPosLineType(view.state, cursor.anchor) != LineType.text) return;
			if (cursor.head != cursor.anchor) return;
			let insertedStr = view.state.doc.sliceString(this.compose_begin_pos, cursor.anchor);
			// console.log("inserted str", insertedStr);
			let changes = this.Formater.formatLineOfDoc(view.state, this.settings,
				this.compose_begin_pos, cursor.anchor, insertedStr);
			this.compose_need_handle = false;
			if (changes != null) {
				view.dispatch(...changes[0]);
				view.dispatch(changes[1]);
				return;
			}
		}
	}

	formatArticle = (editor: Editor, view: MarkdownView): void => {
		
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
			console.log('i+1', i + 1)
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

	// param: lineNumber is (1-based)
	formatOneLine = (editor: Editor, lineNumber: number): void => {
		// @ts-expect-error, not typed
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
		// @ts-expect-error, not typed
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
		const basePath = (this.app.vault.adapter as any).basePath
		let config_path = basePath + "/" + this.app.vault.configDir + "/app.json";
		if (this.settings.debug) {
			console.log(this.app.vault.getConfig("strictLineBreaks"));
			// return;
		}
		let strictLineBreaks = this.app.vault.getConfig("strictLineBreaks");

		// @ts-expect-error, not typed
		const editorView = editor.cm as EditorView;
		let state = editorView.state;
		let doc = state.doc
		const tree = syntaxTree(state);
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
		this.settings.AutoFormat = this.settings.AutoFormat ? false : true;
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
		]);

		let command_name_map_zh_TW = new Map([
			["format_article", "格式化全文"],
			["format_selection", "格式化選中部分/當前行"],
			["delete_blank_line", "刪除選中部分/全文的多餘空白行"],
			["insert_codeblock", "插入代碼塊"],
			["switch_autoformat", "切換自動格式化開關"],
			["paste_wo_format", "無格式化粘貼"],
		]);

		let command_name_map_zh = new Map([
			["format_article", "格式化全文"],
			["format_selection", "格式化选中部分/当前行"],
			["delete_blank_line", "刪除选中部分/全文的多余空白行"],
			["insert_codeblock", "插入代码块"],
			["switch_autoformat", "切换自动格式化开关"],
			["paste_wo_format", "无格式化粘贴"],
		]);

		let command_name_map = command_name_map_en;
		if (lang == 'zh') {
			command_name_map = command_name_map_zh;
		}
		else if (lang == 'zh-TW') {
			command_name_map = command_name_map_zh_TW;
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