import { SpaceState, string2SpaceState } from 'src/core';
import { App, TextComponent, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, WorkspaceLeaf, TextAreaComponent, moment } from 'obsidian';
import EasyTypingPlugin from './main';
import { showString, findFirstPipeNotPrecededByBackslash } from './utils';
import { enUS, ruRU, zhCN, zhTW } from './lang/locale';
import {sprintf} from "sprintf-js";
import { setDebug } from './utils';

export interface PairString {
	left: string;
	right: string;
}

export interface ConvertRule {
	before: PairString;
	after: PairString;
	after_pattern?: string;
}

export enum RuleType {delete= "Delete Rule", convert='Convert Rule'}
export enum WorkMode { OnlyWhenTyping = "typing", Globally = "global" }

export interface EasyTypingSettings {
	Tabout: boolean;
	SelectionEnhance: boolean;
	IntrinsicSymbolPairs: boolean;
	BaseObEditEnhance: boolean;
	FW2HWEnhance: boolean;
	BetterCodeEdit: boolean;
	BetterBackspace: boolean;
	AutoFormat: boolean;
	ExcludeFiles: string;
	AutoCapital: boolean;
	AutoCapitalMode: WorkMode;
	ChineseEnglishSpace: boolean;
	EnglishNumberSpace: boolean;
	ChineseNoSpace: boolean;
	ChineseNumberSpace: boolean;
	PunctuationSpace: boolean;
	PunctuationSpaceMode: WorkMode;
	InlineCodeSpaceMode: SpaceState;
	InlineFormulaSpaceMode: SpaceState;
	InlineLinkSpaceMode: SpaceState;
	InlineLinkSmartSpace: boolean;
	UserDefinedRegSwitch: boolean;
	UserDefinedRegExp: string;
	debug: boolean;

	userSelRepRuleTrigger: string[];
	userSelRepRuleValue: PairString[];
	userDeleteRulesStrList: [string, string][];
	userConvertRulesStrList: [string, string][];
	userSelRuleSettingsOpen: boolean;
	userDelRuleSettingsOpen: boolean;
	userCvtRuleSettingsOpen: boolean;

	EnterTwice: boolean;
	PuncRectify: boolean;
	TryFixChineseIM: boolean;
	FixMacOSContextMenu: boolean;
	TryFixMSIME: boolean;
}

export const DEFAULT_SETTINGS: EasyTypingSettings = {
	Tabout: true,
	SelectionEnhance: true,
	IntrinsicSymbolPairs: true,
	BaseObEditEnhance: true,
	FW2HWEnhance: true,
	BetterCodeEdit: true,
	BetterBackspace: true,
	AutoFormat: true,
	ExcludeFiles: "",
	ChineseEnglishSpace: true,
	ChineseNumberSpace: true,
	EnglishNumberSpace: true,
	ChineseNoSpace: true,
	PunctuationSpace: true,
	AutoCapital: true,
	AutoCapitalMode: WorkMode.OnlyWhenTyping,
	PunctuationSpaceMode: WorkMode.OnlyWhenTyping,
	InlineCodeSpaceMode: SpaceState.soft,
	InlineFormulaSpaceMode: SpaceState.soft,
	InlineLinkSpaceMode: SpaceState.soft,
	InlineLinkSmartSpace: true,
	UserDefinedRegSwitch: true,
	UserDefinedRegExp: "{{.*?}}|++\n"+
		"<.*?>|--\n" +
		"\\[\\!.*?\\][-+]{0,1}|-+\n"+
		"(file:///|https?://|ftp://|obsidian://|zotero://|www.)[^\\s（）《》。,，！？;；：“”‘’\\)\\(\\[\\]\\{\\}']+|--\n"+
		"\n[a-zA-Z0-9_\\-.]+@[a-zA-Z0-9_\\-.]+|++\n"+
		"(?<!#)#[\\u4e00-\\u9fa5\\w-\\/]+|++",
	debug: false,
	userSelRepRuleTrigger: ["-", "#"],
	userSelRepRuleValue: [{left:"~~", right:"~~"}, {left:"#", right:" "}],
	userDeleteRulesStrList: [["demo|", "|"]],
	userConvertRulesStrList: [[":)|","😀|"]],
	userSelRuleSettingsOpen: true,
	userDelRuleSettingsOpen: true,
	userCvtRuleSettingsOpen: true,

	EnterTwice: false,
	TryFixChineseIM: true,
	PuncRectify: false,
	FixMacOSContextMenu: false,
	TryFixMSIME: false,
}

