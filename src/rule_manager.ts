import { App, PluginManifest } from 'obsidian';
import { RuleEngine, SimpleRule, RuleTriggerMode } from './rule_engine';
import { DEFAULT_BUILTIN_RULES } from './default_rules';
import { EasyTypingSettings } from './settings';

export class RuleManager {
	ruleEngine: RuleEngine;
	cachedBuiltinRules: SimpleRule[] = [];
	cachedUserRules: SimpleRule[] = [];
	private readonly BUILTIN_RULES_FILE = 'builtin-rules.json';
	private readonly USER_RULES_FILE = 'user-rules.json';

	constructor(
		private app: App,
		private manifest: PluginManifest,
		private settings: EasyTypingSettings,
		private savePluginSettings: () => Promise<void>,
	) {}

	private pluginPath(filename: string): string {
		return `${this.manifest.dir}/${filename}`;
	}

	async loadRulesFile(filename: string): Promise<SimpleRule[]> {
		const path = this.pluginPath(filename);
		try {
			const content = await this.app.vault.adapter.read(path);
			return JSON.parse(content);
		} catch {
			return [];
		}
	}

	async saveRulesFile(filename: string, rules: SimpleRule[]): Promise<void> {
		const path = this.pluginPath(filename);
		await this.app.vault.adapter.write(path, JSON.stringify(rules, null, 2));
	}

	async mergeBuiltinRules(): Promise<void> {
		const currentRules = await this.loadRulesFile(this.BUILTIN_RULES_FILE);
		const existingIds = new Set(currentRules.map(r => r.id).filter(Boolean));
		const deletedIds = new Set(this.settings.deletedBuiltinRuleIds);

		const newRules = DEFAULT_BUILTIN_RULES.filter(
			r => !existingIds.has(r.id) && !deletedIds.has(r.id)
		);
		if (newRules.length === 0) return;

		await this.saveRulesFile(this.BUILTIN_RULES_FILE, [...currentRules, ...newRules]);
	}

	async initRuleEngine(): Promise<void> {
		this.ruleEngine = new RuleEngine();

		const builtinPath = this.pluginPath(this.BUILTIN_RULES_FILE);
		const userPath = this.pluginPath(this.USER_RULES_FILE);

		if (!await this.app.vault.adapter.exists(builtinPath)) {
			await this.saveRulesFile(this.BUILTIN_RULES_FILE, DEFAULT_BUILTIN_RULES);
		} else {
			await this.mergeBuiltinRules();
		}

		if (!await this.app.vault.adapter.exists(userPath)) {
			await this.saveRulesFile(this.USER_RULES_FILE, []);
		}

		const builtinRules = await this.loadRulesFile(this.BUILTIN_RULES_FILE);
		const userRules = await this.loadRulesFile(this.USER_RULES_FILE);
		this.cachedBuiltinRules = builtinRules;
		this.cachedUserRules = userRules;
		this.ruleEngine.loadFromFiles(builtinRules, userRules);
	}

	async deleteBuiltinRule(id: string): Promise<void> {
		this.ruleEngine.removeRule(id);
		this.cachedBuiltinRules = this.cachedBuiltinRules.filter(r => r.id !== id);
		await this.saveRulesFile(this.BUILTIN_RULES_FILE, this.cachedBuiltinRules);
		this.settings.deletedBuiltinRuleIds.push(id);
		await this.savePluginSettings();
	}

	async restoreBuiltinRule(id: string): Promise<void> {
		const defaultRule = DEFAULT_BUILTIN_RULES.find(r => r.id === id);
		if (!defaultRule) return;
		this.ruleEngine.addSimpleRule(defaultRule);
		this.cachedBuiltinRules.push(defaultRule);
		await this.saveRulesFile(this.BUILTIN_RULES_FILE, this.cachedBuiltinRules);
		this.settings.deletedBuiltinRuleIds = this.settings.deletedBuiltinRuleIds.filter(i => i !== id);
		await this.savePluginSettings();
	}

	async resetAllBuiltinRules(): Promise<void> {
		this.cachedBuiltinRules = [...DEFAULT_BUILTIN_RULES];
		await this.saveRulesFile(this.BUILTIN_RULES_FILE, this.cachedBuiltinRules);
		this.settings.deletedBuiltinRuleIds = [];
		await this.savePluginSettings();
		this.ruleEngine.loadFromFiles(this.cachedBuiltinRules, this.cachedUserRules);
	}

