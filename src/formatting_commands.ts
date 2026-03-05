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

	// Text-based line classification regexes (no syntax tree needed)
	const RE_BLANK = /^\s*$/;
	const RE_LIST = /^\s*(?:[-*+]|\d+[.)]) /;
	const RE_QUOTE = /^\s*>/;
	const RE_BLOCKID = /\s\^[\w-]+\s*$/;
	const RE_HR = /^\s*(?:---+|\*\*\*+|___+)\s*$/;

	/** Check whether a line needs a blank line preserved after it. */
	const needsTrailingBlank = (text: string): boolean =>
		RE_LIST.test(text) || RE_QUOTE.test(text) || RE_BLOCKID.test(text);

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
	let consecutiveBlanks = 0; // track consecutive blank lines for strict mode

	if (start_line != 1) {
		const prevText = doc.line(start_line - 1).text;
		if (needsTrailingBlank(prevText)) {
			remain_next_blank = true;
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
				// 前瞻：如果下一个非空行也是列表/引用/blockid，则删除空行（同类块之间不需要空行）
				let nextNonBlankIsBlock = false;
				for (let j = i + 1; j <= end_line; j++) {
					const jText = doc.line(j).text;
					if (!RE_BLANK.test(jText)) {
						nextNonBlankIsBlock = needsTrailingBlank(jText);
						break;
					}
				}
				if (nextNonBlankIsBlock) {
					// 同类块之间：删除空行
					delete_index.push(i);
				}
				// 不同类型：保留空行
				remain_next_blank = false;
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
		}
		else {
			remain_next_blank = false;
		}
	}

	let newContent = "";
	for (let i = 1; i < line_num; i++) {
		if (!delete_index.contains(i)) {
			newContent += doc.line(i).text + '\n';
		}
	}
	if (!delete_index.contains(line_num)) {
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
