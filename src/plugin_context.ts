import { App } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { EasyTypingSettings, PairString } from './settings';
import { RuleEngine } from './rule_engine';
import { LineFormater } from './core';

export interface ComposeState {
	compose_begin_pos: number;
	compose_end_pos: number;
	compose_need_handle: boolean;
}

export interface PluginContext {
	settings: EasyTypingSettings;
	ruleEngine: RuleEngine;
	Formater: LineFormater;
	app: App;
	TaboutPairStrs: PairString[];
	composeStates: WeakMap<EditorView, ComposeState>;
	CurActiveMarkdown: string;
	onFormatArticle: boolean;
	plainPasteInProgress: boolean;
	pasteDetected: boolean;
	getDefaultIndentChar(): string;
	isCurrentFileExclude(): boolean;
	saveSettings(): Promise<void>;
}
