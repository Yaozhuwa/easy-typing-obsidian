import { SpaceState, string2SpaceState } from 'src/core';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Workspace, WorkspaceLeaf, TextAreaComponent} from 'obsidian';
import EasyTypingPlugin from './main' 

export interface PairString {
    left: string;
    right: string;
}

export interface ConvertRule {
    before: PairString;
    after: PairString;
}

export enum WorkMode{ OnlyWhenTyping="typing", Globally="global"}

export interface EasyTypingSettings {
	SelectionEnhance: boolean;
	SymbolAutoPairDelete: boolean;
	BaseObEditEnhance: boolean;
	FW2HWEnhance:boolean;
    AutoFormat: boolean;
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
    debug:boolean;
}

export const DEFAULT_SETTINGS: EasyTypingSettings = {
	SelectionEnhance: true,
	SymbolAutoPairDelete: true,
	BaseObEditEnhance: true,
	FW2HWEnhance:true,

    AutoFormat: true,
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
	UserDefinedRegExp: "{{.*?}}|++\n"+
				"#[\\u4e00-\\u9fa5\\w\\/]+|++\n"+
				"\\[\\!.*?\\][-+]{0,1}|-+\n"+
				"(https?:\\/\\/|ftp:\\/\\/|obsidian:\\/\\/|zotero:\\/\\/|www.)[^\\s（）《》。,，！？;；：“”‘’\\)\\(\\[\\]\\{\\}']+|++",
    debug: false,
}

export class EasyTypingSettingTab extends PluginSettingTab {
	plugin: EasyTypingPlugin;

