import { Notice } from "obsidian"
import { EasyTypingSettings } from './settings'
import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec, Text, Line } from '@codemirror/state';
import { offsetToPos, posToOffset, stringDeleteAt, stringInsertAt, isParamDefined } from './utils'
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { print } from "./utils"
import {
    capitalizeFirstLetter, capitalizeMidSentence,
    applyLanguagePairSpacing,
    detectBoundarySpaceState,
    TextFormatContext,
} from './formatting/text_formatter'
import { shouldInsertSpaceBetweenParts, shouldPrependSpaceToText } from './formatting/inline_spacing'
import { PrefixDictionary } from './formatting/prefix_dictionary'

export enum LineType {
    text = 'text', codeblock = 'codeblock', formula = 'formula',
    code_start = 'code_block_start', code_end = 'code_block_end',
    none = 'none', frontmatter = "frontmatter",
    quote = 'quote', callout_title = 'callout_title', list = 'list', table = 'table'
}

export enum SpaceState {
    none,
    soft,
    strict
}

export enum InlineType {
    text = 'text', code = 'code', formula = 'formula',
    wikilink = 'wikilink', mdlink = "mdlink",
    user = 'user-defined', none = 'none'
}

export interface InlineChange {
    text: string,
    begin: number,
    end: number,
    origin: string
}

export interface ArticlePart {
    type: LineType;
    begin: number;
    end: number
}

export interface InlinePart {
    content: string;
    type: InlineType;
    begin: number;
    end: number;
    leftSpaceRequire: SpaceState;
    rightSpaceRequire: SpaceState;
}

export class LineFormater {
    constructor() { }
    syntaxTreeNodeNameType(name: string): InlineType {
        if (name.contains('code') && !name.contains("link")) {
            return InlineType.code;
        }
        else if (name.contains('math')) {
            return InlineType.formula;
        }
        else {
            return InlineType.text;
        }
    }

    // param lineNum: 1-based line number
    parseLineWithSyntaxTree(state: EditorState, lineNum: number, regRegExp?: string) {
        let linePartsOfTxtCodeFormula: InlinePart[] = [];
        let line = state.doc.line(lineNum);
        const tree = syntaxTree(state);
        let pos = line.from;
        let prevNodeType: InlineType = InlineType.none;
        let prevBeginIdx = 0;
        while (pos < line.to) {
            let node = tree.resolve(pos, 1);
            let curNodeType = this.syntaxTreeNodeNameType(node.name)

            if (prevNodeType == InlineType.none) {
                prevNodeType = curNodeType;
                prevBeginIdx = 0;
            }
            else if (prevNodeType == curNodeType) { }
            else {
                linePartsOfTxtCodeFormula.push({
                    content: line.text.substring(prevBeginIdx, pos - line.from),
                    type: prevNodeType,
                    begin: prevBeginIdx,
                    end: pos - line.from,
                    leftSpaceRequire: SpaceState.none,
                    rightSpaceRequire: SpaceState.none
                })
                prevNodeType = curNodeType;
                prevBeginIdx = pos - line.from;
            }
            // update next pos
            if (curNodeType == InlineType.text) {
                pos++;
            }
            else {
                pos = node.to;
            }

            if (pos == line.to) {
                linePartsOfTxtCodeFormula.push({
                    content: line.text.substring(prevBeginIdx, pos - line.from),
                    type: prevNodeType,
                    begin: prevBeginIdx,
                    end: pos - line.from,
                    leftSpaceRequire: SpaceState.none,
                    rightSpaceRequire: SpaceState.none
                })
            }
        }
        // =======================================
        let retArray: InlinePart[] = [];
        for (let i = 0; i < linePartsOfTxtCodeFormula.length; i++) {
            if (linePartsOfTxtCodeFormula[i].type != InlineType.text) {
                retArray.push(linePartsOfTxtCodeFormula[i]);
            }
            else {
                let tempArray: InlinePart[];
                if (isParamDefined(regRegExp))
                    tempArray = splitTextWithLinkAndUserDefined(linePartsOfTxtCodeFormula[i].content, regRegExp);
                else
                    tempArray = splitTextWithLinkAndUserDefined(linePartsOfTxtCodeFormula[i].content);

                tempArray.forEach(item => {
                    item.begin += linePartsOfTxtCodeFormula[i].begin;
                    item.end += linePartsOfTxtCodeFormula[i].begin;
                    retArray.push(item);
                });
            }
        }
        return retArray;
    }

