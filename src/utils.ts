import { Annotation, EditorState, Extension, StateField, Transaction, TransactionSpec, Text} from '@codemirror/state';
import { EasyTypingSettingTab, EasyTypingSettings, PairString, ConvertRule} from "./settings"
import { App, Plugin } from 'obsidian'

let DEBUG = true;

export const print=(message?: any, ...optionalParams: any[]) =>{
    if (DEBUG) {
        console.log(message, ...optionalParams);
    }
}

interface AppHiddenProps {
	internalPlugins: {
		config: { [key: string]: boolean };
	};
	isMobile: boolean;
	plugins: {
		enabledPlugins: Set<string>;
		manifests: { [key: string]: { version: string } };
	};
	vault: {
		config: object;
	};
}

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

export function string2pairstring(s: string):PairString{
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

export function showString(s: string):string{
	return s.replace(/\n/g, '\\n');
}

export function getObsidianSettings(plugin: Plugin) {
	const app = plugin.app as any as AppHiddenProps;
	return app.vault.config;
}


// Code Below is from https://github.com/vslinko/obsidian-outliner
// Copyright (c) 2021 Viacheslav Slinko
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
export interface ObsidianTabsSettings {
	useTab: boolean;
	tabSize: number;
}

export interface ObsidianFoldSettings {
	foldIndent: boolean;
}

function getHiddenObsidianConfig(app: App) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (app.vault as any).config;
}

export class ObsidianSettings {
	constructor(private app: App) {}

	isLegacyEditorEnabled() {
		const config: { legacyEditor: boolean } = {
			legacyEditor: false,
			...getHiddenObsidianConfig(this.app),
		};

		return config.legacyEditor;
	}

	isDefaultThemeEnabled() {
		const config: { cssTheme: string } = {
			cssTheme: "",
			...getHiddenObsidianConfig(this.app),
		};

		return config.cssTheme === "";
	}

	getTabsSettings(): ObsidianTabsSettings {
		return {
			useTab: true,
			tabSize: 4,
			...getHiddenObsidianConfig(this.app),
		};
	}

	getFoldSettings(): ObsidianFoldSettings {
		return {
			foldIndent: true,
			...getHiddenObsidianConfig(this.app),
		};
	}

	getDefaultIndentChars() {
		const { useTab, tabSize } = this.getTabsSettings();

		return useTab ? "\t" : new Array(tabSize).fill(" ").join("");
	}
}