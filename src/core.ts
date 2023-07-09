import { Notice} from "obsidian"
import { EasyTypingSettings, WorkMode } from './settings'
import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec, Text, Line } from '@codemirror/state';
import { offsetToPos, posToOffset, stringDeleteAt, stringInsertAt, isParamDefined} from './utils'
import { syntaxTree } from "@codemirror/language";

export enum LineType { text = 'text', codeblock = 'codeblock', formula = 'formula', 
                        none = 'none', frontmatter="frontmatter",
                        quote='quote', callout_title='callout_title', list='list' }

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
    syntaxTreeNodeNameType(name:string):InlineType{
        if(name.contains('code') && !name.contains("link")){
            return InlineType.code;
        }
        else if(name.contains('math')){
            return InlineType.formula;
        }
        else{
            return InlineType.text;
        }
    }

    // param lineNum: 1-based line number
    parseLineWithSyntaxTree(state: EditorState, lineNum:number, regRegExp?: string){
        let linePartsOfTxtCodeFormula: InlinePart[] = [];
        let line = state.doc.line(lineNum);
        const tree = syntaxTree(state);
        let pos = line.from;
        let prevNodeType:InlineType = InlineType.none;
        let prevBeginIdx = 0;
        while(pos<line.to){
            let node = tree.resolve(pos, 1);
            let curNodeType = this.syntaxTreeNodeNameType(node.name)
            
            if(prevNodeType==InlineType.none){
                prevNodeType=curNodeType;
                prevBeginIdx=0;
            }
            else if(prevNodeType==curNodeType){}
            else{
                linePartsOfTxtCodeFormula.push({
                    content:line.text.substring(prevBeginIdx, pos-line.from),
                    type:prevNodeType,
                    begin:prevBeginIdx,
                    end:pos-line.from,
                    leftSpaceRequire:SpaceState.none,
                    rightSpaceRequire:SpaceState.none
                })
                prevNodeType = curNodeType;
                prevBeginIdx = pos-line.from;
            }
            // update next pos
            if (curNodeType == InlineType.text){
                pos++;
            }
            else{
                pos = node.to;
            }

            if(pos==line.to){
                linePartsOfTxtCodeFormula.push({
                    content:line.text.substring(prevBeginIdx, pos-line.from),
                    type:prevNodeType,
                    begin:prevBeginIdx,
                    end:pos-line.from,
                    leftSpaceRequire:SpaceState.none,
                    rightSpaceRequire:SpaceState.none
                })
            }
        }
        // console.log("line parts: ", linePartsOfTxtCodeFormula);
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
        // console.log(retArray)
        return retArray;
    }

    formatLineOfDoc(state: EditorState, settings: EasyTypingSettings, fromB: number, toB: number, insertedStr: string): [TransactionSpec[], TransactionSpec] | null {
        let doc = state.doc;
        let line = doc.lineAt(fromB).text;
        let res = null
        if (insertedStr.contains("\n"))
        {
            res = this.formatLine(state, doc.lineAt(fromB).number, settings, offsetToPos(doc, fromB).ch, offsetToPos(doc, toB-1).ch);
        }
        else
        {
            res = this.formatLine(state, doc.lineAt(fromB).number, settings, offsetToPos(doc, toB).ch, offsetToPos(doc, fromB).ch);
        }
        if (res ===null || res[2].length==0) return null;
        
        let newline = stringInsertAt(res[0], res[1], "|");
        // if (settings.debug) console.log("EasyTyping: New Line String:", newline)

        let changes: TransactionSpec[] = [];
        let offset = doc.lineAt(fromB).from;

        for(let changeItem of res[2])
        {
            changes.push({
                changes:{from: offset+changeItem.begin, to:offset+changeItem.end, insert:changeItem.text}, userEvent:"EasyTyping.change"
            })
        }
        if (insertedStr.contains("\n")){
            console.log("insertStr", insertedStr)
            res[1]+= insertedStr.length;
        }
        return [changes, {selection:{anchor:offset+res[1]}, userEvent:"EasyTyping.change"}];
    }

    // 返回值： [最终的行，最终光标位置，内容改变]
    // param lineNum: 1-based line number
    formatLine(state: EditorState, lineNum:number, settings: EasyTypingSettings, curCh: number, prevCh?: number): [string, number, InlineChange[]] | null {
        // new Notice("format-now");
        let line = state.doc.line(lineNum).text;
        let regNull = /^\s*$/g;
        if (regNull.test(line)) return [line, curCh, []];
        // 1. 划分一行文字的内部不同模块区域
        let lineParts: InlinePart[];
        if (settings.UserDefinedRegSwitch) {
            // lineParts = this.parseLine(line, settings.UserDefinedRegExp);
            lineParts = this.parseLineWithSyntaxTree(state, lineNum, settings.UserDefinedRegExp);
        }
        else {
            // lineParts = this.parseLine(line);
            lineParts = this.parseLineWithSyntaxTree(state, lineNum);
        }
        // if (settings.debug) console.log("line parts\n", lineParts);

        // 备份原来的lineParts, 深拷贝
        let linePartsOrigin = JSON.parse(JSON.stringify(lineParts));
        let inlineChangeList: InlineChange[] = [];

        let cursorLinePartIndex = -1;
        let cursorRelativeIndex = -1;
        let resultCursorCh = 0;     // 输出的光标位置

        // 2. 找到光标所在的部分，如果是 InlinePart.text，则在光标处插入'\0'来标记光标位置
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
        let resultLine = '';
        let offset = 0;
        // 保存前一部分的区块类型，InlineType.none 代表一行的开始
        let prevPartType: string = InlineType.none;
        let prevTextEndSpaceState = SpaceState.none;

        // 3. 遍历每个行部分，进行格式化处理
        for (let i = 0; i < lineParts.length; i++) {
            // 3.1 如果行内第一部分为文本，则处理句首字母大写的部分
            if (i === 0 && lineParts[i].type === InlineType.text && settings.AutoCapital) {
                // 3.1.1 如果 prevCursor 且光标不在此部分，则跳过
                if (isParamDefined(prevCh) && cursorLinePartIndex != 0) { }
                else {
                    let regFirstSentence = /^\s*(\- (\[[x ]\] )?)?“?[a-z\u0401\u0451\u0410-\u044f]/g;
                    let regHeaderSentence = /^(#+ |>+ ?|“)[a-z\u0401\u0451\u0410-\u044f]/g;
                    let textcopy = lineParts[0].content;
                    let match = regFirstSentence.exec(textcopy);
                    let matchHeader = regHeaderSentence.exec(textcopy);
                    let dstCharIndex = -1;
                    if (match) {
                        dstCharIndex = regFirstSentence.lastIndex - 1;
                    }
                    else if (matchHeader) {
                        dstCharIndex = regHeaderSentence.lastIndex - 1;
                    }

                    if (settings.AutoCapitalMode == WorkMode.Globally || (isParamDefined(prevCh) && dstCharIndex >= prevCh && dstCharIndex < curCh)) { }
                    else {
                        dstCharIndex = -1;
                    }

                    if (dstCharIndex != -1) {
                        
                        lineParts[0].content = textcopy.substring(0, dstCharIndex) + textcopy.charAt(dstCharIndex).toUpperCase() + textcopy.substring(dstCharIndex + 1);
                    }
                }
            }

            switch (lineParts[i].type) {
                // 3.2.1 处理文本区块
                case InlineType.text:
                    let content = lineParts[i].content;
                    // Text.4 处理句首字母大写
                    if (settings.AutoCapital) {
                        var reg = /[\.\?\!。！？]([\s]*)[a-z\u0401\u0451\u0410-\u044f]/g;
                        while (true) {
                            let match = reg.exec(content);
                            if (!match) break;
                            let tempIndex = reg.lastIndex - 1;
                            // console.log("prevCh, curCh, offset, tempIndex")
                            // console.log(prevCh, curCh, offset, tempIndex)
                            let isSpaceDot = tempIndex-2<0 || content.substring(tempIndex-2, tempIndex)==' .';
                            if (settings.AutoCapitalMode == WorkMode.Globally && !isSpaceDot) {
                                lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                                content = lineParts[i].content;
                            }
                            else if (isParamDefined(prevCh) && tempIndex >= prevCh - offset && tempIndex < curCh - offset && !isSpaceDot) {
                                lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                                content = lineParts[i].content;
                            }
                        }
                    }   

                    // Text.1 处理中英文之间空格
                    if (settings.ChineseEnglishSpace) {
                        let reg1 = /([A-Za-z])([\u4e00-\u9fa5])/gi;
                        let reg2 = /([\u4e00-\u9fa5])([A-Za-z])/gi;
                        lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                        content = lineParts[i].content;
                    }

                    if (settings.ChineseNumberSpace){
                        let reg = /([0-9])([\u4e00-\u9fa5])/g;
                        while (true) {
                            let match = reg.exec(content);
                            if (!match) break;
                            let tempIndex = reg.lastIndex - 1;
                            if (isParamDefined(prevCh) && tempIndex >= prevCh - offset && tempIndex < curCh - offset) {
                                content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                curCh += 1;
                            }
                        }
                        let reg1 = /([\u4e00-\u9fa5])([0-9])/g;
                        while (true) {
                            let match = reg1.exec(content);
                            if (!match) break;
                            let tempIndex = reg1.lastIndex - 1;
                            if (isParamDefined(prevCh) && tempIndex >= prevCh - offset && tempIndex < curCh - offset) {
                                content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                curCh += 1;
                            }
                        }
                    }

                    if (settings.EnglishNumberSpace){
                        let reg = /([A-Za-z])(\d)/g;
                        while (true) {
                            let match = reg.exec(content);
                            if (!match) break;
                            let tempIndex = reg.lastIndex - 1;
                            if (isParamDefined(prevCh) && tempIndex >= prevCh - offset && tempIndex < curCh - offset) {
                                content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                curCh += 1;
                            }
                        }
                        let reg1 = /(\d)([A-Za-z])/g;
                        while (true) {
                            let match = reg1.exec(content);
                            if (!match) break;
                            let tempIndex = reg1.lastIndex - 1;
                            if (isParamDefined(prevCh) && tempIndex >= prevCh - offset && tempIndex < curCh - offset) {
                                content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                curCh += 1;
                            }
                        }
                    }

                    // Text.2 处理中文间无空格
                    if (settings.ChineseNoSpace) {
                        let reg = /([\u4e00-\u9fa5，。、；‘’《》]+)(\s+)([\u4e00-\u9fa5，。、；‘’《》]+)/g;
                        while (reg.exec(content)) {
                            lineParts[i].content = content.replace(reg, "$1$3");
                            content = lineParts[i].content;
                        }
                    }

                    // 标点与文本空格
                    if (settings.PunctuationSpace) {
                        // Text.3 处理标点与文本空格
                        // if(settings.EnglishSpace)
                        {
                            let reg = /([,\.;\?\!\)])([0-9A-Za-z\u0401\u0451\u0410-\u044f])|([A-Za-z0-9\u4e00-\u9fa5:,\.\?\!'"]+)(\()|[,\.;\?:!][\u4e00-\u9fa5]/gi;
                            while (true) {
                                let match = reg.exec(content);
                                if (!match) break;
                                let tempIndex = reg.lastIndex - 1;
                                let isSpaceDot = '!.?;,'.contains(content.charAt(tempIndex-1)) && (tempIndex-2<0 || content.charAt(tempIndex-2)==' ');
                                let isNumPuncNum = /[,.]\d/.test(content.substring(tempIndex-1, tempIndex+1)) && 
                                                    (tempIndex-2<0 || /\d/.test(content.charAt(tempIndex-2)))

                                if (settings.PunctuationSpaceMode == WorkMode.Globally && !isSpaceDot && !isNumPuncNum) {
                                    content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                }
                                else if (isParamDefined(prevCh) && tempIndex >= prevCh - offset 
                                                                && tempIndex < curCh - offset 
                                                                && !isSpaceDot && !isNumPuncNum) {
                                    content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                    curCh += 1;
                                }
                            }

                            // 单独处理冒号后文本的自动空格，为了兼容 :emoji: 格式的输入
                            let reg2 = /(:)([A-Za-z0-9_]+[ ,\.\?\\\/;'"，。？；‘“”’、\[\]\-\{\}])/gi;
                            lineParts[i].content = content.replace(reg2, "$1 $2");
                            content = lineParts[i].content;

                            let reg3 = /(:)(["'])/g;
                            lineParts[i].content = content.replace(reg3, "$1 $2");
                            content = lineParts[i].content;
                        }
                    }

                    // Text.7 得到文本部分是否以空白符开始或结束，用来判断后续文本前后是否需要添加空格
                    let regStrictSpaceStart = /^\0?\s/;
                    let regStrictSpaceEnd = /\s\0?$/;
                    let regStartWithSpace = /^\0?[\s,\.;\?\!，。；》？：:！~\*、（）"”\]\)\}]/;
                    let regEndWithSpace = /[\s，。、：；？！（）~\*"《“\[\(\{]\0?$/;
                    let txtStartSpaceSate = SpaceState.none;
                    let txtEndSpaceState = SpaceState.none;
                    if (regStartWithSpace.test(content)) {
                        if (regStrictSpaceStart.test(content))
                            txtStartSpaceSate = SpaceState.strict
                        else
                            txtStartSpaceSate = SpaceState.soft
                    }

                    if (regEndWithSpace.test(content)) {
                        if (regStrictSpaceEnd.test(content))
                            txtEndSpaceState = SpaceState.strict;
                        else
                            txtEndSpaceState = SpaceState.soft;
                    }

                    // Text.8 根据前一部分的区块类型处理空格添加的问题
                    switch (prevPartType) {
                        case InlineType.none:
                            break;
                        case InlineType.code:
                            if (settings.InlineCodeSpaceMode > txtStartSpaceSate) {
                                lineParts[i].content = ' ' + content;
                                content = lineParts[i].content;
                            }
                            break;
                        case InlineType.formula:
                            if (settings.InlineFormulaSpaceMode > txtStartSpaceSate) {
                                lineParts[i].content = ' ' + content;
                                content = lineParts[i].content;
                            }
                            break;
                        case InlineType.wikilink:
                        case InlineType.mdlink:
                            if (!settings.InlineLinkSmartSpace && settings.InlineLinkSpaceMode > txtStartSpaceSate) {
                                lineParts[i].content = ' ' + content;
                                content = lineParts[i].content;
                            }
                            else if (settings.InlineLinkSmartSpace && txtStartSpaceSate == SpaceState.none) {
                                let charAtTextBegin = content.charAt(0);
                                let regMdLinkEnd = /\]/;
                                let charAtLinkEndIndex = lineParts[i - 1].content.search(regMdLinkEnd) - 1;
                                let charAtLinkEnd = lineParts[i - 1].content.charAt(charAtLinkEndIndex);
                                if (charAtLinkEnd === '[') break;
                                let twoNeighborChars = charAtLinkEnd + charAtTextBegin;
                                let regNotNeedSpace = /[\u4e00-\u9fa5，。？：；”“’‘-）}][\u4e00-\u9fa5]/g;
                                if (!regNotNeedSpace.test(twoNeighborChars)) {
                                    lineParts[i].content = ' ' + content;
                                    content = lineParts[i].content;
                                }
                            }
                            break;
                        case InlineType.user:
                            if (lineParts[i - 1].rightSpaceRequire > txtStartSpaceSate) {
                                lineParts[i].content = ' ' + content;
                                content = lineParts[i].content;
                            }
                            break;
                    }

                    // Text.9 如果光标在该区块，则计算最终光标的位置
                    if (i === cursorLinePartIndex) {
                        let reg = '\0';
                        let n = content.search(reg)
                        resultCursorCh = offset + n;
                        // 删除 \0
                        lineParts[i].content = stringDeleteAt(content, n);
                    }

                    resultLine += lineParts[i].content;
                    offset += lineParts[i].content.length;
                    prevPartType = InlineType.text;
                    prevTextEndSpaceState = txtEndSpaceState;
                    break;
                
                // 3.2.2 处理行内代码块部分
                case InlineType.code:
                    // Code.1 根据前一区块类型和settings添加空格
                    switch(prevPartType)
                    {
                        case InlineType.none:
                            break;
                        case InlineType.text:
                            if (settings.InlineCodeSpaceMode > prevTextEndSpaceState)
                            {
                                lineParts[i-1].content += ' ';
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.code:
                            if (settings.InlineCodeSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.formula:
                            if (settings.InlineCodeSpaceMode>SpaceState.none || 
                                settings.InlineFormulaSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.mdlink:
                        case InlineType.wikilink:
                            if (settings.InlineCodeSpaceMode>SpaceState.none || 
                                settings.InlineLinkSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.user:
                            if (settings.InlineCodeSpaceMode>SpaceState.none ||
                                lineParts[i-1].rightSpaceRequire>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;                        
                    }
                    // Code.2 如果光标在该区块，则计算最终光标的位置
                    if(i === cursorLinePartIndex)
                    {
                        resultCursorCh = offset + cursorRelativeIndex;
                    }
                    // Code.3 变量更新
                    resultLine += lineParts[i].content;
                    offset += lineParts[i].content.length;
                    prevPartType = InlineType.code;
                    prevTextEndSpaceState = SpaceState.none;
                    break;
                
                // 3.2.3 处理行内公式的部分
                case InlineType.formula:
                    // Formula.1 根据前一区块类型和settings添加空格
                    switch(prevPartType)
                    {
                        case InlineType.none:
                            break;
                        case InlineType.text:
                            if (settings.InlineFormulaSpaceMode>prevTextEndSpaceState)
                            {
                                lineParts[i-1].content += ' ';
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.code:
                            if (settings.InlineFormulaSpaceMode>SpaceState.none ||
                                settings.InlineCodeSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.formula:
                            if (settings.InlineCodeSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.mdlink:
                        case InlineType.wikilink:
                            if (settings.InlineFormulaSpaceMode>SpaceState.none || 
                                settings.InlineLinkSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.user:
                            if (settings.InlineFormulaSpaceMode>SpaceState.none ||
                                lineParts[i-1].rightSpaceRequire>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;         
                    }
                    // Formula.2 如果光标在该区块，则计算最终光标的位置
                    if(i === cursorLinePartIndex)
                    {
                        resultCursorCh = offset + cursorRelativeIndex;
                    }
                    // Formula.3 变量更新
                    resultLine += lineParts[i].content;
                    offset += lineParts[i].content.length;
                    prevPartType = InlineType.formula;
                    prevTextEndSpaceState = SpaceState.none;
                    break;

                case InlineType.mdlink:
                case InlineType.wikilink:
                    switch(prevPartType)
                    {
                        case InlineType.none:
                            break;
                        case InlineType.text:
                            if (prevTextEndSpaceState>settings.InlineLinkSpaceMode) break;
                            if (settings.InlineLinkSpaceMode==SpaceState.strict && prevTextEndSpaceState<SpaceState.strict)
                            {
                                lineParts[i-1].content += ' ';
                                resultLine += ' ';
                                offset += 1;
                            }
                            else if (settings.InlineLinkSmartSpace && prevTextEndSpaceState==SpaceState.none)
                            {
                                let regNoNeedSpace = /[\u4e00-\u9fa5][\u4e00-\u9fa5]/g;
                                let charAtTextEnd = lineParts[i-1].content.charAt(lineParts[i-1].content.length-1);
                                let charAtLinkBegin:string = "";
                                if (lineParts[i].type==InlineType.wikilink)
                                {
                                    let regAlias = /\|/;
                                    let charOfAliasBegin = lineParts[i].content.search(regAlias);
                                    // console.log("charOfAliasBegin",charOfAliasBegin)
                                    let beginIndex = 2;
                                    if(lineParts[i].content.charAt(0)==='!') beginIndex=3;
                                    if (charOfAliasBegin!=-1)
                                    {
                                        beginIndex = charOfAliasBegin+1;
                                    }
                                    charAtLinkBegin = lineParts[i].content.charAt(beginIndex);
                                    // console.log("beginIndex", beginIndex);
                                    if(charAtLinkBegin==']') break;      
                                }
                                else
                                {
                                    let regMdLinkBegin = /\[/;
                                    let charAtLinkBeginIndex = lineParts[i].content.search(regMdLinkBegin)+1;
                                    charAtLinkBegin = lineParts[i].content.charAt(charAtLinkBeginIndex);
                                    if(charAtLinkBegin===']') break; 
                                } 
                                let twoNeighborChars = charAtTextEnd+charAtLinkBegin;
                                if(!regNoNeedSpace.test(twoNeighborChars))
                                {
                                    lineParts[i-1].content += ' ';
                                    resultLine += ' ';
                                    offset += 1;
                                }
                            }
                            else if(!settings.InlineLinkSmartSpace && settings.InlineLinkSpaceMode>prevTextEndSpaceState){
                                lineParts[i-1].content += ' ';
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.code:
                            if (settings.InlineLinkSpaceMode>SpaceState.none ||
                                settings.InlineCodeSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.formula:
                            if (settings.InlineLinkSpaceMode>SpaceState.none||
                                settings.InlineFormulaSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.mdlink:
                        case InlineType.wikilink:
                            if (settings.InlineLinkSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.user:
                            if (lineParts[i-1].rightSpaceRequire>SpaceState.none||
                                settings.InlineLinkSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                    }
                    // Link.2 如果该区块有光标，则计算最终光标位置
                    if(i === cursorLinePartIndex)
                    {
                        resultCursorCh = offset + cursorRelativeIndex;
                    }
                    // Link.3 更新变量
                    resultLine += lineParts[i].content;
                    offset += lineParts[i].content.length;
                    prevPartType = lineParts[i].type;
                    prevTextEndSpaceState = SpaceState.none;
                    break;
                
                // 3.2.5 处理用户自定义区块的部分
                case InlineType.user:
                    // User.1 根据前一区块类型和settings添加空格
                    switch(prevPartType)
                    {
                        case InlineType.none:
                            break;
                        case InlineType.text:
                            if (lineParts[i].leftSpaceRequire>prevTextEndSpaceState)
                            {
                                lineParts[i-1].content += ' ';
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.code:
                            if (lineParts[i].leftSpaceRequire>SpaceState.none||
                                settings.InlineCodeSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.formula:
                            if (lineParts[i].leftSpaceRequire>SpaceState.none||
                                settings.InlineFormulaSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.mdlink:
                        case InlineType.wikilink:
                            if (lineParts[i].leftSpaceRequire>SpaceState.none||
                                settings.InlineLinkSpaceMode>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                        case InlineType.user:
                            if (lineParts[i].leftSpaceRequire>SpaceState.none||
                                lineParts[i-1].rightSpaceRequire>SpaceState.none)
                            {
                                inlineChangeList.push(
                                    {
                                        text:' ',
                                        begin: lineParts[i].begin,
                                        end: lineParts[i].begin,
                                        origin:''
                                    }
                                );
                                resultLine += ' ';
                                offset += 1;
                            }
                            break;
                    }
                    // User.2 如果该区块有光标，则计算最终光标位置
                    if(i === cursorLinePartIndex)
                    {
                        resultCursorCh = offset + cursorRelativeIndex;
                    }
                    // Link.3 更新变量
                    resultLine += lineParts[i].content;
                    offset += lineParts[i].content.length;
                    prevPartType = InlineType.user;
                    prevTextEndSpaceState = SpaceState.none;
                    break;
            }
        }

        for(let i=0;i<lineParts.length;i++)
        {
            if(lineParts[i].type === InlineType.text && lineParts[i].content!=linePartsOrigin[i].content)
            {
                inlineChangeList.push(
                    {
                        text: lineParts[i].content,
                        begin: linePartsOrigin[i].begin,
                        end: linePartsOrigin[i].end,
                        origin: linePartsOrigin[i].content
                    }
                )
            }
        }
    
        inlineChangeList = inlineChangeList.sort((a, b):number=>a.begin-b.begin);
        return [resultLine, resultCursorCh, inlineChangeList];
    }
    
}


export class MarkdownParser{
    constructor(){}

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
                if(regExp.lastIndex>retArray[i].begin && retArray[i].end>match.index){
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

function matchWithAbbr(text: string, type: InlineType, inlineTypeArray: InlinePart[], checkArray = false){
    let retArray = inlineTypeArray;
    let matchArray: InlinePart[] = [];
    retArray = retArray.sort((a, b): number => a.begin - b.begin);
    let regAbbr = /([a-zA-Z]\.)+/g;
    while (true) {
        let match = regAbbr.exec(text);
        if (!match) break;
        let valid = true;
        let isInBlockBegin:boolean = (match.index==0);
        // 检查冲突
        if (checkArray) {
            for (let i = 0; i < retArray.length; i++) {
                if(match.index == retArray[i].end){
                    isInBlockBegin = true;
                }
                if(regAbbr.lastIndex>retArray[i].begin && retArray[i].end>match.index){
                    valid = false;
                    break;
                }
            }
        }
        if(!isInBlockBegin && valid)
        {
            let regChar = /[a-zA-Z0-9]/;
            if(regChar.test(text.charAt(match.index-1))){
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
    let regMdLink = /\!{0,2}\[[^\[\]]*?\]\([^\s\)\(\[\]\{\}']*\)/g;
    // let regBareLink = /(https?:\/\/|ftp:\/\/|obsidian:\/\/|zotero:\/\/|www.)[^\s（）《》。，！？；：“”‘’\)\(\[\]\{\}']+/g;

    // 1. 匹配wikilink
    retArray = matchWithReg(text, regWikiLink, InlineType.wikilink, retArray);
    // 2. 匹配mdlink
    retArray = matchWithReg(text, regMdLink, InlineType.mdlink, retArray);

    // 3. 匹配用户自定义正则
    let regExpList: RegExp[] = [];
    let leftSRequireList: SpaceState[] = [];
    let rightSRequireList: SpaceState[] = [];
    let regNull = /^\s*$/g;
    let regSRequire = /\|[\-=\+][\-=\+]$/;
    if (regExps) {
        let regs = regExps.split('\n');
        for (let i = 0; i < regs.length; i++) {

            if (regNull.test(regs[i])) continue;

            if ((!regSRequire.test(regs[i])) || regs[i].length <= 3) {
                new Notice("EasyTyping: 第" + String(i) + "行自定义正则不符合规范\n"+regs[i]);
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
                if(this.settings.debug){
                    new Notice("EasuTyping: Bad RegExp:\n" + regItem);
                }
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
    retArray = matchWithReg(text, /\d{1,2}:\d{1,2}(:\d{0,2}){0,1}/g, InlineType.user, retArray, true, SpaceState.none, SpaceState.none);

    // 4. 匹配缩写如 a.m.
    retArray = matchWithAbbr(text, InlineType.user, retArray, true);

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


export function string2SpaceState(s:string):SpaceState
{
    if(Number(s)==SpaceState.none) return SpaceState.none;
    if(Number(s)==SpaceState.soft) return SpaceState.soft;
    if(Number(s)==SpaceState.strict) return SpaceState.strict;
    return SpaceState.none;
}


export function getPosLineType(state: EditorState, pos: number):LineType {
    const line = state.doc.lineAt(pos)
    const tree = syntaxTree(state);
    const token = tree.resolve(line.from, 1).name

    // for (let p=line.from; p<line.to; p+=1){
    //     console.log(p-line.from, tree.resolve(p, 1).name)
    // }

    if (token.contains('hmd-frontmatter')){
        return LineType.frontmatter
    }

    if(token.contains('math')){
        for(let p=line.from+1;p<line.to;p+=1){
            if(!tree.resolve(p, 1).name.contains('math')){
                return LineType.text
            }
        }
        return LineType.formula
    }
    else if(token.contains('code') && token.contains('block')){
        for(let p=line.from+1;p<line.to;p+=1){
            let t = tree.resolve(p, 1).name
            if(!(t.contains('code') && t.contains('block'))){
                return LineType.text
            }
        }
        return LineType.codeblock
    }
    return LineType.text
}


export function getPosLineType2(state: EditorState, pos: number):LineType {
    const line = state.doc.lineAt(pos)
    const tree = syntaxTree(state);
    const token = tree.resolve(line.from, 1).name
    if (token.contains('hmd-frontmatter')){
        return LineType.frontmatter
    }

    if(token.contains('math')){
        for(let p=line.from+1;p<line.to;p+=1){
            if(!tree.resolve(p, 1).name.contains('math')){
                return LineType.text
            }
        }
        return LineType.formula
    }
    else if(token.contains('code') && token.contains('block')){
        for(let p=line.from+1;p<line.to;p+=1){
            let t = tree.resolve(p, 1).name
            if(!(t.contains('code') && t.contains('block'))){
                return LineType.text
            }
        }
        return LineType.codeblock
    }

    for(let p=line.from;p<line.to;p+=1){
        if(tree.resolve(p, 1).name.contains('list')){
            return LineType.list
        }
        else if(tree.resolve(p, 1).name.contains('callout')){
            return LineType.callout_title;
        }
    }

    if(token.contains('quote')){
        return LineType.quote;
    }
    
    return LineType.text
}