var locale = enUS;

export class EasyTypingSettingTab extends PluginSettingTab {
	plugin: EasyTypingPlugin;

	constructor(app: App, plugin: EasyTypingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		// new Notice("moment.locale() "+moment.locale())

		if (moment.locale() == "zh" || moment.locale() == "zh-cn") {
			locale = zhCN;
		}
		else if (moment.locale().toLowerCase() == "zh-tw"){
			locale = zhTW;
		}
		else if (moment.locale() == "ru") {
			locale = ruRU;
		}

		containerEl.empty();

		containerEl.createEl("h1", { text: locale.headers.main });
		containerEl.createEl("p", { text: locale.headers.githubDetail }).createEl("a", {
			text: "easy-typing-obsidian",
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian",
		});

		containerEl.createEl('h2', { text: locale.headers.enhancedEditing });

		new Setting(containerEl)
			.setName(locale.settings.symbolAutoPair.name)
			.setDesc(locale.settings.symbolAutoPair.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.IntrinsicSymbolPairs)
					.onChange(async (value) => {
						this.plugin.settings.IntrinsicSymbolPairs = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(locale.settings.selectionReplace.name)
			.setDesc(locale.settings.selectionReplace.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.SelectionEnhance)
					.onChange(async (value) => {
						this.plugin.settings.SelectionEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(locale.settings.fullWidthToHalfWidth.name)
			.setDesc(locale.settings.fullWidthToHalfWidth.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.FW2HWEnhance)
					.onChange(async (value) => {
						this.plugin.settings.FW2HWEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(locale.settings.basicInputEnhance.name)
			.setDesc(locale.settings.basicInputEnhance.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BaseObEditEnhance)
					.onChange(async (value) => {
						this.plugin.settings.BaseObEditEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(locale.settings.codeblockEdit.name)
			.setDesc(locale.settings.codeblockEdit.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BetterCodeEdit)
					.onChange(async (value) => {
						this.plugin.settings.BetterCodeEdit = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(locale.settings.backspaceEdit.name)
			.setDesc(locale.settings.backspaceEdit.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BetterBackspace)
					.onChange(async (value) => {
						this.plugin.settings.BetterBackspace = value;
						await this.plugin.saveSettings();
					});
			});


		new Setting(containerEl)
			.setName(locale.settings.tabOut.name)
			.setDesc(locale.settings.tabOut.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.Tabout)
					.onChange(async (value) => {
						this.plugin.settings.Tabout = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl('h2', { text: locale.headers.customizeEditRule });
		this.buildUserSelRepRuleSetting(this.containerEl.createEl("details", {
			cls: "easytyping-nested-settings",
			attr: {
				...(this.plugin.settings.userSelRuleSettingsOpen?{ open: true }:{})
			}
		}))

		this.buildUserDeleteRuleSetting(this.containerEl.createEl("details", {
			cls: "easytyping-nested-settings",
			attr: {
				...(this.plugin.settings.userDelRuleSettingsOpen?{ open: true }:{})
			}
		}))

		this.buildUserConvertRuleSetting(this.containerEl.createEl("details", {
			cls: "easytyping-nested-settings",
			attr: {
				...(this.plugin.settings.userCvtRuleSettingsOpen?{ open: true }:{})
			}
		}))
		

		containerEl.createEl('h2', { text: locale.headers.autoformatSetting });

		new Setting(containerEl)
			.setName(locale.settings.autoFormatting.name)
			.setDesc(locale.settings.autoFormatting.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.AutoFormat)
					.onChange(async (value) => {
						this.plugin.settings.AutoFormat = value;
						await this.plugin.saveSettings();
					});
			});
		containerEl.createEl('p', { text: locale.headers.detailedSetting });

		new Setting(containerEl)
			.setName(locale.settings.spaceBetweenChineseEnglish.name)
			.setDesc(locale.settings.spaceBetweenChineseEnglish.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseEnglishSpace).onChange(async (value) => {
					this.plugin.settings.ChineseEnglishSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.spaceBetweenChineseNumber.name)
			.setDesc(locale.settings.spaceBetweenChineseNumber.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseNumberSpace).onChange(async (value) => {
					this.plugin.settings.ChineseNumberSpace = value;
					await this.plugin.saveSettings();
				});
			});
		
		new Setting(containerEl)
			.setName(locale.settings.spaceBetweenEnglishNumber.name)
			.setDesc(locale.settings.spaceBetweenEnglishNumber.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.EnglishNumberSpace).onChange(async (value) => {
					this.plugin.settings.EnglishNumberSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.deleteSpaceBetweenChinese.name)
			.setDesc(locale.settings.deleteSpaceBetweenChinese.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseNoSpace).onChange(async (value) => {
					this.plugin.settings.ChineseNoSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.capitalizeFirstLetter.name)
			.setDesc(locale.settings.capitalizeFirstLetter.desc)
			.addDropdown((dropdown) => {
				dropdown.addOption(WorkMode.OnlyWhenTyping, locale.dropdownOptions.onlyWhenTyping);
				dropdown.addOption(WorkMode.Globally, locale.dropdownOptions.globally);
				dropdown.setValue(this.plugin.settings.AutoCapitalMode);
				dropdown.onChange(async (v: WorkMode.OnlyWhenTyping | WorkMode.Globally) => {
					this.plugin.settings.AutoCapitalMode = v;
					await this.plugin.saveSettings();
				})
			})
			.addToggle((toggle) => {
				toggle.setTooltip(locale.toolTip.switch);
				toggle.setValue(this.plugin.settings.AutoCapital).onChange(async (value) => {
					this.plugin.settings.AutoCapital = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.smartInsertSpace.name)
			.setDesc(locale.settings.smartInsertSpace.desc)
			.addDropdown((dropdown) => {
				dropdown.addOption(WorkMode.OnlyWhenTyping, locale.dropdownOptions.onlyWhenTyping);
				dropdown.addOption(WorkMode.Globally, locale.dropdownOptions.globally);
				dropdown.setValue(this.plugin.settings.PunctuationSpaceMode);
				dropdown.onChange(async (v: WorkMode.OnlyWhenTyping | WorkMode.Globally) => {
					this.plugin.settings.PunctuationSpaceMode = v;
					await this.plugin.saveSettings();
				})
			})
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.PunctuationSpace).onChange(async (value) => {
					this.plugin.settings.PunctuationSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.spaceStrategyInlineCode.name)
			.setDesc(locale.settings.spaceStrategyInlineCode.desc)
			.addDropdown((dropdown) => {
				dropdown.addOption(String(SpaceState.none), locale.dropdownOptions.noRequire);
				dropdown.addOption(String(SpaceState.soft), locale.dropdownOptions.softSpace);
				dropdown.addOption(String(SpaceState.strict), locale.dropdownOptions.strictSpace);
				dropdown.setValue(String(this.plugin.settings.InlineCodeSpaceMode));
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineCodeSpaceMode = string2SpaceState(v);
					await this.plugin.saveSettings();
				})
			});

		new Setting(containerEl)
			.setName(locale.settings.spaceStrategyInlineFormula.name)
			.setDesc(locale.settings.spaceStrategyInlineFormula.desc)
			.addDropdown((dropdown) => {
				dropdown.addOption(String(SpaceState.none), locale.dropdownOptions.noRequire);
				dropdown.addOption(String(SpaceState.soft), locale.dropdownOptions.softSpace);
				dropdown.addOption(String(SpaceState.strict), locale.dropdownOptions.strictSpace);
				dropdown.setValue(String(this.plugin.settings.InlineFormulaSpaceMode));
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineFormulaSpaceMode = string2SpaceState(v);
					await this.plugin.saveSettings();
				})
			});

		new Setting(containerEl)
			.setName(locale.settings.spaceStrategyLinkText.name)
			.setDesc(locale.settings.spaceStrategyLinkText.desc)
			.addDropdown((dropdown) => {
				dropdown.addOption("dummy", locale.dropdownOptions.dummy);
				dropdown.addOption("smart", locale.dropdownOptions.smart);
				dropdown.setValue(this.plugin.settings.InlineLinkSmartSpace ? "smart" : "dummy");
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineLinkSmartSpace = v == "smart" ? true : false;
					// new Notice(String(this.plugin.settings.InlineLinkSmartSpace));
					await this.plugin.saveSettings();
				})
			})
			.addDropdown((dropdown) => {
				dropdown.addOption(String(SpaceState.none), locale.dropdownOptions.noRequire);
				dropdown.addOption(String(SpaceState.soft), locale.dropdownOptions.softSpace);
				dropdown.addOption(String(SpaceState.strict), locale.dropdownOptions.strictSpace);
				dropdown.setValue(String(this.plugin.settings.InlineLinkSpaceMode));
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineLinkSpaceMode = string2SpaceState(v);
					await this.plugin.saveSettings();
				})
			})

		containerEl.createEl('h2', { text: locale.headers.customRegexpBlock });
		new Setting(containerEl)
			.setName(locale.settings.userDefinedRegexpSwitch.name)
			.setDesc(locale.settings.userDefinedRegexpSwitch.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value) => {
					this.plugin.settings.UserDefinedRegSwitch = value;
					await this.plugin.saveSettings();
				});
			});

		containerEl.createEl("p", { text: locale.headers.aboutRegexp.header }).createEl("a", {
			text: locale.headers.aboutRegexp.text,
			href: "https://javascript.ruanyifeng.com/stdlib/regexp.html#",
		});

		containerEl.createEl("p", { text: locale.headers.instructionsRegexp.header }).createEl("a", {
			text: locale.headers.instructionsRegexp.text,
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian/blob/master/UserDefinedRegExp.md",
		});

		const regContentAreaSetting = new Setting(containerEl);
		regContentAreaSetting.settingEl.setAttribute(
			"style",
			"display: grid; grid-template-columns: 1fr;"
		);
		regContentAreaSetting
			.setName(locale.settings.userDefinedRegexp.name)
			.setDesc(locale.settings.userDefinedRegexp.desc);
		const regContentArea = new TextAreaComponent(
			regContentAreaSetting.controlEl
		);

		setAttributes(regContentArea.inputEl, {
			style: "margin-top: 12px; width: 100%;  height: 30vh;",
			// class: "ms-css-editor",
		});
		regContentArea
			.setValue(this.plugin.settings.UserDefinedRegExp)
			.onChange(async (value) => {
				this.plugin.settings.UserDefinedRegExp = value;
				this.plugin.saveSettings();
			});

		containerEl.createEl('h2', { text: locale.headers.excludeFoldersFiles });
		new Setting(containerEl)
			.setName(locale.settings.excludeFoldersFiles.name)
			.setDesc(locale.settings.excludeFoldersFiles.desc)
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.ExcludeFiles)
					.onChange(async (value) => {
						this.plugin.settings.ExcludeFiles = value;
						this.plugin.saveSettings();
					})
			);
		
