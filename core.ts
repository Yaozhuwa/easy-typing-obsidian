import { EditorPosition, Notice } from "obsidian";

export enum InlineType {text='text', code='code', formula='formula', link='link', user='user-defined', none='none'}
export enum LineType {text='text', code='code', formula='formula', frontmatter='frontmatter', none='none'}

export interface ArticlePart
{
    type: LineType;
    begin: number;
    end: number
}

export interface InlinePart
{
    content: string,
    type: InlineType,
    begin: number,
    end: number
}

export interface InlineChange
{
    text: string,
    begin: number,
    end: number,
    origin:string
}

export interface FormatSettings
{
    AutoFormatting: boolean;
	ChineseEnglishSpace: boolean;
	ChineseNoSpace: boolean;
    Capitalization: boolean;

	EnglishSpace: boolean;
	BraceSpace: boolean;
	NumberSpace: boolean;

    PunctuationSpace: boolean;
    InlineCodeSpace: boolean;
	InlineFormulaSpace: boolean;
    LinkSpace: boolean;
    LinkSmartSpace: boolean;

    FullWidthCharacterEnhance:boolean;

    UserDefinedRegExp:string;
    UserDefinedRegSwitch: boolean;
    UserPartSpace: boolean;

    Debug: boolean;
}

export const DEFAULT_SETTINGS: FormatSettings = {
    AutoFormatting: true,
	ChineseEnglishSpace: true,
	ChineseNoSpace: true,
    Capitalization: true,

    PunctuationSpace: true,
	EnglishSpace: true,
	BraceSpace: true,
	NumberSpace: true,

    InlineCodeSpace: true,
	InlineFormulaSpace: true,
	LinkSpace: true,
    LinkSmartSpace: true,

    FullWidthCharacterEnhance: true,
    UserDefinedRegExp:':\\w*:\n{{.*?}}',
    UserDefinedRegSwitch: true,
    UserPartSpace:true,
    Debug:false
}

