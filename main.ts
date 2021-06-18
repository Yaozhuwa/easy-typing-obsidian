import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Pos, Setting } from 'obsidian';

enum InlineType {text='text', code='code', formula='formula', link='link', user='user-defined', none='none'}
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

interface InlineChange
{
    text: string,
    begin: number,
    end: number,
    origin:string
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
    LinkSpace: boolean;
    LinkSmartSpace: boolean;

    FullWidthCharacterEnhence:boolean;

    UserDefinedRegExp:string;
    UserDefinedRegSwitch: boolean;
    UserPartSpace: boolean;

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
	LinkSpace: true,
    LinkSmartSpace: true,

    FullWidthCharacterEnhence:true,
    UserDefinedRegExp:':\\w*:\n{{.*?}}',
    UserDefinedRegSwitch: true,
    UserPartSpace:true,
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

function splitLine(line: string, regExps?:string): InlinePart[]
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


function splitTextWithLinkAndUserDefined(text: string, regExps?:string):InlinePart[]
{
    let retArray: InlinePart[] = [];
    let regWikiLink = /\!?\[\[[^\[\]]*?\]\]/g;
    let regMdLink = /\!?\[[^\[\]]*?\]\([^\s\)\(\[\]\{\}']*\)/g;
    let regBareLink = /(https?|obsidian|zotero):\/\/[^\s\)\(\[\]\{\}']+/g;

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
                console.log('Bad Reg:', regs[i]);
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

function formatLine(line: string, curCursor: CodeMirror.Position, settings: FormatSettings, prevCursor?: CodeMirror.Position):[string, number, InlineChange[]]|null
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
                let regHeaderSentence = /^#+ [a-z]/g;
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

                if(dstCharIndex!=-1)
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
					var reg = /([,\.;\?:\!])([A-Za-z])/gi;
					lineParts[i].content = content.replace(reg, "$1 $2");
                    content = lineParts[i].content;
				}

                // Text.4 处理句首字母大写
                if(settings.Capitalization)
				{
					var reg = /[\.;\?\!。！；？]([\s]*)[a-z]/g;
					while(true)
                    {
                        let match = reg.exec(content);
                        if(!match) break;
                        let tempIndex = reg.lastIndex-1;
                        if(!prevCursor)
                        {
                            lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                            content = lineParts[i].content;
                        }
                        else if(prevCursor && prevCursor.line===curCursor.line && tempIndex>=prevCursor.ch && tempIndex<curCursor.ch)
                        {
                            lineParts[i].content = content.substring(0, tempIndex) + content.charAt(tempIndex).toUpperCase() + content.substring(reg.lastIndex);
                            content = lineParts[i].content;
                        }
                    }
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
					let reg1 = /([,;\?:\!\]\}])([0-9])/g;
					let reg2 = /([0-9])([\[\{])/g;
                    lineParts[i].content = content.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
                    content = lineParts[i].content;
				}
                // Text.7 得到文本部分是否以空白符开始或结束，用来判断后续文本前后是否需要添加空格
                let regStartWithSpace = /^\0?[\s,\.;\?\!，。；？！\]\)\}]/;
                let regEndWithSpace = /[\s，。：？！\[\(\{]\0?$/;
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
                            offset += 1;
                        }
                        break;
                    case InlineType.formula:
                        if(settings.InlineFormulaSpace && !textStartWithSpace)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                            offset += 1;
                        }
                        break;
                    case InlineType.link:
                        if(settings.LinkSmartSpace && !textStartWithSpace)
                        {
                            let regTestWikiLink = /^\[\[.+\]\]$/;
                            if(regTestWikiLink.test(lineParts[i-1].content))
                            {
                                let charAtLinkEnd = lineParts[i-1].content.charAt(lineParts[i-1].content.length-3);
                                let charAtTextBegin = lineParts[i].content.charAt(0);
                                let tempStr = charAtLinkEnd+charAtTextBegin;
                                let reg1=/[A-Za-z0-9,.;\?:\!][\u4e00-\u9fa5]/g;
                                let reg2=/[\u4e00-\u9fa5][@A-Za-z0-9]/g;
                                let reg3 = /[A-Za-z0-9,.;?:!][A-Za-z0-9]/g;
                                let reg4 = /[,;\?:\!\]\}][0-9]/g;
                                if(reg1.test(tempStr) || reg2.test(tempStr) || reg3.test(tempStr) || reg4.test(tempStr))
                                {
                                    lineParts[i].content = ' '+content;
                                    content = lineParts[i].content;
                                    offset += 1;
                                }
                            }
                        }
                        else if(!settings.LinkSmartSpace && settings.LinkSpace && !textStartWithSpace)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                            offset += 1;
                        }
                        break;
                    case InlineType.user:
                        if(settings.UserPartSpace && !textStartWithSpace)
                        {
                            lineParts[i].content = ' '+content;
                            content = lineParts[i].content;
                            offset += 1;
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
                        if(settings.LinkSmartSpace && !prevTextEndWithSpace)
                        {
                            let regTestWikiLink = /^\[\[.+\]\]$/;
                            if(regTestWikiLink.test(lineParts[i].content))
                            {
                                let charAtTextEnd = lineParts[i-1].content.charAt(lineParts[i-1].content.length-1);
                                let charAtLinkBegin = lineParts[i].content.charAt(2);
                                let tempStr = charAtTextEnd+charAtLinkBegin;
                                let reg1=/[A-Za-z0-9,.;\?:\!][\u4e00-\u9fa5]/g;
                                let reg2=/[\u4e00-\u9fa5][@A-Za-z0-9]/g;
                                let reg3 = /[A-Za-z0-9,.;?:!][A-Za-z0-9]/g;
                                let reg4 = /[,;\?:\!\]\}][0-9]/g;
                                if(reg1.test(tempStr) || reg2.test(tempStr) || reg3.test(tempStr) || reg4.test(tempStr))
                                {
                                    lineParts[i-1].content += ' ';
                                    resultLine += ' ';
                                    offset += 1;
                                }
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
				modifiers: ['Alt'],
				key: "l"
			}],
		});

        this.addCommand({
			id: "easy-typing-format-switch",
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
            if(this.settings.Debug) console.log('before change: symbol:', symbol);
            switch(symbol)
            {
                case '￥':
                    replaceSymbol = '$$';
                    this.selectedFormatRange = editor.listSelections()[0];
                    break;
                case '·':
                    replaceSymbol = '``';
                    break;
                case '【':
                    replaceSymbol = '[]'
                    this.selectedFormatRange = editor.listSelections()[0];
                    break;
                default:
                    return;
            }
            const selected = editor.getSelection();
            const replaceText = replaceSymbol.charAt(0) +selected+ replaceSymbol.charAt(1);

            obj.update(null, null, [replaceText]);
        }
        else if(!editor.somethingSelected() && this.settings.FullWidthCharacterEnhence)
        {
            switch(symbol)
            {
                case '……':
                    obj.update(null, null, ['^']);
                    break;
                default:
                    return;
            }
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
                    let newLine = formatLine(line, {line:j, ch:line.length}, this.settings)[0];
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
		let ret = formatLine(line, cursor, this.settings);
		let inlineChangeList = ret[2];
        if(inlineChangeList.length != 0)
        {
            let offset = 0;
            for(let i=0;i<inlineChangeList.length;i++)
            {
                let changeBegin:CodeMirror.Position = {
                    line: cursor.line,
                    ch: inlineChangeList[i].begin+offset
                }
                let changeEnd:CodeMirror.Position = {
                    line: cursor.line,
                    ch: inlineChangeList[i].end+offset
                }
                offset += inlineChangeList[i].text.length - inlineChangeList[i].origin.length;
                editor.replaceRange(inlineChangeList[i].text, changeBegin, changeEnd);
            }
            editor.setCursor({
				line: cursor.line,
				ch: ret[1]
			});
			editor.focus();
        }
        this.prevCursor = editor.getCursor();
        
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
                this.prevCursor = editor.getCursor();
                return;
            }
        }


        if(this.settings.AutoFormatting===false)
		{
            this.prevCursor = editor.getCursor();
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
            switch(event.key)
            {
                case '$':
                case '￥':
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
                    break;
                
                case '[':
                case '【':
                    if(twoCharactersBeforeCursor === '[[' && twoCharactersAfterCursor!=']]')
                    {
                        editor.replaceRange(
                            '[[]]',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor(cursor);
                    }
                    break;
                
                case '`':
                case '·':
                    if(twoCharactersBeforeCursor === '··')
                    {
                        editor.replaceRange(
                            '``',
                            {line: cursor.line, ch:cursor.ch-2},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch-1});
                    }
                    else if(character2cursor1==='`·`')
                    {
                        editor.replaceRange(
                            '`',
                            {line: cursor.line, ch:cursor.ch-1},
                            {line: cursor.line, ch:cursor.ch}
                        );
                        editor.setCursor({line: cursor.line, ch:cursor.ch+1});
                    }
                    break;
                default:
                    break;
            }
        }

		if(event.key === 'Control')
		{
			this.keyCtrlFlag = false;
            this.prevCursor = editor.getCursor();
			return;
		}
		if(this.keyCtrlFlag && event.key === 'z')
		{
            this.prevCursor = editor.getCursor();
			return;
		}

		if(this.keySetNotUpdate.has(event.key))
		{
            this.prevCursor = editor.getCursor();
			return;
		}
		

		if(this.inputChineseFlag)
		{
			// windows下判断中文输入的结束点，检测到数字或者空格就是输入中文结束，Shift是中文输入法输入英文。
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
        }
        // 在其他行编辑的时候，需要先获取下行的类型
        else if(cursor.line != this.prevCursor.line)
        {
            thisLineType = getLineTypeFromArticleParts(cursor.line, this.lineTypeArray);
            this.prevLineType = thisLineType;
        }
        else{
            thisLineType = this.prevLineType;
        }

        if(thisLineType!=LineType.text)
        {
            this.prevCursor = editor.getCursor();
            return;
        }

		let ret = formatLine(line, cursor, this.settings, this.prevCursor);
        // console.log(line)
        // console.log(ret)
        let inlineChangeList = ret[2];
        if(inlineChangeList.length != 0)
        {
            let offset = 0;
            for(let i=0;i<inlineChangeList.length;i++)
            {
                let changeBegin:CodeMirror.Position = {
                    line: cursor.line,
                    ch: inlineChangeList[i].begin+offset
                }
                let changeEnd:CodeMirror.Position = {
                    line: cursor.line,
                    ch: inlineChangeList[i].end+offset
                }
                offset += inlineChangeList[i].text.length - inlineChangeList[i].origin.length;
                editor.replaceRange(inlineChangeList[i].text, changeBegin, changeEnd);
            }
            editor.setCursor({
				line: cursor.line,
				ch: ret[1]
			});
			editor.focus();
        }
        this.prevCursor = editor.getCursor();
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

        containerEl.createEl('a', {text: 'More detail is in Github: easy-typing-obsidian', href:'https://github.com/Yaozhuwa/easy-typing-obsidian'});
		containerEl.createEl('h2', {text: '总开关 (Master Switch)'});

		new Setting(containerEl)
		.setName("Auto formatting when typing")
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
		.setName("Space between link and text")
		.setDesc("在 [[wikilink]] mdlink 和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.LinkSpace).onChange(async (value)=>{
				this.plugin.settings.LinkSpace = value;
				await this.plugin.saveSettings();
			});
		});

        new Setting(containerEl)
		.setName("Smart Space between link and text")
		.setDesc("在 [[wikilink]] mdlink 和文本间智能空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.LinkSmartSpace).onChange(async (value)=>{
				this.plugin.settings.LinkSmartSpace = value;
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

        new Setting(containerEl)
		.setName("Space between User Defined Part(selected by RegExp) and text")
		.setDesc("在用户自定义区块(正则表达式选择)和文本之间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.UserPartSpace).onChange(async (value)=>{
				this.plugin.settings.UserPartSpace = value;
				await this.plugin.saveSettings();
			});
		});

        new Setting(containerEl)
		.setName("User Defined RegExp Switch")
		.setDesc("自定义正则表达式开关，匹配到的内容不进行格式化")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value)=>{
				this.plugin.settings.UserDefinedRegSwitch = value;
				await this.plugin.saveSettings();
			});
		});

        new Setting(containerEl)
		.setName("User defined RegExp to ignore, one expression per line")
		.setDesc("用户自定义正则表达式，匹配到的内容不进行格式化，每行一个表达式，行尾不要随意加空格")
		.addTextArea((text) =>
			text
			.setPlaceholder(':\\w*:\n{{.*?}}')
			.setValue(this.plugin.settings.UserDefinedRegExp)
			.onChange(async (value) => {
				this.plugin.settings.UserDefinedRegExp = value;
                if(this.plugin.settings.Debug) console.log("regExp changed:", value);
				await this.plugin.saveSettings();
			})
		);

        containerEl.createEl('a', {text: 'RegExp: 正则表达式', href:'https://javascript.ruanyifeng.com/stdlib/regexp.html#'});


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
