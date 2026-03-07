import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { MarkdownView } from 'obsidian';
import { PluginContext } from './plugin_context';
import { StrictLineMode } from './settings';
import { triggerCvtRule } from './rule_processor';
import { isCodeBlockInPos, getCodeBlockInfoInPos, getQuoteInfoInPos, selectCodeBlockInPos } from './syntax';
import { getPosLineType2, LineType } from './core';
import { consumeAndGotoNextTabstop } from './tabstops_state_field';
import { taboutCursorInPairedString } from './utils';

// =====================================================
// handleTabDown and its sub-functions
// =====================================================

function tabTabstopJump(view: EditorView): boolean {
	if (consumeAndGotoNextTabstop(view)) {
		return true;
	}
	return false;
}

function tabTriggerRule(ctx: PluginContext, view: EditorView): boolean {
	const sel = view.state.selection;
	if (sel.ranges.length === 1 && sel.main.from === sel.main.to) {
		if (triggerCvtRule(ctx, view, sel.main.to, 'tab')) return true;
	}
	return false;
}

function tabCodeBlockIndent(ctx: PluginContext, view: EditorView): boolean {
	if (!ctx.settings.Tabout) return false;

	const state = view.state;
	const s = view.state.selection;
	if (s.ranges.length > 1) return false;
	const pos = s.main.to;

	if (s.main.from == s.main.to && isCodeBlockInPos(state, pos)) {
		const default_indent = ctx.getDefaultIndentChar();
		view.dispatch({
			changes: {
				from: s.main.from,
				insert: default_indent
			},
			selection: {
				anchor: s.main.from + default_indent.length
			}
		});
		return true;
	}
	return false;
}

function tabInlineCodeEscape(ctx: PluginContext, view: EditorView): boolean {
	if (!ctx.settings.Tabout) return false;
	if (!ctx.settings.BetterCodeEdit) return false;

	const state = view.state;
	const doc = state.doc;
	const tree = syntaxTree(state);
	const s = view.state.selection;
	if (s.ranges.length > 1) return false;
	const pos = s.main.to;
	const line = doc.lineAt(pos);

	// 当光标在行内代码内部
	if (pos - line.from != 0 && tree.resolve(pos - 1, 1).name.contains('inline-code')) {
		if (tree.resolve(pos, 1).name.contains('formatting-code_inline-code')) {
			view.dispatch({
				selection: { anchor: pos + 1, head: pos + 1 }
			});
			return true;
		}

		for (let p = pos + 1; p < line.to && tree.resolve(p, 1).name.contains('inline-code'); p += 1) {
			// 如果找到 ` 则光标跳到其后
			if (tree.resolve(p, 1).name.contains('formatting-code_inline-code')) {
				view.dispatch({
					selection: { anchor: p, head: p }
				});
				return true;
			}
			// 如果没找到 ` 则直接跳到行尾
			if (p == line.to - 1 && tree.resolve(p, 1).name.contains('inline-code')) {
				view.dispatch({
					selection: { anchor: p + 1, head: p + 1 }
				});
				return true;
			}
		}
	}
	return false;
}

function tabPairStringTabout(ctx: PluginContext, view: EditorView): boolean {
	if (!ctx.settings.Tabout) return false;

	const state = view.state;
	const doc = state.doc;
	const s = view.state.selection;
	if (s.ranges.length > 1) return false;
	const pos = s.main.to;
	const line = doc.lineAt(pos);

	// 当光标在行内代码外部，并在选中文本的情况下，tab将会跳出到pairstring的外部
	let selection = view.state.selection.asSingle().main;
	let selected = selection.anchor != selection.head;
	if (selected) {
		let new_anchor = selection.anchor < selection.head ? selection.anchor : selection.head;
		let new_head = selection.anchor > selection.head ? selection.anchor : selection.head;

		for (let pstr of ctx.TaboutPairStrs) {
			if (doc.sliceString(new_anchor - pstr.left.length, new_anchor) == pstr.left &&
				doc.sliceString(new_head, new_head + pstr.right.length) == pstr.right) {
				view.dispatch({
					selection: { anchor: new_head + pstr.right.length, head: new_head + pstr.right.length }
				});
				return true;
			}
		}
	}
	else {
		let taboutRes = taboutCursorInPairedString(line.text, pos - line.from, ctx.TaboutPairStrs);
		if (taboutRes.isSuccess) {
			view.dispatch({
				selection: { anchor: taboutRes.newPosition + line.from }
			});
			return true;
		}
	}

	return false;
}

