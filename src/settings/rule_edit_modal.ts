import { App, Modal, Notice, Setting, TextAreaComponent } from 'obsidian';
import { getLocale } from '../lang/locale';
import { RuleEngine, SimpleRule, RuleType as EngineRuleType, RuleTriggerMode, RuleScope } from '../rule_engine';
import { EditorView, keymap, ViewUpdate, ViewPlugin, Decoration, DecorationSet } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';

// ===== Lightweight JS syntax highlight via ViewPlugin + Decoration =====

const JS_KEYWORDS = new Set([
	'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
	'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'true', 'false',
	'null', 'undefined', 'typeof', 'instanceof', 'in', 'of', 'try', 'catch',
	'finally', 'throw', 'async', 'await',
]);

function tokenizeJS(text: string): { from: number; to: number; cls: string }[] {
	const tokens: { from: number; to: number; cls: string }[] = [];
	let i = 0;
	while (i < text.length) {
		// Line comment
		if (text[i] === '/' && text[i + 1] === '/') {
			const start = i;
			while (i < text.length && text[i] !== '\n') i++;
			tokens.push({ from: start, to: i, cls: 'et-hl-comment' });
			continue;
		}
		// Block comment
		if (text[i] === '/' && text[i + 1] === '*') {
			const start = i;
			i += 2;
			while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
			if (i < text.length - 1) i += 2; else i = text.length;
			tokens.push({ from: start, to: i, cls: 'et-hl-comment' });
			continue;
		}
		// String
		if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
			const quote = text[i];
			const start = i;
			i++;
			while (i < text.length && text[i] !== quote) {
				if (text[i] === '\\') i++;
				i++;
			}
			if (i < text.length) i++;
			tokens.push({ from: start, to: i, cls: 'et-hl-string' });
			continue;
		}
		// Number
		if (/\d/.test(text[i]) && (i === 0 || /[^a-zA-Z_$]/.test(text[i - 1]))) {
			const start = i;
			if (text[i] === '0' && (text[i + 1] === 'x' || text[i + 1] === 'X')) {
				i += 2;
				while (i < text.length && /[0-9a-fA-F]/.test(text[i])) i++;
			} else {
				while (i < text.length && /\d/.test(text[i])) i++;
				if (i < text.length && text[i] === '.') { i++; while (i < text.length && /\d/.test(text[i])) i++; }
			}
			tokens.push({ from: start, to: i, cls: 'et-hl-number' });
			continue;
		}
		// Word (keyword or identifier)
		if (/[a-zA-Z_$]/.test(text[i])) {
			const start = i;
			while (i < text.length && /[a-zA-Z0-9_$]/.test(text[i])) i++;
			if (JS_KEYWORDS.has(text.slice(start, i))) {
				tokens.push({ from: start, to: i, cls: 'et-hl-keyword' });
			}
			continue;
		}
		i++;
	}
	return tokens;
}