    formatLineOfDoc(state: EditorState, settings: EasyTypingSettings, fromB: number, toB: number, insertedStr: string): [TransactionSpec[], TransactionSpec] | null {
        let doc = state.doc;
        let line = doc.lineAt(fromB).text;
        let res = null
        if (insertedStr.contains("\n")) {
            res = this.formatLine(state, doc.lineAt(fromB).number, settings, offsetToPos(doc, fromB).ch, offsetToPos(doc, fromB).ch);
        }
        else {
            res = this.formatLine(state, doc.lineAt(fromB).number, settings, offsetToPos(doc, toB).ch, offsetToPos(doc, fromB).ch);
        }
        if (res === null || res[2].length == 0) return null;

        let newline = stringInsertAt(res[0], res[1], "|");

        let changes: TransactionSpec[] = [];
        let offset = doc.lineAt(fromB).from;

        for (let changeItem of res[2]) {
            changes.push({
                changes: { from: offset + changeItem.begin, to: offset + changeItem.end, insert: changeItem.text }, userEvent: "EasyTyping.change"
            })
        }
        if (insertedStr.contains("\n")) {
            console.log("insertStr", insertedStr)
            res[1] += insertedStr.length;
        }
        return [changes, { selection: { anchor: offset + res[1] }, userEvent: "EasyTyping.change" }];
    }

