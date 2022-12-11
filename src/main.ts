import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, WorkspaceLeaf, TFile } from 'obsidian';
import { EditorState, Extension, StateField, Transaction, TransactionSpec, Text } from '@codemirror/state';
import { SelectionRange, Prec } from "@codemirror/state";
import { EasyTypingSettingTab, EasyTypingSettings, DEFAULT_SETTINGS, PairString, ConvertRule } from "./settings"
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { posToOffset, offsetToPos, ruleStringList2RuleList, getTypeStrOfTransac } from './utils'
import { LineFormater, getPosLineType, LineType } from './core'
import { syntaxTree } from "@codemirror/language";

export default class EasyTypingPlugin extends Plugin {
	settings: EasyTypingSettings;
	selectionReplaceMapInitalData: [string, PairString][];
	SelectionReplaceMap: Map<string, PairString>;
	SymbolPairsMap: Map<string, string>;
	BasicConvRules: ConvertRule[];
	FW2HWSymbolRules: ConvertRule[];
	Formater: LineFormater;
	IntrinsicDeleteRules: ConvertRule[];
	IntrinsicAutoPairRulesPatch: ConvertRule[];
	CurActiveMarkdown: string;

	UserDeleteRules: ConvertRule[];
	UserConvertRules: ConvertRule[];


	async onload() {
		await this.loadSettings();
		this.selectionReplaceMapInitalData = [
			["【", { left: "[", right: "]" }], ["￥", { left: "$", right: "$" }], ["·", { left: "`", right: "`" }],
			["《", { left: "《", right: "》" }], ["“", { left: "“", right: "”" }], ["”", { left: "“", right: "”" }], ["（", { left: "（", right: "）" }],
			["<", { left: "<", right: ">" }]
		];
		this.refreshSelectionReplaceRule();
		this.SymbolPairsMap = new Map<string, string>();
		let SymbolPairs = ["【】", "（）", "《》", "“”", "‘’", "「」", "『』"]
		for (let pairStr of SymbolPairs) this.SymbolPairsMap.set(pairStr.charAt(0), pairStr.charAt(1));
		let BasicConvRuleStringList: Array<[string, string]> = [['··|', '`|`'], ["`·|`", "```|\n```"],
		["【【|】", "[[|]]"], ['【【|', "[[|]]"], ['￥￥|', '$|$'], ['$￥|$', "$$\n|\n$$"], ["$$|$", "$$\n|\n$$"], ['$$|', "$|$"],
		[">》|", ">>|"], ['\n》|', "\n>|"], [" 》|", " >|"], ["\n、|", "\n/|"], [' 、|', " /|"]];
		this.BasicConvRules = ruleStringList2RuleList(BasicConvRuleStringList);
		let FW2HWSymbolRulesStrList: Array<[string, string]> = [["。。|", ".|"], ["！！|", "!|"], ["；；|", ";|"], ["，，|", ",|"],
		["：：|", ":|"], ['？？|', '?|'], ['、、|', '/|'], ['（（|）', "(|)"], ['（（|', '(|)'], ["““|”", "\"|\""], ["“”|”", "\"|\""],
		["》》|", ">|"], ["《《|》", "<|"], ['《《|', "<|"]];
		this.FW2HWSymbolRules = ruleStringList2RuleList(FW2HWSymbolRulesStrList);

		let DeleteRulesStrList: Array<[string, string]> = [["$|$", "|"], ['```|\n```', '|'], ['==|==', '|'], ['$$\n|\n$$', "|"]];
		this.IntrinsicDeleteRules = ruleStringList2RuleList(DeleteRulesStrList);

		// let
		let autoPairRulesPatchStrList: Array<[string, string]> = [["【】|】", "【】|"], ["（）|）", "（）|"],
		["<>|>", "<>|"], ["《》|》", "《》|"], ["「」|」", "「」|"], ["『』|』", "『』|"]
		];
		this.IntrinsicAutoPairRulesPatch = ruleStringList2RuleList(autoPairRulesPatchStrList);

		this.refreshUserDeleteRule();
		this.refreshUserConvertRule();

		this.CurActiveMarkdown = "";

		this.Formater = new LineFormater();

		this.registerEditorExtension([
			EditorState.transactionFilter.of(this.transactionFilterPlugin),
			EditorView.updateListener.of(this.viewUpdatePlugin)
		]);

		this.registerEditorExtension(Prec.highest(keymap.of([{
			key: "Tab",
			run: (view: EditorView): boolean => {
				const success = this.handleTabDown(view);
				return success;
			}
		}])));

		this.addCommand({
			id: "easy-typing-format-article",
			name: "format current article",
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
			name: "format selected text or current line",
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
			name: "Delete blank lines of the selected area or whole article",
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
			name: "insert code block w/wo selection",
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
			name: "switch autoformat",
			callback: () => this.switchAutoFormatting(),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: "tab"
			}],
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EasyTypingSettingTab(this.app, this));

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

		let changeTypeStr = getTypeStrOfTransac(tr);
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let changedStr = tr.startState.sliceDoc(fromA, toA);
			let insertedStr = inserted.sliceString(0);
			// if (this.settings.debug)
			// {
			// 	console.log("TransactionFilter catch change:",changeTypeStr, fromA, toA, fromB, toB, insertedStr);
			// }
			// ========== Selection Replace ============
			if (this.settings.SelectionEnhance) {
				if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA != toA && fromB + 1 === toB) {
					if (this.SelectionReplaceMap.has(insertedStr)) {
						changes.push({ changes: { from: fromA, insert: this.SelectionReplaceMap.get(insertedStr)?.left }, userEvent: "EasyTyping.change" })
						changes.push({ changes: { from: toA, insert: this.SelectionReplaceMap.get(insertedStr)?.right }, userEvent: "EasyTyping.change" })
						tr = tr.startState.update(...changes);
						return tr;
					}
				}
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

