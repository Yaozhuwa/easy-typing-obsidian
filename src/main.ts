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
import { handleTabDown, handleEnter, handleBackspace, handleShiftEnter, handleModA, goNewLineAfterCurLine, selectBlockInCursor, onKeyup } from './keyboard_handlers';
import { createTransactionFilter, createViewUpdatePlugin, normalPaste } from './cm_extensions';


export default class EasyTypingPlugin extends Plugin implements PluginContext {
	settings: EasyTypingSettings;
	halfToFullSymbolMap: Map<string, string>;
	Formater: LineFormater;
	CurActiveMarkdown: string;

	lang: string;

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
			['!', '！']
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
			Prec.highest(EditorView.domEventHandlers({
				"keyup": (event: KeyboardEvent, view: EditorView) => onKeyup(this, event, view)
			})),
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

		this.lang = window.localStorage.getItem('language');
		let command_name_map = this.getCommandNameMap();

		this.addCommand({
			id: "easy-typing-format-article",
			name: command_name_map.get("format_article"),
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
			name: command_name_map.get("select_block"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				selectBlockInCursor(this, editor.cm as EditorView);
			},
		});

		this.addCommand({
			id: "easy-typing-format-selection",
			name: command_name_map.get("format_selection"),
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
			name: command_name_map.get("delete_blank_line"),
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
			name: command_name_map.get("goto_new_line_after_cur_line"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				goNewLineAfterCurLine(this, editor.cm as EditorView);
			},
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
		});

		this.addCommand({
			id: "easy-typing-insert-codeblock",
			name: command_name_map.get("insert_codeblock"),
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
			name: command_name_map.get("switch_autoformat"),
			callback: () => switchAutoFormatting(this),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: "tab"
			}],
		});

		this.addCommand({
			id: "easy-typing-paste-without-format",
			name: command_name_map.get("paste_wo_format"),
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
			name: command_name_map.get("toggle_comment"),
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

	getCommandNameMap(): Map<string, string> {
		const lang = window.localStorage.getItem('language');

		let command_name_map_en = new Map([
			["format_article", "Format current article"],
			["format_selection", "Format selected text or current line"],
			["delete_blank_line", "Delete blank lines of the selected or whole article"],
			["insert_codeblock", "Insert code block w/wo selection"],
			["switch_autoformat", "Switch autoformat"],
			["paste_wo_format", "Paste without format"],
			["toggle_comment", "Toggle comment"],
			["goto_new_line_after_cur_line", "Go to new line after current line"],
			['select_block', "Select current text block"]

		]);

		let command_name_map_zh_TW = new Map([
			["format_article", "格式化全文"],
			["format_selection", "格式化選中部分/當前行"],
			["delete_blank_line", "刪除選中部分/全文的多餘空白行"],
			["insert_codeblock", "插入代碼塊"],
			["switch_autoformat", "切換自動格式化開關"],
			["paste_wo_format", "無格式化粘貼"],
			["toggle_comment", "切換註釋"],
			["goto_new_line_after_cur_line", "跳到當前行後的新行"],
			['select_block', "選擇當前文本塊"]
		]);

		let command_name_map_zh = new Map([
			["format_article", "格式化全文"],
			["format_selection", "格式化选中部分/当前行"],
			["delete_blank_line", "刪除选中部分/全文的多余空白行"],
			["insert_codeblock", "插入代码块"],
			["switch_autoformat", "切换自动格式化开关"],
			["paste_wo_format", "无格式化粘贴"],
			["toggle_comment", "切换注释"],
			["goto_new_line_after_cur_line", "跳到当前行后新行"],
			['select_block', "选择当前文本块"]
		]);

		let command_name_map_ru = new Map([
			["format_article", "Форматировать текущую статью"],
			["format_selection", "Форматировать выделенный текст или текущую строку"],
			["delete_blank_line", "Удалить пустые строки в выделенном или всей статье"],
			["insert_codeblock", "Вставить блок кода с/без выделением"],
			["switch_autoformat", "Переключить автоформатирование"],
			["paste_wo_format", "Вставить без форматирования"],
			["toggle_comment", "Переключить комментарий"],
			["goto_new_line_after_cur_line", "Перейти к новой строке после текущей"],
			['select_block', "Выбрать текущий текстовый блок"]
		]);

		let command_name_map = command_name_map_en;
		if (lang == 'zh') {
			command_name_map = command_name_map_zh;
		}
		else if (lang == 'zh-TW') {
			command_name_map = command_name_map_zh_TW;
		}
		else if (lang == "ru") {
			command_name_map = command_name_map_ru;
		}

		return command_name_map;
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