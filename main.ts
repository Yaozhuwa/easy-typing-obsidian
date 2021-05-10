import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { off } from 'process';

interface MyPluginSettings {
	mySetting: string;
	autoFormatting: boolean;
	ChineseEnglishSpace: boolean;
	ChineseNoSpace: boolean;
	inlineCodeSpace: boolean;
	inlineFormulaSpace: boolean;
	EnglishSpace: boolean;
	Capitalization: boolean;
	braceSpace: boolean;
	numberSpace: boolean;
}

enum InlineFlag {inline, notinline};

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	autoFormatting: true,
	ChineseEnglishSpace: true,
	ChineseNoSpace: true,
	inlineCodeSpace: true,
	inlineFormulaSpace: true,
	EnglishSpace: true,
	Capitalization: true,
	braceSpace: true,
	numberSpace: true
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	firstCallFileChange: boolean;
	keyCtrlFlag: boolean;
	keySetNotUpdate: Set<string>;
	inputChineseFlag: boolean;

	async onload() {
		console.log('loading plugin：Easy Typing');

		await this.loadSettings();

		this.firstCallFileChange = true;
		this.keyCtrlFlag = false;
		this.inputChineseFlag = false;
		this.keySetNotUpdate = new Set(['Control', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Alt', 'Backspace', 'Escape', 'Delete', 'NumLock']);

		this.addCommand({
			id: "easy-typing-format-line",
			name: "format current line",
			callback: () => this.commandFormatLine(),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: "tab"
			}],
		});

		this.addCommand({
			id: "easy-typing-format-note",
			name: "format current note",
			callback: () => this.commandFormatNote(),
			hotkeys: [{
				modifiers: ['Alt'],
				key: "f"
			}],
		});		

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerCodeMirror((codeMirrorEditor: CodeMirror.Editor) => {
			codeMirrorEditor.on('keyup', this.handleKeyUp);
		});

		this.registerCodeMirror((codeMirrorEditor: CodeMirror.Editor) => {
			codeMirrorEditor.on('keydown', this.handleKeyDown);
		});

		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin');
	}


	commandFormatNote()
	{
		let activeLeaf: any = this.app.workspace.activeLeaf;
		let editor = activeLeaf.view.sourceMode.cmEditor as CodeMirror.Editor;
		let lineCount = editor.lineCount();

	}
	commandFormatLine()
	{
		let activeLeaf: any = this.app.workspace.activeLeaf;
		let editor = activeLeaf.view.sourceMode.cmEditor as CodeMirror.Editor;
		let cursor = editor.getCursor();
		let line = editor.getLine(cursor.line);
		let newline = this.formatLine(line, this);
		if(newline!=editor.getLine(cursor.line))
		{
			let lineStart:CodeMirror.Position = {ch:0, line:cursor.line};
			let lineEnd: CodeMirror.Position = {ch:line.length, line:cursor.line};
			editor.replaceRange(newline, lineStart, lineEnd);
		}
	}

	private readonly handleKeyDown = (editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{
		console.log('=========================')
		console.log('keydown:', event.key);

		if(event.key === 'Process')
		{
			this.inputChineseFlag = true;
		}
		if(event.key === 'Control')
		{
			this.keyCtrlFlag = true;
		}
	}

	private handleKeyUp=(editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{

		console.log('=========================')
		console.log('keyup:', event.key);

		// for test and debug
		if(event.key === 'F4')
		{
			console.log("Test Begin========================");
			console.log(this.settings.autoFormatting)
			console.log("Test End========================");
			return;
		}

		if(this.settings.autoFormatting===false)
		{
			return;
		}

		if(event.key === 'Control')
		{
			this.keyCtrlFlag = false;
			return;
		}
		if(this.keyCtrlFlag && event.key === 'z')
		{
			// console.log('Find undo, continue!');
			return;
		}
		if(this.keySetNotUpdate.has(event.key))
		{
			return;
		}
		if (editor.somethingSelected())
		{
			return;
		}

		if(this.inputChineseFlag)
		{
			// 判断中文输入的结束点，检测到数字或者空格就是输入中文结束，Shift是中文输入法输入英文。
			// 匹配,.;'<>是中文输入法的全角字符，。；‘’《》
			if(event.key.match(/[0-9 ,.;<>:'\\\/]/gi)!=null || event.key==='Shift')
			{
				// console.log("chinese input done!");
				this.inputChineseFlag = false;
			}
			else
			{
				return;
			}
		}

		let cursor = editor.getCursor();
		let line = editor.getLine(cursor.line);
		let subLine = line.substring(0, cursor.ch);
		let newSubLine = this.formatLine(subLine, this);

		if(line.substring(0, cursor.ch)!=newSubLine)
		{
			let lineStart:CodeMirror.Position = {ch:0, line:cursor.line};
			editor.replaceRange(newSubLine, lineStart, cursor);
			editor.setCursor({
				line: cursor.line,
				ch: newSubLine.length
			});
			editor.focus();
		}
	}

	private getInlineIndexes=(line:string):[number, string][]=>
	{
		let inlineIndexes:[number, string][] = [];
		let codeFlags = ['codeStart', 'codeEnd'];
		let formulaFlags= ['formulaStart', 'formulaEnd'];
		let codeIndex = 0;
		let formulaIndex = 0;
		for(let i=0;i<line.length;i++)
		{
			if(line.charAt(i)==='\`'){
				inlineIndexes.push([i, codeFlags[codeIndex]]);
				codeIndex = 1 - codeIndex;
			}
			if(line.charAt(i)==='\$')
			{
				if(inlineIndexes[inlineIndexes.length-1][1] === codeFlags[0]){
					continue;
				}
				else{
					inlineIndexes.push([i, formulaFlags[formulaIndex]]);
					formulaIndex = 1 - formulaIndex;
				}
			}
		}
		return inlineIndexes;
	}

	private getSubStrings=(line :string):[string, InlineFlag][]=>
	{
		let subStrings:[string, InlineFlag][] = [];
		let indexVec = this.getInlineIndexes(line);
		if(indexVec.length===0)
		{
			return [[line, InlineFlag.notinline]];
		}
		let start = 0;
		let end = 0;
		for(let i=0;i<=indexVec.length;i++)
		{
			start = end;
			if(i===indexVec.length)
			{
				end = line.length;
			}
			else{
				end = indexVec[i][0]+i%2;
			}
			let s = line.substring(start, end);
			let flag = i%2===0?InlineFlag.notinline:InlineFlag.inline;
			if(s!='')
			{
				subStrings.push([s, flag]);
			}
		}
		return subStrings;
	}

	private formatLine = (line: string, plugin: MyPlugin):string=>
	{		
		let linecopy = line;
		if(linecopy==='')
		{
			return '';
		}

		if(plugin.settings.Capitalization)
		{
			if(linecopy.charAt(0).match(/[a-z]/)!=null)
			{
				linecopy = linecopy.substring(0,1).toUpperCase() + linecopy.substring(1);
			}
		}
		let inlineIndexes=plugin.getInlineIndexes(linecopy);
		linecopy = plugin.processInlineElements(linecopy, inlineIndexes);
		let subStrings = plugin.getSubStrings(linecopy);
		let output = '';
		subStrings.forEach(function(item){
			let tempString = item[0];
			if(item[1]===InlineFlag.notinline)
			{
				if(plugin.settings.ChineseEnglishSpace){
					var reg1=/([A-Za-z0-9,.;?:!])([\u4e00-\u9fa5]+)/gi;
					var reg2=/([\u4e00-\u9fa5]+)([A-Za-z0-9])/gi;
					tempString = tempString.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
				}

				if(plugin.settings.ChineseNoSpace)
				{
					var reg=/([\u4e00-\u9fa5，。、；‘’《》]+)(\s+)([\u4e00-\u9fa5，。、；‘’《》]+)/g;
					while(tempString.match(reg)!=null)
					{
						tempString = tempString.replace(reg, "$1$3");
					}
				}

				if(plugin.settings.EnglishSpace)
				{
					var reg1 = /([,.;?:!])([A-Za-z])/gi;
					// var reg2 = /([A-Za-z0-9])(\()/gi;
					tempString = tempString.replace(reg1, "$1 $2");
				}

				if(plugin.settings.Capitalization)
				{
					var reg = /[.;?!。！；？]([\s]*)[a-z]/;
					let find = tempString.search(reg);
					let len = tempString.length;
					while(find!=-1)
					{
						let matchstring = tempString.match(reg)[0];
						find += matchstring.length-1;
						if(find+1<len)
						{
							tempString = tempString.substring(0, find)+tempString.charAt(find).toUpperCase()+tempString.substring(find+1);
						}
						else{
							tempString = tempString.substring(0, find)+tempString.charAt(find).toUpperCase();
						}

						find = tempString.search(reg);
					}

					let pos = -1;
					// 支持ul列表
					if(tempString.search(/\s*- [a-z]/)===0)
					{
						pos = tempString.match(/\s*\- [a-z]/)[0].length-1;
						// console.log("string:", tempString.match(/\s*- [a-z]/)[0],",len:",pos+1);
					}
					// 支持有序列表
					else if(tempString.search(/\s*[0-9]+. [a-z]/)===0)
					{
						pos = tempString.match(/\s*[0-9]+. [a-z]/)[0].length-1;
					}
					// 支持checkbox
					else if(tempString.search(/\s*\- \[[ x]\] [a-z]/)===0)
					{
						pos = tempString.match(/\s*\- \[[ x]\] [a-z]/)[0].length-1;
					}
					if(pos!=-1)
					{
						if(pos+1<len)
						{
							tempString = tempString.substring(0, pos)+tempString.charAt(pos).toUpperCase()+tempString.substring(pos+1);
						}
						else{
							tempString = tempString.substring(0, pos)+tempString.charAt(pos).toUpperCase();
						}
					}
				}

				if(plugin.settings.braceSpace)
				{
					var reg1 = /(\))([A-Za-z0-9\u4e00-\u9fa5]+)/gi;
					var reg2 = /([A-Za-z0-9\u4e00-\u9fa5:,.?']+)(\()/gi;
					tempString = tempString.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
				}

				if(plugin.settings.numberSpace)
				{
					var reg1 = /([A-Za-z,;?:!\]\}])([0-9])/gi;
					var reg2 = /([0-9])([A-Za-z,;?:!\[\{])/gi;
					tempString = tempString.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
				}
			}
			
			output += tempString;
		});
		
		return output;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private processInlineElements(input:string, indexes: [number, string][]):string{
		let codeFlags = ['codeStart', 'codeEnd'];
		let formulaFlags= ['formulaStart', 'formulaEnd'];
	
		let output = input
		let offset = 0
		
		for(let i=0;i<indexes.length;i++)
		{
			let index = indexes[i][0];
			let flag = indexes[i][1];
			if(this.settings.inlineCodeSpace)
			{
				if(flag===codeFlags[0] && index!=0)
				{
					if(input.charAt(index-1).match(/[A-Za-z0-9\u4e00-\u9fa5,.:?'\)\}\]\>\\\|\/]/i)!=null)
					{
						output = this.insert_str(output, index+offset, ' ');
						offset++;
					}
					continue;
				}
				
				if(flag===codeFlags[1] && index!=input.length-1)
				{
					if(input.charAt(index+1).match(/[A-Za-z0-9\u4e00-\u9fa5\(\{\[\<\\\|\/]/)!=null)
					{
						output = this.insert_str(output, index+1+offset, ' ');
						offset++;
					}
					continue;
				}
			}

			if(this.settings.inlineFormulaSpace)
			{
				if(flag===formulaFlags[0])
				{
					if(index!=0 && input.charAt(index-1).match(/[A-Za-z0-9\u4e00-\u9fa5,.:]/i)!=null)
					{
						output = this.insert_str(output, index+offset, ' ');
						offset++;
					}
					continue;
				}
				
				if(flag===formulaFlags[1])
				{
					if(index!=input.length-1 && input.charAt(index+1).match(/[A-Za-z0-9\u4e00-\u9fa5]/)!=null)
					{
						output = this.insert_str(output, index+1+offset, ' ');
						offset++;
					}
					continue;
				}
			}
		}
		return output;
	}

	private insert_str = (str: string, index: number, value: string):string|null=>
	{
		if(index<0 || index>=str.length)
			return null;
		
		let s1 = str.substring(0, index);
		let s2 = str.substring(index, str.length);
		return s1+value+s2;
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		// containerEl.createEl('h2', {text: 'Settings for Easy Typing.'});

		containerEl.createEl('h2', {text: '总开关 (Master Switch)'});

		new Setting(containerEl)
		.setName("Auto formatting")
		.setDesc("是否在编辑文档时自动格式化文本")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.autoFormatting)
			.onChange(async (value)=>{
				this.plugin.settings.autoFormatting = value;
				console.log("AutoFormatting:",value);
				await this.plugin.saveSettings();
			});
		});

		containerEl.createEl('h2', {text: '详细规则开关 (Sub Switch)'});

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
		.setName("Space between English with punctuate")
		.setDesc("在英文文本和标点间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.EnglishSpace).onChange(async (value)=>{
				this.plugin.settings.EnglishSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Capitalize the first letter of every sentence")
		.setDesc("英文每个句首字母大写")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.Capitalization).onChange(async (value)=>{
				this.plugin.settings.Capitalization = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between number and English text")
		.setDesc("数字和英文文本及标点间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.numberSpace).onChange(async (value)=>{
				this.plugin.settings.numberSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between English braces and text")
		.setDesc("在英文小括号和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.braceSpace).onChange(async (value)=>{
				this.plugin.settings.braceSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between inline code and text")
		.setDesc("在行内代码和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.inlineCodeSpace).onChange(async (value)=>{
				this.plugin.settings.inlineCodeSpace = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
		.setName("Space between inline formula and text")
		.setDesc("在行内公式和文本间空格")
		.addToggle((toggle)=>{
			toggle.setValue(this.plugin.settings.inlineFormulaSpace).onChange(async (value)=>{
				this.plugin.settings.inlineFormulaSpace = value;
				await this.plugin.saveSettings();
			});
		});
	}
}