			// 通常单字输入
			if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA === toA && fromB + 1 === toB) {
				// if (this.settings.debug) console.log("Input.type => ", insertedStr)
				// =========== basic convert rules ============
				// not support undo and redo
				if (this.settings.BaseObEditEnhance) {
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

	viewUpdatePlugin = (update: ViewUpdate) => {

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

		let isExcludeFile = this.checkExclude(this.CurActiveMarkdown);
		// console.log(this.CurActiveMarkdown, isExcludeFile)

		// if (this.settings.debug) console.log("-----ViewUpdateWChange-----");
		let tr = update.transactions[0]
		let changeType = getTypeStrOfTransac(tr);
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let insertedStr = inserted.sliceString(0);
			let changedStr = tr.startState.doc.sliceString(fromA, toA);
			if (this.settings.debug)
				console.log("ViewUpdate Catch Change-> Type: " + changeType + ", ", fromA, toA, changedStr, fromB, toB, insertedStr);

			// 找到光标位置，比较和 toB 的位置是否相同，相同且最终插入文字为中文，则为中文输入结束的状态
			let cursor = update.view.state.selection.asSingle().main;
			let ChineseRegExp = /[\u4e00-\u9fa5【】·￥《》？：’‘”“「」、。，（）！——……0-9]/;
			let chineseEndFlag = changeType == "input.type.compose" &&
				cursor.anchor == cursor.head && cursor.anchor === toB &&
				ChineseRegExp.test(insertedStr);

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

				// 判断格式化文本
				// console.log("ready to format");
				// console.log(this.settings.AutoFormat, formatLineFlag, this.ContentParser.isTextLine(offsetToPos(update.view.state.doc, fromB).line))
				if (this.settings.AutoFormat && notSelected && !isExcludeFile && (changeType != 'none' || insertedStr.contains("\n")) &&
					getPosLineType(update.view.state, fromB) == LineType.text) {
					let changes = this.Formater.formatLineOfDoc(update.state, this.settings, fromB, cursor.anchor, insertedStr);
					if (changes != null) {
						update.view.dispatch(...changes[0]);
						update.view.dispatch(changes[1]);
						return;
					}
				}
			}

			if (this.settings.AutoFormat && !isExcludeFile && changeType == "input.paste") {
				let updateLineStart = update.state.doc.lineAt(fromB).number;
				let updateLineEnd = update.state.doc.lineAt(toB).number;
				if (updateLineStart == updateLineEnd && getPosLineType(update.view.state, toB) == LineType.text) {
					let changes = this.Formater.formatLineOfDoc(update.state, this.settings, toB, toB, insertedStr);
					if (changes != null) {
						update.view.dispatch(...changes[0]);
						update.view.dispatch(changes[1]);
						return;
					}
				}
				else {
					for (let i = updateLineStart; i <= updateLineEnd; i++) {
						this.formatOneLine(this.getEditor(), i);
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

		return false;
	}

	formatArticle = (editor: Editor, view: MarkdownView): void => {
		let lineCount = editor.lineCount();
		for (let i = 0; i < lineCount; i++) {
			this.formatOneLine(editor, i + 1);
		}
		new Notice("EasyTyping: Format Article Done!");
	}

	checkExclude(path: string): boolean {
		let excludePaths = this.settings.ExcludeFiles.split('\n');
		for (let epath of excludePaths) {
			if (epath.charAt(0) == '/') epath = epath.substring(1);
			if (path == epath) return true;
			let len = epath.length;
			if (path.substring(0, len) == epath && (path.charAt(len) == '/' || path.charAt(len) == '\\' ||
				epath.charAt(len - 1) == "/" || epath.charAt(len - 1) == "\\")) {
				return true;
			}
		}
		return false;
	}

	formatSelectionOrCurLine = (editor: Editor, view: MarkdownView): void => {
		if (!editor.somethingSelected() || editor.getSelection() === '') {
			let lineNumber = editor.getCursor().line;
			this.formatOneLine(editor, lineNumber + 1);
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
		for (; begin <= end; begin++) {
			this.formatOneLine(editor, begin + 1);
		}
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

		if (getPosLineType(state, line.from) == LineType.text) {
			let oldLine = line.text;
			let newLine = this.Formater.formatLine(state, lineNumber, this.settings, oldLine.length)[0];
			if (oldLine != newLine) {
				editor.replaceRange(newLine, { line: lineNumber - 1, ch: 0 }, { line: lineNumber - 1, ch: oldLine.length });
				editor.setCursor({ line: lineNumber - 1, ch: editor.getLine(lineNumber - 1).length });
			}
		}
		return;
	}


	deleteBlankLines = (editor: Editor): void => {
		// @ts-expect-error, not typed
		const editorView = editor.cm as EditorView;
		let state = editorView.state;
		let doc = state.doc
		const tree = syntaxTree(state);
		let start_line = 1;
		let end_line = doc.lines;
		let line_num = doc.lines
		if (editor.somethingSelected() && editor.getSelection() != '') {
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

		let delete_index: number[] = [];
		let blank_reg = /^\s*$/;
		let remain_next_blank = false;

		if (start_line != 1) {
			let node = tree.resolve(doc.line(start_line - 1).from, 1);
			if (node.name.contains('list') || node.name.contains('quote')) {
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
			else if (node.name.contains('list') || node.name.contains('quote')) {
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