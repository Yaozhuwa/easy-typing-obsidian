import { SpaceState, string2SpaceState } from 'src/core';
import { ScriptCategory } from '../formatting/script_category';
import { App, Notice, PluginSettingTab, Setting, TextAreaComponent, setIcon } from 'obsidian';
import EasyTypingPlugin from '../main';
import { getLocale } from '../lang/locale';
import { setDebug } from '../utils';
import { RuleEngine, SimpleRule, RuleType as EngineRuleType, RuleTriggerMode } from '../rule_engine';
import { DEFAULT_BUILTIN_RULES } from '../default_rules';
import { StrictLineMode } from './settings_types';
import { RuleEditModal } from './rule_edit_modal';
import { sprintf } from 'sprintf-js';

function setAttributes(element: any, attributes: any) {
	for (let key in attributes) {
		element.setAttribute(key, attributes[key]);
	}
}

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

		const locale = getLocale();

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
		const locale = getLocale();

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
		// 主开关
		const masterSwitch = new Setting(el)
			.setName(locale.settings.autoFormatting.name)
			.setDesc(locale.settings.autoFormatting.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.AutoFormat)
					.onChange(async (value) => {
						this.plugin.settings.AutoFormat = value;
						await this.plugin.saveSettings();
					});
			});
		// masterSwitch.settingEl.style.borderBottom = '2px solid var(--color-accent)';
		// masterSwitch.settingEl.style.paddingBottom = '1em';
		// masterSwitch.settingEl.style.marginBottom = '1.5em';
		// masterSwitch.nameEl.style.fontWeight = 'bold';
		// masterSwitch.nameEl.style.fontSize = '1.2em';
		// masterSwitch.nameEl.style.color = 'var(--text-accent)';

		new Setting(el)
			.setName(locale.settings.capitalizeFirstLetter.name)
			.setDesc(locale.settings.capitalizeFirstLetter.desc)
			.addToggle((toggle) => {
				toggle.setTooltip(locale.toolTip.switch);
				toggle.setValue(this.plugin.settings.AutoCapital).onChange(async (value) => {
					this.plugin.settings.AutoCapital = value;
					await this.plugin.saveSettings();
				});
			});

		// ── 自定义语言/符号集 与 语言间空格策略 ──
		el.createEl('h3', { text: locale.headers.languagePairSection });
		el.createEl('p', { text: locale.settings.languagePairSpacing.desc, cls: 'setting-item-description' });

		// 首先是 自定义语言/符号集
		const scriptListContainer = el.createDiv({ cls: 'et-custom-scripts', attr: { style: 'margin-bottom: 15px;' } });

		// Then Language Pair spacing capsules
		const capsuleContainer = el.createDiv({ cls: 'et-lang-pair-capsules' });

		const renderCapsules = () => {
			capsuleContainer.empty();
			for (let idx = 0; idx < this.plugin.settings.languagePairs.length; idx++) {
				const pair = this.plugin.settings.languagePairs[idx];
				const capsule = capsuleContainer.createSpan({ cls: 'et-lang-pair-capsule' });
				const labelA = locale.scriptCategoryLabels[pair.a] || pair.a;
				const labelB = locale.scriptCategoryLabels[pair.b] || pair.b;
				capsule.createSpan({ text: `${labelA} ↔ ${labelB}` });
				const removeBtn = capsule.createSpan({ cls: 'et-capsule-remove', text: '×' });
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
		const addScriptRow = new Setting(el);
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
		const addRow = el.createDiv({ cls: 'et-pair-selector-row' });
		const allCategories = this.getAllScriptCategories();
		let selectedA = allCategories[0] || '';
		let selectedB = allCategories[1] || '';

		const selectorSetting = new Setting(addRow);
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
		el.createEl('h3', { text: locale.headers.detailedSetting });

		// 介绍空格策略
		const introDiv = el.createDiv({ cls: 'et-space-strategy-intro setting-item-description' });
		introDiv.setAttribute('style', 'white-space: pre-wrap; margin-bottom: 20px;');
		introDiv.innerText = locale.headers.spaceStrategyIntro ||
			"空格策略说明：\n无要求：对相关区块与左右文本没有空格要求。\n软空格：只要求有软空格。\n严格空格：严格添加真实空格。";

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


		new Setting(el)
			.setName(locale.settings.softSpaceSymbols.leftName)
			.setDesc(locale.settings.softSpaceSymbols.leftDesc)
			.addText(text => {
				text.setValue(this.plugin.settings.SoftSpaceLeftSymbols)
					.onChange(async (value) => {
						this.plugin.settings.SoftSpaceLeftSymbols = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(el)
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
		el.createEl('h3', { text: locale.headers.prefixDictSection });
		const prefixSetting = new Setting(el);
		prefixSetting.settingEl.setAttribute('style', 'display: grid; grid-template-columns: 1fr;');
		prefixSetting
			.setName(locale.settings.prefixDictionary.name)
			.setDesc(locale.settings.prefixDictionary.desc);
		const prefixArea = new TextAreaComponent(prefixSetting.controlEl);
		setAttributes(prefixArea.inputEl, { style: 'margin-top: 8px; width: 100%; height: 12vh;' });
		prefixArea
			.setValue(this.plugin.settings.PrefixDictionary)
			.onChange(async (value) => {
				this.plugin.settings.PrefixDictionary = value;
				this.plugin.saveSettings();
			});


		// 自定义正则区块
		el.createEl('h3', { text: locale.headers.customRegexpBlock });

		const regexInfoDiv = el.createDiv({ cls: 'setting-item-description' });
		regexInfoDiv.style.marginBottom = "10px";
		regexInfoDiv.appendChild(createFragment((frag) => {
			frag.appendText(locale.headers.aboutRegexp.header);
			const a1 = frag.createEl('a', { text: locale.headers.aboutRegexp.text, href: "https://javascript.ruanyifeng.com/stdlib/regexp.html#" });
			frag.createEl('br');
			frag.appendText(locale.headers.instructionsRegexp.header);
			const a2 = frag.createEl('a', { text: locale.headers.instructionsRegexp.text, href: "https://github.com/Yaozhuwa/easy-typing-obsidian/blob/master/UserDefinedRegExp.md" });
		}));

		new Setting(el)
			.setName(locale.settings.userDefinedRegexpSwitch.name)
			.setDesc(locale.settings.userDefinedRegexpSwitch.desc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value) => {
					this.plugin.settings.UserDefinedRegSwitch = value;
					await this.plugin.saveSettings();
				});
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
		const headerEl = el.createDiv({ cls: 'setting-item' });
		const infoEl = headerEl.createDiv({ cls: 'setting-item-info' });
		infoEl.createEl('h3', { text: locale.headers.builtinRulesSection });
		const controlEl = headerEl.createDiv({ cls: 'setting-item-control' });
		const resetBtn = controlEl.createEl('button', {
			text: locale.toolTip.resetAllRules,
			cls: 'et-reset-btn'
		});
		resetBtn.addEventListener('click', async () => {
			await this.plugin.ruleManager.resetAllBuiltinRules();
			new Notice(locale.toolTip.resetSuccess);
			this.display();
		});

		for (const rule of this.plugin.ruleManager.cachedBuiltinRules) {
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
				const preview = (defaultRule.id && locale.builtinRuleDescriptions[defaultRule.id]) || defaultRule.description || `${RuleEngine.escapeText(defaultRule.trigger)} → ${typeof defaultRule.replacement === 'string' ? defaultRule.replacement : '(fn)'}`;
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
		const headerEl = el.createDiv({ cls: 'setting-item' });
		const infoEl = headerEl.createDiv({ cls: 'setting-item-info' });
		infoEl.createEl('h3', { text: locale.headers.userRulesSection });
		const controlEl = headerEl.createDiv({ cls: 'setting-item-control' });
		const addBtn = controlEl.createEl('button', { text: '+' });
		addBtn.addEventListener('click', () => {
			new RuleEditModal(this.app, 'create', {}, async (rule) => {
				await this.plugin.ruleManager.addUserRule(rule);
				this.display();
			}).open();
		});

		// 导出按钮
		const exportBtn = controlEl.createEl('button', { cls: 'clickable-icon' });
		exportBtn.setAttribute('aria-label', locale.toolTip.exportRules);
		setIcon(exportBtn, 'download');
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
		const importBtn = controlEl.createEl('button', { cls: 'clickable-icon' });
		importBtn.setAttribute('aria-label', locale.toolTip.importRules);
		setIcon(importBtn, 'upload');
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

		for (const rule of this.plugin.ruleManager.cachedUserRules) {
			this.buildRuleItem(el, rule, false);
		}
	}

	buildRuleItem(container: HTMLElement, rule: SimpleRule, isBuiltin: boolean): void {
		const locale = getLocale();
		const opts = RuleEngine.parseOptions(rule.options);
		const typeLabel = this.getRuleTypeLabel(opts.type);
		const typeCls = this.getRuleTypeCls(opts.type);
		const enabled = rule.enabled !== false;
		const isTab = opts.triggerMode === RuleTriggerMode.Tab;
		const isFn = opts.isFunctionReplacement;

		let preview: string;
		const localeDesc = rule.id ? locale.builtinRuleDescriptions[rule.id] : undefined;
		if (localeDesc) {
			preview = localeDesc;
		} else if (rule.description) {
			preview = rule.description;
		} else {
			const repl = typeof rule.replacement === 'string' ? rule.replacement : '(fn)';
			preview = `${RuleEngine.escapeText(rule.trigger)}${rule.trigger_right ? ' … ' + RuleEngine.escapeText(rule.trigger_right) : ''} → ${repl}`;
		}
		// Truncate long previews
		if (preview.length > 60) preview = preview.substring(0, 57) + '...';

		const setting = new Setting(container)
			.setClass('et-rule-item')
			.setName(createFragment(f => {
				f.createSpan({ cls: `et-rule-type-tag ${typeCls}`, text: typeLabel });
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
				f.createSpan({ text: preview });
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
