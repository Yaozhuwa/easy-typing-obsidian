import { Notice} from "obsidian"
import { EasyTypingSettings, WorkMode } from './settings'
import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec, Text, Line } from '@codemirror/state';
import { offsetToPos, posToOffset, stringDeleteAt, stringInsertAt, isParamDefined} from './utils'

export enum LineType { text = 'text', code = 'code', formula = 'formula', none = 'none' }

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

export class ArticleParser {
    ArticleStructure: ArticlePart[];
    ArticleContent: string;
    constructor() {
        this.ArticleStructure = [];
        this.ArticleContent = "";
    }

    updateContent(newArticle: string) {
        this.ArticleContent = newArticle;
    }

    parse(article: string, beginIndex: number = 0): ArticlePart[] {
        let retArray: ArticlePart[] = [];
        let lines = article.split('\n');
        // let regNullLine = /^\s*$/;
        let regFormulaBegin = /^\s*(\- (\[[x ]\] )?)?\$\$/;
        let regFormulaEnd = /\$\$$/;
        let regCodeBegin = /^\s*```/;
        let regCodeEnd = /^\s*```$/;
        let index = beginIndex;

        while (index < lines.length) {
            // 1. 检测 CodeBlock
            if (regCodeBegin.test(lines[index])) {
                let j = index + 1;
                while (j < lines.length) {
                    if (regCodeEnd.test(lines[j]))
                        break;
                    j++;
                }
                j = j === lines.length ? j - 1 : j;
                retArray.push({
                    type: LineType.code,
                    begin: index,
                    end: j + 1
                });
                index = j + 1;
            }
            // 2. 检测 FormulaBlock
            else if (regFormulaBegin.test(lines[index])) {
                let regFormulaOneLineReverse = /\$\$(?!\\)[^]*?\$\$(?!\\)/g;
                let reversedLine = lines[index].split('').reverse().join('')
                // let regFormulaOneLine = /(?<!\\)\$\$(?! )[^]*?(?<! )(?<!\\)\$\$/g;
                if (regFormulaOneLineReverse.test(reversedLine)){
                    retArray.push({
                        type: LineType.formula,
                        begin: index,
                        end: index + 1
                    });
                    index += 1;
                }
                else {
                    let j = index + 1;
                    while (j < lines.length) {
                        if (regFormulaEnd.test(lines[j]))
                            break;
                        j++;
                    }
                    j = j === lines.length ? j - 1 : j;
                    retArray.push({
                        type: LineType.formula,
                        begin: index,
                        end: j + 1
                    });
                    index = j + 1;
                }
            }
            else {
                let j = index + 1;
                while (j < lines.length) {
                    if (regCodeBegin.test(lines[j]) || regFormulaBegin.test(lines[j]))
                        break;
                    j++;
                }
                retArray.push({
                    type: LineType.text,
                    begin: index,
                    end: j
                });
                index = j;
            }
        }
        return retArray;
    }

    reparse(changedArticle: string, updateLineStart: number) {
        this.ArticleContent = changedArticle;
        let res: ArticlePart[] = [];
        let newBeginIndex = 0;
        let changeArticlePartIndex = 0;
        for (let i = 0; i < this.ArticleStructure.length; i++) {
            if (updateLineStart >= this.ArticleStructure[i].begin && updateLineStart < this.ArticleStructure[i].end) {
                newBeginIndex = this.ArticleStructure[i].begin;
                changeArticlePartIndex = i;
                break;
            }
            else {
                res.push(this.ArticleStructure[i]);
            }
        }

        if (changeArticlePartIndex === 0) {
            this.ArticleStructure = this.parse(changedArticle);
            this.ArticleContent = changedArticle;
        }

        let newParts = this.parse(changedArticle, newBeginIndex);
        for (let j = 0; j < newParts.length; j++) {
            res.push(newParts[j]);
        }
        this.ArticleStructure = res;
    }

    getLineType(line: number): LineType {
        for (let i = 0; i < this.ArticleStructure.length; i++) {
            if (line >= this.ArticleStructure[i].begin && line < this.ArticleStructure[i].end) {
                return this.ArticleStructure[i].type;
            }
        }
        return LineType.none;
    }

    isBlockBeginOrEndLine(line: number, type: LineType):boolean {
        for (let i = 0; i < this.ArticleStructure.length; i++) {
            if (this.ArticleStructure[i].type==type && (line == this.ArticleStructure[i].begin || line == this.ArticleStructure[i].end)) {
                return true;
            }
        }
        return false;
    }

    isChangePosNeedReparse(pos: {line:number, ch:number}):boolean{
        if (this.isBlockBeginOrEndLine(pos.line, LineType.formula) && pos.ch<2){
            return true;
        }
        else if(this.isBlockBeginOrEndLine(pos.line, LineType.code) && pos.ch<3){
            return true;
        }
        return false;
    }

    isTextLine(line: number): boolean {
        return this.getLineType(line) === LineType.text;
    }

    parseNewArticle(article: string) {
        this.ArticleContent = article;
        this.ArticleStructure = this.parse(article);
    }

