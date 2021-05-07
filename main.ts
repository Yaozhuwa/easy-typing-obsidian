import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	firstCallFileChange: boolean;
	keySetNotUpdate: Set<string>;


	async onload() {
		console.log('loading plugin：Easy Typing');

		await this.loadSettings();
		this.firstCallFileChange = true;
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

		// better
		// this.registerEvent(
		// 	this.app.metadataCache.on("resolved", this.fileChangedCallBack, this)
		// );

		// 'keyup' is better than 'keydown'
		this.registerCodeMirror((codeMirrorEditor: CodeMirror.Editor) => {
			codeMirrorEditor.on('keyup', this.handleKeyUp);
		});

		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin');
	}

	async fileChangedCallBack(){
		// console.log("call fileChangedCallBack");
		if(this.firstCallFileChange)
		{
			this.firstCallFileChange = false;
			return;
		}
		let activeLeaf:any = this.app.workspace.activeLeaf;
		let editor = activeLeaf.view.sourceMode.cmEditor as CodeMirror.Editor;
		
		if (editor.somethingSelected())
		{
			return;
		}
		var cursor = editor.getCursor();
		let line_number = cursor.line
		// let line_string = editor.getLine(line_number)
		let selection_start:CodeMirror.Position = {ch:0, line:line_number};
		let selection_end:CodeMirror.Position = {ch:cursor.ch, line:line_number};
		// console.log("cursor.ch: ",cursor.ch);
		editor.setSelection(selection_start, selection_end);
		let selectedText = editor.getSelection();
		// console.log("selectedText: ",selectedText);
		let newStr = this.insert_spacing(selectedText);
		editor.replaceSelection(newStr);
		var cursorOffset = newStr.length - selectedText.length;
		editor.setCursor({
			line: line_number,
			ch: cursor.ch + cursorOffset
		});
		editor.focus();
	}

	private readonly handleKeyUp = (editor: CodeMirror.Editor, event: KeyboardEvent):void =>
	{
		console.log(event.key)
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
		editor.setSelection(selectSatrt, selectEnd);
		let selectedText = editor.getSelection();
		// console.log("selectedText: ",selectedText);
		let newStr = this.insert_spacing(selectedText);
		newStr = this.handleInlineElement(newStr, '\$')
		newStr = this.handleInlineElement(newStr, '\`')
		// console.log("new string: ",newStr);
		editor.replaceSelection(newStr);
		var cursorOffset = newStr.length - selectedText.length;
		editor.setCursor({
			line: line_number,
			ch: cursor.ch + cursorOffset
		});
		editor.focus();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		var p3=/([\u4e00-\u9fa5]+) ([\u4e00-\u9fa5]+)/gi;
		// var formula1 = /([A-Za-z0-9\u4e00-\u9fa5]+)(\$[^\s]+.*[^\s]+\$)/gi;
		// var formula2 = /(\$[^\s]+.*[^\s]+\$)([A-Za-z0-9\u4e00-\u9fa5]+)/gi;
		return str.replace(p1, "$1 $2").replace(p2, "$1 $2").replace(p3, "$1$2");

		var p4=/([,.])([A-Za-z0-9])/gi;
		return str.replace(p1, "$1 $2").replace(p2, "$1 $2").replace(p3, "$1$2").replace(p4, "$1 $2");
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
