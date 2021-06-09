import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

enum InlineType {text='text', code='code', formula='formula', wikilink='wikilink', mdlink='mdlink', barelink='barelink', user='user-defined', none='none'}
enum LineType {text='text', code='code', formula='formula', frontmatter='frontmatter', none='none'};

interface ArticlePart
{
    type: LineType;
    begin: number;
    end: number
}

interface InlinePart
{
    content: string,
    type: InlineType,
    begin: number,
    end: number
}

interface FormatSettings
{
    AutoFormatting: boolean;
	ChineseEnglishSpace: boolean;
	ChineseNoSpace: boolean;
	EnglishSpace: boolean;
	Capitalization: boolean;
	BraceSpace: boolean;
	NumberSpace: boolean;

    InlineCodeSpace: boolean;
	InlineFormulaSpace: boolean;
	BareLinkSpace: boolean;
    WikiLiskSpace: boolean;
    MdLinkSpace: boolean;

    FullWidthCharacterEnhence:boolean;

    UserDefinedRegExp:string;

    Debug: boolean;
}

const DEFAULT_SETTINGS: FormatSettings = {
    AutoFormatting: true,
	ChineseEnglishSpace: true,
	ChineseNoSpace: true,
	EnglishSpace: true,
	Capitalization: true,
	BraceSpace: true,
	NumberSpace: true,

    InlineCodeSpace: true,
	InlineFormulaSpace: true,
	BareLinkSpace: true,
    WikiLiskSpace: true,
    MdLinkSpace: true,

    FullWidthCharacterEnhence:true,
    UserDefinedRegExp:'',
    Debug:false
}

function getLineType(article:string, line: number):LineType
{
    let typeArray = splitArticle(article);
    for(let i=0;i<typeArray.length;i++)
    {
        if(line >= typeArray[i].begin && line<typeArray[i].end)
        {
            return typeArray[i].type;
        }
    }
}

function getLineTypeFromArticleParts(line: number, typeArray: ArticlePart[]):LineType
{
    for(let i=0;i<typeArray.length;i++)
    {
        if(line >= typeArray[i].begin && line<typeArray[i].end)
        {
            return typeArray[i].type;
        }
    }
}

function splitArticle(article:string): ArticlePart[]
{
    let retArray: ArticlePart[] = [];
    let lines = article.split('\n');
    let regNullLine = /^\s*$/;
    let regFormulaBegin = /^\s*(\- (\[[x ]\] )?)?\$\$/;
    let regFormulaEnd = /\$\$$/;
    let regCodeBegin = /^\s*```/;
    let regCodeEnd = /^\s*```$/;
    let index = 0;

    // 1. 判断 frontmatter
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
            retArray.push({
                type: LineType.code,
                begin:index,
                end:j+1
            });
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

function stringDeleteAt(str: string, index: number):string
{
    return str.substring(0, index)+str.substring(index+1);
}

function stringInsertAt(str:string, index: number, s: string):string
{
    return str.substr(0, index)+s+str.substring(index);
}

function splitLine(line: string): InlinePart[]
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
            let tempArray = splitTextWithLink(arrayOfInlineTextCodeFormula[i].content);
            tempArray.forEach(item=>{
                item.begin += arrayOfInlineTextCodeFormula[i].begin;
                item.end += arrayOfInlineTextCodeFormula[i].begin;
                retArray.push(item);
            });
        }
    }

    return retArray;
}

