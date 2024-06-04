import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec, Text} from '@codemirror/state';
import { EasyTypingSettingTab, EasyTypingSettings, PairString, ConvertRule} from "./settings"
import { App, Plugin } from 'obsidian'

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
	return str.replace(/\$(\d+)/g, function (match, index) {
		return replacements[parseInt(index, 10)] || match;
	});
}

export function isRegexp(s: string):boolean{
	return s.startsWith("r/") && s.endsWith("/");
}

function convertEscapeChar(s: string):string{
	return s.replace(/\\\|/g, "|").replace(/\\\\/g, "\\")
			.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
			.replace(/\\t/g, '\t');
}

export function ruleStringList2RuleList(list: Array<[string, string]>):ConvertRule[] {
	let res:ConvertRule[] = [];
	for (let i in list){
		res[i] = {before: string2pairstring(list[i][0]), after: string2pairstring(list[i][1])}
	}
	return res;
}

export function findFirstPipeNotPrecededByBackslash(s: string): number {
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