	constructor(app: App, plugin: EasyTypingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl("h1", { text: "Obsidian EasyTyping Plugin" });
		containerEl.createEl("p", { text: "More detail is in Github: " }).createEl("a", {
			text: "easy-typing-obsidian",
			href: "https://github.com/Yaozhuwa/easy-typing-obsidian",
		  });

		containerEl.createEl('h2', {text: '增强编辑设置 (Enhanced Editing Setting)'});
		
		new Setting(containerEl)
		.setName("Symbol auto pair and delete with pair")
		.setDesc("增加多种符号配对输入，配对删除，如《》, <>, “”, 「」, 『』,【】等")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.SymbolAutoPairDelete)
			.onChange(async (value)=>{
				this.plugin.settings.SymbolAutoPairDelete = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Selection Replace Enhancement")
		.setDesc("选中文本情况下的编辑增强，按￥→$选中的文本$, 按·→`选中的文本`，《 → 《选中的文本》等等")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.SelectionEnhance)
			.onChange(async (value)=>{
				this.plugin.settings.SelectionEnhance = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Convert successive full width symbol to half width symbol")
		.setDesc("连续输入全角符号转半角，。。→ .，！！→ !， 》》→ >")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.FW2HWEnhance)
			.onChange(async (value)=>{
				this.plugin.settings.FW2HWEnhance = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Basic symbol input enhance for obsidian")
		.setDesc("Obsidian 的基础输入增强，如【【| → [[|]]，句首的、→ /，句首的》→ >，··| → `|`， `·|` 变成代	码块，￥￥| → $|$")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.BaseObEditEnhance)
			.onChange(async (value)=>{
				this.plugin.settings.BaseObEditEnhance = value;
				await this.plugin.saveSettings();
			});
		});

		

		
		containerEl.createEl('h2', {text: '自动格式化设置 (Autoformat Setting)'});

		new Setting(containerEl)
		.setName("Auto formatting when typing")
		.setDesc("是否在编辑文档时自动格式化文本，自动格式化的总开关")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.AutoFormat)
			.onChange(async (value)=>{
				this.plugin.settings.AutoFormat = value;
				await this.plugin.saveSettings();
			});
		});
		containerEl.createEl('p', {text: 'Detailed Setting Below'});

		new Setting(containerEl)
		.setName("Space between Chinese and English/number")
		.setDesc("在中文和英文/数字间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.ChineseEnglishSpace).onChange(async (value)=>{
				this.plugin.settings.ChineseEnglishSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Delete the Space between Chinese characters")
		.setDesc("在中文字符间去除空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.ChineseNoSpace).onChange(async (value)=>{
				this.plugin.settings.ChineseNoSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Capitalize the first letter of every sentence")
		.setDesc("英文每个句首字母大写")
		.addDropdown((dropdown)=>{
			dropdown.addOption(WorkMode.OnlyWhenTyping, "输入时生效(Only When Typing)");
			dropdown.addOption(WorkMode.Globally, "全局生效(Work Globally)");
			dropdown.setValue(this.plugin.settings.AutoCapitalMode);
			dropdown.onChange(async (v: WorkMode.OnlyWhenTyping|WorkMode.Globally)=>{
				this.plugin.settings.AutoCapitalMode = v;
				await this.plugin.saveSettings();
			})
		})
		.addToggle((toggle)=>{
			toggle.setTooltip("功能开关(Switch)");
			toggle.setValue(this.plugin.settings.AutoCapital).onChange(async (value)=>{
				this.plugin.settings.AutoCapital = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Smartly insert space between text and punctuation")
		.setDesc("在文本和标点间添加空格")
		.addDropdown((dropdown)=>{
			dropdown.addOption(WorkMode.OnlyWhenTyping, "输入时生效(Only When Typing)");
			dropdown.addOption(WorkMode.Globally, "全局生效(Work Globally)");
			dropdown.setValue(this.plugin.settings.PunctuationSpaceMode);
			dropdown.onChange(async (v: WorkMode.OnlyWhenTyping|WorkMode.Globally)=>{
				this.plugin.settings.PunctuationSpaceMode = v;
				await this.plugin.saveSettings();
			})
		})
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.PunctuationSpace).onChange(async (value)=>{
				this.plugin.settings.PunctuationSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space stategy between inline code and text")
		.setDesc("在 `行内代码` 和文本间的空格策略。" +
				"无要求：对本类别块与左右文本没有空格的要求，"+
				"软空格：对本类别块与周围区块只要求有软空格，软空格如当前块左边的临近文本为。，；？等全角标点，当前块右边的临近文本为所有全半角标点，"+
				"严格空格：当前块与临近文本之间严格添加空格。"
		)
		.addDropdown((dropdown)=>{
			dropdown.addOption(String(SpaceState.none), "无要求(No Require)");
			dropdown.addOption(String(SpaceState.soft), "软空格(Soft Space)");
			dropdown.addOption(String(SpaceState.strict), "严格空格(Strict Space)");
			dropdown.setValue(String(this.plugin.settings.InlineCodeSpaceMode));
			dropdown.onChange(async (v: string)=>{
				this.plugin.settings.InlineCodeSpaceMode = string2SpaceState(v);
				await this.plugin.saveSettings();
			})
		});

		new Setting(containerEl)
		.setName("Space stategy between inline formula and text")
		.setDesc("在 $行内公式$ 和文本间的空格策略")
		.addDropdown((dropdown)=>{
			dropdown.addOption(String(SpaceState.none), "无要求(No Require)");
			dropdown.addOption(String(SpaceState.soft), "软空格(Soft Space)");
			dropdown.addOption(String(SpaceState.strict), "严格空格(Strict Space)");
			dropdown.setValue(String(this.plugin.settings.InlineFormulaSpaceMode));
			dropdown.onChange(async (v: string)=>{
				this.plugin.settings.InlineFormulaSpaceMode = string2SpaceState(v);
				await this.plugin.saveSettings();
			})
		});

		new Setting(containerEl)
		.setName("Space strategy between link and text")
		.setDesc("在 [[wikilink]] [mdlink](...) 和文本间空格策略。智能空格模式下则会考虑该链接块的显示内容（如wiki链接的别名）来与临近文本进行空格。")
		.addDropdown((dropdown)=>{
			dropdown.addOption("dummy", "呆空格(dummy)");
			dropdown.addOption("smart", "智能空格(Smart)");
			dropdown.setValue(this.plugin.settings.InlineLinkSmartSpace?"smart":"dummy");
			dropdown.onChange(async (v: string)=>{
				this.plugin.settings.InlineLinkSmartSpace = v=="smart"?true:false;
				// new Notice(String(this.plugin.settings.InlineLinkSmartSpace));
				await this.plugin.saveSettings();
			})
		})
		.addDropdown((dropdown)=>{
			dropdown.addOption(String(SpaceState.none), "无要求(No Require)");
			dropdown.addOption(String(SpaceState.soft), "软空格(Soft Space)");
			dropdown.addOption(String(SpaceState.strict), "严格空格(Strict Space)");
			dropdown.setValue(String(this.plugin.settings.InlineLinkSpaceMode));
			dropdown.onChange(async (v: string)=>{
				this.plugin.settings.InlineLinkSpaceMode = string2SpaceState(v);
				await this.plugin.saveSettings();
			})
		})

		containerEl.createEl('h2', {text: '自定义正则区块 (Custom regular expressions block)'});
        new Setting(containerEl)
		.setName("User Defined RegExp Switch")
		.setDesc("自定义正则表达式开关，匹配到的内容不进行格式化，且可以设置匹配到的内容块与其他内容之间的空格策略")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.UserDefinedRegSwitch).onChange(async (value)=>{
				this.plugin.settings.UserDefinedRegSwitch = value;
				await this.plugin.saveSettings();
			});
		});

		containerEl.createEl("p", { text: "正则表达式相关知识，见 " }).createEl("a", {
			text: "《阮一峰：正则表达式简明教程》",
			href: "https://javascript.ruanyifeng.com/stdlib/regexp.html#",
		  });

		const regContentAreaSetting = new Setting(containerEl);
		regContentAreaSetting.settingEl.setAttribute(
		"style",
		"display: grid; grid-template-columns: 1fr;"
		);
		regContentAreaSetting
		.setName("User-defined Regular Expression, one expression per line")
		.setDesc(
			"用户自定义正则表达式，匹配到的内容不进行格式化，每行一个表达式，行尾不要随意加空格。"+
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
		
		containerEl.createEl('h2', {text: 'Debug'});
        new Setting(containerEl)
		.setName("Print debug info in console")
		.setDesc("在控制台输出调试信息")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.debug).onChange(async (value)=>{
				this.plugin.settings.debug = value;
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