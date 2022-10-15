import { SpaceState, string2SpaceState } from 'src/core';
import { App, TextComponent, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, WorkspaceLeaf, TextAreaComponent } from 'obsidian';
import EasyTypingPlugin from './main';
import { showString } from './utils';

export interface PairString {
	left: string;
	right: string;
}

export interface ConvertRule {
	before: PairString;
	after: PairString;
}

export enum RuleType {delete= "Delete Rule", convert='Convert Rule'}
export enum WorkMode { OnlyWhenTyping = "typing", Globally = "global" }

export interface EasyTypingSettings {
	SelectionEnhance: boolean;
	IntrinsicSymbolPairs: boolean;
	BaseObEditEnhance: boolean;
	FW2HWEnhance: boolean;
	AutoFormat: boolean;
	ExcludeFiles: string;
	AutoCapital: boolean;
	AutoCapitalMode: WorkMode;
	ChineseEnglishSpace: boolean;
	ChineseNoSpace: boolean;
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
}

export const DEFAULT_SETTINGS: EasyTypingSettings = {
	SelectionEnhance: true,
	IntrinsicSymbolPairs: true,
	BaseObEditEnhance: true,
	FW2HWEnhance: true,

	AutoFormat: true,
	ExcludeFiles: "",
	ChineseEnglishSpace: true,
	ChineseNoSpace: true,
	PunctuationSpace: true,
	AutoCapital: true,
	AutoCapitalMode: WorkMode.OnlyWhenTyping,
	PunctuationSpaceMode: WorkMode.Globally,
	InlineCodeSpaceMode: SpaceState.soft,
	InlineFormulaSpaceMode: SpaceState.soft,
	InlineLinkSpaceMode: SpaceState.soft,
	InlineLinkSmartSpace: true,
	UserDefinedRegSwitch: true,
	UserDefinedRegExp: "{{.*?}}|++\n" +
		"#[\\u4e00-\\u9fa5\\w\\/]+|++\n" +
		"\\[\\!.*?\\][-+]{0,1}|-+\n" +
		"(https?:\\/\\/|ftp:\\/\\/|obsidian:\\/\\/|zotero:\\/\\/|www.)[^\\s（）《》。,，！？;；：“”‘’\\)\\(\\[\\]\\{\\}']+|++",
	debug: false,
	userSelRepRuleTrigger: ["-"],
	userSelRepRuleValue: [{left:"~~", right:"~~"}],
	userDeleteRulesStrList: [["demo|", "|"]],
	userConvertRulesStrList: [[":)|","😀|"]],
	userSelRuleSettingsOpen: true,
	userDelRuleSettingsOpen: true,
	userCvtRuleSettingsOpen: true,
}

export class EasyTypingSettingTab extends PluginSettingTab {
	plugin: EasyTypingPlugin;

