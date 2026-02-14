import { TabstopSpec } from './tabstop';

// ===== Enums =====

export enum RuleType {
	Input = 'input',
	Delete = 'delete',
	SelectKey = 'selectKey',
}

export enum RuleTriggerMode {
	Auto = 'auto',
	Tab = 'tab',
}

export enum RuleScope {
	Text = 'text',
	Formula = 'formula',
	Code = 'code',
	All = 'all',
}

// ===== Interfaces =====

export interface ConvertRule {
	id: string;
	description: string;
	enabled: boolean;
	type: RuleType;
	triggerMode: RuleTriggerMode;
	triggerKeys?: string[];
	scope: RuleScope[];
	priority: number;
	match: {
		left: string;
		right: string;
		isRegex: boolean;
	};
	replacement: string |
		((leftMatches: string[], rightMatches: string[]) => string | void) |
		((selectionText: string, key: string) => string | void);
}

export interface SimpleRule {
	id?: string;
	trigger: string;
	trigger_right?: string;
	replacement: string |
		((leftMatches: string[], rightMatches: string[]) => string | void) |
		((selectionText: string, key: string) => string | void);
	options?: string;
	enabled?: boolean;
	description?: string;
	priority?: number;
}

export interface TxContext {
	kind: RuleType;
	docText: string;
	selection: { from: number; to: number };
	inserted: string;
	changeType: string;
	scopeHint: RuleScope;
	debug?: boolean;
	key?: string;
}

export interface ApplyResult {
	newText: string;
	cursor: number;
	tabstops: TabstopSpec[];
	matchRange: { from: number; to: number };
}

interface MatchInfo {
	leftMatches: string[];
	rightMatches: string[];
	matchRange: { from: number; to: number };
	selectionText?: string;
	key?: string;
}

// ===== Utilities =====

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== RuleEngine =====

export class RuleEngine {
	private rulesById: Map<string, ConvertRule> = new Map();
	private sortedRules: ConvertRule[] = [];
	private ruleIdCounter: number = 0;

	// ===== Static Utilities =====

	static parseOptions(options: string = ''): {
		type: RuleType;
		triggerMode: RuleTriggerMode;
		isRegex: boolean;
		isFunctionReplacement: boolean;
		scope: RuleScope[];
	} {
		const type = options.includes('d') ? RuleType.Delete
			: options.includes('s') ? RuleType.SelectKey
			: RuleType.Input;

		const triggerMode = options.includes('T') ? RuleTriggerMode.Tab
			: RuleTriggerMode.Auto;

		const isRegex = options.includes('r');

		const isFunctionReplacement = options.includes('F');

		const scope: RuleScope[] = [];
		if (options.includes('a') || (!options.includes('t') && !options.includes('f') && !options.includes('c'))) {
			scope.push(RuleScope.All);
		} else {
			if (options.includes('t')) scope.push(RuleScope.Text);
			if (options.includes('f')) scope.push(RuleScope.Formula);
			if (options.includes('c')) scope.push(RuleScope.Code);
		}

		return { type, triggerMode, isRegex, isFunctionReplacement, scope };
	}

	/**
	 * Convert escape sequences in user-entered text: \n → newline, \t → tab, \r → CR, \\\\ → \\
	 * Strings from TypeScript source already contain real newlines and are unaffected.
	 */
	static unescapeText(text: string): string {
		let result = '';
		for (let i = 0; i < text.length; i++) {
			if (text[i] === '\\' && i + 1 < text.length) {
				switch (text[i + 1]) {
					case 'n': result += '\n'; i++; break;
					case 't': result += '\t'; i++; break;
					case 'r': result += '\r'; i++; break;
					case '\\': result += '\\'; i++; break;
					default: result += text[i]; break;
				}
			} else {
				result += text[i];
			}
		}
		return result;
	}

	static parseTriggerKeys(pattern: string): string[] {
		if (pattern.startsWith('[') && pattern.endsWith(']')) {
			const inner = pattern.slice(1, -1);
			const keys: string[] = [];
			for (let i = 0; i < inner.length; i++) {
				if (inner[i] === '\\' && i + 1 < inner.length) {
					keys.push(inner[i + 1]);
					i++;
				} else {
					keys.push(inner[i]);
				}
			}
			return keys;
		}
		return [pattern];
	}

	static normalizeRule(simple: SimpleRule): Omit<ConvertRule, 'id'> {
		const opts = RuleEngine.parseOptions(simple.options);

		if (opts.type === RuleType.SelectKey) {
			return {
				description: simple.description ?? '',
				enabled: simple.enabled ?? true,
				type: RuleType.SelectKey,
				triggerMode: opts.triggerMode,
				triggerKeys: RuleEngine.parseTriggerKeys(simple.trigger),
				scope: opts.scope,
				priority: simple.priority ?? 100,
				match: { left: '', right: '', isRegex: false },
				replacement: simple.replacement,
			};
		}

		return {
			description: simple.description ?? '',
			enabled: simple.enabled ?? true,
			type: opts.type,
			triggerMode: opts.triggerMode,
			triggerKeys: undefined,
			scope: opts.scope,
			priority: simple.priority ?? 100,
			match: {
				left: simple.trigger,
				right: simple.trigger_right ?? '',
				isRegex: opts.isRegex,
			},
			replacement: simple.replacement,
		};
	}