    // 返回值： [最终的行，最终光标位置，内容改变]
    // param lineNum: 1-based line number
    // curCh: 光标在当前行的位置
    // prevCh: 光标在前一时刻在当前行的位置
    formatLine(state: EditorState, lineNum: number, settings: EasyTypingSettings, curCh: number, prevCh?: number): [string, number, InlineChange[]] | null {
        let line = state.doc.line(lineNum).text;
        let regNull = /^\s*$/g;
        if (regNull.test(line)) return [line, curCh, []];

        // 1. Parse inline parts
        let lineParts = settings.UserDefinedRegSwitch
            ? this.parseLineWithSyntaxTree(state, lineNum, settings.UserDefinedRegExp)
            : this.parseLineWithSyntaxTree(state, lineNum);

        if (settings.debug) console.log("line parts\n", lineParts);

        let linePartsOrigin = JSON.parse(JSON.stringify(lineParts));
        let inlineChangeList: InlineChange[] = [];

        // 2. Find cursor part and insert \0 marker in text parts
        let cursorLinePartIndex = -1;
        let cursorRelativeIndex = -1;
        let resultCursorCh = 0;

        for (let i = 0; i < lineParts.length; i++) {
            if (curCh > lineParts[i].begin && curCh <= lineParts[i].end) {
                cursorLinePartIndex = i;
                cursorRelativeIndex = curCh - lineParts[i].begin;
                if (lineParts[i].type === InlineType.text) {
                    lineParts[i].content = stringInsertAt(lineParts[i].content, cursorRelativeIndex, '\0');
                }
                break;
            }
        }

        // Build PrefixDictionary from settings
        const prefixDict = new PrefixDictionary(settings.PrefixDictionary);

        let resultLine = '';
        let offset = 0;
        let prevPartType: string = InlineType.none;
        let prevTextEndSpaceState = SpaceState.none;

        // 3. Process each part
        for (let i = 0; i < lineParts.length; i++) {
            if (lineParts[i].type === InlineType.text) {
                let content = lineParts[i].content;
                let ctx: TextFormatContext = { content, curCh, prevCh, offset };

                // 3.1 Capitalization
                if (settings.AutoCapital) {
                    if (i === 0) {
                        ctx = capitalizeFirstLetter(ctx, true, cursorLinePartIndex === 0);
                    }
                    ctx = capitalizeMidSentence(ctx);
                    content = ctx.content;
                    curCh = ctx.curCh;
                }

                // 3.2 Language pair spacing (replaces ChineseEnglishSpace etc.)
                if (settings.debug) console.log('[formatLine] languagePairs:', settings.languagePairs, 'content:', content, 'curCh:', curCh, 'prevCh:', prevCh, 'offset:', offset);
                if (settings.languagePairs && settings.languagePairs.length > 0) {
                    ctx = { ...ctx, content, curCh };
                    ctx = applyLanguagePairSpacing(ctx, settings.languagePairs, prefixDict, settings.customScriptCategories, settings.debug);
                    content = ctx.content;
                    curCh = ctx.curCh;
                }

                lineParts[i].content = content;

                // 3.5 Detect boundary space state
                const boundary = detectBoundarySpaceState(
                    content,
                    settings.SoftSpaceLeftSymbols || '',
                    settings.SoftSpaceRightSymbols || '',
                );

                // 3.6 Handle spacing from previous part to this text
                if (prevPartType !== InlineType.none) {
                    if (prevPartType === InlineType.wikilink || prevPartType === InlineType.mdlink) {
                        // Smart link spacing (complex logic preserved from original)
                        if (!settings.InlineLinkSmartSpace && settings.InlineLinkSpaceMode > boundary.start) {
                            lineParts[i].content = ' ' + lineParts[i].content;
                            content = lineParts[i].content;
                        } else if (settings.InlineLinkSmartSpace && boundary.start === SpaceState.none) {
                            const charAtTextBegin = content.charAt(0) === '\0' ? content.charAt(1) : content.charAt(0);
                            const regMdLinkEnd = /\]/;
                            const charAtLinkEndIndex = lineParts[i - 1].content.search(regMdLinkEnd) - 1;
                            const charAtLinkEnd = lineParts[i - 1].content.charAt(charAtLinkEndIndex);
                            if (charAtLinkEnd !== '[') {
                                const twoNeighborChars = charAtLinkEnd + charAtTextBegin;
                                const regNotNeedSpace = /[\u4e00-\u9fa5，。？：；""''\-）}][\u4e00-\u9fa5]/g;
                                if (!regNotNeedSpace.test(twoNeighborChars)) {
                                    lineParts[i].content = ' ' + lineParts[i].content;
                                    content = lineParts[i].content;
                                }
                            }
                        }
                    } else if (shouldPrependSpaceToText(
                        prevPartType as InlineType,
                        boundary.start,
                        i > 0 ? lineParts[i - 1].rightSpaceRequire : SpaceState.none,
                        settings,
                    )) {
                        lineParts[i].content = ' ' + lineParts[i].content;
                        content = lineParts[i].content;
                    }
                }

                // 3.7 Find cursor position
                if (i === cursorLinePartIndex) {
                    const n = content.search('\0');
                    resultCursorCh = offset + n;
                    lineParts[i].content = stringDeleteAt(content, n);
                }

                resultLine += lineParts[i].content;
                offset += lineParts[i].content.length;
                prevPartType = InlineType.text;
                prevTextEndSpaceState = boundary.end;

            } else {
                // Non-text part (code, formula, link, user)

                // Skip qquad formula (treated as text spacer)
                if (lineParts[i].type === InlineType.formula && lineParts[i].content === "$\\qquad$") {
                    prevPartType = InlineType.text;
                    prevTextEndSpaceState = SpaceState.strict;
                    resultLine += lineParts[i].content;
                    offset += lineParts[i].content.length;
                    continue;
                }

                // Handle link → text spacing (special case for smart link space)
                if ((lineParts[i].type === InlineType.wikilink || lineParts[i].type === InlineType.mdlink)
                    && prevPartType === InlineType.text) {
                    // Link-specific text→link spacing
                    const prevEnd = prevTextEndSpaceState;
                    if (prevEnd >= settings.InlineLinkSpaceMode && !settings.InlineLinkSmartSpace) {
                        // already has enough space
                    } else if (prevEnd === SpaceState.strict && settings.InlineLinkSpaceMode === SpaceState.strict) {
                        // already strict
                    } else if (settings.InlineLinkSpaceMode === SpaceState.strict && prevEnd < SpaceState.strict) {
                        lineParts[i - 1].content += ' ';
                        resultLine += ' ';
                        offset += 1;
                    } else if (settings.InlineLinkSmartSpace && lineParts[i - 1].content.endsWith(' ')) {
                        // Smart space: possibly revert space between two Chinese chars
                        let charAtLinkBegin = this.getLinkBeginChar(lineParts[i]);
                        if (charAtLinkBegin) {
                            const tempContent = lineParts[i - 1].content + charAtLinkBegin;
                            const regRevertSpace = /[\u4e00-\u9fa5] [\u4e00-\u9fa5]$/;
                            if (regRevertSpace.test(tempContent)) {
                                lineParts[i - 1].content = lineParts[i - 1].content.substring(0, lineParts[i - 1].content.length - 1);
                                resultLine = resultLine.substring(0, resultLine.length - 1);
                                offset -= 1;
                            }
                        }
                    } else if (settings.InlineLinkSmartSpace && prevEnd === SpaceState.none) {
                        const charAtTextEnd = lineParts[i - 1].content.charAt(lineParts[i - 1].content.length - 1);
                        const charAtLinkBegin = this.getLinkBeginChar(lineParts[i]);
                        if (charAtLinkBegin) {
                            const regNoNeedSpace = /[\u4e00-\u9fa5][\u4e00-\u9fa5]/g;
                            const twoNeighborChars = charAtTextEnd + charAtLinkBegin;
                            if (!regNoNeedSpace.test(twoNeighborChars)) {
                                lineParts[i - 1].content += ' ';
                                resultLine += ' ';
                                offset += 1;
                            }
                        }
                    } else if (!settings.InlineLinkSmartSpace && settings.InlineLinkSpaceMode > prevEnd) {
                        lineParts[i - 1].content += ' ';
                        resultLine += ' ';
                        offset += 1;
                    }
                } else if (prevPartType === InlineType.text) {
                    // text → non-link: check if prev text needs trailing space
                    if (shouldInsertSpaceBetweenParts(
                        InlineType.text, lineParts[i].type,
                        prevTextEndSpaceState,
                        i > 0 ? lineParts[i - 1].rightSpaceRequire : SpaceState.none,
                        lineParts[i].leftSpaceRequire,
                        settings
                    )) {
                        lineParts[i - 1].content += ' ';
                        resultLine += ' ';
                        offset += 1;
                    }
                } else if (prevPartType !== InlineType.none) {
                    // non-text → non-text: insert space via inlineChangeList
                    if (shouldInsertSpaceBetweenParts(
                        prevPartType as InlineType, lineParts[i].type,
                        prevTextEndSpaceState,
                        i > 0 ? lineParts[i - 1].rightSpaceRequire : SpaceState.none,
                        lineParts[i].leftSpaceRequire,
                        settings
                    )) {
                        inlineChangeList.push({
                            text: ' ',
                            begin: lineParts[i].begin,
                            end: lineParts[i].begin,
                            origin: ''
                        });
                        resultLine += ' ';
                        offset += 1;
                    }
                }

                // Cursor in non-text part
                if (i === cursorLinePartIndex) {
                    resultCursorCh = offset + cursorRelativeIndex;
                }

                resultLine += lineParts[i].content;
                offset += lineParts[i].content.length;
                prevPartType = lineParts[i].type;
                prevTextEndSpaceState = SpaceState.none;
            }
        }

        // 4. Collect text changes
        for (let i = 0; i < lineParts.length; i++) {
            if (lineParts[i].type === InlineType.text && lineParts[i].content != linePartsOrigin[i].content) {
                inlineChangeList.push({
                    text: lineParts[i].content,
                    begin: linePartsOrigin[i].begin,
                    end: linePartsOrigin[i].end,
                    origin: linePartsOrigin[i].content
                });
            }
        }

        inlineChangeList = inlineChangeList.sort((a, b): number => a.begin - b.begin);
        return [resultLine, resultCursorCh, inlineChangeList];
    }

    /**
     * Extract the display-relevant first character of a link for smart spacing.
     */
    private getLinkBeginChar(part: InlinePart): string | null {
        if (part.type === InlineType.wikilink) {
            const regAlias = /\|/;
            const charOfAliasBegin = part.content.search(regAlias);
            let beginIndex = 2;
            if (part.content.charAt(0) === '!') beginIndex = 3;
            if (charOfAliasBegin !== -1) {
                beginIndex = charOfAliasBegin + 1;
            } else if (part.content.charAt(beginIndex) === '#') {
                beginIndex += 1;
            }
            const ch = part.content.charAt(beginIndex);
            return ch === ']' ? null : ch;
        } else {
            const regMdLinkBegin = /\[/;
            const charAtLinkBeginIndex = part.content.search(regMdLinkBegin) + 1;
            const ch = part.content.charAt(charAtLinkBeginIndex);
            return ch === ']' ? null : ch;
        }
    }


}


