import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec, Text} from '@codemirror/state';
import { EasyTypingSettingTab, EasyTypingSettings, PairString, ConvertRule} from "./settings"
import { App, Plugin, Platform } from 'obsidian'
import { TabstopSpec } from './tabstop';

let DEBUG = true;

export const print=(message?: any, ...optionalParams: any[]) =>{
    if (DEBUG) {
        console.log(message, ...optionalParams);
    }
}

export function posToOffset(doc:Text, pos:{line:number, ch:number}) {
	return doc.line(pos.line + 1).from + pos.ch
}
export function offsetToPos(doc:Text, offset:number) {
	let line = doc.lineAt(offset)
	return {line: line.number - 1, ch: offset - line.from}
}

export function getTypeStrOfTransac(tr: Transaction): string {
	let TransacTypeArray:string[] = ["EasyTyping.change", "EasyTyping.paste",
							"input.type.compose", "input.type", "input.paste", "input.drop", "input.complete", "input",
							"delete.selection", "delete.forward", "delete.backward", "delete.cut", "delete",
							"move.drop",
							"undo", "redo",
							"select.pointer"];
	for (let i: number = 0; i < TransacTypeArray.length; i++)
	{
		if (tr.isUserEvent(TransacTypeArray[i]))
			return TransacTypeArray[i];
	}
	return "none"
}

export function string2pairstring(s: string):PairString{
	let cursorIdx = findFirstPipeNotPrecededByBackslash(s);
	let left = s.substring(0, cursorIdx);
	let _left = isRegexp(left) ? left : convertEscapeChar(left);
	let right = s.substring(cursorIdx+1);
	let _right = isRegexp(right) ? right : convertEscapeChar(right)
	return {left:_left, right:_right};
}

export function replacePlaceholders(str: string, replacements: string[]): string {
	let replace_matches = str.replace(/\[\[(\d+)\]\]/g, function (match, index) {
		return replacements[parseInt(index, 10)] || match;
	});
	return replace_matches;
}

export function replacePlaceholdersAndTabstops(str: string, replacements: string[]): [string, TabstopSpec[]]{
	let tabstops: TabstopSpec[] = [];
	const regex = /\$(\d+)|\$\{(\d+): *([^ {}]*?)\}|\[\[(\d+)\]\]/g;
	let match;
	interface ReplaceString {
		from: number;
		to: number;
		replacement: string;
		tabstop: boolean;
		tabstopNumber?: number;
	}

	let replaceStrings: ReplaceString[] = [];
	while ((match = regex.exec(str)) !== null) {
		// 检查是哪种模式的匹配
		const isSimpleVar = match[1]; // 用于 $n 形式
		const isNamedVar = match[2]; // 用于 ${n: 内容} 形式
		const content = match[3]; // 用于 ${n: 内容} 形式的内容
		const replaceN = match[4]; // 用于 [[n]] 形式

		const tabstopN = isSimpleVar || isNamedVar; // 取 n 的值，无论是简单还是命名变量
		const startIndex = match.index;
		const endIndex = startIndex + match[0].length;
		if (replaceN){
			let matchedN = parseInt(replaceN, 10);
			if(matchedN < replacements.length){
				replaceStrings.push({from: startIndex, to: endIndex, replacement: replacements[matchedN], tabstop:false});
			}
		}
		else {
			let n = parseInt(tabstopN, 10);
			let contentStr = replacePlaceholders(content?content:"", replacements);
			replaceStrings.push({from: startIndex, to: endIndex, replacement: contentStr, tabstop:true, tabstopNumber: n});
		}
	}

	let newString = str;
	let offset = 0;
	for (let i=0; i<replaceStrings.length; i++){
		let replaceString = replaceStrings[i];
		newString = newString.substring(0, replaceString.from + offset) + replaceString.replacement + newString.substring(replaceString.to + offset);
		if (replaceString.tabstop){
			let tabstop: TabstopSpec = {
				from: replaceString.from + offset,
				to: replaceString.from + offset + replaceString.replacement.length,
				number: replaceString.tabstopNumber,
			}
			tabstops.push(tabstop);
		}
		offset += replaceString.replacement.length - (replaceString.to - replaceString.from);
	}

	return [newString, tabstops];
}

