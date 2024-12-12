import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorView } from '@codemirror/view';
import { EditorState, SelectionRange } from '@codemirror/state';
import { getPosLineType2 } from "./core";
export interface CodeBlockInfo {
    start_pos: number;
    end_pos: number;
    code_start_pos: number;
    code_end_pos: number;
    language: string;
    indent: number;
}

export interface QuoteInfo {
    start_pos: number;
    end_pos: number;
    is_callout: boolean;
    cur_start_pos: number;
    cur_end_pos: number;
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

export function selectCodeBlockInPos(view: EditorView, selection: SelectionRange):boolean {
    let pos = selection.anchor;
    // let selected = selection.anchor !== selection.head;
    let codeBlockInfos = getCodeBlocksInfos(view.state);
    for (let i = 0; i < codeBlockInfos.length; i++) {
        if (pos >= codeBlockInfos[i].start_pos && pos <= codeBlockInfos[i].end_pos) {
            if (codeBlockInfos[i].code_start_pos == codeBlockInfos[i].code_end_pos) {
                view.dispatch({
                    selection: {
                        anchor: codeBlockInfos[i].start_pos,
                        head: codeBlockInfos[i].end_pos
                    }
                });
                return true;
            }
            let code_line_start = view.state.doc.lineAt(codeBlockInfos[i].code_start_pos);
            let isCodeSelected = selection.anchor == code_line_start.from &&
                selection.head == codeBlockInfos[i].code_end_pos;
            let isCodeBlockSelected = selection.anchor == codeBlockInfos[i].start_pos &&
                selection.head == codeBlockInfos[i].end_pos;
            if (isCodeSelected) {
                view.dispatch({
                    selection: {
                        anchor: codeBlockInfos[i].start_pos,
                        head: codeBlockInfos[i].end_pos
                    }
                });
                return true;
            }
            if (isCodeBlockSelected) return false;
            view.dispatch({
                selection: {
                    anchor: code_line_start.from,
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

export function getQuoteInfoInPos(state: EditorState, pos: number): QuoteInfo | null {
    let quote_regex = /^(\s*)(>+) ?/;
    let callout_regex = /^(\s*)(>)+ \[![^\s]+\][+-]? ?/;
    let cur_line = state.doc.lineAt(pos);
    let match = cur_line.text.match(quote_regex);
    let is_callout = false;
    let cur_start_pos = -1;
    let cur_end_pos = -1;
    if (match){
        let match_callout = cur_line.text.match(callout_regex);
        cur_start_pos = cur_line.from + (match_callout ? match_callout[0].length : match[0].length);
        cur_end_pos = cur_line.to;
        let quote_start_line = cur_line.number;
        let quote_end_line = quote_start_line;
        for(let i=quote_start_line+1;i<=state.doc.lines;i+=1){
            let line = state.doc.line(i);
            if (line.text.match(quote_regex)){
                quote_end_line = i;
            }
            else break;
        }
        for (let i=quote_start_line;i>=1;i-=1){
            let line = state.doc.line(i);
            let match_callout = line.text.match(callout_regex);
            let match_quote = line.text.match(quote_regex);
            if (match_callout){
                is_callout = true;
                quote_start_line = i;
                // break;
            }
            else if (match_quote){
                quote_start_line = i;
            }
            else break;
        }
        return {
            start_pos: state.doc.line(quote_start_line).from,
            end_pos: state.doc.line(quote_end_line).to,
            is_callout: is_callout,
            cur_start_pos: cur_start_pos,
            cur_end_pos: cur_end_pos
        };
    }
    else{
        return null;
    }
}