    print() {
        console.log("~~~~~~~~~~~ArticleParser~~~~~~~~~~~")
        let lines = this.ArticleContent.split('\n');
        for (let part of this.ArticleStructure) {
            console.log("Article Part:", part.type, part.begin, part.end);
            for (let j = part.begin; j < part.end; j++) {
                console.log(lines[j]);
            }
        }
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
    }

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

    parseLine(line: string, regRegExp?: string) {
        let regMark = /\$|`/;
        let flag = false;
        let markList:{mark:string, ch:number}[] = [];
        for (let i=0;i<line.length;i++)
        {
            if(!flag && regMark.test(line.charAt(i)))
            {
                markList.push({mark:line.charAt(i), ch:i});
            }
            flag = line.charAt(i)=="\\";
        }
    
        let linePartsOfTxtCodeFormula: InlinePart[] = [];
        let txtBeginIdx = 0;
        for (let i=0; i <markList.length; i++)
        {
            if(markList[i].ch<txtBeginIdx) continue;
            if(markList[i].mark=="$")
            {
                let matchFlag = false;
                for(let j=i+1; j < markList.length; j++)
                {
                    if(markList[j].mark=="$")
                    {
                        matchFlag = true;
                        if(markList[i].ch > txtBeginIdx)
                        {
                            linePartsOfTxtCodeFormula.push({
                                content: line.substring(txtBeginIdx, markList[i].ch),
                                type: InlineType.text,
                                begin: txtBeginIdx,
                                end: markList[i].ch,
                                leftSpaceRequire: SpaceState.none,
                                rightSpaceRequire: SpaceState.none
                            })
                        }
    
                        linePartsOfTxtCodeFormula.push({
                            content: line.substring(markList[i].ch, markList[j].ch+1),
                            type: InlineType.formula,
                            begin: markList[i].ch,
                            end: markList[j].ch+1,
                            leftSpaceRequire: SpaceState.none,
                            rightSpaceRequire: SpaceState.none
                        })
                        txtBeginIdx = markList[j].ch+1;
                        i = j;
                        break;
                    }
                }
                if (!matchFlag) continue;
            }
            // markList[j].mark=="`"
            else
            {
                if(markList[i].ch > txtBeginIdx)
                {
                    linePartsOfTxtCodeFormula.push({
                        content: line.substring(txtBeginIdx, markList[i].ch),
                        type: InlineType.text,
                        begin: txtBeginIdx,
                        end: markList[i].ch,
                        leftSpaceRequire: SpaceState.none,
                        rightSpaceRequire: SpaceState.none
                    })
                }
    
                let matchFlag = false;
                for(let j=i+1; j < markList.length; j++)
                {
                    if(markList[j].mark=="`")
                    {
                        matchFlag = true;
                        linePartsOfTxtCodeFormula.push({
                            content: line.substring(markList[i].ch, markList[j].ch+1),
                            type: InlineType.code,
                            begin: markList[i].ch,
                            end: markList[j].ch+1,
                            leftSpaceRequire: SpaceState.none,
                            rightSpaceRequire: SpaceState.none
                        })
                        txtBeginIdx = markList[j].ch+1;
                        i = j;
                        break;
                    }
                }
                if (!matchFlag)
                {
                    linePartsOfTxtCodeFormula.push({
                        content: line.substring(markList[i].ch),
                        type: InlineType.code,
                        begin: markList[i].ch,
                        end: line.length,
                        leftSpaceRequire: SpaceState.none,
                        rightSpaceRequire: SpaceState.none
                    })
                    txtBeginIdx = line.length;
                }
            }
        }
        if (txtBeginIdx < line.length)
        {
            linePartsOfTxtCodeFormula.push({
                content: line.substring(txtBeginIdx),
                    type: InlineType.text,
                    begin: txtBeginIdx,
                    end: line.length,
                    leftSpaceRequire: SpaceState.none,
                    rightSpaceRequire: SpaceState.none
            })
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

    // todo 还需要额外处理回车
    formatLineOfDoc(doc: Text, settings: EasyTypingSettings, fromB: number, toB: number, insertedStr: string): [TransactionSpec[], TransactionSpec] | null {
        let line = doc.lineAt(fromB).text;
        let res = null
        if (insertedStr=="\n")
        {
            res = this.formatLine(line, settings, offsetToPos(doc, fromB).ch, offsetToPos(doc, fromB).ch);
        }
        else
        {
            res = this.formatLine(line, settings, offsetToPos(doc, toB).ch, offsetToPos(doc, fromB).ch);
        }
        if (res ===null || res[2].length==0) return null;
        
        let newline = stringInsertAt(res[0], res[1], "|");
        if (settings.debug) console.log("EasyTyping: New Line String:", newline)

        let changes: TransactionSpec[] = [];
        let offset = doc.lineAt(fromB).from;

        for(let changeItem of res[2])
        {
            changes.push({
                changes:{from: offset+changeItem.begin, to:offset+changeItem.end, insert:changeItem.text}, userEvent:"EasyTyping.change"
            })
        }
        if (insertedStr=='\n') res[1]+= 1;
        return [changes, {selection:{anchor:offset+res[1]}, userEvent:"EasyTyping.change"}];
    }

    // 返回值： [最终的行，最终光标位置，内容改变]
    formatLine(line: string, settings: EasyTypingSettings, curCh: number, prevCh?: number): [string, number, InlineChange[]] | null {
        // new Notice("format-now");
        let regNull = /^\s*$/g;
        if (regNull.test(line)) return [line, curCh, []];
        // 1. 划分一行文字的内部不同模块区域
        let lineParts: InlinePart[];
        if (settings.UserDefinedRegSwitch) {
            lineParts = this.parseLine(line, settings.UserDefinedRegExp);
        }
        else {
            lineParts = this.parseLine(line);
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
                    let regFirstSentence = /^\s*(\- (\[[x ]\] )?)?[a-z\u0401\u0451\u0410-\u044f]/g;
                    let regHeaderSentence = /^(#+ |>+ ?)[a-z\u0401\u0451\u0410-\u044f]/g;
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
                            if (settings.AutoCapitalMode === WorkMode.Globally) {
                                lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                                content = lineParts[i].content;
                            }
                            else if (isParamDefined(prevCh) && cursorLinePartIndex === i && tempIndex >= prevCh - offset && tempIndex < curCh - offset) {
                                lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                                content = lineParts[i].content;
                            }
                        }
                    }

                    // Text.1 处理中英文之间空格
                    if (settings.ChineseEnglishSpace) {
                        let reg1 = /([A-Za-z0-9,\.;\?:!])([\u4e00-\u9fa5]+)/gi;
                        let reg2 = /([\u4e00-\u9fa5]+)([A-Za-z0-9])/gi;
                        lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                        content = lineParts[i].content;
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
                        // Text.3 处理英文字母与标点间空格
                        // if(settings.EnglishSpace)
                        {
                            let reg = /([,\.;\?\!])([A-Za-z\u0401\u0451\u0410-\u044f])/gi;
                            while (true) {
                                let match = reg.exec(content);
                                if (!match) break;
                                let tempIndex = reg.lastIndex - 1;
                                if (settings.PunctuationSpaceMode === WorkMode.Globally) {
                                    content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                }
                                else if (isParamDefined(prevCh) && cursorLinePartIndex === i && tempIndex >= prevCh - offset && tempIndex < curCh - offset) {
                                    content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                                }
                            }

                            // 单独处理冒号后文本的自动空格，为了兼容 :emoji: 格式的输入
                            let reg2 = /(:)([A-Za-z0-9_]+[ ,\.\?\\\/;'"，。？；‘“”’、\[\]\-\{\}])/gi;
                            lineParts[i].content = content.replace(reg2, "$1 $2");
                            // console.log(lineParts[i].content);
                            content = lineParts[i].content;

                            let reg3 = /(:)(["'])/g;
                            lineParts[i].content = content.replace(reg3, "$1 $2");
                            content = lineParts[i].content;
                        }

                        // Text.5 处理英文括号与外部文本空格
                        // if(settings.BraceSpace)
                        {
                            let reg1 = /(\))([A-Za-z0-9\u4e00-\u9fa5]+)/gi;
                            let reg2 = /([A-Za-z0-9\u4e00-\u9fa5:,\.\?\!'"]+)(\()/gi;
                            lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                            content = lineParts[i].content;
                        }

                        // Text.6 处理数字与标点的空格
                        // if(settings.NumberSpace)
                        {
                            let reg1 = /([,;\?\!\]\}])([0-9])/g;
                            let reg2 = /([0-9])([\[\{])/g;
                            lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                            content = lineParts[i].content;
                        }
                    }

                    // Text.7 得到文本部分是否以空白符开始或结束，用来判断后续文本前后是否需要添加空格
                    let regStrictSpaceStart = /^\0?\s/;
                    let regStrictSpaceEnd = /\s\0?$/;
                    let regStartWithSpace = /^\0?[\s,\.;\?\!，。；？！~\*、（）"”\]\)\}]/;
                    let regEndWithSpace = /[\s，。、：；？！（）~\*"“\[\(\{]\0?$/;
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
                                let regNeedSpace = /[A-Za-z0-9,\.;\?:!][\u4e00-\u9fa5]|[\u4e00-\u9fa5][A-Za-z0-9]/g;
                                if (regNeedSpace.test(twoNeighborChars)) {
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
                            if (settings.InlineLinkSmartSpace && prevTextEndSpaceState==SpaceState.none)
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
    let regWikiLink = /\!?\[\[[^\[\]]*?\]\]/g;
    let regMdLink = /\!?\[[^\[\]]*?\]\([^\s\)\(\[\]\{\}']*\)/g;
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
                new Notice("EasuTyping: Bad RegExp:\n" + regItem);
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

    // 4. 匹配纯链接
    // retArray = matchWithReg(text, regBareLink, InlineType.barelink, retArray, true);

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