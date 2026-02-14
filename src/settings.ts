import { SpaceState, string2SpaceState } from 'src/core';
import { App, TextComponent, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, WorkspaceLeaf, TextAreaComponent, moment } from 'obsidian';
import EasyTypingPlugin from './main';
import { enUS, ruRU, zhCN, zhTW } from './lang/locale';
import {sprintf} from "sprintf-js";
import { setDebug } from './utils';
import { RuleEngine, SimpleRule, RuleType as EngineRuleType, RuleTriggerMode, RuleScope } from './rule_engine';
import { DEFAULT_BUILTIN_RULES } from './default_rules';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export interface PairString {
	left: string;
	right: string;
}

export enum WorkMode { OnlyWhenTyping = "typing", Globally = "global" }
export enum StrictLineMode { EnterTwice = "enter_twice", TwoSpace = "two_space", Mix = "mix_mode" }

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
	QuoteSpace: boolean;
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

	StrictModeEnter: boolean;
	StrictLineMode: StrictLineMode;
	EnhanceModA: boolean;
	PuncRectify: boolean;
	TryFixChineseIM: boolean;
	FixMacOSContextMenu: boolean;
	TryFixMSIME: boolean;
	CollapsePersistentEnter: boolean;
	deletedBuiltinRuleIds: string[];
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
	QuoteSpace: true,
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

	StrictModeEnter: false,
	StrictLineMode: StrictLineMode.EnterTwice,
	EnhanceModA: false,
	TryFixChineseIM: true,
	PuncRectify: false,
	FixMacOSContextMenu: false,
	TryFixMSIME: false,
	CollapsePersistentEnter: false,
	deletedBuiltinRuleIds: [],
}

var locale = enUS;

export class EasyTypingSettingTab extends PluginSettingTab {
	plugin: EasyTypingPlugin;
	// 记住当前激活的 Tab，避免 display() 刷新时重置
	activeTab: string = "edit-enhance";

	constructor(app: App, plugin: EasyTypingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		// 根据系统语言选择对应的语言包
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

		// ========== 顶部标题 ==========
		containerEl.createEl("h1", { text: locale.headers.main });
		containerEl.createEl("p", { text: locale.headers.githubDetail }).createEl("a", {
			text: "easy-typing-obsidian",
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian",
		});

		// ========== Tab 导航栏 ==========
		const navEl = containerEl.createEl("nav", { cls: "et-settings-nav" });
		const contentEl = containerEl.createEl("div", { cls: "et-settings-content" });

		// 定义 4 个 Tab 页
		const tabs = [
			{ id: "edit-enhance", label: locale.headers.tabs.editEnhance },
			{ id: "auto-format", label: locale.headers.tabs.autoFormat },
			{ id: "builtin-rules", label: locale.headers.tabs.builtinRules },
			{ id: "user-rules", label: locale.headers.tabs.userRules },
			{ id: "other", label: locale.headers.tabs.other },
		];

		const tabPanels: Record<string, HTMLElement> = {};
		const tabButtons: HTMLElement[] = [];

		tabs.forEach((tab) => {
			// 创建导航按钮
			const isActive = tab.id === this.activeTab;
			const btn = navEl.createEl("button", {
				text: tab.label,
				cls: `et-settings-tab-btn ${isActive ? "et-settings-tab-active" : ""}`,
			});
			tabButtons.push(btn);

			// 创建内容面板
			const panel = contentEl.createEl("div", {
				cls: `et-settings-tab-panel ${isActive ? "" : "et-settings-tab-hidden"}`,
			});
			tabPanels[tab.id] = panel;

			// 点击切换 Tab
			btn.addEventListener("click", () => {
				this.activeTab = tab.id;
				// 取消所有按钮的激活状态
				tabButtons.forEach(b => b.removeClass("et-settings-tab-active"));
				// 隐藏所有面板
				Object.values(tabPanels).forEach(p => p.addClass("et-settings-tab-hidden"));
				// 激活当前 Tab
				btn.addClass("et-settings-tab-active");
				panel.removeClass("et-settings-tab-hidden");
			});
		});

		// ========== 填充各 Tab 的内容 ==========
		this.buildEditEnhanceTab(tabPanels["edit-enhance"]);
		this.buildAutoFormatTab(tabPanels["auto-format"]);
		this.buildBuiltinRulesSection(tabPanels["builtin-rules"]);
		this.buildUserRulesSection(tabPanels["user-rules"]);
		this.buildOtherTab(tabPanels["other"]);
	}

