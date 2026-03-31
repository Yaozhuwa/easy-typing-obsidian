import { SpaceState, string2SpaceState } from 'src/core';
import { ScriptCategory } from '../formatting/script_category';
import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TextAreaComponent, setIcon } from 'obsidian';
import EasyTypingPlugin from '../main';
import { getLocale } from '../lang/locale';
import { setDebug } from '../utils';
import { RuleEngine, SimpleRule, RuleScope, RuleType as EngineRuleType, RuleTriggerMode } from '../rule_engine';
import { DEFAULT_BUILTIN_RULES } from '../default_rules';
import { StrictLineMode } from './settings_types';
import { RuleEditModal } from './rule_edit_modal';
import { sprintf } from 'sprintf-js';

/** Empty string = default (plugin directory). */
const DEFAULT_PATH_VALUE = '';

type SettingsSection = {
	sectionEl: HTMLElement;
	bodyEl: HTMLElement;
};

class FolderSuggest extends AbstractInputSuggest<string> {
	private defaultLabel: string;
	private onSelectCb: (path: string) => void;

	constructor(app: App, inputEl: HTMLInputElement, defaultLabel: string, onSelect: (path: string) => void) {
		super(app, inputEl);
		this.defaultLabel = defaultLabel;
		this.onSelectCb = onSelect;
	}

	getSuggestions(query: string): string[] {
		const lowerQuery = query.toLowerCase();
		const folders = this.app.vault.getAllFolders()
			.map(f => f.path)
			.filter(p => p.toLowerCase().includes(lowerQuery));
		return [DEFAULT_PATH_VALUE, ...folders];
	}

	renderSuggestion(path: string, el: HTMLElement): void {
		el.setText(path || this.defaultLabel);
	}

	selectSuggestion(path: string, _evt: MouseEvent | KeyboardEvent): void {
		this.setValue(path);
		this.close();
		this.onSelectCb(path);
	}
}

function setAttributes(element: any, attributes: any) {
	for (let key in attributes) {
		element.setAttribute(key, attributes[key]);
	}
}

export class EasyTypingSettingTab extends PluginSettingTab {
	plugin: EasyTypingPlugin;
	// 记住当前激活的 Tab，避免 display() 刷新时重置
	activeTab: string = "edit-enhance";
	// 拖拽状态
	private dragSourceIndex: number | null = null;

	constructor(app: App, plugin: EasyTypingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		const locale = getLocale();

		containerEl.empty();

		const shellEl = containerEl.createDiv({ cls: "et-settings-shell" });

		const heroEl = shellEl.createDiv({ cls: "et-settings-hero" });
		const heroMainEl = heroEl.createDiv({ cls: "et-settings-hero-main" });
		heroMainEl.createEl("h1", { text: locale.headers.main });
		const heroMetaEl = heroMainEl.createDiv({ cls: "et-settings-hero-meta" });
		heroMetaEl.createSpan({ text: locale.headers.githubDetail, cls: "et-settings-hero-label" });
		heroMetaEl.createEl("a", {
			text: "easy-typing-obsidian",
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian",
			cls: "et-settings-hero-link",
		});

		const navEl = shellEl.createEl("nav", {
			cls: "et-settings-nav",
			attr: { role: "tablist", "aria-orientation": "horizontal" },
		});
		const contentEl = shellEl.createEl("div", { cls: "et-settings-content" });

		// 定义 4 个 Tab 页
		const tabs = [
			{ id: "edit-enhance", label: locale.headers.tabs.editEnhance },
			{ id: "auto-format", label: locale.headers.tabs.autoFormat },
			{ id: "builtin-rules", label: locale.headers.tabs.builtinRules },
			{ id: "user-rules", label: locale.headers.tabs.userRules },
			{ id: "other", label: locale.headers.tabs.other },
		];

		const tabPanels: Record<string, HTMLElement> = {};
		const tabButtons: HTMLButtonElement[] = [];
		const activateTab = (tabId: string, focusButton: boolean = false) => {
			this.activeTab = tabId;
			tabs.forEach((tab, index) => {
				const button = tabButtons[index];
				const panel = tabPanels[tab.id];
				const isActive = tab.id === tabId;
				button.toggleClass("et-settings-tab-active", isActive);
				button.setAttribute("aria-selected", isActive ? "true" : "false");
				button.tabIndex = isActive ? 0 : -1;
				panel.toggleClass("et-settings-tab-hidden", !isActive);
				panel.setAttribute("aria-hidden", isActive ? "false" : "true");
				if (focusButton && isActive) {
					button.focus();
				}
			});
		};

		tabs.forEach((tab) => {
			// 创建导航按钮
			const isActive = tab.id === this.activeTab;
			const buttonId = `easy-typing-settings-tab-${tab.id}`;
			const panelId = `easy-typing-settings-panel-${tab.id}`;
			const btn = navEl.createEl("button", {
				cls: `et-settings-tab-btn ${isActive ? "et-settings-tab-active" : ""}`,
				attr: {
					id: buttonId,
					role: "tab",
					type: "button",
					"aria-selected": isActive ? "true" : "false",
					"aria-controls": panelId,
				},
			}) as HTMLButtonElement;
			btn.tabIndex = isActive ? 0 : -1;
			btn.setText(tab.label);
			tabButtons.push(btn);

			// 创建内容面板
			const panel = contentEl.createEl("section", {
				cls: `et-settings-tab-panel ${isActive ? "" : "et-settings-tab-hidden"}`,
				attr: {
					id: panelId,
					role: "tabpanel",
					"data-tab-id": tab.id,
					"aria-labelledby": buttonId,
					"aria-hidden": isActive ? "false" : "true",
				},
			});
			tabPanels[tab.id] = panel;

			// 点击切换 Tab
			btn.addEventListener("click", () => {
				activateTab(tab.id);
			});

			btn.addEventListener("keydown", (evt: KeyboardEvent) => {
				const currentIndex = tabs.findIndex((item) => item.id === tab.id);
				if (currentIndex === -1) return;

				let targetIndex: number | null = null;
				switch (evt.key) {
					case "ArrowRight":
					case "ArrowDown":
						targetIndex = (currentIndex + 1) % tabs.length;
						break;
					case "ArrowLeft":
					case "ArrowUp":
						targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
						break;
					case "Home":
						targetIndex = 0;
						break;
					case "End":
						targetIndex = tabs.length - 1;
						break;
				}

				if (targetIndex !== null) {
					evt.preventDefault();
					activateTab(tabs[targetIndex].id, true);
				}
			});
		});

		// ========== 填充各 Tab 的内容 ==========
		this.buildEditEnhanceTab(tabPanels["edit-enhance"]);
		this.buildAutoFormatTab(tabPanels["auto-format"]);
		this.buildBuiltinRulesSection(tabPanels["builtin-rules"]);
		this.buildUserRulesSection(tabPanels["user-rules"]);
		this.buildOtherTab(tabPanels["other"]);
	}