		containerEl.createEl('h2', { text: locale.headers.experimentalFeatures });
		new Setting(containerEl)
			.setName(locale.settings.fixMacOSContextMenu.name)
			.setDesc(locale.settings.fixMacOSContextMenu.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.FixMacOSContextMenu).onChange(async (value) => {
					this.plugin.settings.FixMacOSContextMenu = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.fixMicrosoftIME.name)
			.setDesc(locale.settings.fixMicrosoftIME.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.TryFixMSIME).onChange(async (value) => {
					this.plugin.settings.TryFixMSIME = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.strictLineBreaks.name)
			.setDesc(locale.settings.strictLineBreaks.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.EnterTwice).onChange(async (value) => {
					this.plugin.settings.EnterTwice = value;
					await this.plugin.saveSettings();
				});
			});
		
		new Setting(containerEl)
			.setName(locale.settings.puncRectify.name)
			.setDesc(locale.settings.puncRectify.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.PuncRectify).onChange(async (value) => {
					this.plugin.settings.PuncRectify = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(locale.settings.printDebugInfo.name)
			.setDesc(locale.settings.printDebugInfo.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.debug).onChange(async (value) => {
					this.plugin.settings.debug = value;
					setDebug(value);
					await this.plugin.saveSettings();
				});
			});
	}

	buildUserSelRepRuleSetting(containerEl: HTMLDetailsElement){
		containerEl.empty();
        containerEl.ontoggle = async () => {
			this.plugin.settings.userSelRuleSettingsOpen = containerEl.open;
			await this.plugin.saveSettings();
        };
		
		const summary = containerEl.createEl("summary", {cls: "easytyping-nested-settings"});
		summary.setText(locale.headers.customizeSelectionRule)

        // summary.setHeading().setName("User defined Selection Replace Rule");
        // summary.createDiv("collapser").createDiv("handle");

		const selectionRuleSetting = new Setting(containerEl);
		selectionRuleSetting
			.setName(locale.settings.selectionReplaceRule.name)
			// .setDesc(locale.settings.selectionReplaceRule.desc)

		const replaceRuleTrigger = new TextComponent(selectionRuleSetting.controlEl);
		replaceRuleTrigger.setPlaceholder(locale.placeHolder.triggerSymbol);

		const replaceLeftString = new TextComponent(selectionRuleSetting.controlEl);
		replaceLeftString.setPlaceholder(locale.placeHolder.newLeftSideString);

		const replaceRightString = new TextComponent(selectionRuleSetting.controlEl);
		replaceRightString.setPlaceholder(locale.placeHolder.newRightSideString);

		selectionRuleSetting
			.addButton((button) => {
				button
					.setButtonText("+")
					.setTooltip(locale.placeHolder.addRule)
					.onClick(async (buttonEl: any) => {
						let trigger = replaceRuleTrigger.inputEl.value;
						let left = replaceLeftString.inputEl.value;
						let right = replaceRightString.inputEl.value;
						if (trigger && (left || right)) {
							if(trigger.length!=1 && trigger!="——" && trigger!="……"){
								new Notice(locale.placeHolder.noticeInvaidTrigger);
								return;
							}
							if (this.plugin.addUserSelectionRepRule(trigger, left, right)){
								await this.plugin.saveSettings();
								this.display();
							}
							else{
								new Notice(sprintf(locale.placeHolder.noticeWarnTriggerExists, trigger))
							}
						}
						else {
							new Notice(locale.placeHolder.noticeMissingInput);
						}
					});
			});

		// const selRepRuleContainer = containerEl.createEl("div");
		for (let i = 0; i < this.plugin.settings.userSelRepRuleTrigger.length; i++) {
			let trigger = this.plugin.settings.userSelRepRuleTrigger[i];
			let left_s = this.plugin.settings.userSelRepRuleValue[i].left;
			let right_s = this.plugin.settings.userSelRepRuleValue[i].right;
			let showStr = "Trigger: " + trigger + " → " + showString(left_s) + "selected" + showString(right_s);
			// const settingItem = selRepRuleContainer.createEl("div");
			new Setting(containerEl)
				.setName(showStr)
				.addExtraButton(button => {
					button.setIcon("gear")
						.setTooltip(locale.toolTip.editRule)
						.onClick(() => {
							new SelectRuleEditModal(this.app, trigger,left_s, right_s, async (new_left, new_right) => {
								this.plugin.updateUserSelectionRepRule(i, new_left, new_right);
								await this.plugin.saveSettings();
								this.display();
							}).open();
						})
				})
				.addExtraButton(button => {
					button.setIcon("trash")
						.setTooltip(locale.toolTip.removeRule)
						.onClick(async () => {
							this.plugin.deleteUserSelectionRepRule(i);
							await this.plugin.saveSettings();
							this.display();
						})
				});
		}


	}

	buildUserDeleteRuleSetting(containerEl: HTMLDetailsElement){
		containerEl.empty();
        containerEl.ontoggle = async () => {
			this.plugin.settings.userDelRuleSettingsOpen = containerEl.open;
			await this.plugin.saveSettings();
        };
		const summary = containerEl.createEl("summary", {cls: "easytyping-nested-settings"});
		summary.setText(locale.headers.customizeDeleteRule)

		const deleteRuleSetting = new Setting(containerEl);
		deleteRuleSetting
			.setName(locale.settings.deleteRule.name)
			.setDesc(locale.settings.deleteRule.desc)

		const patternBefore = new TextAreaComponent(deleteRuleSetting.controlEl);
		patternBefore.setPlaceholder(locale.placeHolder.beforeDelete);

		const patternAfter = new TextAreaComponent(deleteRuleSetting.controlEl);
		patternAfter.setPlaceholder(locale.placeHolder.newPattern);

		deleteRuleSetting
			.addButton((button) => {
				button
					.setButtonText("+")
					.setTooltip(locale.toolTip.addRule)
					.onClick(async (buttonEl: any) => {
						let before = patternBefore.inputEl.value;
						let after = patternAfter.inputEl.value;
						if (before && after) {
							if(findFirstPipeNotPrecededByBackslash(before)==-1){
								new Notice(locale.placeHolder.noticeInvaidTriggerPatternContainSymbol);
								return;
							}
							else{
								this.plugin.addUserDeleteRule(before, after);
								await this.plugin.saveSettings();
								this.display();
							}
						}
						else {
							new Notice(locale.placeHolder.noticeMissingInput);
						}
					});
			});

		for (let i = 0; i < this.plugin.settings.userDeleteRulesStrList.length; i++){
			let before = this.plugin.settings.userDeleteRulesStrList[i][0];
			let after = this.plugin.settings.userDeleteRulesStrList[i][1];
			let showStr = "\"" + showString(before) + "\"  delete.backwards  → \""+ showString(after)+"\""; 
			new Setting(containerEl)
				.setName(showStr)
				.addExtraButton(button => {
					button.setIcon("gear")
						.setTooltip(locale.toolTip.editRule)
						.onClick(() => {
							new EditConvertRuleModal(this.app, RuleType.delete, before, after, async (new_before, new_after) => {
								this.plugin.updateUserDeleteRule(i, new_before, new_after);
								await this.plugin.saveSettings();
								this.display();
							}).open();
						})
				})
				.addExtraButton(button => {
					button.setIcon("trash")
						.setTooltip(locale.toolTip.removeRule)
						.onClick(async () => {
							this.plugin.deleteUserDeleteRule(i);
							await this.plugin.saveSettings();
							this.display();
						})
				});
		}

	}

	buildUserConvertRuleSetting(containerEl: HTMLDetailsElement){
		containerEl.empty();
        containerEl.ontoggle = async () => {
			this.plugin.settings.userCvtRuleSettingsOpen = containerEl.open;
			await this.plugin.saveSettings();
        };
		const summary = containerEl.createEl("summary", {cls: "easytyping-nested-settings"});
		summary.setText(locale.headers.customizeConvertRule)

		const convertRuleSetting = new Setting(containerEl);
		convertRuleSetting
			.setName(locale.settings.convertRule.name)
			.setDesc(locale.settings.convertRule.desc)

		const patternBefore = new TextAreaComponent(convertRuleSetting.controlEl);
		patternBefore.setPlaceholder(locale.placeHolder.beforeConvert);

		const patternAfter = new TextAreaComponent(convertRuleSetting.controlEl);
		patternAfter.setPlaceholder(locale.placeHolder.newPattern);

		convertRuleSetting
			.addButton((button) => {
				button
					.setButtonText("+")
					.setTooltip(locale.toolTip.addRule)
					.onClick(async (buttonEl: any) => {
						let before = patternBefore.inputEl.value;
						let after = patternAfter.inputEl.value;
						if (before && after) {
							if(findFirstPipeNotPrecededByBackslash(before)==-1){
								new Notice(locale.placeHolder.noticeInvaidTriggerPatternContainSymbol);
								return;
							}
							else{
								this.plugin.addUserConvertRule(before, after);
								await this.plugin.saveSettings();
								this.display();
							}
						}
						else {
							new Notice(locale.placeHolder.noticeMissingInput);
						}
					});
			});

		for (let i = 0; i < this.plugin.settings.userConvertRulesStrList.length; i++){
			let before = this.plugin.settings.userConvertRulesStrList[i][0];
			let after = this.plugin.settings.userConvertRulesStrList[i][1];
			let showStr = "\"" + showString(before) + "\"  auto convert to \""+ showString(after)+"\""; 
			new Setting(containerEl)
				.setName(showStr)
				.addExtraButton(button => {
					button.setIcon("gear")
						.setTooltip(locale.toolTip.editRule)
						.onClick(() => {
							new EditConvertRuleModal(this.app, RuleType.convert, before, after, async (new_before, new_after) => {
								this.plugin.updateUserConvertRule(i, new_before, new_after);
								await this.plugin.saveSettings();
								this.display();
							}).open();
						})
				})
				.addExtraButton(button => {
					button.setIcon("trash")
						.setTooltip(locale.toolTip.removeRule)
						.onClick(async () => {
							this.plugin.deleteUserConvertRule(i);
							await this.plugin.saveSettings();
							this.display();
						})
				});
		}
	}

}