// 对多行文本进行解析得到每行的类型
export function splitArticle(article:string, checkFrontMatter:boolean=true, beginIndex:number=0): ArticlePart[]
{
    let retArray: ArticlePart[] = [];
    let lines = article.split('\n');
    console.log('line number', lines.length);
    let regNullLine = /^\s*$/;
    let regFormulaBegin = /^\s*(\- (\[[x ]\] )?)?\$\$/;
    let regFormulaEnd = /\$\$$/;
    let regCodeBegin = /^\s*```/;
    let regCodeEnd = /^\s*```$/;
    let index = beginIndex;
    let regAdmonitionBlockBegin = /^\s*```ad-\w+/g;

    // 1. 判断 frontmatter区域
    if(checkFrontMatter)
    {
        let frontMatterPart: ArticlePart;
        for(let i=0;i<lines.length;i++)
        {
            if(regNullLine.test(lines[i]))
            {
                continue;
            }
            else if(lines[i]==='---')
            {
                for(let j=i+1; j<lines.length;j++)
                {
                    if(lines[j]==='---')
                    {
                        if(i!=0)
                        {
                            retArray.push({
                                type: LineType.text,
                                begin:0,
                                end:i
                            });
                        }
                        frontMatterPart = {
                            type: LineType.frontmatter,
                            begin: i,
                            end: j+1
                        };
                        retArray.push(frontMatterPart);
                        index = j+1;
                        break;
                    }
                }
                break;
            }
            else{
                break;
            }
        }
    }
    
    // console.log('index', index);

    // 2. 遍历行得到 LineType 分区
    while(index<lines.length)
    {
        if(regCodeBegin.test(lines[index]))
        {
            let j = index+1;
            while(j<lines.length)
            {
                if(regCodeEnd.test(lines[j]))
                    break;
                j++;
            }
            if(j===lines.length || !regAdmonitionBlockBegin.test(lines[index]))
            {
                j = j===lines.length?j-1:j;
                retArray.push({
                    type: LineType.code,
                    begin:index,
                    end:j+1
                });
            }
            // 对AdminitionBolck做特殊处理
            else
            {
                retArray.push({
                    type: LineType.code,
                    begin:index,
                    end:index+1
                });
                retArray.push({
                    type: LineType.text,
                    begin:index+1,
                    end:j
                });
                retArray.push({
                    type: LineType.code,
                    begin:j,
                    end:j+1
                });
            }
            index = j+1;
        }
        else if(regFormulaBegin.test(lines[index]))
        {
            let regFormulaOneLine = /(?<!\\)\$\$(?! )[^]*?(?<! )(?<!\\)\$\$/g;
            if(regFormulaOneLine.test(lines[index]))
            {
                retArray.push({
                    type: LineType.formula,
                    begin: index,
                    end: index+1
                });
                index += 1;
            }
            else{
                let j = index+1;
                while(j<lines.length)
                {
                    if(regFormulaEnd.test(lines[j]))
                        break;
                    j++;
                }
                j = j===lines.length?j-1:j;
                retArray.push({
                    type: LineType.formula,
                    begin:index,
                    end:j+1
                });
                index = j+1;
            }
        }
        else
        {
            let j = index+1;
            for(;j<lines.length;j++)
            {
                if(regCodeBegin.test(lines[j]) || regFormulaBegin.test(lines[j]))
                {
                    break;
                }
            }
            retArray.push({
                type: LineType.text,
                begin: index,
                end:j
            });
            index = j;
        }
    }

    return retArray;
}

export function reparseArticleParts(article: string, prevArticlePart:ArticlePart[]|null, updateLineStart: number, print:boolean=false): ArticlePart[]
{
    if(prevArticlePart === null || updateLineStart===0)
    {
        return splitArticle(article);
    }
    let lines = article.split('\n');
    let res: ArticlePart[] = [];
    let newBeginIndex = 0;
    let changeArticlePartIndex = 0;
    for(let i=0;i<prevArticlePart.length;i++)
    {
        if(updateLineStart>=prevArticlePart[i].begin && updateLineStart<prevArticlePart[i].end)
        {
            newBeginIndex = prevArticlePart[i].begin;
            changeArticlePartIndex = i;
            break;
        }
        else{
            res.push(prevArticlePart[i]);
        }
    }

    // 判断是否是Admonition的编辑块
    let regAdmonitionBlockBegin = /```ad-\w+/g;
    if( prevArticlePart[changeArticlePartIndex].type === LineType.text && newBeginIndex!=0 && regAdmonitionBlockBegin.test(lines[newBeginIndex-1]))
    {
        changeArticlePartIndex -= 1;
        res.pop();
    }
    // 判断是Admonition的下方```块部分
    else if(prevArticlePart[changeArticlePartIndex].begin === prevArticlePart[changeArticlePartIndex].end-1 && 
        changeArticlePartIndex>=2 && regAdmonitionBlockBegin.test(lines[prevArticlePart[changeArticlePartIndex-2].end-1]))
    {
        changeArticlePartIndex -= 2;
        res.pop();
        res.pop();
    }

    if(changeArticlePartIndex===0)
    {
        return splitArticle(article);
    }

    newBeginIndex = prevArticlePart[changeArticlePartIndex].begin;
    let newParts = splitArticle(article, false, newBeginIndex);
    for(let j=0;j<newParts.length;j++)
    {
        res.push(newParts[j]);
    }
    if(print) new Notice("Reparse Article: begin line index "+newBeginIndex.toString());
    return res;
}

export function getLineTypeFromArticleParts(line: number, typeArray: ArticlePart[]):LineType
{
    for(let i=0;i<typeArray.length;i++)
    {
        if(line >= typeArray[i].begin && line<typeArray[i].end)
        {
            return typeArray[i].type;
        }
    }
}

export function stringDeleteAt(str: string, index: number):string
{
    return str.substring(0, index)+str.substring(index+1);
}

export function stringInsertAt(str:string, index: number, s: string):string
{
    return str.substring(0, index)+s+str.substring(index);
}


/**
 * 分割一行文本，得到不同区域
 */
