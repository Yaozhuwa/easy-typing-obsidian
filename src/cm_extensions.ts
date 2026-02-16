import { Transaction, TransactionSpec, EditorState, Extension } from '@codemirror/state';
import { Editor, Platform } from 'obsidian';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { PluginContext } from './plugin_context';
import { triggerCvtRule, triggerPuncRectify } from './rule_processor';
import { isCurrentFileExclude } from './formatting_commands';
import { RuleType, TxContext } from './rule_engine';
import { tabstopSpecsToTabstopGroups } from './tabstop';
import { addTabstopsEffect, hasTabstops, removeAllTabstops, isInsideCurTabstop } from './tabstops_state_field';
import { getCodeBlockInfoInPos, isCodeBlockInPos, detectRuleScope } from './syntax';
import { getPosLineType, LineType } from './core';
import { getTypeStrOfTransac, print } from './utils';

export function createTransactionFilter(ctx: PluginContext): Extension {
	return EditorState.transactionFilter.of((tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
		const changes: TransactionSpec[] = [];
		if (!tr.docChanged) return tr;
		let selected = tr.startState.selection.asSingle().main.anchor != tr.startState.selection.asSingle().main.head;

		let changeTypeStr = getTypeStrOfTransac(tr);

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
			let changedStr = tr.startState.sliceDoc(fromA, toA);
			let changestr_ = changedStr.replace(/\s/g, '0')
			let insertedStr = inserted.sliceString(0);
			if (ctx.settings?.debug)
			{
				console.log("[TransactionFilter] type, fromA, toA, changed, fromB, toB, inserted");
				console.log(changeTypeStr, fromA, toA, changedStr,fromB, toB, insertedStr);
			}

			// 表格编辑时直接返回，解决表格内容编辑有时候会跳出聚焦状态的 Bug
			if (getPosLineType(tr.startState, fromA)==LineType.table) return tr;

			// ========== Selection Replace ============
			if (ctx.settings.SelectionEnhance) {
				if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA != toA && ((fromB + 1 === toB)||insertedStr=='——'||insertedStr=='……')) {
					const selScope = detectRuleScope(tr.startState, fromA);
					const selCtx: TxContext = {
						kind: RuleType.SelectKey,
						docText: tr.startState.doc.toString(),
						selection: { from: fromA, to: toA },
						inserted: insertedStr,
						changeType: changeTypeStr,
						scopeHint: selScope.scope,
						scopeLanguage: selScope.language,
						key: insertedStr,
						debug: ctx.settings?.debug,
					};
					const selResult = ctx.ruleEngine.process(selCtx);
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
			if (ctx.settings.BetterCodeEdit && changeTypeStr.contains('paste') && fromA==fromB &&
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
						trimmed_line = trimmed_line.replace(/[\t]/g, ctx.getDefaultIndentChar())
						if (index === 0) {
							return trimmed_line;  // 第一行不添加额外缩进
						} else {
							return base_indent + trimmed_line;  // 其他行添加基础缩进
						}
					});

					// console.log('default indent: ', ctx.getDefaultIndentChar().length)
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
			if (ctx.settings.BaseObEditEnhance && changeTypeStr.contains('paste') && fromA==fromB && fromA == tr.startState.doc.lineAt(toA).to){
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
							trimmed_line = trimmed_line.replace(/[\t]/g, ctx.getDefaultIndentChar())
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
							trimmed_line = trimmed_line.replace(/[\t]/g, ctx.getDefaultIndentChar())
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


			// 尝试解决微软旧版输入法的问题~
			if (ctx.settings.TryFixMSIME &&
				changeTypeStr == "input.type.compose" &&
				changedStr == '' && /^[\u4e00-\u9fa5]+$/.test(insertedStr)){
				print("MS-IME Compose detected:", insertedStr);
				tr = tr.startState.update(...changes);
				return tr;
			}

			let codeblockinfo = getCodeBlockInfoInPos(tr.startState, toA);
			// print(codeblockinfo, toA)
			// 列表下的代码块删除功能优化
			if (ctx.settings.BetterCodeEdit && changeTypeStr == "delete.backward" && !selected &&
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

			// Unified delete rules (intrinsic + user) via RuleEngine
			if (changeTypeStr === "delete.backward") {
				const delScope = detectRuleScope(tr.startState, toA);
				const delCtx: TxContext = {
					kind: RuleType.Delete,
					docText: tr.startState.doc.toString(),
					selection: { from: toA, to: toA },
					inserted: '',
					changeType: changeTypeStr,
					scopeHint: delScope.scope,
					scopeLanguage: delScope.language,
					debug: ctx.settings?.debug,
				};
				const delResult = ctx.ruleEngine.process(delCtx);
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


			// 通常单字输入
			// if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA === toA && fromB + 1 === toB) {
			// 	// if (ctx.settings.debug) console.log("Input.type => ", insertedStr)
			// 	// =========== basic convert rules ============
			// 	// not support undo and redo
			// 	if (ctx.settings.BaseObEditEnhance) {
			// 		// 处理英文标点下``|的情况，光标自动跳转到中间
			// 		if (insertedStr === '`' &&
			// 			toA-tr.startState.doc.lineAt(toA).from>2 &&
			// 			tr.startState.sliceDoc(toA-1, toA) === '`'
			// 			&& tr.startState.sliceDoc(toA-2, toA-1) != '`'){
			// 			changes.push({
			// 				changes: {from:toA, insert:'`'},
			// 				selection: { anchor: toA }, userEvent: "EasyTyping.change"
			// 			});
			// 			tr = tr.startState.update(...changes);
			// 			return tr;
			// 		}
			// 	}
			// }

		})
		return tr;
	});
}

/**
 * 共享的输入处理管线：triggerCvtRule → puncRectify → autoFormat
 * compose end 和 normal input 都走这条路径
 */
function tryProcessInput(
	ctx: PluginContext, update: ViewUpdate,
	changeFrom: number, cursorPos: number,
	isCompose: boolean
): boolean {
	if (getPosLineType(update.view.state, changeFrom) === LineType.table) return false;
	if (triggerCvtRule(ctx, update.view, cursorPos)) return true;
	if (isCompose && triggerPuncRectify(ctx, update.view, changeFrom)) return true;
	if (!ctx.settings.AutoFormat || isCurrentFileExclude(ctx)) return false;
	const lineType = getPosLineType(update.view.state, changeFrom);
	if (lineType !== LineType.text && lineType !== LineType.table) return false;
	const insertedStr = update.view.state.doc.sliceString(changeFrom, cursorPos);
	const changes = ctx.Formater.formatLineOfDoc(update.state, ctx.settings, changeFrom, cursorPos, insertedStr);
	if (changes) {
		update.view.dispatch(...changes[0]);
		update.view.dispatch(changes[1]);
		return true;
	}
	return false;
}

export function createViewUpdatePlugin(ctx: PluginContext): Extension {
	return EditorView.updateListener.of((update: ViewUpdate) => {
		if (ctx.onFormatArticle) return;

		// --- Tabstop 清理 ---
		if (hasTabstops(update.view)) {
			const cursor_changed = update.transactions.some(tr => tr.selection);
			if ((update.docChanged || cursor_changed) && !update.view.composing && !isInsideCurTabstop(update.view)) {
				removeAllTabstops(update.view);
			}
			if (update.transactions.some(tr => tr.isUserEvent("undo"))) {
				removeAllTabstops(update.view);
			}
		}

		// --- Compose 状态跟踪 ---
		if (update.view.composing) {
			if (update.docChanged) {
				let tr = update.transactions[0];
				tr.changes.iterChanges((fromA) => {
					if (!ctx.compose_need_handle) {
						ctx.compose_need_handle = true;
						ctx.compose_begin_pos = fromA;
					}
					ctx.compose_end_pos = update.view.state.selection.asSingle().main.anchor;
				});
			}
			return;
		}

		// --- Compose end 处理（无论 docChanged 与否） ---
		if (ctx.compose_need_handle) {
			ctx.compose_need_handle = false;
			const cursor = update.view.state.selection.asSingle().main;
			if (cursor.head === cursor.anchor) {
				if (tryProcessInput(ctx, update, ctx.compose_begin_pos, cursor.anchor, true)) return;
			}
		}

		if (!update.docChanged) return;

		// --- 提取首个变更到局部变量 ---
		const tr = update.transactions[0];
		const changeType = getTypeStrOfTransac(tr);

		let fromA = 0, toA = 0, fromB = 0, toB = 0, insertedStr = '', changedStr = '';
		tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
			fromA = _fromA; toA = _toA; fromB = _fromB; toB = _toB;
			insertedStr = inserted.sliceString(0);
			changedStr = tr.startState.doc.sliceString(_fromA, _toA);
		});

		if (ctx.settings?.debug) {
			console.log("[ViewUpdate] type, fromA, toA, changed, fromB, toB, inserted");
			console.log(changeType, fromA, toA, changedStr, fromB, toB, insertedStr);
		}

		if (getPosLineType(update.view.state, fromB) === LineType.table) return;
		if (changeType.includes('EasyTyping') || changeType === 'undo' || changeType === 'redo') return;

		const cursor = update.view.state.selection.asSingle().main;
		const notSelected = cursor.anchor === cursor.head;

		// --- 正常输入结束 → 触发规则 + 自动格式化 ---
		if (notSelected && changedStr.length < 1 && !changeType.includes('delete')) {
			if (tryProcessInput(ctx, update, fromB, cursor.anchor, false)) return;
		}

		// --- 粘贴时自动格式化 ---
		const isExcludeFile = isCurrentFileExclude(ctx);
		if (ctx.settings.AutoFormat && !isExcludeFile && changeType === "input.paste" && !Platform.isIosApp) {
			let updateLineStart = update.state.doc.lineAt(fromB).number;
			let updateLineEnd = update.state.doc.lineAt(toB).number;
			if (updateLineStart === updateLineEnd && getPosLineType(update.view.state, toB) === LineType.text) {
				let changes = ctx.Formater.formatLineOfDoc(update.state, ctx.settings, fromB, toB, insertedStr);
				if (changes) {
					update.view.dispatch(...changes[0]);
					return;
				}
			}
			else {
				let all_changes: TransactionSpec[] = [];
				let inserted_array = insertedStr.split("\n");
				let update_start = fromB;
				for (let i = updateLineStart; i <= updateLineEnd; i++) {
					let real_inserted = inserted_array[i - updateLineStart];
					let changes = ctx.Formater.formatLineOfDoc(update.state, ctx.settings, update_start, update_start + real_inserted.length, real_inserted);
					if (changes) {
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
	});
}

export async function normalPaste(editor: Editor, debug?: boolean): Promise<void> {
	let clipboardText = await navigator.clipboard.readText();
	if (clipboardText === null || clipboardText === "") return;

	if (debug) console.log("Normal Paste!!")
	const editorView = editor.cm as EditorView;
	let mainSelection = editorView.state.selection.asSingle().main;
	editorView.dispatch({
		changes: { from: mainSelection.from, to: mainSelection.to, insert: clipboardText },
		selection: {anchor: mainSelection.from + clipboardText.length},
		userEvent: "EasyTyping.paste"
	});
}