function setAttributes(element: any, attributes: any) {
	for (let key in attributes) {
		element.setAttribute(key, attributes[key]);
	}
}


export class SelectRuleEditModal extends Modal {
	trigger: string;
	old_left: string;
	old_right: string;
	new_left: string;
	new_right: string;
	onSubmit: (new_left: string, new_right:string) => void;

	constructor(app: App, trigger: string, left: string, right: string, onSubmit: (new_left: string, new_right:string) => void) {
		super(app);
		this.trigger = trigger;
		this.old_left = left;
		this.old_right = right;
		this.new_left = left;
		this.new_right = right;

		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: locale.headers.editSelectionReplaceRule });

		new Setting(contentEl)
			.setName(locale.settings.trigger.name)
			.addText((text) => {
				text.setValue(this.trigger);
				text.setDisabled(true);
			})
		
		new Setting(contentEl)
			.setName(locale.settings.left.name)
			.addTextArea((text) => {
				text.setValue(this.old_left);
				text.onChange((value) => {
					this.new_left = value
				})
			})
		new Setting(contentEl)
			.setName(locale.settings.right.name)
			.addTextArea((text) => {
				text.setValue(this.old_right);
				text.onChange((value) => {
					this.new_right = value
				})
			});


		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(locale.button.update)
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(this.new_left, this.new_right);
					}));
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}



