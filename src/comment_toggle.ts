import { EditorView } from '@codemirror/view';
import { getCodeBlockInfoInPos } from './syntax';

export function toggleComment(view: EditorView): boolean {
	const state = view.state;
	const selection = state.selection.main;
	const codeBlockInfo = getCodeBlockInfoInPos(state, selection.from);

	if (codeBlockInfo){
		return toggleCodeBlockComment(view);
	}
	return toggleMarkdownComment(selection.from, selection.to, view);
}

function toggleCodeBlockComment(view: EditorView): boolean {
	const state = view.state;
	const selection = state.selection.main;
	const codeBlockInfo = getCodeBlockInfoInPos(state, selection.from);

	if (!codeBlockInfo) return false; // 不在代码块内，不执行操作

	const language = codeBlockInfo.language;
	const commentSymbol = getCommentSymbol(language.toLowerCase());

	if (!commentSymbol) return false; // 未知语言，不执行操作

	let changes: { from: number; to: number; insert: string }[] = [];

	if (selection.from === selection.to) {
		// 没有选中文本，注释当前行
		const line = state.doc.lineAt(selection.from);
		let change = toggleCodeBlockLineComment(line.from, line.to,
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
			let change = toggleCodeBlockLineComment(line.from, line.to, state.doc.sliceString(line.from, line.to), commentSymbol);
			if (change){
				changes.push(change);
			}
		}
	}

	view.dispatch({ changes, userEvent: "EasyTyping.toggleComment" });
	return true;
}

function toggleCodeBlockLineComment(from: number, to: number, text: string,
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

function toggleMarkdownComment(from: number, to: number, view: EditorView): boolean {
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

function getCommentSymbol(language: string): string | { start: string; end: string } | null {
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