export class MarkdownParser {
    constructor() { }

}

function matchWithReg(text: string, regExp: RegExp, type: InlineType, inlineTypeArray: InlinePart[],
    checkArray = false, leftSpaceRe: SpaceState = SpaceState.none, rightSpaceRe: SpaceState = SpaceState.none): InlinePart[] {
    let retArray = inlineTypeArray;
    let matchArray: InlinePart[] = [];
    retArray = retArray.sort((a, b): number => a.begin - b.begin);
    // console.log('before-----------\n',retArray)
    while (true) {
        let match = regExp.exec(text);
        if (!match) break;
        let valid = true;
        // 检查冲突
        if (checkArray) {
            for (let i = 0; i < retArray.length; i++) {
                if (regExp.lastIndex > retArray[i].begin && retArray[i].end > match.index) {
                    valid = false;
                    break;
                }
            }
        }
        if (!valid) continue;
        matchArray.push(
            {
                content: match[0],
                type: type,
                begin: match.index,
                end: regExp.lastIndex,
                leftSpaceRequire: leftSpaceRe,
                rightSpaceRequire: rightSpaceRe
            }
        );
    }
    retArray = retArray.concat(matchArray);
    // console.log('After===========\n', retArray);
    return retArray;
}

function matchWithAbbr(text: string, type: InlineType, inlineTypeArray: InlinePart[], checkArray = false) {
    let retArray = inlineTypeArray;
    let matchArray: InlinePart[] = [];
    retArray = retArray.sort((a, b): number => a.begin - b.begin);
    let regAbbr = /([a-zA-Z]\.)+/g;
    while (true) {
        let match = regAbbr.exec(text);
        if (!match) break;
        let valid = true;
        let isInBlockBegin: boolean = (match.index == 0);
        // 检查冲突
        if (checkArray) {
            for (let i = 0; i < retArray.length; i++) {
                if (match.index == retArray[i].end) {
                    isInBlockBegin = true;
                }
                if (regAbbr.lastIndex > retArray[i].begin && retArray[i].end > match.index) {
                    valid = false;
                    break;
                }
            }
        }
        if (!isInBlockBegin && valid) {
            let regChar = /[a-zA-Z0-9]/;
            if (regChar.test(text.charAt(match.index - 1))) {
                valid = false;
            }
        }

        if (!valid) continue;
        matchArray.push(
            {
                content: match[0],
                type: type,
                begin: match.index,
                end: regAbbr.lastIndex,
                leftSpaceRequire: SpaceState.none,
                rightSpaceRequire: SpaceState.none
            }
        );
    }
    retArray = retArray.concat(matchArray);
    // console.log('After===========\n', retArray);
    return retArray;
}

