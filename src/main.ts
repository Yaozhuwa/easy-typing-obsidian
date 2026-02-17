import {Editor, MarkdownView, Menu, Notice, Platform, Plugin, WorkspaceLeaf} from 'obsidian';
import {Prec} from '@codemirror/state';
import {DEFAULT_SETTINGS, EasyTypingSettings, EasyTypingSettingTab, PairString} from "./settings"
import {EditorView, keymap} from '@codemirror/view';
import {
	setDebug,
	string2pairstring,
} from './utils'
import {LineFormater} from './core'
import { tabstopsStateField } from './tabstops_state_field';
import { RuleEngine } from './rule_engine';
import { RuleManager } from './rule_manager';
import { toggleComment } from './comment_toggle';
import { isCurrentFileExclude as isCurrentFileExcludeFn, formatArticle, formatSelectionOrCurLine, deleteBlankLines, convert2CodeBlock, switchAutoFormatting } from './formatting_commands';
import { PluginContext } from './plugin_context';
import { handleTabDown, handleEnter, handleBackspace, handleShiftEnter, handleModA, goNewLineAfterCurLine, selectBlockInCursor } from './keyboard_handlers';
import { createTransactionFilter, createViewUpdatePlugin, normalPaste } from './cm_extensions';
import { getLocale } from './lang/locale';


export default class EasyTypingPlugin extends Plugin implements PluginContext {
	settings: EasyTypingSettings;
	halfToFullSymbolMap: Map<string, string>;
	Formater: LineFormater;
	CurActiveMarkdown: string;

	compose_begin_pos: number;
	compose_end_pos: number;
	compose_need_handle: boolean;

	onFormatArticle: boolean;
	TaboutPairStrs: PairString[];
	ruleManager: RuleManager;
	get ruleEngine(): RuleEngine { return this.ruleManager.ruleEngine; }


