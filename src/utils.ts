import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec, Text} from '@codemirror/state';
import { EasyTypingSettingTab, EasyTypingSettings, PairString, ConvertRule} from "./settings"


export function posToOffset(doc:Text, pos:{line:number, ch:number}) {
	return doc.line(pos.line + 1).from + pos.ch
}
export function offsetToPos(doc:Text, offset:number) {
	let line = doc.lineAt(offset)
	return {line: line.number - 1, ch: offset - line.from}
}

export function getTypeStrOfTransac(tr: Transaction): string {
	let TransacTypeArray:string[] = ["EasyTyping.change", 
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

function string2pairstring(s: string):PairString{
	let cursorIdx = s.indexOf("|");
	let left = s.substring(0, cursorIdx);
	let right = s.substring(cursorIdx+1);
	return {left:left, right:right};
}

export function ruleStringList2RuleList(list: Array<[string, string]>):ConvertRule[] {
	let res:ConvertRule[] = [];
	for (let i in list){
		res[i] = {before: string2pairstring(list[i][0]), after: string2pairstring(list[i][1])}
	}
	return res;
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