	private createSection(
		container: HTMLElement,
		title?: string,
		description?: string,
		actionsBuilder?: (actionsEl: HTMLElement) => void,
		extraCls: string = "",
	): SettingsSection {
		const sectionEl = container.createDiv({ cls: `et-settings-section ${extraCls}`.trim() });
		if (title || description || actionsBuilder) {
			const headerEl = sectionEl.createDiv({ cls: "et-settings-section-header" });
			const headingEl = headerEl.createDiv({ cls: "et-settings-section-heading" });
			if (title) {
				headingEl.createEl("h3", { text: title });
			}
			if (description) {
				headingEl.createDiv({ text: description, cls: "et-settings-section-desc setting-item-description" });
			}
			if (actionsBuilder) {
				const actionsEl = headerEl.createDiv({ cls: "et-settings-section-actions" });
				actionsBuilder(actionsEl);
			}
		}

		const bodyEl = sectionEl.createDiv({ cls: "et-settings-section-body" });
		return { sectionEl, bodyEl };
	}

	private setInteractiveDisabled(element: HTMLElement, disabled: boolean): void {
		element.toggleClass("et-settings-disabled", disabled);
		element.setAttribute("aria-disabled", disabled ? "true" : "false");
		element.querySelectorAll("button, input, textarea, select").forEach((node) => {
			(node as HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled = disabled;
		});
	}

	// ==================== Tab 1: 编辑增强 ====================
	buildEditEnhanceTab(el: HTMLElement): void {
		const locale = getLocale();
		const section = this.createSection(el, locale.headers.enhancedEditing);

		new Setting(section.bodyEl)
			.setName(locale.settings.codeblockEdit.name)
			.setDesc(locale.settings.codeblockEdit.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BetterCodeEdit)
					.onChange(async (value) => {
						this.plugin.settings.BetterCodeEdit = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(section.bodyEl)
			.setName(locale.settings.backspaceEdit.name)
			.setDesc(locale.settings.backspaceEdit.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BetterBackspace)
					.onChange(async (value) => {
						this.plugin.settings.BetterBackspace = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(section.bodyEl)
			.setName(locale.settings.tabOut.name)
			.setDesc(locale.settings.tabOut.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.Tabout)
					.onChange(async (value) => {
						this.plugin.settings.Tabout = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(section.bodyEl)
			.setName(locale.settings.enhanceModA.name)
			.setDesc(locale.settings.enhanceModA.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.EnhanceModA).onChange(async (value) => {
					this.plugin.settings.EnhanceModA = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(section.bodyEl)
			.setName(locale.settings.smartPaste.name)
			.setDesc(locale.settings.smartPaste.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.SmartPaste)
					.onChange(async (value) => {
						this.plugin.settings.SmartPaste = value;
						await this.plugin.saveSettings();
					});
			});
	}

	// ==================== Tab 2: 自动格式化 ====================
	buildAutoFormatTab(el: HTMLElement): void {
		const locale = getLocale();
		const overviewSection = this.createSection(el, locale.headers.autoformatSetting);

		// 主开关
		new Setting(overviewSection.bodyEl)
			.setName(locale.settings.autoFormatting.name)
			.setDesc(locale.settings.autoFormatting.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.AutoFormat)
					.onChange(async (value) => {
						this.plugin.settings.AutoFormat = value;
						await this.plugin.saveSettings();
						syncAutoFormatState(value);
					});
			});
		const pasteSetting = new Setting(overviewSection.bodyEl)
			.setName(locale.settings.autoFormatPaste.name)
			.setDesc(locale.settings.autoFormatPaste.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.AutoFormatPaste)
					.onChange(async (value) => {
						this.plugin.settings.AutoFormatPaste = value;
						await this.plugin.saveSettings();
					});
			});
		// masterSwitch.settingEl.style.borderBottom = '2px solid var(--color-accent)';
		// masterSwitch.settingEl.style.paddingBottom = '1em';
		// masterSwitch.settingEl.style.marginBottom = '1.5em';
		// masterSwitch.nameEl.style.fontWeight = 'bold';
		// masterSwitch.nameEl.style.fontSize = '1.2em';
		// masterSwitch.nameEl.style.color = 'var(--text-accent)';

		const autoCapitalSetting = new Setting(overviewSection.bodyEl)
			.setName(locale.settings.capitalizeFirstLetter.name)
			.setDesc(locale.settings.capitalizeFirstLetter.desc)
			.addToggle((toggle) => {
				toggle.setTooltip(locale.toolTip.switch);
				toggle.setValue(this.plugin.settings.AutoCapital).onChange(async (value) => {
					this.plugin.settings.AutoCapital = value;
					await this.plugin.saveSettings();
				});
			});

		const languageSection = this.createSection(
			el,
			locale.headers.languagePairSection,
			locale.settings.languagePairSpacing.desc,
		);

		// 首先是 自定义语言/符号集
		const scriptListContainer = languageSection.bodyEl.createDiv({ cls: 'et-custom-scripts' });

		// Then Language Pair spacing capsules
		const capsuleContainer = languageSection.bodyEl.createDiv({ cls: 'et-lang-pair-capsules' });

		const renderCapsules = () => {
			capsuleContainer.empty();
			for (let idx = 0; idx < this.plugin.settings.languagePairs.length; idx++) {
				const pair = this.plugin.settings.languagePairs[idx];
				const capsule = capsuleContainer.createSpan({ cls: 'et-lang-pair-capsule' });
				const labelA = locale.scriptCategoryLabels[pair.a] || pair.a;
				const labelB = locale.scriptCategoryLabels[pair.b] || pair.b;
				capsule.createSpan({ text: `${labelA} ↔ ${labelB}` });
				const removeBtn = capsule.createEl('button', {
					cls: 'et-capsule-remove',
					text: '×',
					attr: {
						type: 'button',
						'aria-label': locale.toolTip.removeRule,
					}
				});
				removeBtn.addEventListener('click', async () => {
					this.plugin.settings.languagePairs.splice(idx, 1);
					await this.plugin.saveSettings();
					renderCapsules();
				});
			}
		};

		const renderScripts = () => {
			scriptListContainer.empty();
			for (let i = 0; i < this.plugin.settings.customScriptCategories.length; i++) {
				const cat = this.plugin.settings.customScriptCategories[i];
				const item = new Setting(scriptListContainer);
				item.setName(`${cat.name}  [${cat.pattern}]`);
				item.addExtraButton(btn => {
					btn.setIcon('trash').setTooltip(locale.toolTip.removeRule).onClick(async () => {
						// Also remove any language pairs referencing this custom category
						this.plugin.settings.languagePairs = this.plugin.settings.languagePairs.filter(
							p => p.a !== cat.name && p.b !== cat.name
						);
						this.plugin.settings.customScriptCategories.splice(i, 1);
						await this.plugin.saveSettings();
						renderScripts();
						renderCapsules();
					});
				});
			}
		};

		renderScripts();
		renderCapsules();

		// Add new custom script
		const addScriptRow = new Setting(languageSection.bodyEl);
		addScriptRow.settingEl.addClass('et-inline-form-setting');
		let newScriptName = '';
		let newScriptPattern = '';
		addScriptRow
			.setName(locale.headers.customScriptSection)
			.addText(text => {
				text.setPlaceholder(locale.settings.customScriptCategories.namePlaceholder)
					.onChange(v => { newScriptName = v; });
			})
			.addText(text => {
				text.setPlaceholder(locale.settings.customScriptCategories.patternPlaceholder)
					.onChange(v => { newScriptPattern = v; });
			})
			.addButton(btn => {
				btn.setButtonText('+').onClick(async () => {
					if (!newScriptName.trim() || !newScriptPattern.trim()) return;
					// Validate regex
					try { new RegExp(`[${newScriptPattern}]`); } catch { return; }
					this.plugin.settings.customScriptCategories.push({
						name: newScriptName.trim(),
						pattern: newScriptPattern.trim(),
					});
					await this.plugin.saveSettings();
					renderScripts();
					this.display(); // refresh dropdowns to include new category
				});
			});


		// Add pair row: two dropdowns + add button
		const addRow = languageSection.bodyEl.createDiv({ cls: 'et-pair-selector-row' });
		const allCategories = this.getAllScriptCategories();
		let selectedA = allCategories[0] || '';
		let selectedB = allCategories[1] || '';

		const selectorSetting = new Setting(addRow);
		selectorSetting.settingEl.addClass('et-inline-form-setting');
		selectorSetting
			.setName(locale.headers.addLanguagePair)
			.addDropdown(dd => {
				for (const cat of allCategories) {
					dd.addOption(cat, locale.scriptCategoryLabels[cat] || cat);
				}
				dd.setValue(selectedA);
				dd.onChange(v => { selectedA = v; });
			})
			.addDropdown(dd => {
				for (const cat of allCategories) {
					dd.addOption(cat, locale.scriptCategoryLabels[cat] || cat);
				}
				dd.setValue(selectedB);
				dd.onChange(v => { selectedB = v; });
			})
			.addButton(btn => {
				btn.setButtonText('+').onClick(async () => {
					if (selectedA === selectedB) return;
					// Check for duplicate (A-B or B-A)
					const exists = this.plugin.settings.languagePairs.some(p =>
						(p.a === selectedA && p.b === selectedB) ||
						(p.a === selectedB && p.b === selectedA)
					);
					if (exists) return;
					this.plugin.settings.languagePairs.push({ a: selectedA, b: selectedB });
					await this.plugin.saveSettings();
					renderCapsules();
				});
			});




		// ── 详细设置（行内元素间空格） ──
		const detailSection = this.createSection(el, locale.headers.detailedSetting);

		// 介绍空格策略
		const introDiv = detailSection.bodyEl.createDiv({ cls: 'et-settings-note et-space-strategy-intro setting-item-description' });
		introDiv.innerText = locale.headers.spaceStrategyIntro ||
			"空格策略说明：\n无要求：对相关区块与左右文本没有空格要求。\n软空格：只要求有软空格。\n严格空格：严格添加真实空格。";

		new Setting(detailSection.bodyEl)
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

		new Setting(detailSection.bodyEl)
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

		new Setting(detailSection.bodyEl)
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


		new Setting(detailSection.bodyEl)
			.setName(locale.settings.softSpaceSymbols.leftName)
			.setDesc(locale.settings.softSpaceSymbols.leftDesc)
			.addText(text => {
				text.setValue(this.plugin.settings.SoftSpaceLeftSymbols)
					.onChange(async (value) => {
						this.plugin.settings.SoftSpaceLeftSymbols = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(detailSection.bodyEl)
			.setName(locale.settings.softSpaceSymbols.rightName)
			.setDesc(locale.settings.softSpaceSymbols.rightDesc)
			.addText(text => {
				text.setValue(this.plugin.settings.SoftSpaceRightSymbols)
					.onChange(async (value) => {
						this.plugin.settings.SoftSpaceRightSymbols = value;
						await this.plugin.saveSettings();
					});
			});

		// ── 前缀词典 ──
		const prefixSection = this.createSection(
			el,
			locale.headers.prefixDictSection,
			locale.settings.prefixDictionary.desc,
		);
		const prefixSetting = new Setting(prefixSection.bodyEl);
		prefixSetting.settingEl.addClass('et-setting-full-width');
		const prefixArea = new TextAreaComponent(prefixSetting.controlEl);
		prefixArea.inputEl.addClass('et-settings-textarea', 'et-settings-textarea-compact');
		prefixArea
			.setValue(this.plugin.settings.PrefixDictionary)
			.onChange(async (value) => {
				this.plugin.settings.PrefixDictionary = value;
				this.plugin.saveSettings();
			});


		// 自定义正则区块
		const regexSection = this.createSection(el, locale.headers.customRegexpBlock);
		const regexInfoDiv = regexSection.bodyEl.createDiv({ cls: 'setting-item-description et-settings-section-desc' });
		regexInfoDiv.appendChild(createFragment((frag) => {
			frag.appendText(locale.headers.aboutRegexp.header);
			frag.createEl('a', { text: locale.headers.aboutRegexp.text, href: "https://javascript.ruanyifeng.com/stdlib/regexp.html#" });
		}));

		const regSwitchSetting = new Setting(regexSection.bodyEl)
			.setName(locale.settings.userDefinedRegexpSwitch.name)
			.setDesc(locale.settings.userDefinedRegexpSwitch.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value) => {
					this.plugin.settings.UserDefinedRegSwitch = value;
					await this.plugin.saveSettings();
					syncRegexContentState();
				});
			});

		const regContentAreaSetting = new Setting(regexSection.bodyEl);
		regContentAreaSetting.settingEl.addClass('et-setting-full-width');
		regContentAreaSetting
			.setName(locale.settings.userDefinedRegexp.name)
			.setDesc(locale.settings.userDefinedRegexp.desc);
		const regContentArea = new TextAreaComponent(
			regContentAreaSetting.controlEl
		);

		regContentArea.inputEl.addClass('et-settings-textarea', 'et-settings-textarea-tall');
		regContentArea
			.setValue(this.plugin.settings.UserDefinedRegExp)
			.onChange(async (value) => {
				this.plugin.settings.UserDefinedRegExp = value;
				this.plugin.saveSettings();
			});

		new Setting(regexSection.bodyEl)
			.setName(locale.settings.userRulesRespectUserDefinedRegexBlocks.name)
			.setDesc(locale.settings.userRulesRespectUserDefinedRegexBlocks.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.UserRulesRespectUserDefinedRegexBlocks)
					.onChange(async (value) => {
						this.plugin.settings.UserRulesRespectUserDefinedRegexBlocks = value;
						await this.plugin.saveSettings();
					});
			});

		// 排除文件/文件夹
		const excludeSection = this.createSection(
			el,
			locale.headers.excludeFoldersFiles,
			locale.settings.excludeFoldersFiles.desc,
		);
		const excludeSetting = new Setting(excludeSection.bodyEl);
		excludeSetting.settingEl.addClass('et-setting-full-width');
		excludeSetting
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.ExcludeFiles);
				text.inputEl.addClass('et-settings-textarea');
				text.onChange(async (value) => {
					this.plugin.settings.ExcludeFiles = value;
					this.plugin.saveSettings();
				});
			});