	async addUserRule(rule: SimpleRule): Promise<string> {
		const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		rule.id = id;
		this.cachedUserRules.push(rule);
		await this.saveRulesFile(this.USER_RULES_FILE, this.cachedUserRules);
		this.ruleEngine.addSimpleRule(rule);
		return id;
	}

	async importUserRules(incoming: SimpleRule[]): Promise<{ imported: number; skipped: number }> {
		const existingSet = new Set(
			this.cachedUserRules.map(r => {
				const isRegex = (r.options ?? '').includes('r');
				return `${r.trigger}\0${r.trigger_right ?? ''}\0${isRegex}`;
			})
		);

		let imported = 0;
		let skipped = 0;

		for (const rule of incoming) {
			if (!rule.trigger || rule.replacement === undefined) {
				skipped++;
				continue;
			}
			const isRegex = (rule.options ?? '').includes('r');
			const key = `${rule.trigger}\0${rule.trigger_right ?? ''}\0${isRegex}`;
			if (existingSet.has(key)) {
				skipped++;
				continue;
			}
			existingSet.add(key);
			const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
			rule.id = id;
			rule.enabled = rule.enabled ?? true;
			this.cachedUserRules.push(rule);
			this.ruleEngine.addSimpleRule(rule);
			imported++;
		}

		if (imported > 0) {
			await this.saveRulesFile(this.USER_RULES_FILE, this.cachedUserRules);
		}
		return { imported, skipped };
	}

	async updateUserRule(id: string, rule: SimpleRule): Promise<void> {
		const idx = this.cachedUserRules.findIndex(r => r.id === id);
		if (idx === -1) return;
		rule.id = id;
		this.cachedUserRules[idx] = rule;
		await this.saveRulesFile(this.USER_RULES_FILE, this.cachedUserRules);
		this.ruleEngine.removeRule(id);
		this.ruleEngine.addSimpleRule(rule);
	}

	async deleteUserRule(id: string): Promise<void> {
		this.cachedUserRules = this.cachedUserRules.filter(r => r.id !== id);
		await this.saveRulesFile(this.USER_RULES_FILE, this.cachedUserRules);
		this.ruleEngine.removeRule(id);
	}

	async updateBuiltinRule(id: string, rule: SimpleRule): Promise<void> {
		const idx = this.cachedBuiltinRules.findIndex(r => r.id === id);
		if (idx === -1) return;
		rule.id = id;
		this.cachedBuiltinRules[idx] = rule;
		await this.saveRulesFile(this.BUILTIN_RULES_FILE, this.cachedBuiltinRules);
		this.ruleEngine.removeRule(id);
		this.ruleEngine.addSimpleRule(rule);
	}

	async toggleRuleEnabled(id: string, isBuiltin: boolean, enabled: boolean): Promise<void> {
		const cache = isBuiltin ? this.cachedBuiltinRules : this.cachedUserRules;
		const file = isBuiltin ? this.BUILTIN_RULES_FILE : this.USER_RULES_FILE;
		const rule = cache.find(r => r.id === id);
		if (!rule) return;
		rule.enabled = enabled;
		await this.saveRulesFile(file, cache);
		this.ruleEngine.setEnabled(id, enabled);
	}

	async updateRuleTriggerMode(id: string, isBuiltin: boolean, tabMode: boolean): Promise<void> {
		const cache = isBuiltin ? this.cachedBuiltinRules : this.cachedUserRules;
		const file = isBuiltin ? this.BUILTIN_RULES_FILE : this.USER_RULES_FILE;
		const rule = cache.find(r => r.id === id);
		if (!rule) return;
		let opts = rule.options ?? '';
		if (tabMode && !opts.includes('T')) opts += 'T';
		else if (!tabMode) opts = opts.replace(/T/g, '');
		rule.options = opts || undefined;
		await this.saveRulesFile(file, cache);
		this.ruleEngine.updateRule(id, { triggerMode: tabMode ? RuleTriggerMode.Tab : RuleTriggerMode.Auto });
	}
}