	async onload() {
		await this.loadSettings();
		this.ruleManager = new RuleManager(this.app, this.manifest, this.settings, () => this.saveSettings());
		await this.ruleManager.initRuleEngine();
		this.halfToFullSymbolMap = new Map([
			[".", "。"],
			[",", "，"],
			['?', '？'],
			['!', '！'],
			[':', '：'],
			[';', '；']
		]);

		let TaboutPairStrs = ["【|】", "（|）", "《|》", "\u201C|\u201D", "\u2018|\u2019",
						   "「|」", "『|』", "'|'", "\"|\"", "$$|$$", '$|$', '__|__', '_|_',
							"==|==", "~~|~~", "**|**", '*|*', "[[|]]", '[|]',"{|}", "(|)", "<|>"];
		this.TaboutPairStrs = TaboutPairStrs.map((s:string)=>string2pairstring(s));

		this.CurActiveMarkdown = "";

		this.compose_need_handle = false;

		this.Formater = new LineFormater();

		this.onFormatArticle = false;

		// 确保 settings 已正确加载
		if (!this.settings) {
			console.error('EasyTyping: Settings not loaded properly, using defaults');
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
		}
		
		setDebug(this.settings.debug);

		this.registerEditorExtension([
			createTransactionFilter(this),
			createViewUpdatePlugin(this),
			tabstopsStateField.extension,
		]);


		this.registerEditorExtension(Prec.highest(keymap.of([
			{
				key: "Tab",
				run: (v: EditorView): boolean => handleTabDown(this, v)
			},
			{
				key: "Enter",
				run: (v: EditorView): boolean => handleEnter(this, v)
			},
			{
				key: "Mod-a",
				run: (v: EditorView): boolean => handleModA(this, v)
			},
			{
                key: "Backspace",
                run: (v: EditorView): boolean => {
					if (!this.settings.BetterBackspace) return false;
                    return handleBackspace(v);
                }
            },
			{
				key: "Shift-Enter",
				run: (v: EditorView): boolean => handleShiftEnter(this, v)
			},
		])));

		const locale = getLocale();

		this.addCommand({
			id: "easy-typing-format-article",
			name: locale.commands.formatArticle,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				formatArticle(this, editor, view);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "s"
			}],
		});

		this.addCommand({
			id: "easy-typing-select-block",
			name: locale.commands.selectBlock,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				selectBlockInCursor(this, editor.cm as EditorView);
			},
		});

		this.addCommand({
			id: "easy-typing-format-selection",
			name: locale.commands.formatSelection,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				formatSelectionOrCurLine(this, editor, view);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "l"
			}],
		});

		this.addCommand({
			id: "easy-typing-delete-blank-line",
			name: locale.commands.deleteBlankLine,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				deleteBlankLines(this, editor);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "k"
			}],
		});

		this.addCommand({
			id: "easy-typing-goto-new-line-after-cur-line",
			name: locale.commands.gotoNewLine,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				goNewLineAfterCurLine(this, editor.cm as EditorView);
			},
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
		});

		this.addCommand({
			id: "easy-typing-insert-codeblock",
			name: locale.commands.insertCodeblock,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				convert2CodeBlock(this, editor);
			},
			hotkeys: [{
				modifiers: ['Mod', 'Shift'],
				key: "n"
			}],
		});

		this.addCommand({
			id: "easy-typing-format-switch",
			name: locale.commands.switchAutoformat,
			callback: () => switchAutoFormatting(this),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: "tab"
			}],
		});

		this.addCommand({
			id: "easy-typing-paste-without-format",
			name: locale.commands.pasteWithoutFormat,
			editorCallback: (editor) => normalPaste(editor, this.settings?.debug),
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "v",
				},
			],
		});


		this.addCommand({
			id: "easy-typing-toggle-comment",
			name: locale.commands.toggleComment,
			editorCallback: (editor: Editor, view: MarkdownView) => toggleComment(editor.cm as EditorView),
			hotkeys: [{ modifiers: ["Mod"], key: "/" }],
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EasyTypingSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf) => {
			if (leaf.view.getViewType() == 'markdown') {
				let file = this.app.workspace.getActiveFile();
				if (file != null && this.CurActiveMarkdown != file.path) {
					this.CurActiveMarkdown = file.path;
					if (this.settings?.debug)
						new Notice('new md-file open: ' + file.path)
				}
			}
		}));

		//判断当前是否为MAC系统
		if (Platform.isMacOS && this.settings.FixMacOSContextMenu) {
			// 检测鼠标右键呼出菜单的事件
			this.registerEvent(this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				// console.log('editor-menu', menu, editor, view);
				if (editor.listSelections().length != 1) return;
				let selection = editor.listSelections()[0];
				let selected = editor.getSelection();
				// console.log('selected', selected, selected=='\n');
				// console.log('selection', selection);
				if (selected=='\n')
				{
					editor.setSelection(selection.anchor, selection.anchor);
				}
			}));
		}

		console.log("Easy Typing Plugin loaded.")
	}

	onunload() {
		console.log("Easy Typing Plugin unloaded.")
	}

	getDefaultIndentChar = () => {
		// console.log('useTab, tabSize', this.app.vault.config.useTab, this.app.vault.config.tabSize);
		let useTab = this.app.vault.config.useTab === undefined ? true : false;
		let tabSize = this.app.vault.config.tabSize == undefined ? 4 : this.app.vault.config.tabSize;
		let default_indent = useTab ? '\t' : ' '.repeat(tabSize);
		return default_indent;
	}

	isCurrentFileExclude(): boolean {
		return isCurrentFileExcludeFn(this);
	}

	getEditor = (): Editor | null => {
		let editor = null;
		let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView) {
			editor = markdownView.editor;
		}
		if (editor === null) console.log('can\'t get editor');
		return editor;
	}

	async loadSettings() {
		try {
			const userData = await this.loadData();
			this.settings = Object.assign({}, DEFAULT_SETTINGS, userData || {});
		} catch (error) {
			console.error('EasyTyping: Failed to load settings, using defaults:', error);
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}