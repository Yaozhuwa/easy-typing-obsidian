import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { off } from 'process';

interface MyPluginSettings {
	mySetting: string;
}

enum InlineFlag {inline, notinline};

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	firstCallFileChange: boolean;
	keyCtrlFlag: boolean;
	keySetNotUpdate: Set<string>;
	inputChineseFlag: boolean;

	ChineseEnglishSpace: boolean;
	ChineseNoSpace: boolean;
	inlineCodeSpace: boolean;
	inlineFormulaSpace: boolean;
	EnglishSpace: boolean;
	Capitalization: boolean;

	async onload() {
		console.log('loading plugin：Easy Typing');

		await this.loadSettings();
		this.ChineseEnglishSpace = true;
		this.ChineseNoSpace = true;
		this.inlineCodeSpace = true;
		this.inlineFormulaSpace = true;
		this.EnglishSpace = true;
		this.Capitalization = true;


		this.firstCallFileChange = true;
		this.keyCtrlFlag = false;
		this.inputChineseFlag = false;
		this.keySetNotUpdate = new Set(['Control', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Alt', 'Backspace', 'Escape', 'Delete', 'NumLock']);
		// this.addRibbonIcon('dice', 'Sample Plugin', () => {
		// 	new Notice('This is a notice!');
		// });

		this.addStatusBarItem().setText('Status Bar Text');

		this.addCommand({
			id: 'open-sample-modal',
			name: 'Open Sample Modal',
			// callback: () => {
			// 	console.log('Simple Callback');
			// },
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						new SampleModal(this.app).open();
					}
					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			console.log('codemirror', cm);
		});


		// 'keyup' is better than 'keydown'
		this.registerCodeMirror((codeMirrorEditor: CodeMirror.Editor) => {
			codeMirrorEditor.on('keyup', this.handleKeyUp2);
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

	private readonly handleKeyDown = (editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{
		console.log('=========================')
		console.log('keydown', event.key);

		if(event.key === 'Process')
		{
			this.inputChineseFlag = true;
		}
		if(event.key === 'Control')
		{
			this.keyCtrlFlag = true;
		}
	}

	private handleKeyUp2=(editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{
		// for test and debug
		if(event.key === 'F4')
		{
			let tempString = 'ada. i';

			var reg = /[.;]([\s]*)[a-z]/;
			let find = tempString.search(reg);
			console.log('find:',find);
			let len = tempString.length;
			while(find!=-1)
			{
				let matchstring = tempString.match(reg)[0];
				console.log("match:", matchstring);
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

			return;
		}

		if(event.key === 'Control')
		{
			this.keyCtrlFlag = false;
			return;
		}
		if(this.keyCtrlFlag && event.key === 'z')
		{
			console.log('Find undo, continue!');
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
				console.log("chinese input done!");
				this.inputChineseFlag = false;
			}
			else
			{
				return;
			}
		}

		let cursor = editor.getCursor();
		let line = editor.getLine(cursor.line);
		console.log(line)
		let ret = this.formatLine(line, cursor.ch, this);
		console.log(ret);
		if(ret[0])
		{
			let lineStart:CodeMirror.Position = {ch:0, line:cursor.line};
			editor.replaceRange(ret[1].substring(0, ret[2]), lineStart, cursor);
			editor.setCursor({
				line: cursor.line,
				ch: ret[2]
			});
			editor.focus();
		}
	}

	private readonly handleKeyUp = (editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{
		console.log('keyup: ',event.key, ',coursor: ',editor.getCursor().ch)
		console.log('=========================')
		// editor.
		if(event.key === 'Control')
		{
			this.keyCtrlFlag = false;
			return;
		}
		if(this.inputChineseFlag)
		{
			// 判断中文输入的结束点，检测到数字或者空格就是输入中文结束，Shift是中文输入法输入英文。
			// 匹配,.;'<>是中文输入法的全角字符，。；‘’《》
			if(event.key.match(/[0-9 ,.;<>'\\\/]/gi)!=null || event.key==='Shift')
			{
				console.log("chinese input done!");
				this.inputChineseFlag = false;
			}
			else
			{
				return;
			}
		}
		
		if(this.keyCtrlFlag && event.key === 'z')
		{
			console.log('Find undo, continue!');
			return;
		}
		
		if(event.key==='F4')
		{
			console.log("Test begin======================")
			// let s = editor.getValue()
			// console.log(s);
			// let cursor = editor.getCursor();
			// console.log(cursor)
			// editor.replaceRange('0', cursor)
			// console.log(editor.getCursor())

			let s = '\`\$inlinecode\`\$inlineformula\$ddd';
			let ret = this.getSubStrings(s);
			for(let i=0;i<ret.length;i++)
			{
				console.log(ret[i][0]+ret[i][1])
			}
			console.log('Notinline: ',InlineFlag.notinline)
			console.log("Test end======================")
			return;
		}

		// console.log("Has: ", this.keySetNotUpdate.has(' '));
		if(this.keySetNotUpdate.has(event.key))
		{
			return;
		}
		if (editor.somethingSelected())
		{
			return;
		}
		var cursor = editor.getCursor();
		let line_number = cursor.line
		// let line_string = editor.getLine(line_number)
		let selectSatrt:CodeMirror.Position = {ch:0, line:line_number};
		let selectEnd:CodeMirror.Position = {ch:cursor.ch, line:line_number};
		// console.log("cursor.ch: ",cursor.ch);
		// editor.setSelection(selectSatrt, selectEnd);
		let selectedText = editor.getRange(selectSatrt, selectEnd);
		// console.log("selectedText: ",selectedText);
		let newStr = this.insert_spacing(selectedText);
		newStr = this.handleInlineElement(newStr, '\$')
		newStr = this.handleInlineElement(newStr, '\`')
		// console.log("new string: ",newStr);
		editor.replaceRange(newStr, selectSatrt, selectEnd);
		var cursorOffset = newStr.length - selectedText.length;
		editor.setCursor({
			line: line_number,
			ch: cursor.ch + cursorOffset
		});
		editor.focus();
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

	private formatLine = (line: string, ch: number, plugin: MyPlugin):[boolean, string, number]=>
	{
		let update = false;
		if(line==='' || ch===0)
		{
			return [false, '', 0];
		}

		let subline = line.substring(0, ch);
		if(plugin.Capitalization)
		{
			if(subline.charAt(0).match(/[a-z]/)!=null)
			{
				subline = subline.substring(0,1).toUpperCase() + subline.substring(1);
			}
		}
		let inlineIndexes=plugin.getInlineIndexes(subline);
		subline = plugin.processInlineElements(subline, inlineIndexes);
		console.log("subline after:",subline)
		let subStrings = plugin.getSubStrings(subline);
		subStrings.forEach(element => {
			console.log(element[0], element[1])
		});
		let output = '';
		subStrings.forEach(function(item){
			let tempString = item[0];
			if(item[1]===InlineFlag.notinline)
			{
				if(plugin.ChineseEnglishSpace){
					var reg1=/([A-Za-z0-9,.;?:])([\u4e00-\u9fa5]+)/gi;
					var reg2=/([\u4e00-\u9fa5]+)([A-Za-z0-9])/gi;
					tempString = tempString.replace(reg1, "$1 $2").replace(reg2, "$1 $2");
				}

				if(plugin.ChineseNoSpace)
				{
					var reg=/([\u4e00-\u9fa5，。、；‘’《》]+)(\s+)([\u4e00-\u9fa5，。、；‘’《》]+)/g;
					while(tempString.match(reg)!=null)
					{
						tempString = tempString.replace(reg, "$1$3");
					}
				}

				if(plugin.EnglishSpace)
				{
					var reg = /([,.;?:])([A-Za-z0-9])/gi;
					tempString = tempString.replace(reg, "$1 $2");
				}

				if(plugin.Capitalization)
				{
					var reg = /[.;?。；？]([\s]*)[a-z]/;
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
					
				}
			}
			
			output += tempString;
		});
		
		let len = output.length;
		output += line.substring(ch, line.length);
		if(output!=line)
		{
			update = true;
		}

		return [update, output, len];
	}
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	handleInlineCode(input:string):[boolean, string]{
		let indexes:number[] = [];
		for(let i=0;i<input.length;i++)
		{
			if(input.charAt(i)==='\`'){
				indexes.push(i);
			}
		}
		
		let output = input
		let offset = 0
		let update = false
		while(indexes.length>0)
		{
			let indexStart = indexes[0];
			if(indexStart!=0 && input.charAt(indexStart-1).match(/[A-Za-z0-9\u4e00-\u9fa5,.]/i)!=null)
			{
				update = true;
				output = this.insert_str(output, indexStart+offset, ' ');
				offset++;
			}
			indexes.shift();

			if(indexes.length==0)
			{
				break;
			}
			let indexEnd = indexes[0];
			if(indexEnd!=input.length-1 && input.charAt(indexEnd+1).match(/[A-Za-z0-9\u4e00-\u9fa5]/))
			{
				update = true;
				output = this.insert_str(output, indexEnd+1+offset, ' ');
				offset++;
			}
			indexes.shift();
		}
		return [update, output];
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
			if(this.inlineCodeSpace)
			{
				if(flag===codeFlags[0] && index!=0)
				{
					if(input.charAt(index-1).match(/[A-Za-z0-9\u4e00-\u9fa5,.:]/i)!=null)
					{
						output = this.insert_str(output, index+offset, ' ');
						offset++;
					}
					continue;
				}
				
				if(flag===codeFlags[1] && index!=input.length-1)
				{
					if(input.charAt(index+1).match(/[A-Za-z0-9\u4e00-\u9fa5]/)!=null)
					{
						output = this.insert_str(output, index+1+offset, ' ');
						offset++;
					}
					continue;
				}
			}

			if(this.inlineFormulaSpace)
			{
				if(flag===formulaFlags[0] && index!=0)
				{
					if(input.charAt(index-1).match(/[A-Za-z0-9\u4e00-\u9fa5,.:]/i)!=null)
					{
						output = this.insert_str(output, index+offset, ' ');
						offset++;
					}
					continue;
				}
				
				if(flag===formulaFlags[1] && index!=input.length-1)
				{
					if(input.charAt(index+1).match(/[A-Za-z0-9\u4e00-\u9fa5]/)!=null)
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

	handleInlineElement(input:string, separator:string):string{
		let len = input.length;
		let indexes:number[] = [];
		for(let i=0;i<len;i++)
		{
			if(input.charAt(i)===separator){
				indexes.push(i);
			}
		}
		
		let result = input
		let offset = 0
		while(indexes.length>0)
		{
			let indexStart = indexes[0];
			
			if(indexStart!=0 && input.charAt(indexStart-1).match(/[A-Za-z0-9\u4e00-\u9fa5,.]/i)!=null)
			{
				result = this.insert_str(result, indexStart+offset, ' ');
				offset++;
			}
			indexes.shift();

			if(indexes.length==0)
			{
				break;
			}
			let indexEnd = indexes[0];
			if(indexEnd!=input.length-1 && input.charAt(indexEnd+1).match(/[A-Za-z0-9\u4e00-\u9fa5]/))
			{
				result = this.insert_str(result, indexEnd+1+offset, ' ');
				offset++;
			}
			indexes.shift();
		}
		return result;
	}

	private insert_str = (str: string, index: number, value: string):string|null=>
	{
		if(index<0 || index>=str.length)
			return null;
		
		let s1 = str.substring(0, index);
		let s2 = str.substring(index, str.length);
		return s1+value+s2;
	}

	insert_spacing(str:string):string {
		var p1=/([A-Za-z0-9,.])([\u4e00-\u9fa5]+)/gi;
		var p2=/([\u4e00-\u9fa5,]+)([A-Za-z0-9])/gi;
		// var p4=/([,.])([A-Za-z0-9])/gi;
		var p3=/([\u4e00-\u9fa5，。、；‘’《》]+)(\s+)([\u4e00-\u9fa5，。、；‘’《》]+)/g;
		// var formula1 = /([A-Za-z0-9\u4e00-\u9fa5]+)(\$[^\s]+.*[^\s]+\$)/gi;
		// var formula2 = /(\$[^\s]+.*[^\s]+\$)([A-Za-z0-9\u4e00-\u9fa5]+)/gi;
		return str.replace(p1, "$1 $2").replace(p2, "$1 $2").replace(p3, "$1$3");	
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
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

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('')
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