export function parseTheAfterPattern(pattern: string, replacements: string[]): [string, TabstopSpec[]]{
	let single_cursor_pos = findFirstPipeNotPrecededByBackslash(pattern);
	let general_cursor_find = /\$(\d+)|\$\{(\d+): *([^ {}]*?)\}/.test(pattern);
	let single_cursor_find = single_cursor_pos !== -1;
	let final_pattern = pattern;
	if (general_cursor_find){
		final_pattern = pattern;
	}else if (single_cursor_find){
		final_pattern = pattern.substring(0, single_cursor_pos) + "$0" + pattern.substring(single_cursor_pos+1);
	}else {
		final_pattern = pattern + "$0";
	}
	return replacePlaceholdersAndTabstops(convertEscapeChar(final_pattern), replacements);
}

export function isRegexp(s: string):boolean{
	return s.startsWith("r/") && s.endsWith("/");
}

function convertEscapeChar(s: string):string{
	return s.replace(/\\\|/g, "|")
			.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
			.replace(/\\\n/g, '\\n').replace(/\\\r/g, '\\r').replace(/\\\t/g, '\\t')
			.replace(/\\\\/g, "\\");
}

export function ruleStringList2RuleList(list: Array<[string, string]>):ConvertRule[] {
	let res:ConvertRule[] = [];
	for (let i in list){
		res[i] = {before: string2pairstring(list[i][0]), after: string2pairstring(list[i][1]), after_pattern: list[i][1]}
	}
	return res;
}

export function findFirstPipeNotPrecededByBackslash(s: string): number {
	let regex = /^r\/[^]*?\/\|/;
	let regMatch = s.match(regex);
	if (regMatch) return regMatch[0].length - 1;
    const match = s.match(/((^|[^\\])(\\\\)*)\|/);
    return match ? s.indexOf(match[0]) + match[1].length : -1;
}

export function stringDeleteAt(str: string, index: number):string
{
    return str.substring(0, index)+str.substring(index+1);
}

export function stringInsertAt(str:string, index: number, s: string):string
{
    return str.substring(0, index)+s+str.substring(index);
}

export function isParamDefined(param: any):boolean
{
	return typeof param!=="undefined";
}

export function showString(s: string):string{
	return s.replace(/\n/g, '\\n');
}


type TabOutResult = {
    isSuccess: boolean;
    newPosition: number;
};




export function taboutCursorInPairedString(input: string, cursorPosition: number, symbolPairs: PairString[]): TabOutResult {
    let stack: string[] = [];
    let fail: TabOutResult = { isSuccess: false, newPosition: 0 };

    for (let i = 0; i < cursorPosition; i++) {
        for (const { left: open, right: close } of symbolPairs) {
            if (input.startsWith(open, i) && (open !== close || stack.lastIndexOf(open) === -1)) {
                stack.push(open);
                i += open.length - 1;
            } else if (input.startsWith(close, i) && stack.length > 0) {
                const lastOpenIndex = stack.lastIndexOf(open);
                if (lastOpenIndex !== -1) {
                    stack = stack.slice(0, lastOpenIndex);
                }
                i += close.length - 1;
            }
        }
    }

    if (stack.length === 0) {
        return fail;
    }

    let tempStack: string[] = [];
    for (let i = cursorPosition; i < input.length; i++) {
        for (const { left: open, right: close } of symbolPairs) {
            if (input.startsWith(open, i) && (open !== close || (stack.lastIndexOf(open) === -1 && tempStack.lastIndexOf(open) === -1))) {
                tempStack.push(open);
                i += open.length - 1;
            } else if (input.startsWith(close, i)) {
                const lastOpenIndex = tempStack.lastIndexOf(open);
                if (lastOpenIndex === -1 && stack.lastIndexOf(open) !== -1) {
                    return { isSuccess: true, newPosition: cursorPosition === i ? i + close.length : i };
                } else if (lastOpenIndex !== -1) {
                    tempStack = tempStack.slice(0, lastOpenIndex);
                }
                i += close.length - 1;
            }
        }
    }

    return fail;
}