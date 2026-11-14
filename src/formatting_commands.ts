import { Editor, MarkdownView, Notice } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { ensureSyntaxTree } from '@codemirror/language';
import { PluginContext } from './plugin_context';
import { getPosLineType, LineType } from './core';

export function isCurrentFileExclude(ctx: PluginContext): boolean {
	if (ctx.CurActiveMarkdown == "") {
		let file = ctx.app.workspace.getActiveFile();
		if (file != null && ctx.CurActiveMarkdown != file.path) {
			ctx.CurActiveMarkdown = file.path;
		}
		else {
			return true;
		}
	}
	let excludePaths = ctx.settings.ExcludeFiles.split('\n');
	for (let epath of excludePaths) {
		if (epath.charAt(0) == '/') epath = epath.substring(1);
		if (ctx.CurActiveMarkdown == epath) return true;
		let len = epath.length;
		if (ctx.CurActiveMarkdown.substring(0, len) == epath && (ctx.CurActiveMarkdown.charAt(len) == '/' || ctx.CurActiveMarkdown.charAt(len) == '\\' ||
			epath.charAt(len - 1) == "/" || epath.charAt(len - 1) == "\\")) {
			return true;
		}
	}
	return false;
}

export function formatArticle(ctx: PluginContext, editor: Editor, view: MarkdownView): void {
	const editorView = editor.cm as EditorView;
	const tree = ensureSyntaxTree(editorView.state, editorView.state.doc.length);
	if (!tree) {
		new Notice('EasyTyping: Syntax tree is not ready yet, please wait a moment and try again later!', 5000);
		return;
	}

	ctx.onFormatArticle = true;

	let lineCount = editor.lineCount();
	let new_article = "";
	let cs = editor.getCursor();
	let ch = 0;
	for (let i = 0; i < lineCount; i++) {
		if (i != 0) new_article += '\n';
		if (i != cs.line) {
			new_article += preFormatOneLine(ctx, editor, i + 1)[0];
		}
		else {
			let newData = preFormatOneLine(ctx, editor, i + 1, cs.ch);
			new_article += newData[0];
			ch = newData[1];
		}
	}
	editor.setValue(new_article);
	editor.setCursor({ line: cs.line, ch: ch });

	ctx.onFormatArticle = false;

	new Notice("EasyTyping: Format Article Done!");
}