function splitTextWithLink(text: string):InlinePart[]
{
    let retArray: InlinePart[] = [];
    let regWikiLink = /\!?\[\[[^\[\]]*?\]\]/g;
    let regMdLink = /\!?\[[^\[\]]*?\]\([^\s\)\(\[\]\{\}']*\)/g;
    // let regMdLink = /\!?\[[^\[\]]*?\]\((https?|obsidian|zotero):\/\/[^\s\)\(\[\]\{\}']+\)/g;
    let regBareLink = /(https?|obsidian|zotero):\/\/[^\s\)\(\[\]\{\}']+/g;

    while(true)
    {
        let match = regWikiLink.exec(text); 
        if(!match) break;
        retArray.push(
            {
                content: match[0],
                type: InlineType.wikilink,
                begin: match.index,
                end: regWikiLink.lastIndex
            }
        );
    }

    while(true)
    {
        let match = regMdLink.exec(text);
        if(!match) break;
        retArray.push(
            {
                content: match[0],
                type: InlineType.mdlink,
                begin: match.index,
                end: regMdLink.lastIndex
            }
        );
    }

    while(true)
    {
        let match = regBareLink.exec(text);
        if(!match) break;
        let valid = true;
        for(let i=0;i<retArray.length;i++)
        {
            if(match.index>=retArray[i].begin && match.index<retArray[i].end)
            {
                valid = false;
                break;
            }
        }
        if(!valid) continue;
        retArray.push(
            {
                content: match[0],
                type: InlineType.barelink,
                begin: match.index,
                end: regBareLink.lastIndex
            }
        );
    }
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

    retArray = retArray.concat(textArray);
    retArray = retArray.sort((a, b):number=>a.begin-b.begin);
    return retArray
}

function formatLine(line: string, ch: number, settings: FormatSettings):[string, number]|null
{
    if(line==='') return ['', 0];
    let inlineList = splitLine(line);
    // console.log('split line', inlineList);
    let cInlineIndex = -1;
    let cRelativeIndex = -1;
    let resultCh = 0;
    // get cursor index in inlineList

    for(let i=0;i<inlineList.length;i++)
    {
        if(ch>inlineList[i].begin && ch<=inlineList[i].end)
        {
            cInlineIndex = i;
            cRelativeIndex = ch-inlineList[i].begin;
            if(inlineList[i].type===InlineType.text)
            {
                inlineList[i].content = stringInsertAt(inlineList[i].content, cRelativeIndex, '\0'); 
            }
            break;
        }
    }

    // console.log('inline index', cInlineIndex);
    // console.log('relative index', cRelativeIndex);

    let result = '';
    let offset = 0;
    let prevType:string = InlineType.none;
    let prevEndWithSpace = false;

    for(let i=0;i<inlineList.length;i++)
    {
        // console.log(inlineList[i]);
        if(i===0 && settings.Capitalization && inlineList[i].type===InlineType.text)
        {
            let reg = /^\s*(\- (\[[x ]\] )?)?[a-z]/g;
            let regHead = /^#+ [a-z]/g;
            let textcopy = inlineList[0].content;
            let match = reg.exec(textcopy);
            let matchHead = regHead.exec(textcopy);
            let charindex = -1;
            if(match)
            {
                charindex = reg.lastIndex-1;
                inlineList[0].content = textcopy.substring(0, charindex)+textcopy.charAt(charindex).toUpperCase()+textcopy.substring(charindex+1);
            }
            else if(matchHead)
            {
                charindex = regHead.lastIndex-1;
                inlineList[0].content = textcopy.substring(0, charindex)+textcopy.charAt(charindex).toUpperCase()+textcopy.substring(charindex+1);
            }
        }
        switch(inlineList[i].type)
        {
            case InlineType.text:
                let content = inlineList[i].content;
                if(settings.ChineseEnglishSpace){
					var reg1=/([A-Za-z0-9,.;?:!])([\u4e00-\u9fa5]+)/gi;
					var reg2=/([\u4e00-\u9fa5]+)([A-Za-z0-9])/gi;
					inlineList[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                    content = inlineList[i].content;
				}
                if(settings.ChineseNoSpace)
				{
					var reg=/([\u4e00-\u9fa5，。、；‘’《》]+)(\s+)([\u4e00-\u9fa5，。、；‘’《》]+)/g;
					while(reg.exec(content))
					{
						inlineList[i].content = content.replace(reg, "$1$3");
                        content = inlineList[i].content;
					}
				}

                if(settings.EnglishSpace)
				{
					var reg = /([,.;?:!])([A-Za-z])/gi;
					inlineList[i].content = content.replace(reg, "$1 $2");
                    content = inlineList[i].content;
				}

                if(settings.Capitalization)
				{
					var reg = /[\.;\?\!。！；？]([\s]*)[a-z]/g;
					while(true)
                    {
                        let match = reg.exec(content);
                        if(!match) break;
                        let tempIndex = reg.lastIndex-1;
                        inlineList[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                        content = inlineList[i].content;
                    }
                }

                if(settings.BraceSpace)
				{
					var reg1 = /(\))([A-Za-z0-9\u4e00-\u9fa5]+)/gi;
					var reg2 = /([A-Za-z0-9\u4e00-\u9fa5:,\.\?']+)(\()/gi;
					inlineList[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                    content = inlineList[i].content;
				}

                if(settings.NumberSpace)
				{
					var reg1 = /([,;\?:\!\]\}])([0-9])/gi;
					var reg2 = /([0-9])([\[\{])/gi;
                    inlineList[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                    content = inlineList[i].content;
				}

                let regStartWithSpace = /^[\s,\.;\?\!，。；？！\]\)\}]/;
                let regEndWithSpace = /[\s，。：？！\[\(\{]\0?$/;
                let startWithSpace = regStartWithSpace.test(content);
                let endWithSpace = regEndWithSpace.test(content);
                switch(prevType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace && !startWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace && !startWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.wikilink:
                        if(settings.WikiLiskSpace && !startWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.mdlink:
                        if(settings.MdLinkSpace && !startWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.barelink:
                        if(settings.BareLinkSpace && !startWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                }

                if(i === cInlineIndex)
                {
                    let reg = '\0';
                    let n = content.search(reg)
                    resultCh = offset + n;
                    content = stringDeleteAt(content, n);
                }
                result += content;
                offset += content.length;
                prevType = InlineType.text;
                prevEndWithSpace = endWithSpace;
                // console.log('part', i, [result]);
                break;
            case InlineType.code:
                switch(prevType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.InlineCodeSpace && !prevEndWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace || settings.InlineCodeSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.wikilink:
                        if(settings.WikiLiskSpace || settings.InlineCodeSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.mdlink:
                        if(settings.MdLinkSpace || settings.InlineCodeSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.barelink:
                        if(settings.BareLinkSpace || settings.InlineCodeSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                }
                if(i === cInlineIndex)
                {
                    resultCh = offset + cRelativeIndex;
                }
                result += inlineList[i].content;
                offset += inlineList[i].content.length;
                prevType = InlineType.code;
                prevEndWithSpace = false;
                // console.log('part', i, [result]);
                break;
            case InlineType.formula:
                switch(prevType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.InlineFormulaSpace && !prevEndWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace || settings.InlineFormulaSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.wikilink:
                        if(settings.WikiLiskSpace || settings.InlineFormulaSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.mdlink:
                        if(settings.MdLinkSpace || settings.InlineFormulaSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.barelink:
                        if(settings.BareLinkSpace || settings.InlineFormulaSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                }
                if(i === cInlineIndex)
                {
                    resultCh = offset + cRelativeIndex;
                }
                result += inlineList[i].content;
                offset += inlineList[i].content.length;
                prevType = InlineType.formula;
                prevEndWithSpace = false;
                // console.log('part', i, [result]);
                break;
            case InlineType.wikilink:
                switch(prevType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.WikiLiskSpace && !prevEndWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace || settings.WikiLiskSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace || settings.WikiLiskSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.wikilink:
                        if(settings.WikiLiskSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.mdlink:
                        if(settings.MdLinkSpace || settings.WikiLiskSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.barelink:
                        if(settings.BareLinkSpace || settings.WikiLiskSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                }
                if(i === cInlineIndex)
                {
                    resultCh = offset + cRelativeIndex;
                }
                result += inlineList[i].content;
                offset += inlineList[i].content.length;
                prevType = InlineType.wikilink;
                prevEndWithSpace = false;
                // console.log('part', i, [result]);
                break;
            case InlineType.mdlink:
                switch(prevType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.MdLinkSpace && !prevEndWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace || settings.MdLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace || settings.MdLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.wikilink:
                        if(settings.WikiLiskSpace || settings.MdLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.mdlink:
                        if(settings.MdLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.barelink:
                        if(settings.BareLinkSpace || settings.MdLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                }
                if(i === cInlineIndex)
                {
                    resultCh = offset + cRelativeIndex;
                }
                result += inlineList[i].content;
                offset += inlineList[i].content.length;
                prevType = InlineType.mdlink;
                prevEndWithSpace = false;
                // console.log('part', i, [result]);
                break;
            case InlineType.barelink:
                switch(prevType)
                {
                    case InlineType.none:
                        break;
                    case InlineType.text:
                        if(settings.BareLinkSpace && !prevEndWithSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.code:
                        if(settings.InlineCodeSpace || settings.BareLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace || settings.BareLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.wikilink:
                        if(settings.WikiLiskSpace || settings.BareLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.mdlink:
                        if(settings.MdLinkSpace || settings.BareLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                    case InlineType.barelink:
                        if(settings.BareLinkSpace)
                        {
                            result += ' ';
                            offset += 1;
                        }
                        break;
                }
                if(i === cInlineIndex)
                {
                    resultCh = offset + cRelativeIndex;
                }
                result += inlineList[i].content;
                offset += inlineList[i].content.length;
                prevType = InlineType.barelink;
                prevEndWithSpace = false;
                // console.log('part', i, [result]);
                break;
        }
    }
    return [result, resultCh];
}

export default class EasyTypingPlugin extends Plugin {
	settings: FormatSettings;
	keyCtrlFlag: boolean;
	keySetNotUpdate: Set<string>;
	inputChineseFlag: boolean;
    prevCursor: CodeMirror.Position;
    lineTypeArray: ArticlePart[];
    checkLineType: boolean;
    prevLineCount: number;
    prevLineType: LineType;
    
    selectedFormatRange:CodeMirror.Range;

	async onload() {
		console.log('loading plugin：Easy Typing');

		await this.loadSettings();

		this.keyCtrlFlag = false;
		this.inputChineseFlag = false;
		this.keySetNotUpdate = new Set(['Control', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Alt', 'Backspace', 'Escape', 'Delete', 'NumLock']);
        
        // this.prevPosition = {type:LineType.none, line:0, ch:0};
        this.prevCursor = {line:0, ch:0};
        this.prevLineType = LineType.none;
        this.prevLineCount = null;
        this.lineTypeArray = null;
        this.checkLineType = true;
        this.selectedFormatRange = null;

		this.addCommand({
			id: "easy-typing-format-line",
			name: "format current line",
			callback: () => this.commandFormatLine(),
			hotkeys: [{
				modifiers: ['Shift'],
				key: "tab"
			}],
		});

        this.addCommand({
			id: "easy-typing-format-line",
			name: "switch autoformat",
			callback: () => this.commandSwitch(),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: "tab"
			}],
		});

		this.addCommand({
			id: "easy-typing-format-note",
			name: "format current note",
			callback: () => this.commandFormatNote(),
			hotkeys: [{
				modifiers: ['Alt'],
				key: "f"
			}],
		});		

		this.addSettingTab(new EasyTypingSettingTab(this.app, this));

		this.registerCodeMirror((codeMirrorEditor: CodeMirror.Editor) => {
			codeMirrorEditor.on('keyup', this.handleKeyUp);
            codeMirrorEditor.on('keydown', this.handleKeyDown);
            codeMirrorEditor.on('beforeChange', this.beforeChange);
		});


		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

	}

    beforeChange = (editor:CodeMirror.Editor, obj: CodeMirror.EditorChangeCancellable)=>
    {
        if(!this.settings.AutoFormatting) return;
        let symbol = obj.text[0];
        let replaceSymbol:string;

        let reg = /[-\`\$]/;
        if(reg.test(symbol))
        {
            this.checkLineType = true;
        }

        if(editor.somethingSelected() && this.settings.FullWidthCharacterEnhence)
        {
            console.log('before change: symbol:', symbol);
            if(symbol === '￥')
            {
                replaceSymbol = '$$';
                this.selectedFormatRange = editor.listSelections()[0];
            }
            else if(symbol === '·')
            {
                replaceSymbol = '``';
            }
            else if(symbol==='【')
            {
                replaceSymbol = '[]'
                this.selectedFormatRange = editor.listSelections()[0];
            }
            else{
                return;
            }

            const selected = editor.getSelection();
            const replaceText = replaceSymbol.charAt(0) +selected+ replaceSymbol.charAt(1);

            obj.update(null, null, [replaceText]);
        }
    }

	onunload() {
		console.log('unloading plugin');
        this.app.workspace.iterateCodeMirrors((codeMirrorEditor: CodeMirror.Editor) => {
			codeMirrorEditor.off('keyup', this.handleKeyUp);
            codeMirrorEditor.off('keydown', this.handleKeyDown);
            codeMirrorEditor.off('beforeChange', this.beforeChange);
		});
	}


    commandSwitch()
    {
        this.settings.AutoFormatting = this.settings.AutoFormatting? false:true;
        let status = this.settings.AutoFormatting?'on':'off';
        new Notice('Autoformat is '+ status +'!');
    }

	commandFormatNote()
	{
		let activeLeaf: any = this.app.workspace.activeLeaf;
		let editor = activeLeaf.view.sourceMode.cmEditor as CodeMirror.Editor;
		let typeArray = splitArticle(editor.getValue());
        for(let i=0; i<typeArray.length;i++)
        {
            if(typeArray[i].type===LineType.text)
            {
                for(let j=typeArray[i].begin; j<typeArray[i].end;j++)
                {
                    let line = editor.getLine(j);
                    let newLine = formatLine(line, line.length, this.settings)[0];
                    if(newLine!=line)
                    {
                        let start: CodeMirror.Position = {line:j, ch:0};
                        let end: CodeMirror.Position = {line:j, ch:line.length};
                        editor.replaceRange(newLine, start, end);
                    }
                }
            }
        }
        new Notice('Format Note Done!');
	}
	commandFormatLine()
	{
		let activeLeaf: any = this.app.workspace.activeLeaf;
		let editor = activeLeaf.view.sourceMode.cmEditor as CodeMirror.Editor;
		let cursor = editor.getCursor();
		let line = editor.getLine(cursor.line);
		let ret = formatLine(line, cursor.ch, this.settings);
		if(ret[0]!=editor.getLine(cursor.line))
		{
			let lineStart:CodeMirror.Position = {ch:0, line:cursor.line};
			let lineEnd: CodeMirror.Position = {ch:line.length, line:cursor.line};
			editor.replaceRange(ret[0], lineStart, lineEnd);
			editor.setCursor({
				line: cursor.line,
				ch: ret[1]
			});
		}
	}

	private readonly handleKeyDown = (editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{
        if(this.settings.Debug)
        {
            console.log('=========================')
            console.log('keydown:', event.key);
        }

        if(!this.settings.AutoFormatting) return;
		
		if(event.key === 'Process')
		{
			this.inputChineseFlag = true;
		}
		if(event.key === 'Control')
		{
			this.keyCtrlFlag = true;
		}
	}

	private handleKeyUp=(editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{

        if(this.settings.Debug)
        {
            console.log('=========================')
            console.log('keyup:', event.key);

            if(event.key === 'F4')
            {
                console.log("Test Begin========================");
                
                console.log("Test End========================");
                return;
            }
        }


        if(this.settings.AutoFormatting===false)
		{
			return;
		}

        // selectFormat
        if(this.selectedFormatRange!=null)
        {
            let selectedStart = this.selectedFormatRange.from();
            let selectedEnd = this.selectedFormatRange.to();
            selectedStart.ch += 1;
            selectedEnd.ch += 1;
            editor.setSelection(selectedStart, selectedEnd);
            this.selectedFormatRange = null;
        }

        if (editor.somethingSelected())
		{
			return;
		}

        if(this.settings.FullWidthCharacterEnhence)
        {
            let cursor = editor.getCursor();
            let twoCharactersBeforeCursor = editor.getRange(
                {line: cursor.line, ch:cursor.ch-2},
                {line: cursor.line, ch:cursor.ch}
            );
            let twoCharactersNearCursor = editor.getRange(
                {line: cursor.line, ch:cursor.ch-1},
                {line: cursor.line, ch:cursor.ch+1}
            );
            let character2cursor1 = editor.getRange(
                {line: cursor.line, ch:cursor.ch-2},
                {line: cursor.line, ch:cursor.ch+1}
            );
            let twoCharactersAfterCursor = editor.getRange(
                {line: cursor.line, ch:cursor.ch},
                {line: cursor.line, ch:cursor.ch+2}
            );
            if(event.key==='$' || event.key==='￥')
            {
                if(twoCharactersBeforeCursor === '￥￥')
                {
                    editor.replaceRange(
                        '$$',
                        {line: cursor.line, ch:cursor.ch-2},
                        {line: cursor.line, ch:cursor.ch}
                    );
                    editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                }
                else if(character2cursor1==='$￥$')
                {
                    editor.replaceRange(
                        '$$',
                        {line: cursor.line, ch:cursor.ch-1},
                        {line: cursor.line, ch:cursor.ch}
                    );
                    editor.setCursor(cursor);
                }
            }
            else if(event.key==='[' || event.key==='【')
            {
                if(twoCharactersBeforeCursor === '[[' && twoCharactersAfterCursor!=']]')
                {
                    editor.replaceRange(
                        '[[]]',
                        {line: cursor.line, ch:cursor.ch-2},
                        {line: cursor.line, ch:cursor.ch}
                    );
                    editor.setCursor(cursor);
                }
            }
            else if(event.key==='`' || event.key==='·')
            {
                if(twoCharactersBeforeCursor === '··')
                {
                    editor.replaceRange(
                        '``',
                        {line: cursor.line, ch:cursor.ch-2},
                        {line: cursor.line, ch:cursor.ch}
                    );
                    editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                }
            }
        }

		if(event.key === 'Control')
		{
			this.keyCtrlFlag = false;
			return;
		}
		if(this.keyCtrlFlag && event.key === 'z')
		{
			// console.log('Find undo, continue!');
			return;
		}
		if(this.keySetNotUpdate.has(event.key))
		{
			return;
		}
		

		if(this.inputChineseFlag)
		{
			// 判断中文输入的结束点，检测到数字或者空格就是输入中文结束，Shift是中文输入法输入英文。
			// 匹配,.;'<>是中文输入法的全角字符，。；‘’《》
			if(event.key.match(/[0-9 ,.;<>:'`\\\/]/gi)!=null || event.key==='Shift')
			{
				// console.log("chinese input done!");
				this.inputChineseFlag = false;
			}
			else
			{
				return;
			}
		}

		let cursor = editor.getCursor();
		let line = editor.getLine(cursor.line);
        let thisLineType:LineType;

        // 在文档行数变化时，或者checkLineType为真时，重新 parse article
        if(this.checkLineType || this.prevLineCount!=editor.lineCount())
        {
            if(this.settings.Debug) new Notice('reparse article');
            this.lineTypeArray = splitArticle(editor.getValue());
            thisLineType = getLineTypeFromArticleParts(cursor.line, this.lineTypeArray);
            this.prevLineType = thisLineType;
            this.prevLineCount = editor.lineCount();
            this.checkLineType = false;
            this.prevCursor = cursor;
        }
        // 在其他行编辑的时候，需要先获取下行的类型
        else if(cursor.line != this.prevCursor.line)
        {
            thisLineType = getLineTypeFromArticleParts(cursor.line, this.lineTypeArray);
            this.prevLineType = thisLineType;
            this.prevCursor = cursor;
        }
        else{
            thisLineType = this.prevLineType;
        }

        if(thisLineType!=LineType.text)
        {
            return;
        }

		let ret = formatLine(line, cursor.ch, this.settings);

		if(line!=ret[0])
		{
			let lineStart:CodeMirror.Position = {ch:0, line:cursor.line};
			let lineEnd: CodeMirror.Position = {ch:line.length, line:cursor.line};
			editor.replaceRange(ret[0], lineStart, lineEnd);
			editor.setCursor({
				line: cursor.line,
				ch: ret[1]
			});
            this.prevCursor = {
				line: cursor.line,
				ch: ret[1]
			};
			editor.focus();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class EasyTypingSettingTab extends PluginSettingTab {
	plugin: EasyTypingPlugin;

	constructor(app: App, plugin: EasyTypingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		// containerEl.createEl('h2', {text: 'Settings for Easy Typing.'});

		containerEl.createEl('h2', {text: '总开关 (Master Switch)'});

		new Setting(containerEl)
		.setName("Auto formatting")
		.setDesc("是否在编辑文档时自动格式化文本")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.AutoFormatting)
			.onChange(async (value)=>{
				this.plugin.settings.AutoFormatting = value;
				console.log("AutoFormatting:",value);
				await this.plugin.saveSettings();
			});
		});

		containerEl.createEl('h2', {text: '详细规则开关 (Sub Switches)'});

		new Setting(containerEl)
		.setName("Space between Chinese and English/number")
		.setDesc("在中文和英文/数字间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.ChineseEnglishSpace).onChange(async (value)=>{
				this.plugin.settings.ChineseEnglishSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Delete the Space between Chinese characters")
		.setDesc("在中文字符间去除空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.ChineseNoSpace).onChange(async (value)=>{
				this.plugin.settings.ChineseNoSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between English with punctuate")
		.setDesc("在英文文本和标点间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.EnglishSpace).onChange(async (value)=>{
				this.plugin.settings.EnglishSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Capitalize the first letter of every sentence")
		.setDesc("英文每个句首字母大写")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.Capitalization).onChange(async (value)=>{
				this.plugin.settings.Capitalization = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between number and English text")
		.setDesc("数字和标点间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.NumberSpace).onChange(async (value)=>{
				this.plugin.settings.NumberSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between English braces and text")
		.setDesc("在英文小括号和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.BraceSpace).onChange(async (value)=>{
				this.plugin.settings.BraceSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between inline code and text")
		.setDesc("在 `行内代码` 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.InlineCodeSpace).onChange(async (value)=>{
				this.plugin.settings.InlineCodeSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between inline formula and text")
		.setDesc("在 $行内公式$ 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.InlineFormulaSpace).onChange(async (value)=>{
				this.plugin.settings.InlineFormulaSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between wiki link formula and text")
		.setDesc("在 [[wikilink]] 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.WikiLiskSpace).onChange(async (value)=>{
				this.plugin.settings.WikiLiskSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between markdown link formula and text")
		.setDesc("在 [markdown link](https://..) 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.MdLinkSpace).onChange(async (value)=>{
				this.plugin.settings.MdLinkSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between bare link formula and text")
		.setDesc("在 链接文本 https://.. 和其他文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.BareLinkSpace).onChange(async (value)=>{
				this.plugin.settings.BareLinkSpace = value;
				await this.plugin.saveSettings();
			});
		});

        new Setting(containerEl)
		.setName("Full-Width symbol input enhancement")
		.setDesc("全角符号输入增强")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.FullWidthCharacterEnhence).onChange(async (value)=>{
				this.plugin.settings.FullWidthCharacterEnhence = value;
				await this.plugin.saveSettings();
			});
		});
        containerEl.createEl('a', {text: 'More detail in the github repo', href:'https://github.com/Yaozhuwa/easy-typing-obsidian'});

        // new Setting(containerEl)
		// .setName("RegExp")
		// .setDesc("用户自定义正则表达式，匹配到的内容不进行格式化")
		// .addTextArea((text) =>
		// 	text
		// 	.setPlaceholder("")
		// 	.setValue(this.plugin.settings.UserDefinedRegExp)
		// 	.onChange(async (value) => {
		// 		this.plugin.settings.UserDefinedRegExp = value;
        //         if(this.plugin.settings.Debug) console.log("regExp:", value);
		// 		await this.plugin.saveSettings();
		// 	})
		// );

        containerEl.createEl('h2', {text: 'Debug'});
        new Setting(containerEl)
		.setName("Print debug info in console")
		.setDesc("在控制台输出调试信息")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.Debug).onChange(async (value)=>{
				this.plugin.settings.Debug = value;
				await this.plugin.saveSettings();
			});
		});

	}
}