/**
 * 分割一行文本中的链接和用户自定义的正则部分，得到 InlinePart 的不同区域
 */
function splitTextWithLinkAndUserDefined(text: string, regExps?: string): InlinePart[] {
    let retArray: InlinePart[] = [];
    let regWikiLink = /\!{0,2}\[\[[^\[\]]*?\]\]/g;
    let regMdLink = /\!{0,2}\[[^\[\]]*?\]\([^\s]*\)/g;
    // let regBareLink = /(https?:\/\/|ftp:\/\/|obsidian:\/\/|zotero:\/\/|www.)[^\s（）《》。，！？；：“”‘’\)\(\[\]\{\}']+/g;

    // 1. 匹配wikilink
    retArray = matchWithReg(text, regWikiLink, InlineType.wikilink, retArray);
    // 2. 匹配mdlink
    retArray = matchWithReg(text, regMdLink, InlineType.mdlink, retArray);

    // 3. 匹配用户自定义正则
    let regExpList: RegExp[] = [];
    let leftSRequireList: SpaceState[] = [];
    let rightSRequireList: SpaceState[] = [];
    let regNull = /^\s*$|^\/\//g;
    let regSRequire = /\|[\-=\+][\-=\+]$/;
    if (regExps) {
        let regs = regExps.split('\n');
        for (let i = 0; i < regs.length; i++) {

            if (regNull.test(regs[i])) continue;

            if ((!regSRequire.test(regs[i])) || regs[i].length <= 3) {
                new Notice("EasyTyping: 第" + String(i) + "行自定义正则不符合规范\n" + regs[i]);
                continue;
            }
            let regItem = regs[i].substring(0, regs[i].length - 3);
            let spaceReqString = regs[i].substring(regs[i].length - 3);

            let isValidReg = true;
            try {
                let regTemp = new RegExp(regItem, 'g')
            }
            catch (error) {
                isValidReg = false;
                // 记录正则表达式错误到控制台，而不依赖于设置
                console.error("EasyTyping: Invalid RegExp:", regItem, error);
            }

            if (isValidReg) {
                regExpList.push(new RegExp(regItem, 'g'));
                leftSRequireList.push(str2SpaceState(spaceReqString.charAt(1)));
                rightSRequireList.push(str2SpaceState(spaceReqString.charAt(2)));
            }
        }
        let regLen = regExpList.length;

        for (let i = 0; i < regLen; i++) {
            retArray = matchWithReg(text, regExpList[i], InlineType.user, retArray, true, leftSRequireList[i], rightSRequireList[i]);
        }
    }

    // 匹配时间戳
    // retArray = matchWithReg(text, /\d{1,2}:\d{1,2}(:\d{0,2}){0,1}/g, InlineType.user, retArray, true, SpaceState.none, SpaceState.none);

    // 4. 匹配缩写如 a.m.
    // retArray = matchWithAbbr(text, InlineType.user, retArray, true);

    // 5. 得到剩余的文本部分
    retArray = retArray.sort((a, b): number => a.begin - b.begin);

    let textArray: InlinePart[] = [];
    let textBegin = 0;
    let textEnd = 0;
    for (let i = 0; i < retArray.length; i++) {
        if (textBegin < retArray[i].begin) {
            textEnd = retArray[i].begin;
            textArray.push(
                {
                    content: text.substring(textBegin, textEnd),
                    type: InlineType.text,
                    begin: textBegin,
                    end: textEnd,
                    leftSpaceRequire: SpaceState.none,
                    rightSpaceRequire: SpaceState.none
                }
            );
        }
        textBegin = retArray[i].end;
    }

    if (textBegin != text.length) {
        textArray.push(
            {
                content: text.substring(textBegin, text.length),
                type: InlineType.text,
                begin: textBegin,
                end: text.length,
                leftSpaceRequire: SpaceState.none,
                rightSpaceRequire: SpaceState.none
            }
        );
    }

    // 6. 合并文本部分和其他部分
    retArray = retArray.concat(textArray);
    retArray = retArray.sort((a, b): number => a.begin - b.begin);
    return retArray
}