	// ===== Rule Management =====

	private generateId(): string {
		return `rule-${++this.ruleIdCounter}`;
	}

	private insertSorted(rule: ConvertRule): void {
		let lo = 0, hi = this.sortedRules.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (this.sortedRules[mid].priority <= rule.priority) lo = mid + 1;
			else hi = mid;
		}
		this.sortedRules.splice(lo, 0, rule);
	}

	addRule(rule: Omit<ConvertRule, 'id'> & { id?: string }): string {
		const id = rule.id ?? this.generateId();
		const fullRule: ConvertRule = { ...rule, id };
		this.rulesById.set(id, fullRule);
		this.insertSorted(fullRule);
		return id;
	}

	addSimpleRule(simple: SimpleRule): string {
		const normalized = RuleEngine.normalizeRule(simple);
		return this.addRule({ ...normalized, id: simple.id });
	}

	addSimpleRules(rules: SimpleRule[]): string[] {
		return rules.map(r => this.addSimpleRule(r));
	}

	removeRule(id: string): boolean {
		if (!this.rulesById.has(id)) return false;
		this.rulesById.delete(id);
		const idx = this.sortedRules.findIndex(r => r.id === id);
		if (idx !== -1) this.sortedRules.splice(idx, 1);
		return true;
	}

	updateRule(id: string, patch: Partial<Omit<ConvertRule, 'id'>>): boolean {
		const existing = this.rulesById.get(id);
		if (!existing) return false;

		const priorityChanged = patch.priority !== undefined && patch.priority !== existing.priority;
		Object.assign(existing, patch);

		if (priorityChanged) {
			const idx = this.sortedRules.findIndex(r => r.id === id);
			if (idx !== -1) this.sortedRules.splice(idx, 1);
			this.insertSorted(existing);
		}
		return true;
	}

	setEnabled(id: string, enabled: boolean): void {
		const rule = this.rulesById.get(id);
		if (rule) rule.enabled = enabled;
	}

	getRules(): readonly ConvertRule[] {
		return this.sortedRules;
	}

	getRulesByType(type: RuleType): ConvertRule[] {
		return this.sortedRules.filter(r => r.type === type);
	}

	getRule(id: string): ConvertRule | undefined {
		return this.rulesById.get(id);
	}

	clear(): void {
		this.rulesById.clear();
		this.sortedRules = [];
	}

	loadFromFiles(builtinRules: SimpleRule[], userRules: SimpleRule[]): void {
		this.clear();
		this.addSimpleRules(builtinRules);
		this.addSimpleRules(userRules);
	}

	// ===== Template Expansion =====

	private expandVariables(text: string, match: MatchInfo): string {
		// [[Rn]] → right regex capture group (must come before [[n]])
		text = text.replace(/\[\[R(\d+)\]\]/g, (_, n) => {
			const idx = parseInt(n);
			return match.rightMatches[idx] ?? '';
		});

		// [[n]] → left regex capture group, fallback to right
		text = text.replace(/\[\[(\d+)\]\]/g, (_, n) => {
			const idx = parseInt(n);
			return match.leftMatches[idx] ?? match.rightMatches[idx] ?? '';
		});

		// Standalone ${SELECTION} and ${KEY}
		if (match.selectionText !== undefined) {
			text = text.replace(/\$\{SELECTION\}/g, match.selectionText);
		}
		if (match.key !== undefined) {
			text = text.replace(/\$\{KEY\}/g, match.key);
		}

		return text;
	}

	private findMatchingBrace(text: string, openIdx: number): number {
		let depth = 1;
		for (let i = openIdx + 1; i < text.length; i++) {
			if (text[i] === '{' && i > 0 && text[i - 1] === '$') depth++;
			else if (text[i] === '}') { depth--; if (depth === 0) return i; }
		}
		return -1;
	}

	private parseTabstops(
		text: string,
		baseOffset: number,
		match?: MatchInfo
	): [string, TabstopSpec[]] {
		const tabstops: TabstopSpec[] = [];
		let result = '';
		let i = 0;

		while (i < text.length) {
			if (text[i] === '$') {
				// ${n:default} form
				if (i + 1 < text.length && text[i + 1] === '{') {
					const closeIdx = this.findMatchingBrace(text, i + 1);
					if (closeIdx === -1) { result += text[i]; i++; continue; }

					const inner = text.substring(i + 2, closeIdx);
					const colonIdx = inner.indexOf(':');

					let num: number;
					let defaultVal: string;

					if (colonIdx > -1) {
						num = parseInt(inner.substring(0, colonIdx));
						defaultVal = inner.substring(colonIdx + 1);
						// Expand nested variables in default value
						if (match?.selectionText !== undefined)
							defaultVal = defaultVal.replace(/\$\{SELECTION\}/g, match.selectionText);
						if (match?.key !== undefined)
							defaultVal = defaultVal.replace(/\$\{KEY\}/g, match.key);
					} else {
						num = parseInt(inner);
						defaultVal = '';
					}

					const from = baseOffset + result.length;
					result += defaultVal;
					const to = baseOffset + result.length;
					tabstops.push({ number: num, from, to });
					i = closeIdx + 1;
				}
				// $n form
				else if (i + 1 < text.length && /\d/.test(text[i + 1])) {
					let numStr = '';
					let j = i + 1;
					while (j < text.length && /\d/.test(text[j])) { numStr += text[j]; j++; }
					const num = parseInt(numStr);
					const pos = baseOffset + result.length;
					tabstops.push({ number: num, from: pos, to: pos });
					i = j;
				}
				else { result += text[i]; i++; }
			}
			else { result += text[i]; i++; }
		}

		// Sort by tabstop number ascending ($0 first)
		tabstops.sort((a, b) => a.number - b.number);

		return [result, tabstops];
	}

	// ===== Rule Execution =====

	process(ctx: TxContext): ApplyResult | null {
		for (const rule of this.sortedRules) {
			if (!rule.enabled) continue;
			if (rule.type !== ctx.kind) continue;
			if (rule.triggerMode === RuleTriggerMode.Tab && ctx.changeType !== 'tab') continue;

			// Scope check: RuleScope.All on either side means "no restriction"
			if (ctx.scopeHint !== RuleScope.All && !rule.scope.includes(RuleScope.All) && !rule.scope.includes(ctx.scopeHint)) continue;

			switch (ctx.kind) {
				case RuleType.SelectKey: {
					if (!rule.triggerKeys?.includes(ctx.key!)) continue;
					const result = this.applySelectKeyRule(rule, ctx);
					if (result) {
						if (ctx.debug) console.log('[RuleEngine] hit:', rule.id, rule.description);
						return result;
					}
					break;
				}
				default: {
					const result = this.matchAndApplyTextRule(rule, ctx);
					if (result) {
						if (ctx.debug) console.log('[RuleEngine] hit:', rule.id, rule.description);
						return result;
					}
					break;
				}
			}
		}
		return null;
	}

	private matchAndApplyTextRule(rule: ConvertRule, ctx: TxContext): ApplyResult | null {
		const { from, to } = ctx.selection;
		const leftDoc = ctx.docText.slice(0, from);
		const rightDoc = ctx.docText.slice(to);

		const leftPattern = rule.match.isRegex
			? rule.match.left
			: escapeRegex(rule.match.left);
		const rightPattern = rule.match.isRegex
			? rule.match.right
			: escapeRegex(rule.match.right);

		const leftRegex = leftPattern ? new RegExp(leftPattern + '$') : null;
		const rightRegex = rightPattern ? new RegExp('^' + rightPattern) : null;

		const leftMatch = leftRegex ? leftDoc.match(leftRegex) : [''];
		const rightMatch = rightRegex ? rightDoc.match(rightRegex) : [''];
		if (!leftMatch || !rightMatch) return null;

		const matchFrom = from - leftMatch[0].length;
		const matchTo = to + rightMatch[0].length;

		return this.applyReplacement(rule, {
			leftMatches: [...leftMatch],
			rightMatches: [...rightMatch],
			matchRange: { from: matchFrom, to: matchTo },
		}, ctx);
	}

	private applySelectKeyRule(rule: ConvertRule, ctx: TxContext): ApplyResult | null {
		const selectionText = ctx.docText.slice(ctx.selection.from, ctx.selection.to);

		return this.applyReplacement(rule, {
			leftMatches: [],
			rightMatches: [],
			matchRange: ctx.selection,
			selectionText,
			key: ctx.key!,
		}, ctx);
	}

	private applyReplacement(
		rule: ConvertRule,
		match: MatchInfo,
		ctx: TxContext
	): ApplyResult | null {
		let text: string;

		if (typeof rule.replacement === 'function') {
			if (rule.type === RuleType.SelectKey) {
				const fn = rule.replacement as (sel: string, key: string) => string | void;
				const result = fn(match.selectionText!, match.key!);
				if (result === undefined) return null;
				text = result as string;
			} else {
				const fn = rule.replacement as (l: string[], r: string[]) => string | void;
				const result = fn(match.leftMatches, match.rightMatches);
				if (result === undefined) return null;
				text = result as string;
			}
		} else {
			text = rule.replacement;
		}

		// Unescape \n, \t, \r, \\ in replacement text
		text = RuleEngine.unescapeText(text);

		// Expand [[n]], standalone ${SELECTION}, ${KEY}
		text = this.expandVariables(text, match);

		// Parse tabstops (including nested ${SELECTION}/${KEY} in defaults)
		const [finalText, tabstops] = this.parseTabstops(text, match.matchRange.from, match);

		const cursor = tabstops.length > 0
			? tabstops[0].from
			: match.matchRange.from + finalText.length;

		return {
			newText: finalText,
			cursor,
			tabstops,
			matchRange: match.matchRange,
		};
	}
}
