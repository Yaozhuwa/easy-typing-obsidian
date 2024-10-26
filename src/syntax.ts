import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
export interface CodeBlockInfo {
    start_pos: number;
    end_pos: number;
    code_start_pos: number;
    code_end_pos: number;
    language: string;
    indent: number;
}

export function isCodeBlockInPos(state: EditorState, pos: number): boolean {
    let codeBlockInfos = getCodeBlocksInfos(state);
    for (let i = 0; i < codeBlockInfos.length; i++) {
        if (pos >= codeBlockInfos[i].start_pos && pos <= codeBlockInfos[i].end_pos) {
            return true;
        }
    }
    return false;
}

export function getCodeBlockInfoInPos(state: EditorState, pos: number): CodeBlockInfo | null {
    let codeBlockInfos = getCodeBlocksInfos(state);
    for (let i = 0; i < codeBlockInfos.length; i++) {
        if (pos >= codeBlockInfos[i].start_pos && pos <= codeBlockInfos[i].end_pos) {
            return codeBlockInfos[i];
        }
    }
    return null;
}

export function selectCodeBlockInPos(view: EditorView, pos: number):boolean {
    let codeBlockInfos = getCodeBlocksInfos(view.state);
    for (let i = 0; i < codeBlockInfos.length; i++) {
        if (pos >= codeBlockInfos[i].start_pos && pos <= codeBlockInfos[i].end_pos) {
            if (codeBlockInfos[i].code_start_pos == codeBlockInfos[i].code_end_pos) 
                return false;
            view.dispatch({
                selection: {
                    anchor: codeBlockInfos[i].code_start_pos,
                    head: codeBlockInfos[i].code_end_pos
                }
            });
            return true;
        }
    }
    return false;
}

export function getCodeBlocksInfos(state: EditorState): CodeBlockInfo[]{
    let isCodeBlockBegin = false;
    let codeBlockInfos: CodeBlockInfo[] = [];
    let curCodeBlockInfo: CodeBlockInfo | null = null;
    const doc = state.doc;

    syntaxTree(state).iterate({
        enter(node) {
            const nodeName = node.name;
            const nodeFrom = node.from;
            const nodeTo = node.to;
            const nodeText = state.sliceDoc(nodeFrom, nodeTo);
            // console.log(nodeName, nodeFrom, nodeTo, nodeText);
            if (nodeName.includes('codeblock-begin')) {
                isCodeBlockBegin = true;
                let start_pos = nodeFrom + nodeText.indexOf('`');
                let indent = start_pos - state.doc.lineAt(start_pos).from;
                let language = nodeText.trim().substring(3);
                curCodeBlockInfo = {
                    start_pos: start_pos,
                    end_pos: -1,
                    code_start_pos: -1,
                    code_end_pos: -1,
                    language: language.toLowerCase(),
                    indent: indent
                }
            } else if (nodeName.includes('codeblock-end')) {
                isCodeBlockBegin = false;
                if (curCodeBlockInfo != null) {
                    curCodeBlockInfo.end_pos = nodeTo;
                    if (doc.lineAt(curCodeBlockInfo.start_pos).number ==
                        doc.lineAt(curCodeBlockInfo.end_pos).number - 1) {
                        curCodeBlockInfo.code_start_pos = doc.lineAt(curCodeBlockInfo.start_pos).to;
                        curCodeBlockInfo.code_end_pos = doc.lineAt(curCodeBlockInfo.start_pos).to;
                    }
                    else {
                        let code_start_line = doc.lineAt(curCodeBlockInfo.start_pos).number + 1;
                        let code_end_line = doc.lineAt(curCodeBlockInfo.end_pos).number - 1;
                        curCodeBlockInfo.code_start_pos = doc.line(code_start_line).from + curCodeBlockInfo.indent;
                        curCodeBlockInfo.code_end_pos = doc.line(code_end_line).to;
                    }
                    codeBlockInfos.push(curCodeBlockInfo);
                    curCodeBlockInfo = null;
                }
            }
        }
    });

    if (isCodeBlockBegin && curCodeBlockInfo) {
        curCodeBlockInfo.end_pos = doc.length;
        curCodeBlockInfo.code_end_pos = doc.length;
        if (doc.lines > doc.lineAt(curCodeBlockInfo.start_pos).number) {
            let start_line = doc.lineAt(curCodeBlockInfo.start_pos).number + 1;
            let code_start_pos = doc.line(start_line).from + curCodeBlockInfo.indent;
            curCodeBlockInfo.code_start_pos = code_start_pos < doc.length ? code_start_pos :
                doc.lineAt(curCodeBlockInfo.start_pos + 1).from ;
        }
        else {
            curCodeBlockInfo.code_start_pos = doc.lineAt(curCodeBlockInfo.start_pos).to;
        }
        codeBlockInfos.push(curCodeBlockInfo);
        curCodeBlockInfo = null;
    }
    return codeBlockInfos;
}