export function formatSelectionOrCurLine(ctx: PluginContext, editor: Editor, view: MarkdownView): void {
	if (!editor.somethingSelected() || editor.getSelection() === '') {
		let lineNumber = editor.getCursor().line;
		let newLineData = preFormatOneLine(ctx, editor, lineNumber + 1, editor.getCursor().ch);
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
		new_lines += preFormatOneLine(ctx, editor, i + 1)[0];
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
export function preFormatOneLine(ctx: PluginContext, editor: Editor, lineNumber: number, ch: number = -1): [string, number] {
	const editorView = editor.cm as EditorView;
	let state = editorView.state;
	let line = state.doc.line(lineNumber)

	let newLine = line.text;
	let newCh = 0;
	let curCh = line.text.length;
	if (ch != -1) {
		curCh = ch;
	}
	const lineType = getPosLineType(state, line.from);
	if (lineType == LineType.text || lineType == LineType.table) {
		let newLineData = ctx.Formater.formatLine(state, lineNumber, { ...ctx.settings, AutoCapital: false }, curCh, 0);
		newLine = newLineData[0];
		newCh = newLineData[1];
	}

	return [newLine, newCh];
}

// param: lineNumber is (1-based), 废弃函数
export function formatOneLine(ctx: PluginContext, editor: Editor, lineNumber: number): void {
	const editorView = editor.cm as EditorView;
	let state = editorView.state;
	let line = state.doc.line(lineNumber)

	const lineType = getPosLineType(state, line.from);
	if (lineType == LineType.text || lineType == LineType.table) {
		let oldLine = line.text;
		let newLine = ctx.Formater.formatLine(state, lineNumber, ctx.settings, oldLine.length, 0)[0];
		if (oldLine != newLine) {
			editor.replaceRange(newLine, { line: lineNumber - 1, ch: 0 }, { line: lineNumber - 1, ch: oldLine.length });
			editor.setCursor({ line: lineNumber - 1, ch: editor.getLine(lineNumber - 1).length });
		}
	}
	return;
}

export function deleteBlankLines(ctx: PluginContext, editor: Editor): void {
	if (ctx.settings?.debug) {
		console.log('config.strictLineBreaks', ctx.app.vault.getConfig("strictLineBreaks"));
	}
	let strictLineBreaks = ctx.app.vault.config.strictLineBreaks || false;

	const editorView = editor.cm as EditorView;
	let state = editorView.state;
	let doc = state.doc;

	// Keep the existing text-based cleanup rules, but protect structural blanks
	// using the complete document, even when the selection starts inside a block.
	const RE_BLANK = /^\s*$/;
	const RE_LIST = /^\s*(?:[-*+]|\d+[.)]) /;
	const RE_QUOTE = /^\s*>/;
	const RE_BLOCKID = /\s\^[\w-]+\s*$/;
	const RE_HR = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
	const tree = ensureSyntaxTree(state, doc.length);
	if (!tree) {
		new Notice('EasyTyping: Syntax tree is not ready yet, please wait a moment and try again later!', 5000);
		return;
	}
	const protectedBlankLines = new Set<number>();
	const blockStarts = new Set<number>();
	const indentedCodeLines = new Set<number>();
	let fenceStart: number | null = null;
	const protectBlanks = (fromLine: number, toLine: number) => {
		for (let i = fromLine; i <= toLine; i++) {
			if (RE_BLANK.test(doc.line(i).text)) protectedBlankLines.add(i);
		}
	};
	tree.iterate({
		enter(node) {
			const tokens = node.name.split('_');
			if (tokens.includes('HyperMD-codeblock-begin') || tokens.includes('hmd-codeblock-begin')) {
				fenceStart = doc.lineAt(node.from).number;
			} else if (tokens.includes('HyperMD-codeblock-end') || tokens.includes('hmd-codeblock-end')) {
				if (fenceStart !== null) protectBlanks(fenceStart, doc.lineAt(node.to).number);
				fenceStart = null;
			}
			if (tokens.includes('hmd-indented-code')) {
				for (let i = doc.lineAt(node.from).number; i <= doc.lineAt(node.to).number; i++) {
					indentedCodeLines.add(i);
				}
			}
			if (tokens.includes('HyperMD-table-row-0')) blockStarts.add(doc.lineAt(node.from).number);
		}
	});
	if (fenceStart !== null) protectBlanks(fenceStart, doc.lines);

	// Indented code has no fence nodes. Blank gaps between its content lines
	// belong to the code; a blank before the first line separates it from prose.
	let previousCodeLine = 0;
	for (const lineNumber of Array.from(indentedCodeLines).sort((a, b) => a - b)) {
		let firstBlank = lineNumber;
		while (firstBlank > 1 && RE_BLANK.test(doc.line(firstBlank - 1).text)) firstBlank--;
		if (previousCodeLine > 0 && firstBlank === previousCodeLine + 1) {
			protectBlanks(firstBlank, lineNumber - 1);
		} else {
			blockStarts.add(lineNumber);
		}
		previousCodeLine = lineNumber;
	}
	for (const lineNumber of blockStarts) {
		let firstBlank = lineNumber;
		while (firstBlank > 1 && RE_BLANK.test(doc.line(firstBlank - 1).text)) firstBlank--;
		// Preserve the first blank, as strict mode already does, so a run still
		// collapses to one line rather than retaining both ends of the run.
		if (firstBlank < lineNumber) protectedBlankLines.add(firstBlank);
	}

	type TrailingBlankType = 'list' | 'quote' | 'blockid' | null;

	/** Detect whether a line belongs to a block kind that may preserve one following blank line. */
	const getTrailingBlankType = (text: string): TrailingBlankType => {
		if (RE_LIST.test(text)) return 'list';
		if (RE_QUOTE.test(text)) return 'quote';
		if (RE_BLOCKID.test(text)) return 'blockid';
		return null;
	};

	/** Check whether a line needs a blank line preserved after it. */
	const needsTrailingBlank = (text: string): boolean => getTrailingBlankType(text) !== null;

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
		end_line = end;
	}

	let delete_index: number[] = [];
	let remain_next_blank = false;
	let remain_next_blank_type: TrailingBlankType = null;
	let consecutiveBlanks = 0; // track consecutive blank lines for strict mode

	if (start_line != 1) {
		const prevText = doc.line(start_line - 1).text;
		const prevType = getTrailingBlankType(prevText);
		if (prevType) {
			remain_next_blank = true;
			remain_next_blank_type = prevType;
		}
	}
	if (end_line != line_num && !RE_BLANK.test(doc.line(end_line + 1).text)) {
		end_line += 1;
	}

	for (let i = start_line; i <= end_line; i++) {
		let line = doc.line(i);
		let text = line.text;

		// 对于空白行
		if (RE_BLANK.test(text)) {
			consecutiveBlanks++;
			if (remain_next_blank) {
				// 前瞻：仅当前后是同类块时才删除空行
				let nextNonBlankType: TrailingBlankType = null;
				for (let j = i + 1; j <= end_line; j++) {
					const jText = doc.line(j).text;
					if (!RE_BLANK.test(jText)) {
						nextNonBlankType = getTrailingBlankType(jText);
						break;
					}
				}
				if (remain_next_blank_type && nextNonBlankType === remain_next_blank_type) {
					// 同类块之间：删除空行
					delete_index.push(i);
				}
				// 不同类型：保留空行
				remain_next_blank = false;
				remain_next_blank_type = null;
				continue;
			}
			if (strictLineBreaks && consecutiveBlanks === 1) {
				// 严格换行模式：保留第一行空行
				continue;
			}
			delete_index.push(i);
			continue;
		}

		// 非空白行：重置计数器
		consecutiveBlanks = 0;

		if (RE_HR.test(text) && delete_index[delete_index.length - 1] == i - 1) {
			delete_index.pop();
		}
		else if (needsTrailingBlank(text)) {
			remain_next_blank = true;
			remain_next_blank_type = getTrailingBlankType(text);
		}
		else {
			remain_next_blank = false;
			remain_next_blank_type = null;
		}
	}

	const deletedLines = new Set(delete_index.filter(i => !protectedBlankLines.has(i)));
	if (deletedLines.size === 0) return;
	let newContent = "";
	for (let i = 1; i < line_num; i++) {
		if (!deletedLines.has(i)) {
			newContent += doc.line(i).text + '\n';
		}
	}
	if (!deletedLines.has(line_num)) {
		newContent += doc.line(line_num).text;
	}

	editor.setValue(newContent);
}

export function switchAutoFormatting(ctx: PluginContext): void {
	ctx.settings.AutoFormat = !ctx.settings.AutoFormat;
	let status = ctx.settings.AutoFormat ? 'on' : 'off';
	new Notice('EasyTyping: Autoformat is ' + status + '!');
}

export function convert2CodeBlock(ctx: PluginContext, editor: Editor): void {
	if (ctx.settings?.debug) console.log("----- EasyTyping: insert code block-----");
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