const jsHighlightPlugin = ViewPlugin.fromClass(class {
	decorations: DecorationSet;
	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}
	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}
	buildDecorations(view: EditorView): DecorationSet {
		const text = view.state.doc.toString();
		const tokens = tokenizeJS(text);
		const ranges = tokens.map(t => Decoration.mark({ class: t.cls }).range(t.from, t.to));
		return Decoration.set(ranges, true);
	}
}, {
	decorations: v => v.decorations
});

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
			jsHighlightPlugin,
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
	scopeLanguage: string = '';
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
		if (initial.trigger !== undefined) this.trigger = RuleEngine.escapeText(initial.trigger);
		if (initial.trigger_right !== undefined) this.triggerRight = RuleEngine.escapeText(initial.trigger_right);
		if (typeof initial.replacement === 'string') this.replacement = initial.replacement;
		if (initial.priority !== undefined) this.priority = initial.priority;
		if (initial.description !== undefined) this.description = initial.description;
		if (initial.enabled !== undefined) this.enabled = initial.enabled;
		if (initial.scope_language !== undefined) this.scopeLanguage = initial.scope_language;
	}

	onOpen() {
		const { contentEl } = this;
		this.modalEl.addClass('et-rule-edit-modal');
		const locale = getLocale();
		const title = this.mode === 'create'
			? locale.settings.ruleEditModal.addTitle
			: locale.settings.ruleEditModal.editTitle;
		contentEl.createEl('h2', { text: title });

		// ===== Pill Bar: Type & Trigger Mode =====
		const pillBar = contentEl.createDiv({ cls: 'et-pill-bar' });

		pillBar.createEl('span', {
			cls: 'et-pill-group-label',
			text: locale.settings.ruleEditModal.fieldType,
		});

		const typePills: { value: EngineRuleType; label: string }[] = [
			{ value: EngineRuleType.Input, label: locale.dropdownOptions.ruleTypeInput },
			{ value: EngineRuleType.Delete, label: locale.dropdownOptions.ruleTypeDelete },
			{ value: EngineRuleType.SelectKey, label: locale.dropdownOptions.ruleTypeSelectKey },
		];
		for (const { value, label } of typePills) {
			const pill = pillBar.createEl('button', {
				cls: `et-pill${this.ruleType === value ? ' et-pill-active' : ''}`,
				text: label,
			});
			pill.dataset.pillGroup = 'ruleType';
			pill.dataset.pillValue = value;
			pill.addEventListener('click', () => {
				this.ruleType = value;
				this.refreshVisibility(contentEl);
			});
		}

		const triggerModeLabel = pillBar.createEl('span', {
			cls: 'et-pill-group-label',
			text: locale.settings.ruleEditModal.fieldTriggerMode,
		});
		triggerModeLabel.dataset.field = 'triggerModeLabel';

		const triggerModePills: { value: RuleTriggerMode; label: string }[] = [
			{ value: RuleTriggerMode.Auto, label: locale.dropdownOptions.triggerModeAuto },
			{ value: RuleTriggerMode.Tab, label: locale.dropdownOptions.triggerModeTab },
		];
		for (const { value, label } of triggerModePills) {
			const pill = pillBar.createEl('button', {
				cls: `et-pill${this.triggerMode === value ? ' et-pill-active' : ''}`,
				text: label,
			});
			pill.dataset.pillGroup = 'triggerMode';
			pill.dataset.pillValue = value;
			pill.addEventListener('click', () => {
				this.triggerMode = value;
				this.refreshVisibility(contentEl);
			});
		}

		// ===== Group: Match =====
		const matchGroup = contentEl.createDiv({ cls: 'et-modal-group' });
		const matchHeader = matchGroup.createDiv({ cls: 'et-modal-group-header' });
		matchHeader.createEl('span', { cls: 'et-modal-group-title', text: locale.settings.ruleEditModal.groupMatch });
		const regexChip = matchHeader.createEl('button', {
			cls: `et-pill-chip${this.isRegex ? ' et-pill-chip-active' : ''}`,
			text: locale.settings.ruleEditModal.fieldIsRegex,
		});
		regexChip.dataset.field = 'isRegexChip';
		regexChip.addEventListener('click', () => {
			this.isRegex = !this.isRegex;
			this.refreshVisibility(contentEl);
		});

		// Trigger
		const triggerSetting = new Setting(matchGroup)
			.setName(locale.settings.ruleEditModal.fieldTrigger)
			.setDesc('')
			.addText(text => {
				text.setValue(this.trigger);
				text.onChange(v => this.trigger = v);
			});
		triggerSetting.settingEl.dataset.field = 'trigger';

		// Trigger Right (hidden for SelectKey)
		const triggerRightSetting = new Setting(matchGroup)
			.setName(locale.settings.ruleEditModal.fieldTriggerRight)
			.addText(text => {
				text.setValue(this.triggerRight);
				text.onChange(v => this.triggerRight = v);
			});
		triggerRightSetting.settingEl.dataset.field = 'triggerRight';

		// ===== Group: Replacement =====
		const replacementGroup = contentEl.createDiv({ cls: 'et-modal-group' });
		const replHeader = replacementGroup.createDiv({ cls: 'et-modal-group-header' });
		replHeader.createEl('span', { cls: 'et-modal-group-title', text: locale.settings.ruleEditModal.groupReplacement });
		const fnChip = replHeader.createEl('button', {
			cls: `et-pill-chip${this.isFunction ? ' et-pill-chip-active' : ''}`,
			text: locale.settings.ruleEditModal.fieldIsFunction,
		});
		fnChip.dataset.field = 'isFunctionChip';
		fnChip.addEventListener('click', () => {
			this.isFunction = !this.isFunction;
			this.refreshVisibility(contentEl);
		});

		// Replacement (textarea for string mode)
		const replacementSetting = new Setting(replacementGroup)
			.setName(locale.settings.ruleEditModal.fieldReplacement);
		replacementSetting.settingEl.addClass('et-replacement-setting');
		replacementSetting.settingEl.dataset.field = 'replacementTextarea';
		const replacementArea = new TextAreaComponent(replacementSetting.controlEl);
		replacementArea.inputEl.addClass('et-replacement-textarea');
		replacementArea.setValue(this.replacement);
		replacementArea.onChange(v => this.replacement = v);

		// Replacement hint (below textarea, outside the Setting)
		const replacementHint = replacementGroup.createEl('div', {
			cls: 'setting-item-description et-replacement-hint',
			text: '',
		});
		replacementHint.dataset.field = 'replacementHint';

		// CM6 editor for function mode (syntax highlighted)
		const editorWrapper = replacementGroup.createDiv();
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
		const fnHint = replacementGroup.createEl('div', {
			cls: 'setting-item-description et-fn-hint',
			text: '',
		});
		fnHint.dataset.field = 'fnHint';

		// ===== Group: Other =====
		const otherGroup = contentEl.createDiv({ cls: 'et-modal-group' });
		otherGroup.createEl('div', { cls: 'et-modal-group-title', text: locale.settings.ruleEditModal.groupOther });

		// Scope
		new Setting(otherGroup)
			.setName(locale.settings.ruleEditModal.fieldScope)
			.addDropdown(dropdown => {
				dropdown.addOption(RuleScope.All, locale.dropdownOptions.scopeAll);
				dropdown.addOption(RuleScope.Text, locale.dropdownOptions.scopeText);
				dropdown.addOption(RuleScope.Formula, locale.dropdownOptions.scopeFormula);
				dropdown.addOption(RuleScope.Code, locale.dropdownOptions.scopeCode);
				dropdown.setValue(this.ruleScope);
				dropdown.onChange((v: string) => {
					this.ruleScope = v as RuleScope;
					this.refreshVisibility(contentEl);
				});
			});

		// Scope Language (only visible when scope is Code)
		const scopeLangSetting = new Setting(otherGroup)
			.setName(locale.settings.ruleEditModal.fieldScopeLanguage)
			.addText(text => {
				text.setPlaceholder('e.g. python, javascript');
				text.setValue(this.scopeLanguage);
				text.onChange(v => this.scopeLanguage = v.trim().toLowerCase());
			});
		scopeLangSetting.settingEl.dataset.field = 'scopeLanguage';

		// Priority
		new Setting(otherGroup)
			.setName(locale.settings.ruleEditModal.fieldPriority)
			.setDesc(locale.settings.ruleEditModal.fieldPriorityDesc)
			.addText(text => {
				text.setValue(String(this.priority));
				text.inputEl.type = 'number';
				text.onChange(v => {
					const n = parseInt(v);
					if (!isNaN(n)) this.priority = n;
				});
			});

		// Description
		new Setting(otherGroup)
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
						const rule = this.buildSimpleRule();
						const regexError = RuleEngine.validateRegex(rule);
						if (regexError) {
							new Notice(`[EasyTyping] ${locale.settings.ruleEditModal.invalidRegex}: ${regexError}`);
							return;
						}
						this.close();
						this.onSubmit(rule);
					});
			});

		this.refreshVisibility(contentEl);
	}

	refreshVisibility(contentEl: HTMLElement) {
		const locale = getLocale();
		const triggerRightEl = contentEl.querySelector('[data-field="triggerRight"]') as HTMLElement;
		if (triggerRightEl) {
			triggerRightEl.classList.toggle('et-hidden', this.ruleType === EngineRuleType.SelectKey);
		}

		// Trigger Label & Desc
		const triggerEl = contentEl.querySelector('[data-field="trigger"]') as HTMLElement;
		if (triggerEl) {
			const nameEl = triggerEl.querySelector('.setting-item-name');
			if (nameEl) {
				nameEl.textContent = this.ruleType === EngineRuleType.SelectKey
					? locale.settings.ruleEditModal.fieldTriggerSelectKey
					: locale.settings.ruleEditModal.fieldTrigger;
			}
			const descEl = triggerEl.querySelector('.setting-item-description');
			if (descEl) {
				descEl.textContent = this.isRegex ? '' : locale.settings.ruleEditModal.hintTriggerEscape;
			}
		}

		// Update pill active states
		contentEl.querySelectorAll('[data-pill-group="ruleType"]').forEach((el: Element) => {
			el.classList.toggle('et-pill-active', (el as HTMLElement).dataset.pillValue === this.ruleType);
		});

		// Trigger mode label + pills visible only for Input type
		const triggerModeLabel = contentEl.querySelector('[data-field="triggerModeLabel"]') as HTMLElement;
		if (triggerModeLabel) triggerModeLabel.classList.toggle('et-hidden', this.ruleType !== EngineRuleType.Input);
		contentEl.querySelectorAll('[data-pill-group="triggerMode"]').forEach((el: Element) => {
			const htmlEl = el as HTMLElement;
			htmlEl.classList.toggle('et-hidden', this.ruleType !== EngineRuleType.Input);
			htmlEl.classList.toggle('et-pill-active', htmlEl.dataset.pillValue === this.triggerMode);
		});

		// Regex chip state
		const regexChip = contentEl.querySelector('[data-field="isRegexChip"]') as HTMLElement;
		if (regexChip) {
			regexChip.classList.toggle('et-pill-chip-active', this.isRegex);
			regexChip.classList.toggle('et-hidden', this.ruleType === EngineRuleType.SelectKey);
		}

		// Function chip state
		const fnChip = contentEl.querySelector('[data-field="isFunctionChip"]') as HTMLElement;
		if (fnChip) fnChip.classList.toggle('et-pill-chip-active', this.isFunction);

		// Replacement Hint (separate element below textarea)
		const replacementHintEl = contentEl.querySelector('[data-field="replacementHint"]') as HTMLElement;
		if (replacementHintEl) {
			const parts: string[] = [];
			if (this.ruleType === EngineRuleType.SelectKey) {
				parts.push(locale.settings.ruleEditModal.fieldReplacementDescSelectKey);
			} else if (this.isRegex) {
				parts.push(locale.settings.ruleEditModal.fieldReplacementDescInputDelete);
			}
			parts.push(locale.settings.ruleEditModal.hintTabstop);
			replacementHintEl.textContent = parts.join('\n');
			replacementHintEl.classList.toggle('et-hidden', this.isFunction);
		}

		// Function hint
		const fnHint = contentEl.querySelector('[data-field="fnHint"]') as HTMLElement;
		if (fnHint) {
			fnHint.classList.toggle('et-hidden', !this.isFunction);
			const parts: string[] = [];
			if (this.ruleType === EngineRuleType.SelectKey) {
				parts.push(locale.settings.ruleEditModal.functionHintSelectKey);
			} else {
				parts.push(locale.settings.ruleEditModal.functionHintInputDelete);
				if (this.isRegex) {
					parts.push(locale.settings.ruleEditModal.fieldReplacementDescInputDelete);
				}
			}
			parts.push(locale.settings.ruleEditModal.hintTabstop);
			fnHint.textContent = parts.join('\n');
		}

		// Toggle between textarea and CM6 editor
		const textareaSetting = contentEl.querySelector('[data-field="replacementTextarea"]') as HTMLElement;
		const editorSetting = contentEl.querySelector('[data-field="fnEditor"]') as HTMLElement;
		if (textareaSetting && editorSetting) {
			textareaSetting.classList.toggle('et-hidden', this.isFunction);
			editorSetting.classList.toggle('et-hidden', !this.isFunction);
			if (this.isFunction) {
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
				// Sync value to textarea
				const textarea = textareaSetting.querySelector('textarea') as HTMLTextAreaElement;
				if (textarea && textarea.value !== this.replacement) {
					textarea.value = this.replacement;
				}
			}
		}

		// Scope Language only visible when scope is Code
		const scopeLangEl = contentEl.querySelector('[data-field="scopeLanguage"]') as HTMLElement;
		if (scopeLangEl) {
			scopeLangEl.classList.toggle('et-hidden', this.ruleScope !== RuleScope.Code);
		}
	}

	buildSimpleRule(): SimpleRule {
		let options = '';
		if (this.ruleType === EngineRuleType.Delete) options += 'd';
		else if (this.ruleType === EngineRuleType.SelectKey) options += 's';
		if (this.ruleType === EngineRuleType.Input && this.triggerMode === RuleTriggerMode.Tab) options += 'T';
		if (this.isRegex) options += 'r';
		if (this.isFunction) options += 'F';
		if (this.ruleScope === RuleScope.Text) options += 't';
		else if (this.ruleScope === RuleScope.Formula) options += 'f';
		else if (this.ruleScope === RuleScope.Code) options += 'c';

		return {
			trigger: RuleEngine.unescapeText(this.trigger),
			trigger_right: RuleEngine.unescapeText(this.triggerRight) || undefined,
			replacement: this.replacement,
			options: options || undefined,
			priority: this.priority,
			description: this.description || undefined,
			enabled: this.enabled,
			scope_language: (this.ruleScope === RuleScope.Code && this.scopeLanguage) ? this.scopeLanguage : undefined,
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