	constructor(app: App, plugin: EasyTypingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h1", { text: "Obsidian EasyTyping Plugin" });
		containerEl.createEl("p", { text: "More detail is in Github: " }).createEl("a", {
			text: "easy-typing-obsidian",
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian",
		});

		containerEl.createEl('h2', { text: '增强编辑设置 (Enhanced Editing Setting)' });

		new Setting(containerEl)
			.setName("Symbol auto pair and delete with pair")
			.setDesc("增加多种符号配对输入，配对删除，如《》, “”, 「」, 『』,【】等")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.IntrinsicSymbolPairs)
					.onChange(async (value) => {
						this.plugin.settings.IntrinsicSymbolPairs = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Selection Replace Enhancement")
			.setDesc("选中文本情况下的编辑增强，按￥→$选中的文本$, 按·→`选中的文本`，《 → 《选中的文本》等等")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.SelectionEnhance)
					.onChange(async (value) => {
						this.plugin.settings.SelectionEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Convert successive full width symbol to half width symbol")
			.setDesc("连续输入全角符号转半角，。。→ .，！！→ !， 》》→ >")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.FW2HWEnhance)
					.onChange(async (value) => {
						this.plugin.settings.FW2HWEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Basic symbol input enhance for obsidian")
			.setDesc("Obsidian 的基础输入增强，如【【| → [[|]]，句首的、→ /，句首的》→ >，··| → `|`， `·|` 变成代	码块，￥￥| → $|$")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.BaseObEditEnhance)
					.onChange(async (value) => {
						this.plugin.settings.BaseObEditEnhance = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl('h2', { text: '自定义编辑转换规则 (Customize Edit Convertion Rule)' });
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
		

		containerEl.createEl('h2', { text: '自动格式化设置 (Autoformat Setting)' });

		new Setting(containerEl)
			.setName("Auto formatting when typing")
			.setDesc("是否在编辑文档时自动格式化文本，自动格式化的总开关")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.AutoFormat)
					.onChange(async (value) => {
						this.plugin.settings.AutoFormat = value;
						await this.plugin.saveSettings();
					});
			});
		containerEl.createEl('p', { text: 'Detailed Setting Below' });

		new Setting(containerEl)
			.setName("Space between Chinese and English/number")
			.setDesc("在中文和英文/数字间空格")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseEnglishSpace).onChange(async (value) => {
					this.plugin.settings.ChineseEnglishSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Delete the Space between Chinese characters")
			.setDesc("在中文字符间去除空格")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.ChineseNoSpace).onChange(async (value) => {
					this.plugin.settings.ChineseNoSpace = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Capitalize the first letter of every sentence")
			.setDesc("英文每个句首字母大写")
			.addDropdown((dropdown) => {
				dropdown.addOption(WorkMode.OnlyWhenTyping, "输入时生效(Only When Typing)");
				dropdown.addOption(WorkMode.Globally, "全局生效(Work Globally)");
				dropdown.setValue(this.plugin.settings.AutoCapitalMode);
				dropdown.onChange(async (v: WorkMode.OnlyWhenTyping | WorkMode.Globally) => {
					this.plugin.settings.AutoCapitalMode = v;
					await this.plugin.saveSettings();
				})
			})
			.addToggle((toggle) => {
				toggle.setTooltip("功能开关(Switch)");
				toggle.setValue(this.plugin.settings.AutoCapital).onChange(async (value) => {
					this.plugin.settings.AutoCapital = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Smartly insert space between text and punctuation")
			.setDesc("在文本和标点间添加空格")
			.addDropdown((dropdown) => {
				dropdown.addOption(WorkMode.OnlyWhenTyping, "输入时生效(Only When Typing)");
				dropdown.addOption(WorkMode.Globally, "全局生效(Work Globally)");
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
			.setName("Space stategy between inline code and text")
			.setDesc("在 `行内代码` 和文本间的空格策略。" +
				"无要求：对本类别块与左右文本没有空格的要求，" +
				"软空格：对本类别块与周围区块只要求有软空格，软空格如当前块左边的临近文本为。，；？等全角标点，当前块右边的临近文本为所有全半角标点，" +
				"严格空格：当前块与临近文本之间严格添加空格。"
			)
			.addDropdown((dropdown) => {
				dropdown.addOption(String(SpaceState.none), "无要求(No Require)");
				dropdown.addOption(String(SpaceState.soft), "软空格(Soft Space)");
				dropdown.addOption(String(SpaceState.strict), "严格空格(Strict Space)");
				dropdown.setValue(String(this.plugin.settings.InlineCodeSpaceMode));
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineCodeSpaceMode = string2SpaceState(v);
					await this.plugin.saveSettings();
				})
			});

		new Setting(containerEl)
			.setName("Space stategy between inline formula and text")
			.setDesc("在 $行内公式$ 和文本间的空格策略")
			.addDropdown((dropdown) => {
				dropdown.addOption(String(SpaceState.none), "无要求(No Require)");
				dropdown.addOption(String(SpaceState.soft), "软空格(Soft Space)");
				dropdown.addOption(String(SpaceState.strict), "严格空格(Strict Space)");
				dropdown.setValue(String(this.plugin.settings.InlineFormulaSpaceMode));
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineFormulaSpaceMode = string2SpaceState(v);
					await this.plugin.saveSettings();
				})
			});

		new Setting(containerEl)
			.setName("Space strategy between link and text")
			.setDesc("在 [[wikilink]] [mdlink](...) 和文本间空格策略。智能空格模式下则会考虑该链接块的显示内容（如wiki链接的别名）来与临近文本进行空格。")
			.addDropdown((dropdown) => {
				dropdown.addOption("dummy", "呆空格(dummy)");
				dropdown.addOption("smart", "智能空格(Smart)");
				dropdown.setValue(this.plugin.settings.InlineLinkSmartSpace ? "smart" : "dummy");
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineLinkSmartSpace = v == "smart" ? true : false;
					// new Notice(String(this.plugin.settings.InlineLinkSmartSpace));
					await this.plugin.saveSettings();
				})
			})
			.addDropdown((dropdown) => {
				dropdown.addOption(String(SpaceState.none), "无要求(No Require)");
				dropdown.addOption(String(SpaceState.soft), "软空格(Soft Space)");
				dropdown.addOption(String(SpaceState.strict), "严格空格(Strict Space)");
				dropdown.setValue(String(this.plugin.settings.InlineLinkSpaceMode));
				dropdown.onChange(async (v: string) => {
					this.plugin.settings.InlineLinkSpaceMode = string2SpaceState(v);
					await this.plugin.saveSettings();
				})
			})

		containerEl.createEl('h2', { text: '自定义正则区块 (Custom regular expressions block)' });
		new Setting(containerEl)
			.setName("User Defined RegExp Switch")
			.setDesc("自定义正则表达式开关，匹配到的内容不进行格式化，且可以设置匹配到的内容块与其他内容之间的空格策略")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value) => {
					this.plugin.settings.UserDefinedRegSwitch = value;
					await this.plugin.saveSettings();
				});
			});