	// ==================== Tab 1: 编辑增强 ====================
	buildEditEnhanceTab(el: HTMLElement): void {
		new Setting(el)
			.setName(locale.settings.symbolAutoPair.name)
			.setDesc(locale.settings.symbolAutoPair.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.IntrinsicSymbolPairs)
					.onChange(async (value) => {
						this.plugin.settings.IntrinsicSymbolPairs = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(el)
			.setName(locale.settings.selectionReplace.name)
			.setDesc(locale.settings.selectionReplace.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.SelectionEnhance)
					.onChange(async (value) => {
						this.plugin.settings.SelectionEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(el)
			.setName(locale.settings.fullWidthToHalfWidth.name)
			.setDesc(locale.settings.fullWidthToHalfWidth.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.FW2HWEnhance)
					.onChange(async (value) => {
						this.plugin.settings.FW2HWEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(el)
			.setName(locale.settings.basicInputEnhance.name)
			.setDesc(locale.settings.basicInputEnhance.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BaseObEditEnhance)
					.onChange(async (value) => {
						this.plugin.settings.BaseObEditEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(el)
			.setName(locale.settings.codeblockEdit.name)
			.setDesc(locale.settings.codeblockEdit.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BetterCodeEdit)
					.onChange(async (value) => {
						this.plugin.settings.BetterCodeEdit = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(el)
			.setName(locale.settings.backspaceEdit.name)
			.setDesc(locale.settings.backspaceEdit.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BetterBackspace)
					.onChange(async (value) => {
						this.plugin.settings.BetterBackspace = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(el)
			.setName(locale.settings.tabOut.name)
			.setDesc(locale.settings.tabOut.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.Tabout)
					.onChange(async (value) => {
						this.plugin.settings.Tabout = value;
						await this.plugin.saveSettings();
					});
			});
	}

	// ==================== Tab 2: 自动格式化 ====================
	buildAutoFormatTab(el: HTMLElement): void {
		// 主开关
		new Setting(el)
			.setName(locale.settings.autoFormatting.name)
			.setDesc(locale.settings.autoFormatting.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.AutoFormat)
					.onChange(async (value) => {
						this.plugin.settings.AutoFormat = value;
						await this.plugin.saveSettings();
					});
			});

		// 空格策略分组标题
		el.createEl('h3', { text: locale.headers.detailedSetting });

		new Setting(el)
			.setName(locale.settings.spaceBetweenChineseEnglish.name)
			.setDesc(locale.settings.spaceBetweenChineseEnglish.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseEnglishSpace).onChange(async (value) => {
					this.plugin.settings.ChineseEnglishSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.spaceBetweenChineseNumber.name)
			.setDesc(locale.settings.spaceBetweenChineseNumber.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseNumberSpace).onChange(async (value) => {
					this.plugin.settings.ChineseNumberSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.spaceBetweenEnglishNumber.name)
			.setDesc(locale.settings.spaceBetweenEnglishNumber.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.EnglishNumberSpace).onChange(async (value) => {
					this.plugin.settings.EnglishNumberSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.deleteSpaceBetweenChinese.name)
			.setDesc(locale.settings.deleteSpaceBetweenChinese.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseNoSpace).onChange(async (value) => {
					this.plugin.settings.ChineseNoSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.quoteSpace.name)
			.setDesc(locale.settings.quoteSpace.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.QuoteSpace).onChange(async (value) => {
					this.plugin.settings.QuoteSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
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

		new Setting(el)
			.setName(locale.settings.textPunctuationSpace.name)
			.setDesc(locale.settings.textPunctuationSpace.desc)
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

		new Setting(el)
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

		new Setting(el)
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

		new Setting(el)
			.setName(locale.settings.spaceStrategyLinkText.name)
			.setDesc(locale.settings.spaceStrategyLinkText.desc)
			.addDropdown((dropdown) => {
				dropdown.addOption("dummy", locale.dropdownOptions.dummy);
				dropdown.addOption("smart", locale.dropdownOptions.smart);
				dropdown.setValue(this.plugin.settings.InlineLinkSmartSpace ? "smart" : "dummy");
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineLinkSmartSpace = v == "smart" ? true : false;
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
			});

		// 自定义正则区块
		el.createEl('h3', { text: locale.headers.customRegexpBlock });
		new Setting(el)
			.setName(locale.settings.userDefinedRegexpSwitch.name)
			.setDesc(locale.settings.userDefinedRegexpSwitch.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value) => {
					this.plugin.settings.UserDefinedRegSwitch = value;
					await this.plugin.saveSettings();
				});
			});

		el.createEl("p", { text: locale.headers.aboutRegexp.header }).createEl("a", {
			text: locale.headers.aboutRegexp.text,
			href: "https://javascript.ruanyifeng.com/stdlib/regexp.html#",
		});

		el.createEl("p", { text: locale.headers.instructionsRegexp.header }).createEl("a", {
			text: locale.headers.instructionsRegexp.text,
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian/blob/master/UserDefinedRegExp.md",
		});

		const regContentAreaSetting = new Setting(el);
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
		});
		regContentArea
			.setValue(this.plugin.settings.UserDefinedRegExp)
			.onChange(async (value) => {
				this.plugin.settings.UserDefinedRegExp = value;
				this.plugin.saveSettings();
			});

		// 排除文件/文件夹
		el.createEl('h3', { text: locale.headers.excludeFoldersFiles });
		new Setting(el)
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
	}

	// ==================== Tab 3: 内置规则 ====================
	buildBuiltinRulesSection(el: HTMLElement): void {
		const headerEl = el.createDiv({ cls: 'setting-item' });
		const infoEl = headerEl.createDiv({ cls: 'setting-item-info' });
		infoEl.createEl('h3', { text: locale.headers.builtinRulesSection });
		const controlEl = headerEl.createDiv({ cls: 'setting-item-control' });
		const resetBtn = controlEl.createEl('button', { text: locale.toolTip.resetAllRules });
		resetBtn.addEventListener('click', async () => {
			await this.plugin.resetAllBuiltinRules();
			this.display();
		});

		for (const rule of this.plugin.cachedBuiltinRules) {
			this.buildRuleItem(el, rule, true);
		}

		// Deleted built-in rules section
		const deletedIds = this.plugin.settings.deletedBuiltinRuleIds || [];
		if (deletedIds.length > 0) {
			const details = el.createEl('details', { cls: 'et-deleted-rules' });
			details.createEl('summary', { text: `${locale.headers.deletedRulesSection} (${deletedIds.length})` });
			for (const id of deletedIds) {
				const defaultRule = DEFAULT_BUILTIN_RULES.find(r => r.id === id);
				if (!defaultRule) continue;
				const opts = RuleEngine.parseOptions(defaultRule.options);
				const typeLabel = this.getRuleTypeLabel(opts.type);
				const typeCls = this.getRuleTypeCls(opts.type);
				const preview = defaultRule.description || `${defaultRule.trigger} → ${typeof defaultRule.replacement === 'string' ? defaultRule.replacement : '(fn)'}`;
				new Setting(details)
					.setName(createFragment(f => {
						f.createSpan({ cls: `et-rule-type-tag ${typeCls}`, text: typeLabel });
						f.createSpan({ text: preview });
					}))
					.addButton(button => {
						button.setButtonText(locale.toolTip.restoreRule)
							.onClick(async () => {
								await this.plugin.restoreBuiltinRule(id);
								this.display();
							});
					});
			}
		}
	}

	// ==================== Tab 4: 自定义规则 ====================
	buildUserRulesSection(el: HTMLElement): void {
		const headerEl = el.createDiv({ cls: 'setting-item' });
		const infoEl = headerEl.createDiv({ cls: 'setting-item-info' });
		infoEl.createEl('h3', { text: locale.headers.userRulesSection });
		const controlEl = headerEl.createDiv({ cls: 'setting-item-control' });
		const addBtn = controlEl.createEl('button', { text: '+' });
		addBtn.addEventListener('click', () => {
			new RuleEditModal(this.app, 'create', {}, async (rule) => {
				await this.plugin.addUserRule(rule);
				this.display();
			}).open();
		});

		for (const rule of this.plugin.cachedUserRules) {
			this.buildRuleItem(el, rule, false);
		}
	}

	buildRuleItem(container: HTMLElement, rule: SimpleRule, isBuiltin: boolean): void {
		const opts = RuleEngine.parseOptions(rule.options);
		const typeLabel = this.getRuleTypeLabel(opts.type);
		const typeCls = this.getRuleTypeCls(opts.type);
		const enabled = rule.enabled !== false;
		const isTab = opts.triggerMode === RuleTriggerMode.Tab;
		const isFn = opts.isFunctionReplacement;

		let preview: string;
		if (rule.description) {
			preview = rule.description;
		} else {
			const repl = typeof rule.replacement === 'string' ? rule.replacement : '(fn)';
			preview = `${rule.trigger}${rule.trigger_right ? ' … ' + rule.trigger_right : ''} → ${repl}`;
		}
		// Truncate long previews
		if (preview.length > 60) preview = preview.substring(0, 57) + '...';

		const setting = new Setting(container)
			.setClass('et-rule-item')
			.setName(createFragment(f => {
				f.createSpan({ cls: `et-rule-type-tag ${typeCls}`, text: typeLabel });
				const modeTag = f.createSpan({
					cls: `et-rule-trigger-mode ${isTab ? 'et-trigger-mode-tab' : 'et-trigger-mode-auto'}`,
					text: isTab ? 'Tab' : 'Auto',
				});
				modeTag.setAttribute('aria-label', locale.settings.ruleEditModal.fieldTriggerMode);
				modeTag.addEventListener('click', async (e) => {
					e.stopPropagation();
					const newIsTab = !isTab;
					await this.plugin.updateRuleTriggerMode(rule.id!, isBuiltin, newIsTab);
					this.display();
				});
				if (isFn) {
					f.createSpan({ cls: 'et-rule-type-tag et-rule-type-fn', text: 'Fn' });
				}
				f.createSpan({ text: preview });
			}))
			.addToggle(toggle => {
				toggle.setValue(enabled)
					.setTooltip(locale.toolTip.enableRule)
					.onChange(async (value) => {
						await this.plugin.toggleRuleEnabled(rule.id!, isBuiltin, value);
					});
			})
			.addExtraButton(button => {
				button.setIcon('gear')
					.setTooltip(locale.toolTip.editRule)
					.onClick(() => {
						new RuleEditModal(this.app, 'edit', rule, async (updated) => {
							if (isBuiltin) {
								await this.plugin.updateBuiltinRule(rule.id!, updated);
							} else {
								await this.plugin.updateUserRule(rule.id!, updated);
							}
							this.display();
						}).open();
					});
			})
			.addExtraButton(button => {
				button.setIcon('trash')
					.setTooltip(locale.toolTip.removeRule)
					.onClick(async () => {
						if (isBuiltin) {
							await this.plugin.deleteBuiltinRule(rule.id!);
						} else {
							await this.plugin.deleteUserRule(rule.id!);
						}
						this.display();
					});
			});

		if (!enabled) {
			setting.settingEl.style.opacity = '0.5';
		}
	}

	getRuleTypeLabel(type: EngineRuleType): string {
		switch (type) {
			case EngineRuleType.Input: return locale.settings.ruleType.input;
			case EngineRuleType.Delete: return locale.settings.ruleType.delete;
			case EngineRuleType.SelectKey: return locale.settings.ruleType.selectKey;
		}
	}

	getRuleTypeCls(type: EngineRuleType): string {
		switch (type) {
			case EngineRuleType.Input: return 'et-rule-type-input';
			case EngineRuleType.Delete: return 'et-rule-type-delete';
			case EngineRuleType.SelectKey: return 'et-rule-type-selectkey';
		}
	}

	// ==================== Tab 5: 其他设置 ====================
	buildOtherTab(el: HTMLElement): void {
		el.createEl('h3', { text: locale.headers.experimentalFeatures });

		new Setting(el)
			.setName(locale.settings.strictLineBreaks.name)
			.setDesc(locale.settings.strictLineBreaks.desc)
			.addDropdown((dropdown) => {
				dropdown.addOption(StrictLineMode.EnterTwice, locale.dropdownOptions.enterTwice);
				dropdown.addOption(StrictLineMode.TwoSpace, locale.dropdownOptions.twoSpace);
				dropdown.addOption(StrictLineMode.Mix, locale.dropdownOptions.mixMode);
				dropdown.setValue(this.plugin.settings.StrictLineMode);
				dropdown.onChange(async (v: StrictLineMode) => {
					this.plugin.settings.StrictLineMode = v;
					await this.plugin.saveSettings();
				})
			})
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.StrictModeEnter).onChange(async (value) => {
					this.plugin.settings.StrictModeEnter = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.enhanceModA.name)
			.setDesc(locale.settings.enhanceModA.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.EnhanceModA).onChange(async (value) => {
					this.plugin.settings.EnhanceModA = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.collapsePersistentEnter.name)
			.setDesc(locale.settings.collapsePersistentEnter.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.CollapsePersistentEnter).onChange(async (value) => {
					this.plugin.settings.CollapsePersistentEnter = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.fixMicrosoftIME.name)
			.setDesc(locale.settings.fixMicrosoftIME.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.TryFixMSIME).onChange(async (value) => {
					this.plugin.settings.TryFixMSIME = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.fixMacOSContextMenu.name)
			.setDesc(locale.settings.fixMacOSContextMenu.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.FixMacOSContextMenu).onChange(async (value) => {
					this.plugin.settings.FixMacOSContextMenu = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName(locale.settings.puncRectify.name)
			.setDesc(locale.settings.puncRectify.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.PuncRectify).onChange(async (value) => {
					this.plugin.settings.PuncRectify = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
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

}


function setAttributes(element: any, attributes: any) {
	for (let key in attributes) {
		element.setAttribute(key, attributes[key]);
	}
}


// ===== Lightweight JS tokenizer for CM6 =====

const simpleJSLanguage = StreamLanguage.define({
	token(stream) {
		if (stream.match('//')) { stream.skipToEnd(); return 'lineComment'; }
		if (stream.match('/*')) {
			while (!stream.eol()) {
				if (stream.match('*/')) break;
				stream.next();
			}
			return 'blockComment';
		}
		if (stream.match(/^"(?:[^"\\]|\\.)*"/) || stream.match(/^'(?:[^'\\]|\\.)*'/)) return 'string';
		if (stream.match(/^`(?:[^`\\]|\\.)*`/)) return 'string';
		if (stream.match(/^0x[0-9a-fA-F]+/) || stream.match(/^\d+(\.\d+)?/)) return 'number';
		if (stream.match(/^(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|true|false|null|undefined|typeof|instanceof|in|of|try|catch|finally|throw|async|await)\b/)) return 'keyword';
		if (stream.match(/^[+\-*/%=<>!&|^~?:]+/)) return 'operator';
		if (stream.match(/^[()[\]{}]/)) return 'paren';
		if (stream.match(/^\w+/)) return 'variableName';
		stream.next();
		return null;
	}
});

const jsHighlightStyle = HighlightStyle.define([
	{ tag: tags.keyword, color: '#c678dd' },
	{ tag: tags.string, color: '#98c379' },
	{ tag: [tags.lineComment, tags.blockComment], color: 'var(--text-faint)', fontStyle: 'italic' },
	{ tag: tags.number, color: '#d19a66' },
	{ tag: tags.operator, color: '#56b6c2' },
	{ tag: tags.variableName, color: 'var(--text-normal)' },
	{ tag: tags.paren, color: 'var(--text-muted)' },
]);

const fnEditorTheme = EditorView.theme({
	'&': {
		fontSize: '13px',
		backgroundColor: 'var(--background-primary)',
	},
	'.cm-content': {
		fontFamily: 'var(--font-monospace)',
		padding: '8px',
		minHeight: '120px',
	},
	'&.cm-focused': {
		outline: 'none',
	},
	'.cm-gutters': { display: 'none' },
	'.cm-activeLine': { backgroundColor: 'transparent' },
});

function createJSEditorView(
	container: HTMLElement,
	initialValue: string,
	onChange: (value: string) => void,
): EditorView {
	const state = EditorState.create({
		doc: initialValue,
		extensions: [
			simpleJSLanguage.extension,
			syntaxHighlighting(jsHighlightStyle),
			fnEditorTheme,
			keymap.of([indentWithTab]),
			EditorState.tabSize.of(4),
			EditorView.updateListener.of((update: ViewUpdate) => {
				if (update.docChanged) {
					onChange(update.state.doc.toString());
				}
			}),
		],
	});
	return new EditorView({ state, parent: container });
}

export class RuleEditModal extends Modal {
	mode: 'create' | 'edit';
	initial: Partial<SimpleRule>;
	onSubmit: (rule: SimpleRule) => void;

	// Form state
	ruleType: EngineRuleType = EngineRuleType.Input;
	triggerMode: RuleTriggerMode = RuleTriggerMode.Auto;
	trigger: string = '';
	triggerRight: string = '';
	replacement: string = '';
	isRegex: boolean = false;
	ruleScope: RuleScope = RuleScope.All;
	priority: number = 100;
	description: string = '';
	enabled: boolean = true;
	isFunction: boolean = false;
	private cmEditor: EditorView | null = null;

	constructor(
		app: App,
		mode: 'create' | 'edit',
		initial: Partial<SimpleRule>,
		onSubmit: (rule: SimpleRule) => void
	) {
		super(app);
		this.mode = mode;
		this.initial = initial;
		this.onSubmit = onSubmit;

		// Parse initial values
		if (initial.options !== undefined || initial.trigger !== undefined) {
			const opts = RuleEngine.parseOptions(initial.options);
			this.ruleType = opts.type;
			this.triggerMode = opts.triggerMode;
			this.isRegex = opts.isRegex;
			this.isFunction = opts.isFunctionReplacement;
			this.ruleScope = opts.scope[0] || RuleScope.All;
		}
		if (initial.trigger !== undefined) this.trigger = initial.trigger;
		if (initial.trigger_right !== undefined) this.triggerRight = initial.trigger_right;
		if (typeof initial.replacement === 'string') this.replacement = initial.replacement;
		if (initial.priority !== undefined) this.priority = initial.priority;
		if (initial.description !== undefined) this.description = initial.description;
		if (initial.enabled !== undefined) this.enabled = initial.enabled;
	}

	onOpen() {
		const { contentEl } = this;
		const title = this.mode === 'create'
			? locale.settings.ruleEditModal.addTitle
			: locale.settings.ruleEditModal.editTitle;
		contentEl.createEl('h2', { text: title });

		// Type dropdown
		new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldType)
			.addDropdown(dropdown => {
				dropdown.addOption(EngineRuleType.Input, locale.dropdownOptions.ruleTypeInput);
				dropdown.addOption(EngineRuleType.Delete, locale.dropdownOptions.ruleTypeDelete);
				dropdown.addOption(EngineRuleType.SelectKey, locale.dropdownOptions.ruleTypeSelectKey);
				dropdown.setValue(this.ruleType);
				dropdown.onChange((v: string) => {
					this.ruleType = v as EngineRuleType;
					this.refreshVisibility(contentEl);
				});
			});

		// Trigger Mode
		new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldTriggerMode)
			.addDropdown(dropdown => {
				dropdown.addOption(RuleTriggerMode.Auto, locale.dropdownOptions.triggerModeAuto);
				dropdown.addOption(RuleTriggerMode.Tab, locale.dropdownOptions.triggerModeTab);
				dropdown.setValue(this.triggerMode);
				dropdown.onChange((v: string) => this.triggerMode = v as RuleTriggerMode);
			});

		// Trigger
		new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldTrigger)
			.addText(text => {
				text.setValue(this.trigger);
				text.onChange(v => this.trigger = v);
			});

		// Trigger Right (hidden for SelectKey)
		const triggerRightSetting = new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldTriggerRight)
			.addText(text => {
				text.setValue(this.triggerRight);
				text.onChange(v => this.triggerRight = v);
			});
		triggerRightSetting.settingEl.dataset.field = 'triggerRight';

		// Replacement (textarea for string mode)
		const replacementSetting = new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldReplacement);
		replacementSetting.settingEl.setAttribute('style', 'display: grid; grid-template-columns: 1fr;');
		replacementSetting.settingEl.dataset.field = 'replacementTextarea';
		const replacementArea = new TextAreaComponent(replacementSetting.controlEl);
		replacementArea.inputEl.setAttribute('style', 'width: 100%; min-height: 60px;');
		replacementArea.setValue(this.replacement);
		replacementArea.onChange(v => this.replacement = v);

		// CM6 editor for function mode (syntax highlighted)
		const editorWrapper = contentEl.createDiv();
		editorWrapper.dataset.field = 'fnEditor';
		editorWrapper.createEl('label', {
			text: locale.settings.ruleEditModal.fieldReplacement,
			cls: 'et-fn-editor-label',
		});
		const editorContainer = editorWrapper.createDiv({ cls: 'et-fn-editor-container' });
		this.cmEditor = createJSEditorView(editorContainer, this.replacement, (value) => {
			this.replacement = value;
		});

		// Function hint (visible only in function mode)
		const fnHint = contentEl.createEl('div', {
			cls: 'setting-item-description',
			text: '',
		});
		fnHint.dataset.field = 'fnHint';
		fnHint.style.marginTop = '-10px';
		fnHint.style.marginBottom = '10px';
		fnHint.style.fontSize = '12px';
		fnHint.style.fontFamily = 'var(--font-monospace)';

		// Is Regex
		new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldIsRegex)
			.addToggle(toggle => {
				toggle.setValue(this.isRegex);
				toggle.onChange(v => this.isRegex = v);
			});

		// Is Function
		const fnSetting = new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldIsFunction)
			.addToggle(toggle => {
				toggle.setValue(this.isFunction);
				toggle.onChange(v => {
					this.isFunction = v;
					this.refreshVisibility(contentEl);
				});
			});
		fnSetting.settingEl.dataset.field = 'isFunction';

		// Scope
		new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldScope)
			.addDropdown(dropdown => {
				dropdown.addOption(RuleScope.All, locale.dropdownOptions.scopeAll);
				dropdown.addOption(RuleScope.Text, locale.dropdownOptions.scopeText);
				dropdown.addOption(RuleScope.Formula, locale.dropdownOptions.scopeFormula);
				dropdown.addOption(RuleScope.Code, locale.dropdownOptions.scopeCode);
				dropdown.setValue(this.ruleScope);
				dropdown.onChange((v: string) => this.ruleScope = v as RuleScope);
			});

		// Priority
		new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldPriority)
			.addText(text => {
				text.setValue(String(this.priority));
				text.inputEl.type = 'number';
				text.onChange(v => {
					const n = parseInt(v);
					if (!isNaN(n)) this.priority = n;
				});
			});

		// Description
		new Setting(contentEl)
			.setName(locale.settings.ruleEditModal.fieldDescription)
			.addText(text => {
				text.setValue(this.description);
				text.onChange(v => this.description = v);
			});

		// Save button
		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText(locale.settings.ruleEditModal.buttonSave)
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(this.buildSimpleRule());
					});
			});

		this.refreshVisibility(contentEl);
	}

	refreshVisibility(contentEl: HTMLElement) {
		const triggerRightEl = contentEl.querySelector('[data-field="triggerRight"]') as HTMLElement;
		if (triggerRightEl) {
			triggerRightEl.style.display = this.ruleType === EngineRuleType.SelectKey ? 'none' : '';
		}

		// Function hint
		const fnHint = contentEl.querySelector('[data-field="fnHint"]') as HTMLElement;
		if (fnHint) {
			fnHint.style.display = this.isFunction ? '' : 'none';
			fnHint.textContent = this.ruleType === EngineRuleType.SelectKey
				? locale.settings.ruleEditModal.functionHintSelectKey
				: locale.settings.ruleEditModal.functionHintInputDelete;
		}

		// Toggle between textarea and CM6 editor
		const textareaSetting = contentEl.querySelector('[data-field="replacementTextarea"]') as HTMLElement;
		const editorSetting = contentEl.querySelector('[data-field="fnEditor"]') as HTMLElement;
		if (textareaSetting && editorSetting) {
			if (this.isFunction) {
				textareaSetting.style.display = 'none';
				editorSetting.style.display = '';
				// Sync value to CM6 editor
				if (this.cmEditor) {
					const current = this.cmEditor.state.doc.toString();
					if (current !== this.replacement) {
						this.cmEditor.dispatch({
							changes: { from: 0, to: current.length, insert: this.replacement }
						});
					}
				}
			} else {
				textareaSetting.style.display = '';
				editorSetting.style.display = 'none';
				// Sync value to textarea
				const textarea = textareaSetting.querySelector('textarea') as HTMLTextAreaElement;
				if (textarea && textarea.value !== this.replacement) {
					textarea.value = this.replacement;
				}
			}
		}
	}

	buildSimpleRule(): SimpleRule {
		let options = '';
		if (this.ruleType === EngineRuleType.Delete) options += 'd';
		else if (this.ruleType === EngineRuleType.SelectKey) options += 's';
		if (this.triggerMode === RuleTriggerMode.Tab) options += 'T';
		if (this.isRegex) options += 'r';
		if (this.isFunction) options += 'F';
		if (this.ruleScope === RuleScope.Text) options += 't';
		else if (this.ruleScope === RuleScope.Formula) options += 'f';
		else if (this.ruleScope === RuleScope.Code) options += 'c';

		return {
			trigger: this.trigger,
			trigger_right: this.triggerRight || undefined,
			replacement: this.replacement,
			options: options || undefined,
			priority: this.priority,
			description: this.description || undefined,
			enabled: this.enabled,
		};
	}

	onClose() {
		if (this.cmEditor) {
			this.cmEditor.destroy();
			this.cmEditor = null;
		}
		this.contentEl.empty();
	}
}

