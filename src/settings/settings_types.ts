import { SpaceState } from 'src/core';
import { ScriptCategory, CustomScriptDef } from '../formatting/script_category';

export interface PairString {
	left: string;
	right: string;
}

export enum StrictLineMode { EnterTwice = "enter_twice", TwoSpace = "two_space", Mix = "mix_mode" }

export interface LanguagePair {
	a: ScriptCategory | string;
	b: ScriptCategory | string;
}

export interface EasyTypingSettings {
	Tabout: boolean;
	SmartPaste: boolean;
	BetterCodeEdit: boolean;
	BetterBackspace: boolean;
	AutoFormat: boolean;
	AutoFormatPaste: boolean;
	ExcludeFiles: string;
	AutoCapital: boolean;


	languagePairs: LanguagePair[];
	PrefixDictionary: string;
	SoftSpaceLeftSymbols: string;
	SoftSpaceRightSymbols: string;
	customScriptCategories: CustomScriptDef[];
	InlineCodeSpaceMode: SpaceState;
	InlineFormulaSpaceMode: SpaceState;
	InlineLinkSpaceMode: SpaceState;
	InlineLinkSmartSpace: boolean;
	UserDefinedRegSwitch: boolean;
	UserDefinedRegExp: string;
	debug: boolean;

	StrictModeEnter: boolean;
	StrictLineMode: StrictLineMode;
	EnhanceModA: boolean;
	TryFixChineseIM: boolean;
	FixMacOSContextMenu: boolean;
	TryFixMSIME: boolean;
	CollapsePersistentEnter: boolean;
	deletedBuiltinRuleIds: string[];
}

export const DEFAULT_SETTINGS: EasyTypingSettings = {
	Tabout: true,
	SmartPaste: true,
	BetterCodeEdit: true,
	BetterBackspace: true,
	AutoFormat: true,
	AutoFormatPaste: true,
	ExcludeFiles: "",

	AutoCapital: false,
	languagePairs: [
		{ a: ScriptCategory.Chinese, b: ScriptCategory.English },
		{ a: ScriptCategory.Chinese, b: ScriptCategory.Digit },
		{ a: ScriptCategory.Digit, b: ScriptCategory.English },
	],
	PrefixDictionary: 'n8n, /[1234][dD]/\npython3, Python3',
	SoftSpaceLeftSymbols: '-',
	SoftSpaceRightSymbols: '-',
	customScriptCategories: [],
	InlineCodeSpaceMode: SpaceState.soft,
	InlineFormulaSpaceMode: SpaceState.soft,
	InlineLinkSpaceMode: SpaceState.soft,
	InlineLinkSmartSpace: true,
	UserDefinedRegSwitch: true,
	UserDefinedRegExp: "{{.*?}}|++\n" +
		"<.*?>|--\n" +
		"\\[\\!.*?\\][-+]{0,1}|-+\n" +
		"(file:///|https?://|ftp://|obsidian://|zotero://|www.)[^\\s（）《》。,，！？;；：“”‘’\\)\\(\\[\\]\\{\\}']+|--\n" +
		"\n[a-zA-Z0-9_\\-.]+@[a-zA-Z0-9_\\-.]+|++\n" +
		"(?<!#)#[\\u4e00-\\u9fa5\\w-\\/]+|++",
	debug: false,

	StrictModeEnter: false,
	StrictLineMode: StrictLineMode.EnterTwice,
	EnhanceModA: false,
	TryFixChineseIM: true,
	FixMacOSContextMenu: false,
	TryFixMSIME: false,
	CollapsePersistentEnter: false,
	deletedBuiltinRuleIds: [],
}