export function handleTabDown(ctx: PluginContext, view: EditorView): boolean {
	return tabTabstopJump(view)
		|| tabTriggerRule(ctx, view)
		|| tabCodeBlockIndent(ctx, view)
		|| tabInlineCodeEscape(ctx, view)
		|| tabPairStringTabout(ctx, view);
}

// =====================================================
// handleEnter and its sub-functions
// =====================================================

function enterCollapsedHeading(ctx: PluginContext, view: EditorView): boolean {
	if (!ctx.settings.CollapsePersistentEnter) return false;

	const state = view.state;
	const doc = state.doc;
	const s = view.state.selection;
	const pos = s.main.to;

	const editor = ctx.app.workspace.getActiveViewOfType(MarkdownView).editor;
	let fold_offsets: Set<number> = editor.getFoldOffsets();
	let all_foldable_lines: { from: number, to: number }[] = editor.getAllFoldableLines();

	let folded_lines: { from: number, to: number }[] = [];
	for (let offset of fold_offsets) {
		let folded = all_foldable_lines.find(l => l.from == offset);
		if (folded) {
			folded_lines.push(folded);
		}
	}
	// 判断当前 cursor pos 是否在 folded_lines 中，如果有找到该范围，否则不处理
	let folded_line = folded_lines.find(l => pos >= l.from && pos <= l.to);
	if (folded_line) {
		let folded_first_line = doc.lineAt(folded_line.from).text;
		// 判断是不是 Markdown 标题行，如果是则新建同级标题行，如果不是标题行则不处理
		let reg_headings = /^#+ /;
		if (reg_headings.test(folded_first_line)) {
			let heading_level = folded_first_line.match(/^#+/)?.[0].length;
			let new_heading_level = heading_level;
			let new_heading_line = '\n' + '#'.repeat(new_heading_level) + ' ';
			let folded_last_line = doc.lineAt(folded_line.to).text;
			let folded_last_line_is_blank = /^\s*$/.test(folded_last_line);

			let new_heading_line_pos = editor.offsetToPos(folded_line.to);
			let new_cursor_pos = { line: new_heading_line_pos.line + 1, ch: new_heading_level + 1 };

			if (ctx.settings.StrictModeEnter && !folded_last_line_is_blank && (ctx.app.vault.config.strictLineBreaks || false)) {
				new_heading_line = '\n\n' + '#'.repeat(new_heading_level) + ' ';
				new_cursor_pos = { line: new_heading_line_pos.line + 2, ch: new_heading_level + 1 };
			}

			editor.replaceRange(new_heading_line, new_heading_line_pos);
			editor.setCursor(editor.offsetToPos(folded_line.from));
			editor.exec('toggleFold');
			editor.setCursor(new_cursor_pos);
			return true;
		}
	}
	return false;
}

function enterCodeBlockIndent(ctx: PluginContext, view: EditorView): boolean {
	if (!ctx.settings.BetterCodeEdit) return false;

	const state = view.state;
	const doc = state.doc;
	const s = view.state.selection;
	const pos = s.main.to;
	const line = doc.lineAt(pos);
	const codeBlockInfo = getCodeBlockInfoInPos(state, pos);

	if (codeBlockInfo && codeBlockInfo.code_start_pos !== doc.lineAt(codeBlockInfo.start_pos).to
		&& pos >= codeBlockInfo.code_start_pos && pos <= codeBlockInfo.code_end_pos) {
		let line_indent_str = line.text.match(/^\s*/)?.[0] || '';
		view.dispatch({
			changes: { from: pos, to: pos, insert: '\n' + line_indent_str },
			selection: { anchor: pos + line_indent_str.length + 1, head: pos + line_indent_str.length + 1 },
			userEvent: "EasyTyping.handleEnter"
		});
		return true;
	}
	return false;
}

function enterStrictLineBreak(ctx: PluginContext, view: EditorView): boolean {
	if (!ctx.settings.StrictModeEnter) return false;
	let strictLineBreaks = ctx.app.vault.config.strictLineBreaks || false;
	if (!strictLineBreaks) return false;

	const state = view.state;
	const doc = state.doc;
	const s = view.state.selection;
	const pos = s.main.to;
	const line = doc.lineAt(pos);
	const codeBlockInfo = getCodeBlockInfoInPos(state, pos);
	const lineType = getPosLineType2(state, pos);

	// 如果当前行为空白行，不做处理
	if (/^\s*$/.test(line.text)) return false;

	// 如果光标在当前行首，不做处理
	if (pos == line.from) return false;

	if (lineType == LineType.quote) {
		let reg_quote = /^(\s*)(>+ ?)/;
		let quote_match = line.text.match(reg_quote);
		if (!quote_match) return false;
		let quote_content = line.text.slice(quote_match[0].length);

		if (quote_content.trim() == '') return false;
		else {
			let space_str = '  ';
			if (quote_content.endsWith('  ')) space_str = '';
			let inserted_str = space_str + '\n' + quote_match[0];
			if (ctx.settings.StrictLineMode == StrictLineMode.EnterTwice) {
				inserted_str = '\n' + quote_match[0] + '\n' + quote_match[0];
			}
			view.dispatch({
				changes: { from: pos, to: pos, insert: inserted_str },
				selection: { anchor: pos + inserted_str.length },
				userEvent: "EasyTyping.handleEnter"
			});
			return true;
		}
	}

	let space_str = '  ';
	if (line.text.endsWith('  ')) space_str = '';
	// 如下一行非空白行，不做处理
	if (line.number < doc.lines && !/^\s*$/.test(doc.line(line.number + 1).text)) {
		if (ctx.settings.StrictLineMode != StrictLineMode.TwoSpace) return false;
	}

	if (ctx.settings.StrictLineMode == StrictLineMode.TwoSpace &&
		lineType == LineType.text) {
		let inserted_str = space_str + '\n';
		view.dispatch({
			changes: { from: pos, to: pos, insert: inserted_str },
			selection: { anchor: pos + inserted_str.length, head: pos + inserted_str.length },
			userEvent: "EasyTyping.handleEnter"
		});
		return true;
	}

	if (lineType == LineType.text ||
		(codeBlockInfo && pos == codeBlockInfo.end_pos && codeBlockInfo.indent == 0)) {
		view.dispatch({
			changes: {
				from: pos,
				to: pos,
				insert: '\n\n'
			},
			selection: { anchor: pos + 2 },
			userEvent: "EasyTyping.handleEnter"
		});
		return true;
	}

	return false;
}

export function handleEnter(ctx: PluginContext, view: EditorView): boolean {
	const s = view.state.selection;
	if (s.ranges.length > 1) return false;
	return enterCollapsedHeading(ctx, view)
		|| enterCodeBlockIndent(ctx, view)
		|| enterStrictLineBreak(ctx, view);
}

// =====================================================
// handleBackspace and its sub-functions
// =====================================================

function backspaceEmptyQuote(
	view: EditorView,
	state: EditorState,
	doc: typeof state.doc,
	line: ReturnType<typeof state.doc.lineAt>,
	lineContent: string,
	quoteMatchEmpty: RegExpMatchArray
): { changes: any[]; newCursorPos: number } {
	let changes: any[] = [];
	let newCursorPos: number;

	const quote_indent_str = quoteMatchEmpty[1];
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
				let inseted = temp_line + '\n' + temp_line;
				changes = [{ from: prevLine.from, to: line.to, insert: inseted }];
				newCursorPos = prevLine.from + inseted.length;
			}
			else {
				// 多级引用，降低一级
				const newQuotePrefix = '>'.repeat(quoteLevel - 1) + ' ';
				changes = [{ from: line.from, to: line.to, insert: newQuotePrefix }];
				newCursorPos = line.from + newQuotePrefix.length;
			}
		} else {
			// 多级引用，降低一级
			const newQuotePrefix = '>'.repeat(quoteLevel - 1) + ' ';
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

	return { changes, newCursorPos };
}