		const advancedSections = [
			languageSection.sectionEl,
			detailSection.sectionEl,
			prefixSection.sectionEl,
			regexSection.sectionEl,
			excludeSection.sectionEl,
		];
		const syncRegexContentState = () => {
			this.setInteractiveDisabled(regContentAreaSetting.settingEl, !this.plugin.settings.AutoFormat || !this.plugin.settings.UserDefinedRegSwitch);
		};
		const syncAutoFormatState = (enabled: boolean) => {
			this.setInteractiveDisabled(pasteSetting.settingEl, !enabled);
			this.setInteractiveDisabled(autoCapitalSetting.settingEl, !enabled);
			advancedSections.forEach(sectionEl => this.setInteractiveDisabled(sectionEl, !enabled));
			this.setInteractiveDisabled(regSwitchSetting.settingEl, !enabled);
			syncRegexContentState();
		};
		syncAutoFormatState(this.plugin.settings.AutoFormat);
	}

	/**
	 * Get all available script categories: built-in + user-defined custom categories.
	 */
	private getAllScriptCategories(): string[] {
		const builtin: string[] = [
			ScriptCategory.Chinese,
			ScriptCategory.Japanese,
			ScriptCategory.Korean,
			ScriptCategory.CJK,
			ScriptCategory.English,
			ScriptCategory.Digit,
			ScriptCategory.Russian,
		];
		const custom = (this.plugin.settings.customScriptCategories || []).map(c => c.name);
		return [...builtin, ...custom];
	}

	// ==================== Tab 3: 内置规则 ====================
	buildBuiltinRulesSection(el: HTMLElement): void {
		const locale = getLocale();
		const section = this.createSection(el, locale.headers.builtinRulesSection, undefined, (actionsEl) => {
			const resetBtn = actionsEl.createEl('button', {
				text: locale.toolTip.resetAllRules,
				cls: 'et-reset-btn et-section-action-btn'
			});
			resetBtn.addEventListener('click', async () => {
				await this.plugin.ruleManager.resetAllBuiltinRules();
				new Notice(locale.toolTip.resetSuccess);
				this.display();
			});
		}, 'et-builtin-rules-section');

		for (const rule of this.plugin.ruleManager.cachedBuiltinRules) {
			this.buildRuleItem(section.bodyEl, rule, true);
		}

		// Deleted built-in rules section
		const deletedIds = this.plugin.settings.deletedBuiltinRuleIds || [];
		if (deletedIds.length > 0) {
			const details = section.bodyEl.createEl('details', { cls: 'et-deleted-rules' });
			details.createEl('summary', { text: `${locale.headers.deletedRulesSection} (${deletedIds.length})` });
			for (const id of deletedIds) {
				const defaultRule = DEFAULT_BUILTIN_RULES.find(r => r.id === id);
				if (!defaultRule) continue;
				const opts = RuleEngine.parseOptions(defaultRule.options);
				const typeLabel = this.getRuleTypeLabel(opts.type);
				const typeCls = this.getRuleTypeCls(opts.type);
				const preview = (defaultRule.id && locale.builtinRuleDescriptions[defaultRule.id])
					|| defaultRule.description
					|| `${RuleEngine.escapeText(defaultRule.trigger, opts.isRegex)} → ${typeof defaultRule.replacement === 'string' ? defaultRule.replacement : '(fn)'}`;
				new Setting(details)
					.setName(createFragment(f => {
						f.createSpan({ cls: `et-rule-type-tag ${typeCls}`, text: typeLabel });
						f.createSpan({ text: preview });
					}))
					.addButton(button => {
						button.setButtonText(locale.toolTip.restoreRule)
							.onClick(async () => {
								await this.plugin.ruleManager.restoreBuiltinRule(id);
								this.display();
							});
					});
			}
		}
	}

	// ==================== Tab 4: 自定义规则 ====================
	buildUserRulesSection(el: HTMLElement): void {
		const locale = getLocale();
		const section = this.createSection(el, locale.headers.userRulesSection, undefined, (actionsEl) => {
			const addBtn = actionsEl.createEl('button', {
				text: '+',
				cls: 'mod-cta et-section-action-btn',
			});
			addBtn.addEventListener('click', () => {
				new RuleEditModal(this.app, 'create', {}, async (rule) => {
					await this.plugin.ruleManager.addUserRule(rule);
					this.display();
				}).open();
			});

			// 导出按钮
			const exportBtn = actionsEl.createEl('button', { cls: 'clickable-icon et-section-icon-btn' });
			exportBtn.setAttribute('aria-label', locale.toolTip.exportRules);
			setIcon(exportBtn, 'arrow-up-from-line');
			exportBtn.addEventListener('click', () => {
				const rules = this.plugin.ruleManager.cachedUserRules;
				if (rules.length === 0) {
					new Notice(locale.toolTip.noRulesToExport);
					return;
				}
				const json = JSON.stringify(rules, null, 2);
				const blob = new Blob([json], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'easy-typing-user-rules.json';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			});

			// 导入按钮
			const importBtn = actionsEl.createEl('button', { cls: 'clickable-icon et-section-icon-btn' });
			importBtn.setAttribute('aria-label', locale.toolTip.importRules);
			setIcon(importBtn, 'arrow-down-to-line');
			importBtn.addEventListener('click', () => {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = '.json';
				input.style.display = 'none';
				input.addEventListener('change', async () => {
					const file = input.files?.[0];
					if (!file) return;
					try {
						const text = await file.text();
						let parsed: any;
						try {
							parsed = JSON.parse(text);
						} catch {
							new Notice(`[EasyTyping] ${locale.toolTip.importInvalidJson}`);
							return;
						}
						if (!Array.isArray(parsed) || parsed.length === 0) {
							new Notice(`[EasyTyping] ${locale.toolTip.importNoRules}`);
							return;
						}
						const { imported, skipped } = await this.plugin.ruleManager.importUserRules(parsed);
						if (imported === 0 && skipped > 0) {
							new Notice(`[EasyTyping] ${locale.toolTip.importNoRules}`);
						} else {
							new Notice(`[EasyTyping] ${sprintf(locale.toolTip.importSuccess, imported, skipped)}`);
						}
						this.display();
					} finally {
						input.remove();
					}
				});
				document.body.appendChild(input);
				input.click();
			});
		}, 'et-user-rules-section');

		this.plugin.ruleManager.cachedUserRules.forEach((rule, index) => {
			this.buildRuleItem(section.bodyEl, rule, false, index);
		});
	}

	buildRuleItem(container: HTMLElement, rule: SimpleRule, isBuiltin: boolean, ruleIndex?: number): void {
		const locale = getLocale();
		const opts = RuleEngine.parseOptions(rule.options);
		const typeLabel = this.getRuleTypeLabel(opts.type);
		const typeCls = this.getRuleTypeCls(opts.type);
		const enabled = rule.enabled !== false;
		const isTab = opts.triggerMode === RuleTriggerMode.Tab;
		const isFn = opts.isFunctionReplacement;
		const scopeBadges = this.getRuleScopeBadges(opts.scope, rule.scope_language, locale);

		let preview: string;
		if (rule.description) {
			preview = rule.description;
		} else {
			const repl = typeof rule.replacement === 'string' ? rule.replacement : '(fn)';
			const renderMatch = (text: string) => RuleEngine.escapeText(text, opts.isRegex);
			preview = `${renderMatch(rule.trigger)}${rule.trigger_right ? ' … ' + renderMatch(rule.trigger_right) : ''} → ${repl}`;
		}

		const setting = new Setting(container)
			.setClass('et-rule-item')
			.setName(createFragment(f => {
				f.createSpan({ cls: `et-rule-type-tag ${typeCls}`, text: typeLabel });
				scopeBadges.forEach((badge) => {
					f.createSpan({ cls: `et-rule-scope-tag ${badge.cls}`, text: badge.text });
				});
				if (opts.type === EngineRuleType.Input) {
					const modeTag = f.createSpan({
						cls: `et-rule-trigger-mode ${isTab ? 'et-trigger-mode-tab' : 'et-trigger-mode-auto'}`,
						text: isTab ? 'Tab' : 'Auto',
					});
					modeTag.setAttribute('aria-label', locale.settings.ruleEditModal.fieldTriggerMode);
					modeTag.addEventListener('click', async (e) => {
						e.stopPropagation();
						const newIsTab = !isTab;
						await this.plugin.ruleManager.updateRuleTriggerMode(rule.id!, isBuiltin, newIsTab);
						this.display();
					});
				}
				if (isFn) {
					f.createSpan({ cls: 'et-rule-type-tag et-rule-type-fn', text: 'Fn' });
				}
				f.createSpan({ cls: 'et-rule-preview-text', text: preview });
			}))
			.addToggle(toggle => {
				toggle.setValue(enabled)
					.setTooltip(locale.toolTip.enableRule)
					.onChange(async (value) => {
						setting.settingEl.style.opacity = value ? "" : "0.5";
						await this.plugin.ruleManager.toggleRuleEnabled(rule.id!, isBuiltin, value);
					});
			})
			.addExtraButton(button => {
				button.setIcon('gear')
					.setTooltip(locale.toolTip.editRule)
					.onClick(() => {
						new RuleEditModal(this.app, 'edit', rule, async (updated) => {
							if (isBuiltin) {
								await this.plugin.ruleManager.updateBuiltinRule(rule.id!, updated);
							} else {
								await this.plugin.ruleManager.updateUserRule(rule.id!, updated);
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
							await this.plugin.ruleManager.deleteBuiltinRule(rule.id!);
						} else {
							await this.plugin.ruleManager.deleteUserRule(rule.id!);
						}
						this.display();
					});
			});

		if (!enabled) {
			setting.settingEl.style.opacity = '0.5';
		}

		// 用户规则：添加拖拽手柄和拖拽事件
		if (!isBuiltin && ruleIndex !== undefined) {
			const el = setting.settingEl;
			el.dataset.ruleIndex = String(ruleIndex);

			// 插入 grip 手柄到 settingEl 最前面
			const handle = el.createDiv({ cls: 'et-rule-drag-handle' });
			setIcon(handle, 'grip-vertical');
			el.prepend(handle);

			handle.draggable = true;

			// 缓存 midY，避免 dragover 每帧调用 getBoundingClientRect
			let cachedMidY = 0;

			handle.addEventListener('dragstart', (e: DragEvent) => {
				this.dragSourceIndex = parseInt(el.dataset.ruleIndex!);
				el.addClass('et-rule-dragging');
				e.dataTransfer!.effectAllowed = 'move';
			});

			handle.addEventListener('dragend', () => {
				this.dragSourceIndex = null;
				el.removeClass('et-rule-dragging');
				el.parentElement?.querySelectorAll('.et-rule-drag-over-top, .et-rule-drag-over-bottom').forEach(
					item => item.removeClass('et-rule-drag-over-top', 'et-rule-drag-over-bottom')
				);
			});

			el.addEventListener('dragenter', () => {
				const rect = el.getBoundingClientRect();
				cachedMidY = rect.top + rect.height / 2;
			});

			el.addEventListener('dragover', (e: DragEvent) => {
				if (this.dragSourceIndex === null) return;
				e.preventDefault();
				e.dataTransfer!.dropEffect = 'move';

				const isTop = e.clientY < cachedMidY;
				const targetCls = isTop ? 'et-rule-drag-over-top' : 'et-rule-drag-over-bottom';
				if (!el.hasClass(targetCls)) {
					el.removeClass('et-rule-drag-over-top', 'et-rule-drag-over-bottom');
					el.addClass(targetCls);
				}
			});

			el.addEventListener('dragleave', () => {
				el.removeClass('et-rule-drag-over-top', 'et-rule-drag-over-bottom');
			});

			el.addEventListener('drop', async (e: DragEvent) => {
				e.preventDefault();
				el.removeClass('et-rule-drag-over-top', 'et-rule-drag-over-bottom');

				const fromIndex = this.dragSourceIndex;
				if (fromIndex === null) return;
				const currentIndex = parseInt(el.dataset.ruleIndex!);

				const dropOnBottom = e.clientY >= cachedMidY;

				// 计算目标位置（splice 后的索引）
				let toIndex: number;
				if (fromIndex < currentIndex) {
					toIndex = dropOnBottom ? currentIndex : currentIndex - 1;
				} else {
					toIndex = dropOnBottom ? currentIndex + 1 : currentIndex;
				}

				if (fromIndex === toIndex) return;

				await this.plugin.ruleManager.reorderUserRule(fromIndex, toIndex);

				// DOM 直接移动，避免全量刷新
				const parent = el.parentElement!;
				const ruleItems = Array.from(parent.querySelectorAll('.et-rule-item[data-rule-index]')) as HTMLElement[];
				const sourceEl = ruleItems[fromIndex];
				if (!sourceEl) return;

				if (toIndex < fromIndex) {
					parent.insertBefore(sourceEl, ruleItems[toIndex]);
				} else {
					const ref = ruleItems[toIndex];
					if (ref.nextSibling) {
						parent.insertBefore(sourceEl, ref.nextSibling);
					} else {
						parent.appendChild(sourceEl);
					}
				}

				// 复用已有数组更新 data-rule-index，无需二次 querySelectorAll
				ruleItems.splice(fromIndex, 1);
				ruleItems.splice(toIndex, 0, sourceEl);
				ruleItems.forEach((item, i) => item.dataset.ruleIndex = String(i));
			});
		}
	}

	private getRuleScopeBadges(
		scopes: RuleScope[],
		scopeLanguage?: string,
		locale = getLocale(),
	): { text: string; cls: string }[] {
		const badges: { text: string; cls: string }[] = [];
		if (scopes.includes(RuleScope.Code)) {
			badges.push({
				text: `<${scopeLanguage || locale.dropdownOptions.scopeCode}>`,
				cls: 'et-rule-scope-code',
			});
		}
		if (scopes.includes(RuleScope.Formula)) {
			badges.push({
				text: 'ƒx',
				cls: 'et-rule-scope-formula',
			});
		}
		return badges;
	}

	getRuleTypeLabel(type: EngineRuleType): string {
		const locale = getLocale();
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
		const locale = getLocale();
		const experimentalSection = this.createSection(el, locale.headers.experimentalFeatures);

		new Setting(experimentalSection.bodyEl)
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

		new Setting(experimentalSection.bodyEl)
			.setName(locale.settings.collapsePersistentEnter.name)
			.setDesc(locale.settings.collapsePersistentEnter.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.CollapsePersistentEnter).onChange(async (value) => {
					this.plugin.settings.CollapsePersistentEnter = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(experimentalSection.bodyEl)
			.setName(locale.settings.fixMicrosoftIME.name)
			.setDesc(locale.settings.fixMicrosoftIME.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.TryFixMSIME).onChange(async (value) => {
					this.plugin.settings.TryFixMSIME = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(experimentalSection.bodyEl)
			.setName(locale.settings.fixMacOSContextMenu.name)
			.setDesc(locale.settings.fixMacOSContextMenu.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.FixMacOSContextMenu).onChange(async (value) => {
					this.plugin.settings.FixMacOSContextMenu = value;
					await this.plugin.saveSettings();
				});
			});

		const miscSection = this.createSection(el);
		new Setting(miscSection.bodyEl)
			.setName(locale.settings.rulesStoragePath.name)
			.setDesc(locale.settings.rulesStoragePath.desc)
			.addText((text) => {
				text.setPlaceholder(locale.settings.rulesStoragePath.defaultOption)
					.setValue(this.plugin.settings.rulesStoragePath);
				new FolderSuggest(
					this.app,
					text.inputEl,
					locale.settings.rulesStoragePath.defaultOption,
					async (path) => {
						this.plugin.settings.rulesStoragePath = path;
						await this.plugin.saveSettings();
						await this.plugin.ruleManager.initRuleEngine();
						this.display();
					},
				);
			})
			.addButton((btn) => {
				btn.setButtonText(locale.settings.rulesStoragePath.migrateButton)
					.setTooltip(locale.settings.rulesStoragePath.migrateDesc)
					.onClick(async () => {
						const oldPath = this.plugin.ruleManager.previousStoragePath;
						const newPath = this.plugin.settings.rulesStoragePath;
						await this.plugin.ruleManager.migrateRulesFiles(oldPath, newPath);
						await this.plugin.ruleManager.initRuleEngine();
						new Notice(locale.settings.rulesStoragePath.migrateSuccess);
						this.display();
					});
			});

		new Setting(miscSection.bodyEl)
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