export class EditConvertRuleModal extends Modal {
	type: RuleType;
	old_before: string;
	old_after: string;
	new_before: string;
	new_after: string;
	onSubmit: (new_before: string, new_after:string) => void;

	constructor(app: App, type: RuleType, before: string, after: string, onSubmit: (new_before: string, new_after:string) => void) {
		super(app);
		this.type = type;
		this.old_before = before;
		this.old_after = after;
		this.new_before = before;
		this.new_after = after;

		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Edit " + this.type});
		
		new Setting(contentEl)
			.setName(locale.settings.oldPattern.name)
			.addTextArea((text) => {
				text.setValue(this.old_before);
				text.onChange((value) => {
					this.new_before = value
				})
			})
		new Setting(contentEl)
			.setName(locale.settings.newPattern.name)
			.addTextArea((text) => {
				text.setValue(this.old_after);
				text.onChange((value) => {
					this.new_after = value
				})
			});


		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(locale.button.update)
					.setCta()
					.onClick(() => {
						if (this.checkConvertPatternString(this.new_before, this.new_after))
						{
							this.close();
							this.onSubmit(this.new_before, this.new_after);
						}
						else{
							new Notice(locale.placeHolder.noticeInvalidPatternString);
						}
						
					}));
	}

	checkConvertPatternString(before: string, after:string):boolean{
		if(findFirstPipeNotPrecededByBackslash(before)==-1) return false;
		return true;
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