export function splitLine(line: string, regExps?:string): InlinePart[]
{
    let regInlineMark = /(?<!\\)\$|(?<!\\)\`/g;
    let regFormulaInline = /(?<!\\)\$(?! )[^]+?(?<! )(?<!\\)\$/g;
    let regFormulaBlock = /(?<!\\)\$\$(?! )[^]*?(?<! )(?<!\\)\$\$/g;
    let regCode = /(?<!\\)`[^]*?(?<!\\)`/g;
    let markQueue:RegExpExecArray[] = [];
    let arrayOfInlineTextCodeFormula: InlinePart[] = [];

    while(true)
    {
        let match = regInlineMark.exec(line);
        if(!match) break;
        markQueue.push(match);
    }

    let textBeginIndex = 0;
    while(markQueue.length!=0)
    {
        let mark = markQueue.shift();
        if(mark.index<textBeginIndex) continue;

        if(mark[0]==='$')
        {
            let matchFormulaBeginIndex:number;
            let matchFormulaLastIndex:number;
            regFormulaBlock.lastIndex = mark.index;
            let matchBlockFormula = regFormulaBlock.exec(line);
            if(matchBlockFormula && matchBlockFormula.index===mark.index)
            {
                matchFormulaBeginIndex = matchBlockFormula.index;
                matchFormulaLastIndex = regFormulaBlock.lastIndex;
            }
            else
            {
                regFormulaInline.lastIndex = mark.index;
                let matchInlineFormula = regFormulaInline.exec(line);
                if(matchInlineFormula && matchInlineFormula.index===mark.index)
                {
                    matchFormulaBeginIndex = matchInlineFormula.index;
                    matchFormulaLastIndex = regFormulaInline.lastIndex;
                }
                // 如果没匹配到，则 continue
                else
                {
                    continue;
                }
            }
            
            if(mark.index>textBeginIndex)
            {
                arrayOfInlineTextCodeFormula.push(
                    {
                        content: line.substring(textBeginIndex, mark.index),
                        type: InlineType.text,
                        begin: textBeginIndex,
                        end: mark.index
                    }
                );
            }

            arrayOfInlineTextCodeFormula.push(
                {
                    content: line.substring(matchFormulaBeginIndex, matchFormulaLastIndex),
                    type:InlineType.formula,
                    begin:matchFormulaBeginIndex,
                    end:matchFormulaLastIndex
                }
            );
            textBeginIndex = matchFormulaLastIndex;
            continue;
        }
        else if(mark[0]==='`')
        {
            let matchCodeBeginIndex:number;
            let matchCodeLastIndex:number;
            regCode.lastIndex = mark.index;
            let matchInlineCode = regCode.exec(line);
            if(matchInlineCode && matchInlineCode.index===mark.index)
            {
                matchCodeBeginIndex = matchInlineCode.index;
                matchCodeLastIndex = regCode.lastIndex;

                if(mark.index>textBeginIndex)
                {
                    arrayOfInlineTextCodeFormula.push(
                        {
                            content: line.substring(textBeginIndex, mark.index),
                            type:InlineType.text,
                            begin: textBeginIndex,
                            end: mark.index
                        }
                    );
                }
    
                arrayOfInlineTextCodeFormula.push(
                    {
                        content: line.substring(matchCodeBeginIndex, matchCodeLastIndex),
                        type:InlineType.code,
                        begin:matchCodeBeginIndex,
                        end:matchCodeLastIndex
                    }
                );
                textBeginIndex = matchCodeLastIndex;
                continue;
            }
            else
            {
                continue;
            }
        }
    }
    if(textBeginIndex!=line.length)
    {
        arrayOfInlineTextCodeFormula.push(
            {
                content: line.substring(textBeginIndex),
                type:InlineType.text,
                begin:textBeginIndex,
                end:line.length
            }
        )
    }
    // =======================================
    let retArray: InlinePart[] = [];
    for(let i=0;i<arrayOfInlineTextCodeFormula.length;i++)
    {
        if(arrayOfInlineTextCodeFormula[i].type!=InlineType.text)
        {
            retArray.push(arrayOfInlineTextCodeFormula[i]);
        }
        else
        {
            let tempArray:InlinePart[];
            if(regExps)
                tempArray = splitTextWithLinkAndUserDefined(arrayOfInlineTextCodeFormula[i].content, regExps);
            else
                tempArray = splitTextWithLinkAndUserDefined(arrayOfInlineTextCodeFormula[i].content);
            
            tempArray.forEach(item=>{
                item.begin += arrayOfInlineTextCodeFormula[i].begin;
                item.end += arrayOfInlineTextCodeFormula[i].begin;
                retArray.push(item);
            });
        }
    }

    return retArray;
}