function backspaceEmptyListItem(
	view: EditorView,
	state: EditorState,
	doc: typeof state.doc,
	line: ReturnType<typeof state.doc.lineAt>,
	lineContent: string,
): { changes: any[]; newCursorPos: number } {
	let changes: any[] = [];
	let newCursorPos: number;

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

	return { changes, newCursorPos };
}

export function handleBackspace(view: EditorView): boolean {
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
		let result: { changes: any[]; newCursorPos: number };

		if (quoteMatchEmpty) {
			result = backspaceEmptyQuote(view, state, doc, line, lineContent, quoteMatchEmpty);
		} else {
			result = backspaceEmptyListItem(view, state, doc, line, lineContent);
		}

		const tr = state.update({
			changes: result.changes,
			selection: { anchor: result.newCursorPos, head: result.newCursorPos },
			userEvent: "EasyTyping.handleBackspace"
		});

		view.dispatch(tr);
		return true;
	}

	return false;
}

// =====================================================
// handleShiftEnter
// =====================================================

export function handleShiftEnter(ctx: PluginContext, view: EditorView): boolean {
	const state = view.state;
	const doc = state.doc;
	const selection = state.selection.main;

	if (selection.anchor != selection.head) return false;

	// 获取当前行的信息
	const line = doc.lineAt(selection.head);
	const lineContent = line.text;

	const taskListMatch = lineContent.match(/^(\s*)([-*+] \[.\])\s/);

	if (taskListMatch) {
		const [, indent, listMarker] = taskListMatch;
		let inserted = '\n' + indent + '  ';
		view.dispatch({
			changes: [{ from: selection.anchor, insert: inserted }],
			selection: { anchor: selection.anchor + inserted.length, head: selection.anchor + inserted.length },
			userEvent: "EasyTyping.handleShiftEnter"
		});
		return true;
	}

	return false;
}