// 字符转化成空格状态要求
function str2SpaceState(s: string): SpaceState {
    switch (s) {
        case "+":
            return SpaceState.strict;
        case '=':
            return SpaceState.soft;
        case '-':
        default:
            return SpaceState.none;
    }
}


export function string2SpaceState(s: string): SpaceState {
    if (Number(s) == SpaceState.none) return SpaceState.none;
    if (Number(s) == SpaceState.soft) return SpaceState.soft;
    if (Number(s) == SpaceState.strict) return SpaceState.strict;
    return SpaceState.none;
}


export function getPosLineType(state: EditorState, pos: number): LineType {
    const line = state.doc.lineAt(pos)
    let line_number = line.number
    // const tree = syntaxTree(state);
    const tree = ensureSyntaxTree(state, line.to);
    if (!tree) return LineType.text;
    const token = tree.resolve(line.from, 1).name

    // for (let p=line.from; p<line.to; p+=1){
    //     console.log(p-line.from, tree.resolve(p, 1).name)
    // }

    if (token.contains('table')) {
        return LineType.table;
    }

    if (token.contains('hmd-frontmatter')) {
        return LineType.frontmatter;
    }

    if (token.contains('math')) {
        for (let p = line.from + 1; p < line.to; p += 1) {
            if (!tree.resolve(p, 1).name.contains('math')) {
                return LineType.text;
            }
        }
        return LineType.formula
    }
    else if (token.contains('code') && token.contains('block')) {
        for (let p = line.from + 1; p < line.to; p += 1) {
            let t = tree.resolve(p, 1).name
            if (!(t.contains('code') && t.contains('block'))) {
                return LineType.text
            }
        }
        return LineType.codeblock
    }
    else if (token.contains('quote') && !token.contains('callout')) {
        // 接下来判断该行是否为callout块内的代码块
        // 首先判断是否为callout
        let callout_start_line = -1;
        for (let l = line_number - 1; l >= 1; l -= 1) {
            let l_line = state.doc.line(l)
            let l_token = tree.resolve(l_line.from, 1).name
            if (!l_token.contains('quote')) {
                break;
            }
            if (l_token.contains('callout')) {
                callout_start_line = l;
                break;
            }
        }
        if (callout_start_line == -1) return LineType.text;

        // 然后判断是否为代码块
        let is_code_block: boolean = false;
        let reset: boolean = false;
        let reg_code_begin = /^>+ ```/;
        let reg_code_end = /^>+ ```$/;
        for (let l = callout_start_line + 1; l <= line_number; l += 1) {
            let l_line = state.doc.line(l)
            if (reset) {
                is_code_block = false;
                reset = false;
            }
            if (is_code_block && reg_code_end.test(l_line.text)) {
                is_code_block = true;
                reset = true;
            }
            else if (!is_code_block && reg_code_begin.test(l_line.text)) {
                is_code_block = true;
            }
        }
        if (is_code_block) {
            return LineType.codeblock;
        }
        else return LineType.text;
    }
    else if (token.contains('list')) {
        for (let p = line.from + 1; p < line.to; p += 1) {
            let t = tree.resolve(p, 1).name
            if ((t.contains('code') && t.contains('block'))) {
                return LineType.codeblock
            }
        }
    }
    return LineType.text
}


export function getPosLineType2(state: EditorState, pos: number): LineType {
    const line = state.doc.lineAt(pos)
    const tree = syntaxTree(state);
    const token = tree.resolve(line.from, 1).name
    if (token.contains('hmd-frontmatter')) {
        return LineType.frontmatter
    }

    if (token.contains('math')) {
        for (let p = line.from + 1; p < line.to; p += 1) {
            if (!tree.resolve(p, 1).name.contains('math')) {
                return LineType.text
            }
        }
        return LineType.formula
    }
    else if (token.contains('code') && token.contains('block')) {
        for (let p = line.from + 1; p < line.to; p += 1) {
            let t = tree.resolve(p, 1).name
            if (!(t.contains('code') && t.contains('block'))) {
                return LineType.text
            }
        }
        return LineType.codeblock
    }

    for (let p = line.from; p < line.to; p += 1) {
        if (tree.resolve(p, 1).name.contains('list')) {
            return LineType.list
        }
        else if (tree.resolve(p, 1).name.contains('callout')) {
            return LineType.callout_title;
        }
    }

    if (token.contains('quote')) {
        return LineType.quote;
    }

    return LineType.text
}