function matchWithReg(text:string, regExp:RegExp, type: InlineType, inlineTypeArray:InlinePart[], checkArray=false):InlinePart[]
{
    let retArray = inlineTypeArray;
    let matchArray:InlinePart[] = [];
    retArray = retArray.sort((a, b):number=>a.begin-b.begin);
    // console.log('before-----------\n',retArray)
    while(true)
    {
        let match = regExp.exec(text); 
        if(!match) break;
        let valid = true;
        // 检查冲突
        if(checkArray)
        {
            for(let i=0;i<retArray.length;i++)
            {
                if(match.index<=retArray[i].begin)
                {
                    if(regExp.lastIndex <= retArray[i].begin)
                    {
                        valid = true;
                        break;
                    }
                    else if(regExp.lastIndex <= retArray[i].end)
                    {
                        valid = false;
                        break;
                    }
                    else if(regExp.lastIndex > retArray[i].end)
                    {
                        let removeCount = 1;
                        valid = true;
                        for(let j=i+1; j<retArray.length;j++)
                        {
                            if(regExp.lastIndex<=retArray[j].begin)
                            {
                                removeCount = j-i;
                                valid = true;
                                break;
                            }
                            else if(regExp.lastIndex<retArray[j].end)
                            {
                                valid = false;
                                break;
                            }
                            else
                            {
                                continue;
                            }
                        }

                        if(valid)
                        {
                            retArray.splice(i, removeCount);
                            i -= 1;
                        }
                        break;
                    }
                }
                if(match.index>retArray[i].begin && match.index<retArray[i].end)
                {
                    valid = false;
                    break;
                }
            }
        }
        if(!valid) continue;
        matchArray.push(
            {
                content: match[0],
                type: type,
                begin: match.index,
                end: regExp.lastIndex
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
function splitTextWithLinkAndUserDefined(text: string, regExps?:string):InlinePart[]
{
    let retArray: InlinePart[] = [];
    let regWikiLink = /\!?\[\[[^\[\]]*?\]\]/g;
    let regMdLink = /\!?\[[^\[\]]*?\]\([^\s\)\(\[\]\{\}']*\)/g;
    // let regBareLink = /(https?|obsidian|zotero):\/\/[^\s\)\(\[\]\{\}']+/g;
    let regBareLink = /(https?:\/\/|ftp:\/\/|obsidian:\/\/|zotero:\/\/|www.)[^\s（）《》。，！？；：“”‘’\)\(\[\]\{\}']+/g;

    // 1. 匹配wikilink
    retArray = matchWithReg(text, regWikiLink, InlineType.link, retArray);
    // 2. 匹配mdlink
    retArray = matchWithReg(text, regMdLink, InlineType.link, retArray);

    // 3. 匹配用户自定义正则
    let regExpList: RegExp[] = [];
    if(regExps)
    {
        let regs = regExps.split('\n');
        for(let i=0;i<regs.length;i++)
        {
            let regNull = /^\s*$/g;
            if(regNull.test(regs[i])) continue;
            let isValidReg = true;
            try{
                let regTemp = new RegExp(regs[i], 'g')
            }
            catch(error)
            {
                isValidReg = false;
                // console.log('Bad Reg:', regs[i]);
                new Notice("Bad RegExp:" + regs[i]);
            }

            if(isValidReg) 
            {
                regExpList.push(new RegExp(regs[i], 'g'));
                // console.log('Good Reg:', regs[i]);
            }
        }
        let regLen = regExpList.length;

        for(let i=0;i<regLen;i++)
        {
            retArray = matchWithReg(text, regExpList[i], InlineType.user, retArray, true);
        }
    }
    
    // 4. 匹配纯链接
    retArray = matchWithReg(text, regBareLink, InlineType.link, retArray, true);

    // 5. 得到剩余的文本部分
    retArray = retArray.sort((a, b):number=>a.begin-b.begin);

    let textArray : InlinePart[] = [];
    let textBegin = 0;
    let textEnd = 0;
    for(let i=0;i<retArray.length;i++)
    {
        if(textBegin<retArray[i].begin)
        {
            textEnd = retArray[i].begin;
            textArray.push(
                {
                    content: text.substring(textBegin, textEnd),
                    type: InlineType.text,
                    begin: textBegin,
                    end: textEnd
                }
            );
        }
        textBegin = retArray[i].end;
    }

    if(textBegin!=text.length)
    {
        textArray.push(
            {
                content: text.substring(textBegin, text.length),
                type: InlineType.text,
                begin: textBegin,
                end: text.length
            }
        );
    }

    // 6. 合并文本部分和其他部分
    retArray = retArray.concat(textArray);
    retArray = retArray.sort((a, b):number=>a.begin-b.begin);
    return retArray
}


export function formatLine(line: string, curCursor: EditorPosition, settings: FormatSettings, prevCursor?: EditorPosition):[string, number, InlineChange[]]|null
{
    let ch = curCursor.ch;
    if(line==='') return ['', 0, []];

    // 1. 划分一行文字的内部不同模块区域
    let lineParts:InlinePart[];
    if(settings.UserDefinedRegSwitch)
    {
        lineParts = splitLine(line, settings.UserDefinedRegExp);
    }
    else
    {
        lineParts = splitLine(line);
    }
    // console.log(lineParts);

    // 备份原来的lineParts, 深拷贝
    let linePartsOrigin = JSON.parse(JSON.stringify(lineParts));
    let inlineChangeList:InlineChange[] = [];
    
    let cursorLinePartIndex = -1;
    let cursorRelativeIndex = -1;
    let resultCursorCh = 0;     // 输出的光标位置

    // 2. 找到光标所在的部分，如果是 InlinePart.text，则在光标处插入'\0'来标记光标位置
    for(let i=0;i<lineParts.length;i++)
    {
        if(ch>lineParts[i].begin && ch<=lineParts[i].end)
        {
            cursorLinePartIndex = i;
            cursorRelativeIndex = ch-lineParts[i].begin;
            if(lineParts[i].type===InlineType.text)
            {
                lineParts[i].content = stringInsertAt(lineParts[i].content, cursorRelativeIndex, '\0'); 
            }
            break;
        }
    }

    let resultLine = '';
    let offset = 0;
    // 保存前一部分的区块类型，InlineType.none 代表一行的开始
    let prevPartType:string = InlineType.none;
    let prevTextEndWithSpace = false;

    // 3. 遍历每个行部分，进行格式化处理
    for(let i=0;i<lineParts.length;i++)
    {
        // console.log(inlineList[i]);

        // 3.1 如果行内第一部分为文本，则处理句首字母大写的部分
        if(i===0 && lineParts[i].type===InlineType.text && settings.Capitalization)
        {
            // 3.1.1 如果 prevCursor 且光标不在此部分，则跳过
            if(prevCursor && cursorLinePartIndex!=0){}
            else
            {
                let regFirstSentence = /^\s*(\- (\[[x ]\] )?)?[a-z]/g;
                let regHeaderSentence = /^(#+ |>+ ?)[a-z]/g;
                let textcopy = lineParts[0].content;
                let match = regFirstSentence.exec(textcopy);
                let matchHeader = regHeaderSentence.exec(textcopy);
                let dstCharIndex = -1;

                if(match)
                {
                    dstCharIndex = regFirstSentence.lastIndex-1;
                }
                else if(matchHeader)
                {
                    dstCharIndex = regHeaderSentence.lastIndex-1;
                }

                if(!prevCursor){}
                else if(prevCursor.line===curCursor.line && dstCharIndex>=prevCursor.ch && dstCharIndex<curCursor.ch){}
                else{
                    dstCharIndex = -1;
                }

                if(dstCharIndex != -1)
                {
                    lineParts[0].content = textcopy.substring(0, dstCharIndex)+textcopy.charAt(dstCharIndex).toUpperCase()+textcopy.substring(dstCharIndex+1);
                }
                
            }
        }
        // 3.2 分别处理每种区块情况
        switch(lineParts[i].type)
        {
            // 3.2.1 处理文本区块
            case InlineType.text:
                let content = lineParts[i].content;
                // console.log('Before', i, lineParts[i].content)

                // Text.4 处理句首字母大写
                if(settings.Capitalization)
				{
					var reg = /[\.\?\!。！？]([\s]*)[a-z]/g;
					while(true)
                    {
                        let match = reg.exec(content);
                        if(!match) break;
                        let tempIndex = reg.lastIndex-1;
                        // console.log(cursorLinePartIndex)
                        // console.log(prevCursor, curCursor);
                        // console.log(tempIndex);
                        if(!prevCursor)
                        {
                            lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                            content = lineParts[i].content;
                        }
                        else if(prevCursor && cursorLinePartIndex===i && prevCursor.line===curCursor.line)
                        {
                            if(tempIndex>=prevCursor.ch-offset && tempIndex<curCursor.ch-offset)
                            {
                                lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                                content = lineParts[i].content;
                            }
                        }
                    }
                }

                // Text.1 处理中英文之间空格
                if(settings.ChineseEnglishSpace){
					let reg1=/([A-Za-z0-9,\.;\?:!])([\u4e00-\u9fa5]+)/gi;
					let reg2=/([\u4e00-\u9fa5]+)([A-Za-z0-9])/gi;
					lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                    content = lineParts[i].content;
				}
                // Text.2 处理中文间无空格
                if(settings.ChineseNoSpace)
				{
					var reg=/([\u4e00-\u9fa5，。、；‘’《》]+)(\s+)([\u4e00-\u9fa5，。、；‘’《》]+)/g;
					while(reg.exec(content))
					{
						lineParts[i].content = content.replace(reg, "$1$3");
                        content = lineParts[i].content;
					}
				}

                // Text.3 处理英文字母与标点间空格
                if(settings.EnglishSpace)
				{
					var reg = /([,\.;\?\!])([A-Za-z])/gi;
                    // let tempContent = content.replace(reg, "$1 $2");
                    // let tempContent = content;
                    while(true)
                    {
                        let match = reg.exec(content);
                        if(!match) break;
                        let tempIndex = reg.lastIndex-1;
                        if(!prevCursor)
                        {
                            content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                        }
                        else if(prevCursor && cursorLinePartIndex===i && prevCursor.line===curCursor.line)
                        {
                            if(tempIndex>=prevCursor.ch-offset && tempIndex<curCursor.ch-offset)
                            {
                                content = content.substring(0, tempIndex) + " " + content.substring(tempIndex);
                            }
                        }
                    }

                    var reg2 = /(:)([A-Za-z0-9_]+[ ,\.\?\\\/;'"，。？；‘“”’、\[\]\-\{\}])/gi;
					lineParts[i].content = content.replace(reg2, "$1 $2");
                    // console.log(lineParts[i].content);
                    content = lineParts[i].content;
				}

                // Text.5 处理英文括号与外部文本空格
                if(settings.BraceSpace)
				{
					let reg1 = /(\))([A-Za-z0-9\u4e00-\u9fa5]+)/gi;
					let reg2 = /([A-Za-z0-9\u4e00-\u9fa5:,\.\?']+)(\()/gi;
					lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                    content = lineParts[i].content;
				}

                // Text.6 处理数字与标点的空格
                if(settings.NumberSpace)
				{
					let reg1 = /([,;\?\!\]\}])([0-9])/g;
					let reg2 = /([0-9])([\[\{])/g;
                    lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                    content = lineParts[i].content;
				}
                // Text.7 得到文本部分是否以空白符开始或结束，用来判断后续文本前后是否需要添加空格
                let regStartWithSpace = /^\0?[\s,\.;\?\!，。；？！（\]\)\}]/;
                let regEndWithSpace = /[\s，。：？！）\[\(\{]\0?$/;
                let textStartWithSpace = regStartWithSpace.test(content);
                let textEndWithSpace = regEndWithSpace.test(content);

                // console.log('Median', i, lineParts[i].content)

                // Text.8 根据前一部分的区块类型处理空格添加的问题
                switch(prevPartType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace && !textStartWithSpace)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace && !textStartWithSpace)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                        }
                        break;
                    case InlineType.link:
                        if(lineParts[i].content.charAt(0)===' ') break;
                        let regBareLink = /(https?:\/\/|ftp:\/\/|obsidian:\/\/|zotero:\/\/|www.)[^\s（）《》。,;:，！？；：“”‘’\)\(\[\]\{\}']+/g;
                        let isBareLink = false;
                        isBareLink = regBareLink.test(lineParts[i-1].content);
                        if(isBareLink)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                            break;
                        }

                        if(settings.LinkSmartSpace && !textStartWithSpace)
                        {
                            let regTestWikiLink = /\!?\[\[[^\[\]]*?\]\]/;
                            let regMdLink = /\!?\[[^\[\]]*?\]\([^\s\)\(\[\]\{\}']*\)/g;
                            let regNoNeedSpace = /[\u4e00-\u9fa5][\u4e00-\u9fa5]/g;                            
                            let twoNeighborChars = '';
                            let charAtTextBegin = lineParts[i].content.charAt(0);
                            let charAtLinkEnd:string = "";
                            let linkWithNoText = false;                            
                            if(regTestWikiLink.test(lineParts[i-1].content))
                            {
                                charAtLinkEnd = lineParts[i-1].content.charAt(lineParts[i-1].content.length-3);
                                if(charAtLinkEnd==='[') linkWithNoText = true;
                            }
                            else if(regMdLink.test(lineParts[i-1].content))
                            {
                                let regMdLinkEnd = /\]/;
                                let charAtLinkEndIndex=lineParts[i-1].content.search(regMdLinkEnd)-1;
                                charAtLinkEnd = lineParts[i-1].content.charAt(charAtLinkEndIndex);
                                if(charAtLinkEnd==='[') linkWithNoText = true;
                            }

                            twoNeighborChars = charAtLinkEnd+charAtTextBegin;
                            if( !linkWithNoText && !regNoNeedSpace.test(twoNeighborChars))
                            {
                                lineParts[i].content = ' '+content;
                                content = lineParts[i].content;
                            }
                        }
                        else if(!settings.LinkSmartSpace && settings.LinkSpace && !textStartWithSpace)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                        }
                        break;
                    case InlineType.user:
                        if(settings.UserPartSpace && !textStartWithSpace)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                        }
                        break;
                }

                // Text.9 如果光标在该区块，则计算最终光标的位置
                if(i === cursorLinePartIndex)
                {
                    let reg = '\0';
                    let n = content.search(reg)
                    resultCursorCh = offset + n;
                    // 删除 \0
                    lineParts[i].content = stringDeleteAt(content, n);
                }
                // console.log('After', i, lineParts[i].content)
                // Text.10 变量更新
                resultLine += lineParts[i].content;
                offset += lineParts[i].content.length;
                prevPartType = InlineType.text;
                prevTextEndWithSpace = textEndWithSpace;
                break;
            
            // 3.2.2 处理行内代码块部分
            case InlineType.code:
                // Code.1 根据前一区块类型和settings添加空格
                switch(prevPartType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.InlineCodeSpace && !prevTextEndWithSpace)
                        {
                            lineParts[i-1].content += ' ';
                            resultLine += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace)
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
                        if(settings.InlineFormulaSpace || settings.InlineCodeSpace)
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
                    case InlineType.link:
                        if(settings.LinkSpace || settings.InlineCodeSpace)
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
                        if(settings.UserPartSpace || settings.InlineCodeSpace)
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
                prevTextEndWithSpace = false;
                break;

            // 3.2.3 处理行内公式的部分
            case InlineType.formula:
                // Formula.1 根据前一区块类型和settings添加空格
                switch(prevPartType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.InlineFormulaSpace && !prevTextEndWithSpace)
                        {
                            lineParts[i-1].content += ' ';
                            resultLine += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace || settings.InlineFormulaSpace)
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
                        if(settings.InlineFormulaSpace)
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
                    case InlineType.link:
                        if(settings.LinkSpace || settings.InlineFormulaSpace)
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
                        if(settings.UserPartSpace || settings.InlineFormulaSpace)
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
                prevTextEndWithSpace = false;
                break;

            // 3.2.4 处理行内链接的部分
            case InlineType.link:
                // Link.1 根据前一区块类型和settings添加空格
                switch(prevPartType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        let charAtTextEnd = lineParts[i-1].content.charAt(lineParts[i-1].content.length-1);
                        if(charAtTextEnd===' ') break;

                        if(settings.LinkSmartSpace && !prevTextEndWithSpace)
                        {
                            let regTestWikiLink = /\!?\[\[[^\[\]]*?\]\]/;
                            let regMdLink = /\!?\[[^\[\]]*?\]\([^\s\)\(\[\]\{\}']*\)/g;
                            let regNoNeedSpace = /[\u4e00-\u9fa5][\u4e00-\u9fa5]/g;
                            let isBareLink = false;
                            let twoNeighborChars = '';
                            let charAtLinkBegin = '';
                            let linkWithNoText = false;
                            if(regTestWikiLink.test(lineParts[i].content))
                            {
                                let beginIndex = 2;
                                if(lineParts[i].content.charAt(0)==='!') beginIndex=3;
                                charAtLinkBegin = lineParts[i].content.charAt(beginIndex);
                                if(charAtLinkBegin===']') linkWithNoText = true;                                
                            }
                            else if(regMdLink.test(lineParts[i].content))
                            {
                                let regMdLinkBegin = /\[/;
                                let charAtLinkBeginIndex = lineParts[i].content.search(regMdLinkBegin)+1;
                                charAtLinkBegin = lineParts[i].content.charAt(charAtLinkBeginIndex);
                                if(charAtLinkBegin===']') linkWithNoText = true; 
                            }
                            else
                            {
                                isBareLink = true;
                            }

                            twoNeighborChars = charAtTextEnd+charAtLinkBegin;                            
                            if( !linkWithNoText && (isBareLink || !regNoNeedSpace.test(twoNeighborChars)))
                            {
                                lineParts[i-1].content += ' ';
                                resultLine += ' ';
                                offset += 1;
                            }
                        }
                        else if(settings.LinkSpace && !prevTextEndWithSpace)
                        {
                            lineParts[i-1].content += ' ';
                            resultLine += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace || settings.LinkSpace)
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
                        if(settings.InlineFormulaSpace || settings.LinkSpace)
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
                    case InlineType.link:
                        if(settings.LinkSpace)
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
                        if(settings.UserPartSpace || settings.LinkSpace)
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

                // Link.2 如果该区块有光标，则计算最终光标位置
                if(i === cursorLinePartIndex)
                {
                    resultCursorCh = offset + cursorRelativeIndex;
                }
                // Link.3 更新变量
                resultLine += lineParts[i].content;
                offset += lineParts[i].content.length;
                prevPartType = InlineType.link;
                prevTextEndWithSpace = false;
                break;
            
            // 3.2.5 处理用户自定义区块的部分
            case InlineType.user:
                // User.1 根据前一区块类型和settings添加空格
                switch(prevPartType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.UserPartSpace && !prevTextEndWithSpace)
                        {
                            lineParts[i-1].content += ' ';
                            resultLine += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace || settings.UserPartSpace)
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
                        if(settings.InlineFormulaSpace || settings.UserPartSpace)
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
                    case InlineType.link:
                        if(settings.LinkSpace || settings.UserPartSpace)
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
                        if(settings.UserPartSpace)
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
                prevTextEndWithSpace = false;
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

export function isPositionBefore(pos1: EditorPosition, pos2: EditorPosition): boolean
{
    if(pos1.line < pos2.line) return true;
    else if (pos1.line > pos2.line) return false;
    else
    {
        if(pos1.ch < pos2.ch) return true;
        else return false;
    }
}