		containerEl.createEl("p", { text: "正则表达式相关知识，见 " }).createEl("a", {
			text: "《阮一峰：正则表达式简明教程》",
			href: "https://javascript.ruanyifeng.com/stdlib/regexp.html#",
		});

		containerEl.createEl("p", { text: "正则表达式规则使用说明与示例：" }).createEl("a", {
			text: "自定义正则表达式规则",
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian/blob/master/UserDefinedRegExp.md",
		});

		const regContentAreaSetting = new Setting(containerEl);
		regContentAreaSetting.settingEl.setAttribute(
			"style",
			"display: grid; grid-template-columns: 1fr;"
		);
		regContentAreaSetting
			.setName("User-defined Regular Expression, one expression per line")
			.setDesc(
				"用户自定义正则表达式，匹配到的内容不进行格式化，每行一个表达式，行尾不要随意加空格。" +
				"每行末尾3个字符的固定为|和两个空格策略符号，空格策略符号为-=+，分别代表不要求空格(-)，软空格(=)，严格空格(+)。" +
				"这两个空格策略符号分别为匹配区块的左右两边的空格策略"
			);
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

		containerEl.createEl('h2', { text: '指定文件不自动格式化 (Exclude Folders/Files)' });
		new Setting(containerEl)
			.setName("Exclude Folders/Files")
			.setDesc("This plugin will parse each line as a exlude folder or file. For example: DailyNote/, DailyNote/WeekNotes/, DailyNote/test.md")
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.ExcludeFiles)
					.onChange(async (value) => {
						this.plugin.settings.ExcludeFiles = value;
						this.plugin.saveSettings();
					})
			);

		containerEl.createEl('h2', { text: 'Debug' });
		new Setting(containerEl)
			.setName("Print debug info in console")
			.setDesc("在控制台输出调试信息")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.debug).onChange(async (value) => {
					this.plugin.settings.debug = value;
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
		summary.setText("自定义选中文本编辑增强规则 (Customize Selection Replace Rule)")

        // summary.setHeading().setName("User defined Selection Replace Rule");
        // summary.createDiv("collapser").createDiv("handle");

		const selectionRuleSetting = new Setting(containerEl);
		selectionRuleSetting
			.setName("Selection Replece Rule")

		const replaceRuleTrigger = new TextComponent(selectionRuleSetting.controlEl);
		replaceRuleTrigger.setPlaceholder("Triggr Symbol");

		const replaceLeftString = new TextAreaComponent(selectionRuleSetting.controlEl);
		replaceLeftString.setPlaceholder("New Left Side String");

		const replaceRightString = new TextAreaComponent(selectionRuleSetting.controlEl);
		replaceRightString.setPlaceholder("New Right Side String");

		selectionRuleSetting
			.addButton((button) => {
				button
					.setButtonText("+")
					.setTooltip("Add Rule")
					.onClick(async (buttonEl: any) => {
						let trigger = replaceRuleTrigger.inputEl.value;
						let left = replaceLeftString.inputEl.value;
						let right = replaceRightString.inputEl.value;
						if (trigger && left && right) {
							if(trigger.length>1){
								new Notice("Inlvalid trigger, trigger must be a symbol of length 1");
								return;
							}
							if (this.plugin.addUserSelectionRepRule(trigger, left, right)){
								await this.plugin.saveSettings();
								this.display();
							}
							else{
								new Notice("warning! Trigger " + trigger + " is already exist!")
							}
						}
						else {
							new Notice("missing input");
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
						.setTooltip("Edit rule")
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
						.setTooltip("Remove rule")
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
		summary.setText("自定义删除编辑增强规则 (Customize Delete Rule)")

		const deleteRuleSetting = new Setting(containerEl);
		deleteRuleSetting
			.setName("Delete Rule")
			.setDesc("规则：用|代表光标位置，必须包含光标。 Tips: Using | to indicate the cursor position.")

		const patternBefore = new TextAreaComponent(deleteRuleSetting.controlEl);
		patternBefore.setPlaceholder("Before Delete");

		const patternAfter = new TextAreaComponent(deleteRuleSetting.controlEl);
		patternAfter.setPlaceholder("New Pattern");

		deleteRuleSetting
			.addButton((button) => {
				button
					.setButtonText("+")
					.setTooltip("Add Rule")
					.onClick(async (buttonEl: any) => {
						let before = patternBefore.inputEl.value;
						let after = patternAfter.inputEl.value;
						if (before && after) {
							let regRule = /\|/g;
							if(before.search(regRule)==-1||after.search(regRule)==-1){
								new Notice("Inlvalid trigger, pattern must contain symbol \| which indicate cursor position");
								return;
							}
							else{
								this.plugin.addUserDeleteRule(before, after);
								await this.plugin.saveSettings();
								this.display();
							}
						}
						else {
							new Notice("missing input");
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
						.setTooltip("Edit rule")
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
						.setTooltip("Remove rule")
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
		summary.setText("自定义编辑转换规则 (Customize Convert Rule)")

		const convertRuleSetting = new Setting(containerEl);
		convertRuleSetting
			.setName("Convert Rule")
			.setDesc("规则：用|代表光标位置，必须包含光标。 Tips: Using | to indicate the cursor position.")

		const patternBefore = new TextAreaComponent(convertRuleSetting.controlEl);
		patternBefore.setPlaceholder("Before Convert");

		const patternAfter = new TextAreaComponent(convertRuleSetting.controlEl);
		patternAfter.setPlaceholder("New Pattern");

		convertRuleSetting
			.addButton((button) => {
				button
					.setButtonText("+")
					.setTooltip("Add Rule")
					.onClick(async (buttonEl: any) => {
						let before = patternBefore.inputEl.value;
						let after = patternAfter.inputEl.value;
						if (before && after) {
							let regRule = /\|/g;
							if(before.search(regRule)==-1||after.search(regRule)==-1){
								new Notice("Inlvalid trigger, pattern must contain symbol \| which indicate cursor position");
								return;
							}
							else{
								this.plugin.addUserConvertRule(before, after);
								await this.plugin.saveSettings();
								this.display();
							}
						}
						else {
							new Notice("missing input");
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
						.setTooltip("Edit rule")
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
						.setTooltip("Remove rule")
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

		contentEl.createEl("h1", { text: "Edit Selection Replace Rule" });

		new Setting(contentEl)
			.setName("Trigger")
			.addText((text) => {
				text.setValue(this.trigger);
				text.setDisabled(true);
			})
		
		new Setting(contentEl)
			.setName("Left")
			.addTextArea((text) => {
				text.setValue(this.old_left);
				text.onChange((value) => {
					this.new_left = value
				})
			})
		new Setting(contentEl)
			.setName("Right")
			.addTextArea((text) => {
				text.setValue(this.old_right);
				text.onChange((value) => {
					this.new_right = value
				})
			});


		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Update")
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
			.setName("Old Pattern")
			.addTextArea((text) => {
				text.setValue(this.old_before);
				text.onChange((value) => {
					this.new_before = value
				})
			})
		new Setting(contentEl)
			.setName("New Pattern")
			.addTextArea((text) => {
				text.setValue(this.old_after);
				text.onChange((value) => {
					this.new_after = value
				})
			});


		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Update")
					.setCta()
					.onClick(() => {
						if (this.checkConvertPatternString(this.new_before, this.new_after))
						{
							this.close();
							this.onSubmit(this.new_before, this.new_after);
						}
						else{
							new Notice("Invalid pattern string!");
						}
						
					}));
	}

	checkConvertPatternString(before: string, after:string):boolean{
		let regRule = /\|/g;
		if(before.search(regRule)==-1 || after.search(regRule)==-1) return false;
		return true;
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