// =====================================================
// handleModA
// =====================================================

export function handleModA(ctx: PluginContext, view: EditorView): boolean {
	let selection = view.state.selection.main;
	let line = view.state.doc.lineAt(selection.anchor);
	let line_type = getPosLineType2(view.state, selection.anchor);
	let is_in_code_block = isCodeBlockInPos(view.state, selection.anchor);

	if (ctx.settings.EnhanceModA &&
		line_type == LineType.text &&
		!is_in_code_block
	) {
		let [block_start, block_end] = getBlockLinesInPos(ctx, view.state, selection.head);
		// 检查是否已选中整个block
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
			selection: { anchor: line.from, head: line.to },
			userEvent: "EasyTyping.handleModA"
		});
		return true;
	}

	let quote_info = getQuoteInfoInPos(view.state, selection.head);
	if (ctx.settings.EnhanceModA && quote_info) {
		// 第一次，选中当前 quote 行内容；第二次选中整个 quote 块，第三次不处理
		if (selection.anchor == quote_info.start_pos && selection.head == quote_info.end_pos) {
			return false;
		}
		else if (selection.anchor == quote_info.cur_start_pos && selection.head == quote_info.cur_end_pos) {
			view.dispatch({
				selection: { anchor: quote_info.start_pos, head: quote_info.end_pos },
				userEvent: "EasyTyping.handleModA"
			});
			return true;
		}
		else {
			view.dispatch({
				selection: { anchor: quote_info.cur_start_pos, head: quote_info.cur_end_pos },
				userEvent: "EasyTyping.handleModA"
			});
			return true;
		}
	}

	if (ctx.settings.EnhanceModA && line_type == LineType.list) {
		// 第一次 Mod+A 选中当前列表行的内容（不包括indent），
		// 第二次选中当前列表行及其子列表，
		// 第三次选中整个列表
		// 第四次选中全文
		const reg_list = /^(\s*)([-*+] \[[^\]]\]|[-*+]|\d+\.)\s/;
		let reg_code_block = /^\s+```/;
		const listMatch = line.text.match(reg_list);
		if (!listMatch) {
			if (!reg_code_block.test(line.text)) {
				let cur_indent = line.text.match(/^\s*/)?.[0].length || 0;
				let selection_list: { anchor: number, head: number }[] = [];
				selection_list.push({ anchor: line.from + cur_indent, head: line.to });
				let list_start_line = line.number;
				for (let i = line.number - 1; i >= 1; i--) {
					const prevLine = view.state.doc.line(i);
					if (getPosLineType2(view.state, prevLine.from) == LineType.list) {
						list_start_line = i;
						break;
					}
				}
				let list_s_match = view.state.doc.line(list_start_line).text.match(reg_list);
				let list_s_start_idx = list_s_match?.[0].length || 0;
				selection_list.push({ anchor: view.state.doc.line(list_start_line).from + list_s_start_idx, head: line.to });

				if (selection.anchor <= selection_list[0].anchor && selection.head >= selection_list[0].head) {
					view.dispatch({ selection: selection_list[1], userEvent: "EasyTyping.handleModA" });
					return true;
				}
				else {
					view.dispatch({ selection: selection_list[0], userEvent: "EasyTyping.handleModA" });
					return true;
				}
			}
		}
		else {
			const cur_indent = listMatch[1].length;
			let selection_list: { anchor: number, head: number }[] = [];
			// 当前行内容
			const contentStart = line.from + listMatch[0].length;
			selection_list.push({ anchor: contentStart, head: line.to });

			// 当前行及其子列表
			let endLine = line.number;
			for (let i = line.number + 1; i <= view.state.doc.lines; i++) {
				const nextLine = view.state.doc.line(i);
				const nextMatch = nextLine.text.match(/^(\s*)/);
				if (!nextMatch || nextMatch[0].length <= cur_indent) break;
				endLine = i;
			}
			let list_block_selection = { anchor: line.from, head: view.state.doc.line(endLine).to };
			selection_list.push(list_block_selection);

			// 整个列表
			let list_start_line = line.number;
			for (let i = line.number - 1; i >= 1; i--) {
				const prevLine = view.state.doc.line(i);
				const prevMatch = prevLine.text.match(/^(\s*)/);
				if (getPosLineType2(view.state, prevLine.from) == LineType.list || (prevMatch && prevMatch[0].length >= 2)) {
					list_start_line = i;
				}
				else {
					break;
				}
			}
			let list_end_line = line.number;
			for (let i = line.number + 1; i <= view.state.doc.lines; i++) {
				const nextLine = view.state.doc.line(i);
				const nextMatch = nextLine.text.match(/^(\s*)/);
				if (getPosLineType2(view.state, nextLine.from) == LineType.list || (nextMatch && nextMatch[0].length >= 2)) {
					list_end_line = i;
				}
				else {
					break;
				}
			}
			let list_all_selection = { anchor: view.state.doc.line(list_start_line).from, head: view.state.doc.line(list_end_line).to };
			if (list_all_selection.anchor != list_block_selection.anchor || list_all_selection.head != list_block_selection.head) {
				selection_list.push(list_all_selection);
			}

			// 选中全文
			selection_list.push({ anchor: 0, head: view.state.doc.length });

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
			if (hit_idx < selection_list.length) {
				view.dispatch({ selection: selection_list[hit_idx], userEvent: "EasyTyping.handleModA" });
				return true;
			}
			return false;
		}
	}

	if (!ctx.settings.BetterCodeEdit) return false;
	let mainSelection = view.state.selection.asSingle().main;

	return selectCodeBlockInPos(view, mainSelection);
}

// =====================================================
// goNewLineAfterCurLine
// =====================================================

export function goNewLineAfterCurLine(ctx: PluginContext, view: EditorView): boolean {
	const state = view.state;
	const doc = state.doc;
	const selection = state.selection.main;

	// 获取当前行的信息
	const line = doc.lineAt(selection.head);
	const lineContent = line.text;

	// 当前行为空行时，只做一次回车
	if (/^\s*$/.test(lineContent)) {
		const insertStr = '\n';
		view.dispatch({
			changes: { from: line.to, insert: insertStr },
			selection: { anchor: line.to + insertStr.length },
			userEvent: "EasyTyping.goNewLineAfterCurLine"
		});
		return true;
	}

	// 检查是否在列表或引用块中
	const listMatch = lineContent.match(/^(\s*)([-*+] \[.\]|[-*+]|\d+\.)\s/);
	const quoteMatch = lineContent.match(/^(\s*)(>+ ?)/);

	let changes;
	let newCursorPos;

	let prefix = '';
	if (listMatch) {
		// 继续列表
		const [, indent, listMarker] = listMatch;
		if (['-', '*', '+'].includes(listMarker)) {
			prefix = indent + listMarker + ' ';
		}
		else if (listMarker.match(/[-*+] \[.\]/)) {
			prefix = indent + listMarker.replace(/\[.\]/g, '[ ]') + ' ';
		}
		else {
			prefix = indent + (parseInt(listMarker) + 1) + '. ';
		}

	} else if (quoteMatch) {
		// 继续引用，保持相同的引用级别，确保每个 > 后有一个空格
		prefix = quoteMatch[1] + quoteMatch[2];
	}

	// 严格换行模式下需要额外处理才能产生真正的换行
	// 但在代码块和公式块中不应用严格换行
	const strictLineBreaks = ctx.app.vault.config.strictLineBreaks || false;
	let useStrictBreak = ctx.settings.StrictModeEnter && strictLineBreaks;
	if (useStrictBreak) {
		const lineType = getPosLineType2(state, line.from);
		if (lineType === LineType.codeblock || lineType === LineType.formula
			|| lineType === LineType.code_start || lineType === LineType.code_end) {
			useStrictBreak = false;
		}
	}

	let insertStr: string;
	if (!useStrictBreak) {
		insertStr = '\n' + prefix;
	} else {
		const mode = ctx.settings.StrictLineMode;
		const spaceStr = lineContent.endsWith('  ') ? '' : '  ';
		if (listMatch) {
			// 所有模式下列表都不额外处理
			insertStr = '\n' + prefix;
		} else if (mode === StrictLineMode.TwoSpace) {
			insertStr = spaceStr + '\n' + prefix;
		} else if (quoteMatch) {
			if (mode === StrictLineMode.EnterTwice) {
				insertStr = '\n' + prefix + '\n' + prefix;
			} else {
				// Mix 模式下引用块用两空格
				insertStr = spaceStr + '\n' + prefix;
			}
		} else {
			// EnterTwice / Mix 模式下普通文本用两回车
			insertStr = '\n\n' + prefix;
		}
	}

	changes = [{ from: line.to, insert: insertStr }];
	newCursorPos = line.to + insertStr.length;

	// 创建一个新的事务
	const tr = state.update({
		changes: changes,
		selection: { anchor: newCursorPos, head: newCursorPos },
		userEvent: "EasyTyping.goNewLineAfterCurLine"
	});

	view.dispatch(tr);

	return true;
}

// =====================================================
// getBlockLinesInPos
// =====================================================

export function getBlockLinesInPos(ctx: PluginContext, state: EditorState, pos: number): [number, number] {
	const strictLineBreaks = ctx.app.vault.config.strictLineBreaks || false;
	let line = state.doc.lineAt(pos);

	let block_start = line.number;
	let block_end = line.number;
	let reg_headings = /^#+ /;
	for (let i = line.number - 1; i >= 1; i--) {
		let line = state.doc.line(i);
		if (getPosLineType2(state, line.from) == LineType.text &&
			line.text !== '' && !reg_headings.test(line.text)) {
			block_start = i;
			continue;
		}
		break;
	}
	for (let i = line.number + 1; i <= state.doc.lines; i++) {
		let line = state.doc.line(i);
		if (getPosLineType2(state, line.from) == LineType.text &&
			line.text !== '' && !reg_headings.test(line.text)) {
			block_end = i;
			continue;
		}
		break;
	}
	return [block_start, block_end];
}

// =====================================================
// selectBlockInCursor (fixed typo from selectBlockInCurser)
// =====================================================

export function selectBlockInCursor(ctx: PluginContext, view: EditorView): boolean {
	let selection = view.state.selection.main;
	let line = view.state.doc.lineAt(selection.head);
	if (/^\s*$/.test(line.text)) return false;
	let [block_start, block_end] = getBlockLinesInPos(ctx, view.state, selection.head);
	view.dispatch({
		selection: { anchor: view.state.doc.line(block_start).from, head: view.state.doc.line(block_end).to },
		userEvent: "EasyTyping.selectBlockInCursor"
	});
	return true;
}
