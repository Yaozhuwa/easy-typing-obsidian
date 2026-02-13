# Rule Engine Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the three separate rule systems (input convert, delete, selection replace) with a unified `RuleEngine` class in `src/rule_engine.ts`.

**Architecture:** New `RuleEngine` class with dual storage (Map + sorted array), `SimpleRule` → `ConvertRule` normalization, unified `process(ctx)` matching. The existing `transactionFilterPlugin` / `viewUpdatePlugin` structure stays — they construct `TxContext` and delegate to the engine.

**Tech Stack:** TypeScript, CodeMirror 6, Obsidian API. No test framework exists — project uses `npm run build` (tsc + esbuild) for validation.

**Design doc:** `docs/plans/2026-02-13-rule-engine-refactor-design.md`

---

### Task 1: Create type definitions

**Files:**
- Create: `src/rule_engine.ts`

**Step 1: Write all type definitions**

```typescript
// src/rule_engine.ts

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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS (types only, no usage yet)

**Step 3: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: add rule engine type definitions"
```

---

### Task 2: Implement static utility methods

**Files:**
- Modify: `src/rule_engine.ts`

**Step 1: Implement `parseOptions`, `parseTriggerKeys`, `normalizeRule`, `escapeRegex`**

```typescript
// Add to src/rule_engine.ts after the type definitions

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Placeholder class — methods will be added in subsequent tasks
export class RuleEngine {
  private rulesById: Map<string, ConvertRule> = new Map();
  private sortedRules: ConvertRule[] = [];
  private ruleIdCounter: number = 0;

  private generateId(): string {
    return `rule-${++this.ruleIdCounter}`;
  }

  static parseOptions(options: string = ''): {
    type: RuleType;
    triggerMode: RuleTriggerMode;
    isRegex: boolean;
    scope: RuleScope[];
  } {
    const type = options.includes('d') ? RuleType.Delete
               : options.includes('s') ? RuleType.SelectKey
               : RuleType.Input;

    const triggerMode = options.includes('T') ? RuleTriggerMode.Tab
                      : RuleTriggerMode.Auto;

    const isRegex = options.includes('r');

    const scope: RuleScope[] = [];
    if (options.includes('a') || (!options.includes('t') && !options.includes('f') && !options.includes('c'))) {
      scope.push(RuleScope.All);
    } else {
      if (options.includes('t')) scope.push(RuleScope.Text);
      if (options.includes('f')) scope.push(RuleScope.Formula);
      if (options.includes('c')) scope.push(RuleScope.Code);
    }

    return { type, triggerMode, isRegex, scope };
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
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: implement RuleEngine static utilities (parseOptions, parseTriggerKeys, normalizeRule)"
```

---

### Task 3: Implement rule management methods

**Files:**
- Modify: `src/rule_engine.ts`

**Step 1: Add rule CRUD methods to RuleEngine**

```typescript
// Add inside RuleEngine class

  /** Binary search for insertion index to maintain priority ascending order */
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: implement RuleEngine rule management (add, remove, update, sorted insert)"
```

---

### Task 4: Implement template expansion and tabstop parsing

**Files:**
- Modify: `src/rule_engine.ts`

**Step 1: Add expandVariables and parseTabstops methods**

These replace the existing `parseTheAfterPattern` / `replacePlaceholdersAndTabstops` in `src/utils.ts` with support for `${SELECTION}`, `${KEY}`, and nested defaults.

```typescript
// Add inside RuleEngine class as private methods

  private expandVariables(text: string, match: MatchInfo): string {
    // [[n]] → regex capture group
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
        if (text[i + 1] === '{') {
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: implement template expansion and tabstop parsing with SELECTION/KEY support"
```

---

### Task 5: Implement process() and matching logic

**Files:**
- Modify: `src/rule_engine.ts`

**Step 1: Add matching and execution methods**

```typescript
// Add inside RuleEngine class

  process(ctx: TxContext): ApplyResult | null {
    for (const rule of this.sortedRules) {
      if (!rule.enabled) continue;
      if (rule.type !== ctx.kind) continue;
      if (rule.triggerMode === RuleTriggerMode.Tab && ctx.changeType !== 'tab') continue;

      // Scope check
      if (!rule.scope.includes(RuleScope.All) && !rule.scope.includes(ctx.scopeHint)) continue;

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
  ): ApplyResult {
    let text: string;

    if (typeof rule.replacement === 'function') {
      if (rule.type === RuleType.SelectKey) {
        const fn = rule.replacement as (sel: string, key: string) => string | void;
        text = fn(match.selectionText!, match.key!) ?? match.selectionText!;
      } else {
        const fn = rule.replacement as (l: string[], r: string[]) => string | void;
        const result = fn(match.leftMatches, match.rightMatches);
        if (result === undefined) return null;
        text = result;
      }
    } else {
      text = rule.replacement;
    }

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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: implement RuleEngine.process() with matching and replacement logic"
```

---

### Task 6: Define default built-in rules

**Files:**
- Create: `src/default_rules.ts`

**Step 1: Convert all existing built-in rules to SimpleRule format**

Ref existing rules at `src/main.ts:72-95`. Each rule gets a stable `id` for tracking.

```typescript
// src/default_rules.ts

import { SimpleRule } from './rule_engine';

// Priority bands: 0-9 internal patches, 10-19 basic conversions,
// 20-29 FW2HW, 30-39 delete rules, 40-49 selection rules,
// 50-59 quote/extra, 100+ user rules

export const DEFAULT_BUILTIN_RULES: (SimpleRule & { id: string })[] = [
  // ===== Basic Conversion Rules (from BasicConvRuleStringList) =====
  // These are input rules, auto trigger, non-regex, all scope
  { id: 'builtin-conv-001', trigger: '··',  replacement: '`$0`$1', priority: 10, description: '中文点转代码' },
  { id: 'builtin-conv-002', trigger: '！【【', trigger_right: '】', replacement: '![[$0]]$1', priority: 10, description: '中文感叹号+双方括号转嵌入' },
  { id: 'builtin-conv-003', trigger: '！【【', replacement: '![[$0]]$1', priority: 10, description: '中文感叹号+双方括号转嵌入(无右)' },
  { id: 'builtin-conv-004', trigger: '【【', trigger_right: '】', replacement: '[[$0]]$1', priority: 10, description: '中文方括号转 wiki link' },
  { id: 'builtin-conv-005', trigger: '【【', replacement: '[[$0]]$1', priority: 10, description: '中文方括号转 wiki link(无右)' },
  { id: 'builtin-conv-006', trigger: '￥￥', replacement: '$$0$$1', priority: 10, description: '人民币符号转行内公式' },
  { id: 'builtin-conv-007', trigger: '$￥', trigger_right: '$', replacement: '$$\n$0\n$$$1', priority: 10, description: '混合符号转公式块' },
  { id: 'builtin-conv-008', trigger: '¥¥', replacement: '$$0$$1', priority: 10, description: '半角人民币转行内公式' },
  { id: 'builtin-conv-009', trigger: '$¥', trigger_right: '$', replacement: '$$\n$0\n$$$1', priority: 10, description: '半角混合转公式块' },
  { id: 'builtin-conv-010', trigger: '$$', trigger_right: '$', replacement: '$$\n$0\n$$$1', priority: 10, description: '三美元转公式块' },
  { id: 'builtin-conv-011', trigger: '$$', replacement: '$$0$$1', priority: 10, description: '双美元转行内公式' },
  { id: 'builtin-conv-012', trigger: '\n》', replacement: '\n> $0', priority: 10, description: '中文书名号转引用' },
  { id: 'builtin-conv-013', trigger: '\n、', replacement: '\n/$0', priority: 10, description: '中文顿号转斜杠' },

  // ===== FW2HW Symbol Rules (from FW2HWSymbolRulesStrList) =====
  { id: 'builtin-fw2hw-001', trigger: '。。', replacement: '.$0', priority: 20, description: '全角句号转半角' },
  { id: 'builtin-fw2hw-002', trigger: '！！', replacement: '!$0', priority: 20, description: '全角感叹号转半角' },
  { id: 'builtin-fw2hw-003', trigger: '；；', replacement: ';$0', priority: 20, description: '全角分号转半角' },
  { id: 'builtin-fw2hw-004', trigger: '，，', replacement: ',$0', priority: 20, description: '全角逗号转半角' },
  { id: 'builtin-fw2hw-005', trigger: '：：', replacement: ':$0', priority: 20, description: '全角冒号转半角' },
  { id: 'builtin-fw2hw-006', trigger: '？？', replacement: '?$0', priority: 20, description: '全角问号转半角' },
  { id: 'builtin-fw2hw-007', trigger: '（（', trigger_right: '）', replacement: '($0)$1', priority: 20, description: '全角括号转半角' },
  { id: 'builtin-fw2hw-008', trigger: '（（', replacement: '($0)$1', priority: 20, description: '全角括号转半角(无右)' },
  { id: 'builtin-fw2hw-009', trigger: '\u201c\u201c', trigger_right: '\u201d', replacement: '"$0"$1', priority: 20, description: '中文左双引号转半角' },
  { id: 'builtin-fw2hw-010', trigger: '\u201d\u201d', trigger_right: '\u201d', replacement: '"$0"$1', priority: 20, description: '中文右双引号转半角' },
  { id: 'builtin-fw2hw-011', trigger: '\u2018\u2018', trigger_right: '\u2019', replacement: "'$0'$1", priority: 20, description: '中文左单引号转半角' },
  { id: 'builtin-fw2hw-012', trigger: '\u2019\u2019', trigger_right: '\u2019', replacement: "'$0'$1", priority: 20, description: '中文右单引号转半角' },
  { id: 'builtin-fw2hw-013', trigger: '》》', replacement: '>$0', priority: 20, description: '全角右书名号转半角' },
  { id: 'builtin-fw2hw-014', trigger: '《《', trigger_right: '》', replacement: '<$0', priority: 20, description: '全角左书名号转半角' },
  { id: 'builtin-fw2hw-015', trigger: '《《', replacement: '<$0', priority: 20, description: '全角左书名号转半角(无右)' },
  { id: 'builtin-fw2hw-016', trigger: '｜｜', replacement: '|$0', priority: 20, description: '全角竖线转半角' },

  // ===== Delete Rules (from DeleteRulesStrList) =====
  { id: 'builtin-del-001', trigger: '\\$', trigger_right: '\\$', replacement: '$0', options: 'd', priority: 30, description: '删除行内公式对' },
  { id: 'builtin-del-002', trigger: '==', trigger_right: '==', replacement: '$0', options: 'd', priority: 30, description: '删除高亮对' },
  { id: 'builtin-del-003', trigger: '\\$\\$\\n', trigger_right: '\\n\\$\\$', replacement: '$0', options: 'dr', priority: 30, description: '删除公式块对' },

  // ===== Auto Pair Patch Rules =====
  { id: 'builtin-pair-001', trigger: '【】', trigger_right: '】', replacement: '【】$0', priority: 5, description: '防止重复右方括号' },
  { id: 'builtin-pair-002', trigger: '（）', trigger_right: '）', replacement: '（）$0', priority: 5, description: '防止重复右圆括号' },
  { id: 'builtin-pair-003', trigger: '<>', trigger_right: '>', replacement: '<>$0', priority: 5, description: '防止重复右尖括号' },
  { id: 'builtin-pair-004', trigger: '《》', trigger_right: '》', replacement: '《》$0', priority: 5, description: '防止重复右书名号' },
  { id: 'builtin-pair-005', trigger: '「」', trigger_right: '」', replacement: '「」$0', priority: 5, description: '防止重复右单角括号' },
  { id: 'builtin-pair-006', trigger: '『』', trigger_right: '』', replacement: '『』$0', priority: 5, description: '防止重复右双角括号' },
  { id: 'builtin-pair-007', trigger: '()', trigger_right: ')', replacement: '()$0', priority: 5, description: '防止重复右圆括号(英)' },
  { id: 'builtin-pair-008', trigger: '[]', trigger_right: ']', replacement: '[]$0', priority: 5, description: '防止重复右方括号(英)' },
  { id: 'builtin-pair-009', trigger: '{}', trigger_right: '}', replacement: '{}$0', priority: 5, description: '防止重复右花括号' },
  { id: 'builtin-pair-010', trigger: "''", trigger_right: "'", replacement: "''$0", priority: 5, description: '防止重复右单引号(英)' },
  { id: 'builtin-pair-011', trigger: '""', trigger_right: '"', replacement: '""$0', priority: 5, description: '防止重复右双引号(英)' },

  // ===== Quote/Extra Rules (regex) =====
  { id: 'builtin-extra-001', trigger: '(?<=^|\\n)(\\s*>*) ?[>》]', replacement: '[[0]]> $0', options: 'r', priority: 50, description: '引用符号转换' },
  { id: 'builtin-extra-002', trigger: '(?<=^|\\n)(\\s*>+)([^ >》]+)', replacement: '[[0]] [[1]]$0', options: 'r', priority: 50, description: '引用后加空格' },

  // ===== Selection Replace Rules (from selectionReplaceMapInitalData) =====
  { id: 'builtin-sel-001', trigger: '【', replacement: '[${SELECTION}]$0', options: 's', priority: 40, description: '选中文字加方括号' },
  { id: 'builtin-sel-002', trigger: '￥', replacement: '$${SELECTION}$$0', options: 's', priority: 40, description: '选中文字加公式' },
  { id: 'builtin-sel-003', trigger: '·', replacement: '`${SELECTION}`$0', options: 's', priority: 40, description: '选中文字加代码' },
  { id: 'builtin-sel-004', trigger: '¥', replacement: '$${SELECTION}$$0', options: 's', priority: 40, description: '选中文字加公式(半角)' },
  { id: 'builtin-sel-005', trigger: '《', replacement: '《${SELECTION}》$0', options: 's', priority: 40, description: '选中文字加书名号' },
  { id: 'builtin-sel-006', trigger: '\u201c', replacement: '\u201c${SELECTION}\u201d$0', options: 's', priority: 40, description: '选中文字加中文双引号' },
  { id: 'builtin-sel-007', trigger: '\u201d', replacement: '\u201c${SELECTION}\u201d$0', options: 's', priority: 40, description: '选中文字加中文双引号(右)' },
  { id: 'builtin-sel-008', trigger: '（', replacement: '（${SELECTION}）$0', options: 's', priority: 40, description: '选中文字加中文圆括号' },
  { id: 'builtin-sel-009', trigger: '<', replacement: '<${SELECTION}>$0', options: 's', priority: 40, description: '选中文字加尖括号' },
  { id: 'builtin-sel-010', trigger: '"', replacement: '"${SELECTION}"$0', options: 's', priority: 40, description: '选中文字加英文双引号' },
  { id: 'builtin-sel-011', trigger: "'", replacement: "'${SELECTION}'$0", options: 's', priority: 40, description: '选中文字加英文单引号' },
  { id: 'builtin-sel-012', trigger: '「', replacement: '「${SELECTION}」$0', options: 's', priority: 40, description: '选中文字加单角括号' },
  { id: 'builtin-sel-013', trigger: '『', replacement: '『${SELECTION}』$0', options: 's', priority: 40, description: '选中文字加双角括号' },
];
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/default_rules.ts
git commit -m "feat: define all default built-in rules in SimpleRule format"
```

---

### Task 7: Add settings field and file I/O helpers to plugin

**Files:**
- Modify: `src/settings.ts` (add `deletedBuiltinRuleIds` to `EasyTypingSettings` and `DEFAULT_SETTINGS`)
- Modify: `src/main.ts` (add file I/O methods and `RuleEngine` instance)

**Step 1: Add `deletedBuiltinRuleIds` to settings**

In `src/settings.ts`, add to the `EasyTypingSettings` interface:
```typescript
deletedBuiltinRuleIds: string[];
```

In `DEFAULT_SETTINGS`, add:
```typescript
deletedBuiltinRuleIds: [],
```

**Step 2: Add file I/O and RuleEngine to main.ts**

Add imports at top of `src/main.ts`:
```typescript
import { RuleEngine, SimpleRule } from './rule_engine';
import { DEFAULT_BUILTIN_RULES } from './default_rules';
```

Add to plugin class properties:
```typescript
ruleEngine: RuleEngine;
private readonly BUILTIN_RULES_FILE = 'builtin-rules.json';
private readonly USER_RULES_FILE = 'user-rules.json';
```

Add methods to plugin class:
```typescript
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
    this.ruleEngine.loadFromFiles(builtinRules, userRules);
  }

  async deleteBuiltinRule(id: string): Promise<void> {
    this.ruleEngine.removeRule(id);
    const rules = await this.loadRulesFile(this.BUILTIN_RULES_FILE);
    await this.saveRulesFile(this.BUILTIN_RULES_FILE, rules.filter(r => r.id !== id));
    this.settings.deletedBuiltinRuleIds.push(id);
    await this.saveSettings();
  }

  async restoreBuiltinRule(id: string): Promise<void> {
    const defaultRule = DEFAULT_BUILTIN_RULES.find(r => r.id === id);
    if (!defaultRule) return;
    this.ruleEngine.addSimpleRule(defaultRule);
    const rules = await this.loadRulesFile(this.BUILTIN_RULES_FILE);
    rules.push(defaultRule);
    await this.saveRulesFile(this.BUILTIN_RULES_FILE, rules);
    this.settings.deletedBuiltinRuleIds = this.settings.deletedBuiltinRuleIds.filter(i => i !== id);
    await this.saveSettings();
  }

  async resetAllBuiltinRules(): Promise<void> {
    await this.saveRulesFile(this.BUILTIN_RULES_FILE, DEFAULT_BUILTIN_RULES);
    this.settings.deletedBuiltinRuleIds = [];
    await this.saveSettings();
    const userRules = await this.loadRulesFile(this.USER_RULES_FILE);
    this.ruleEngine.loadFromFiles(DEFAULT_BUILTIN_RULES, userRules);
  }
```

**Step 3: Add `initRuleEngine()` call in `onload()`**

In `src/main.ts` `onload()` method, add after `loadSettings()`:
```typescript
await this.initRuleEngine();
```

**Step 4: Verify build**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/settings.ts src/main.ts
git commit -m "feat: add RuleEngine initialization, file I/O, and merge logic to plugin"
```

---

### Task 8: Integrate RuleEngine into transactionFilterPlugin — Selection Replace

**Files:**
- Modify: `src/main.ts`

**Step 1: Replace SelectionReplaceMap usage with ruleEngine.process()**

In `transactionFilterPlugin` at `src/main.ts:346-355`, replace the selection replace block:

Old code uses `this.SelectionReplaceMap.has(insertedStr)` to look up left/right wrapping.

New code constructs a `TxContext` with `kind: RuleType.SelectKey` and calls `this.ruleEngine.process(ctx)`. Convert the `ApplyResult` to a `TransactionSpec`.

```typescript
// Replace the selection replace section (~lines 346-355)
if (this.settings.SelectionEnhance) {
  if ((changeTypeStr == 'input.type' || changeTypeStr == "input.type.compose") && fromA != toA && ((fromB + 1 === toB)||insertedStr=='——'||insertedStr=='……')) {
    const ctx: TxContext = {
      kind: RuleType.SelectKey,
      docText: tr.startState.doc.toString(),
      selection: { from: fromA, to: toA },
      inserted: insertedStr,
      changeType: changeTypeStr,
      scopeHint: RuleScope.All,  // selection replace applies everywhere
      key: insertedStr,
      debug: this.settings?.debug,
    };
    const result = this.ruleEngine.process(ctx);
    if (result) {
      const tabstopGroups = tabstopSpecsToTabstopGroups(result.tabstops);
      if (tabstopGroups.length > 0) {
        changes.push({
          changes: { from: result.matchRange.from, to: result.matchRange.to, insert: result.newText },
          selection: tabstopGroups[0].toEditorSelection(),
          effects: [addTabstopsEffect.of(tabstopGroups)],
          userEvent: "EasyTyping.change"
        });
      } else {
        changes.push({
          changes: { from: result.matchRange.from, to: result.matchRange.to, insert: result.newText },
          selection: { anchor: result.cursor },
          userEvent: "EasyTyping.change"
        });
      }
      tr = tr.startState.update(...changes);
      return tr;
    }
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "refactor: integrate RuleEngine for selection replace rules"
```

---

### Task 9: Integrate RuleEngine into transactionFilterPlugin — Delete Rules

**Files:**
- Modify: `src/main.ts`

**Step 1: Replace IntrinsicDeleteRules and UserDeleteRules with ruleEngine.process()**

In `transactionFilterPlugin`, replace the delete rule sections at `src/main.ts:535-611`.

The intrinsic delete rules block (`~535-551`) and user delete rules block (`~555-611`) both match left/right patterns on backspace. Replace them with a single `ruleEngine.process()` call using `kind: RuleType.Delete`.

Note: Keep the `SymbolPairsMap` delete handling (`~511-516`) and code block delete handling (`~518-533`) as-is — those are special-purpose logic, not converted to rules.

```typescript
// Replace IntrinsicDeleteRules block (~535-551) and UserDeleteRules block (~555-611)
// with a single unified block after the code block delete handling:

{
  // Unified delete rules (intrinsic + user)
  const ctx: TxContext = {
    kind: RuleType.Delete,
    docText: tr.startState.doc.toString(),
    selection: { from: toA, to: toA },  // cursor position after deletion
    inserted: '',
    changeType: changeTypeStr,
    scopeHint: RuleScope.All,  // TODO: detect scope from syntax tree
    debug: this.settings?.debug,
  };
  const result = this.ruleEngine.process(ctx);
  if (result) {
    const tabstopGroups = tabstopSpecsToTabstopGroups(result.tabstops);
    if (tabstopGroups.length > 0) {
      changes.push({
        changes: { from: result.matchRange.from, to: result.matchRange.to, insert: result.newText },
        selection: tabstopGroups[0].toEditorSelection(),
        effects: [addTabstopsEffect.of(tabstopGroups)],
        userEvent: "EasyTyping.change"
      });
    } else {
      changes.push({
        changes: { from: result.matchRange.from, to: result.matchRange.to, insert: result.newText },
        selection: { anchor: result.cursor },
        userEvent: "EasyTyping.change"
      });
    }
    tr = tr.startState.update(...changes);
    return tr;
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "refactor: integrate RuleEngine for delete rules (intrinsic + user)"
```

---

### Task 10: Integrate RuleEngine into transactionFilterPlugin — Basic Conv & FW2HW Rules

**Files:**
- Modify: `src/main.ts`

**Step 1: Replace BasicConvRules and FW2HWSymbolRules with ruleEngine.process()**

In `transactionFilterPlugin`, replace the basic conversion rules block (`~661-699`) and FW2HW block (`~702-721`).

These are input rules triggered on single character input. Replace with:

```typescript
// Replace BasicConvRules (~661-699) and FW2HWSymbolRules (~702-721)
// and IntrinsicAutoPairRulesPatch (~727-744) with a single block:

{
  const ctx: TxContext = {
    kind: RuleType.Input,
    docText: tr.state.doc.toString(),  // note: tr.state is the new state after insert
    selection: { from: toB, to: toB }, // cursor position in new doc
    inserted: insertedStr,
    changeType: changeTypeStr,
    scopeHint: RuleScope.All,
    debug: this.settings?.debug,
  };
  const result = this.ruleEngine.process(ctx);
  if (result) {
    // Need to adjust: result.matchRange is in terms of new doc (tr.state),
    // but we need to build changes relative to old doc (tr.startState).
    // The offset difference: toB - toA (inserted char length)
    // Map back: result positions in new doc → old doc positions
    const insertLen = toB - toA;  // usually 1 for single char
    const adjustedFrom = result.matchRange.from <= toA
      ? result.matchRange.from
      : result.matchRange.from - insertLen;
    const adjustedTo = result.matchRange.to <= toB
      ? result.matchRange.to - insertLen
      : result.matchRange.to - insertLen;

    const tabstopGroups = tabstopSpecsToTabstopGroups(result.tabstops);
    if (tabstopGroups.length > 0) {
      changes.push({
        changes: { from: adjustedFrom, to: adjustedTo, insert: result.newText },
        selection: tabstopGroups[0].toEditorSelection(),
        effects: [addTabstopsEffect.of(tabstopGroups)],
        userEvent: "EasyTyping.change"
      });
    } else {
      changes.push({
        changes: { from: adjustedFrom, to: adjustedTo, insert: result.newText },
        selection: { anchor: result.cursor },
        userEvent: "EasyTyping.change"
      });
    }
    tr = tr.startState.update(...changes);
    return tr;
  }
}
```

> **Important note for implementer:** The position mapping between `tr.state` (new doc after insert) and `tr.startState` (old doc) is tricky. The existing code uses `toB` for positions in the new doc and `toA` for the old doc. The basic conv rules currently read from `tr.state.doc` (new doc). Carefully verify that `matchRange` positions map correctly when building the `TransactionSpec`. An alternative approach: build `ctx.docText` from `tr.startState.doc.toString()` with the insertion manually applied, and map result positions accordingly. Test with the `··` → backtick rule and `【【` → `[[]]` rule to verify correctness.

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Manual test in Obsidian**

- Type `··` — should produce `` ` `` with cursor inside
- Type `【【` — should produce `[[]]` with cursor inside
- Type `。。` — should produce `.` (if FW2HW enabled)
- Type `【】]` — should not produce extra `]`

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "refactor: integrate RuleEngine for basic conv, FW2HW, and auto pair rules"
```

---

### Task 11: Integrate RuleEngine into viewUpdatePlugin — Convert Rules

**Files:**
- Modify: `src/main.ts`

**Step 1: Replace triggerCvtRule with ruleEngine.process()**

The `triggerCvtRule` method at `src/main.ts:1818-1876` handles regex-based convert rules triggered after typing. Replace its internals with a `ruleEngine.process()` call.

```typescript
// Replace triggerCvtRule body
triggerCvtRule = (view: EditorView, cursor_pos: number): boolean => {
  const ctx: TxContext = {
    kind: RuleType.Input,
    docText: view.state.doc.toString(),
    selection: { from: cursor_pos, to: cursor_pos },
    inserted: '',
    changeType: 'input.type',
    scopeHint: RuleScope.All,
    debug: this.settings?.debug,
  };
  // Only run convert-time rules (QuoteSpace + UserConvert)
  // These are already in the engine with appropriate priorities
  const result = this.ruleEngine.process(ctx);
  if (result) {
    const tabstopGroups = tabstopSpecsToTabstopGroups(result.tabstops);
    view.dispatch({
      changes: {
        from: result.matchRange.from,
        to: result.matchRange.to,
        insert: result.newText,
      },
      userEvent: "EasyTyping.change"
    });
    if (tabstopGroups.length > 0) {
      addTabstopsAndSelect(view, tabstopGroups);
    }
    return true;
  }
  return false;
}
```

> **Important note for implementer:** The current `triggerCvtRule` only runs `ExtraBasicConvRules` + `QuoteSpaceRules` + `UserConvertRules`. After refactoring, `process()` will try ALL input rules. This means basic conv rules and FW2HW rules (already handled in `transactionFilterPlugin`) could trigger again here. Solution: either (a) use a separate `RuleTriggerMode.Tab` or a flag to distinguish "immediate" vs "deferred" input rules, or (b) ensure that `triggerCvtRule` is only called when no rule was matched in `transactionFilterPlugin` (which is already the case in the existing flow). Verify the flow ensures no double-triggering.

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Manual test in Obsidian**

- Type `:)` with user convert rule `:)|` → `😀|` configured — should produce `😀`
- Type `> text` (quote space rule) — should add space after `>`

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "refactor: integrate RuleEngine for convert rules in viewUpdatePlugin"
```

---

### Task 12: Clean up old rule infrastructure

**Files:**
- Modify: `src/main.ts` (remove old rule arrays and refresh methods)
- Modify: `src/settings.ts` (remove old rule type if unused elsewhere)

**Step 1: Remove old rule properties from plugin class**

Remove from `EasyTypingPlugin` class:
- `BasicConvRules`, `FW2HWSymbolRules`, `IntrinsicDeleteRules`, `IntrinsicAutoPairRulesPatch`
- `QuoteSpaceRules`, `ExtraBasicConvRules`
- `UserDeleteRules`, `UserConvertRules`
- `SelectionReplaceMap`, `selectionReplaceMapInitalData`

Remove methods:
- `refreshSelectionReplaceRule()`
- `addUserSelectionRepRule()`, `deleteUserSelectionRepRule()`, `updateUserSelectionRepRule()`
- `refreshUserDeleteRule()`, `addUserDeleteRule()`, `deleteUserDeleteRule()`, `updateUserDeleteRule()`
- `refreshUserConvertRule()`, `addUserConvertRule()`, `deleteUserConvertRule()`

Remove from `onload()`:
- All rule array initialization code (`~54-100`)
- Replace with just `await this.initRuleEngine();`

**Step 2: Remove old imports**

Remove from `src/main.ts` imports:
- `ruleStringList2RuleList`, `string2pairstring`, `isRegexp`, `replacePlaceholders`, `parseTheAfterPattern` (if no longer used elsewhere)

**Step 3: Check if old `ConvertRule` and `PairString` from settings.ts are still used**

Search for remaining usage. If `PairString` is still used by `SymbolPairsMap` or `TaboutPairStrs`, keep it. The old `ConvertRule` interface in `settings.ts` can be removed if fully replaced.

> **Important:** Do NOT remove `PairString` — it is still used by `SymbolPairsMap` and `TaboutPairStrs` for auto-pair and tabout logic that is NOT part of the rule engine.

**Step 4: Remove old settings fields if unused**

Check if `userSelRepRuleTrigger`, `userSelRepRuleValue`, `userDeleteRulesStrList`, `userConvertRulesStrList` are still referenced by settings UI. If so, keep them for now — the settings UI refactor is out of scope.

> **Important:** The settings UI (`EasyTypingSettingTab`) still references these fields. For now, keep the settings fields but note they will be deprecated in favor of the rule files. The settings UI update is a separate task.

**Step 5: Verify build**

Run: `npm run build`
Expected: PASS

**Step 6: Manual regression test in Obsidian**

- All basic conversions still work (`··`, `【【`, `￥￥`)
- FW2HW conversions work (`。。`, `！！`)
- Delete pairs work (`$|$`, `==|==`)
- Selection replace works (select text, type `【`)
- User convert rules work (`:)` → `😀`)
- Quote space rules work

**Step 7: Commit**

```bash
git add src/main.ts src/settings.ts src/utils.ts
git commit -m "refactor: remove old rule infrastructure, fully replaced by RuleEngine"
```

---

### Task 13: Final validation and build

**Files:**
- All modified files

**Step 1: Full build**

Run: `npm run build`
Expected: PASS with no errors

**Step 2: Verify no old rule references remain**

Search for `BasicConvRules`, `FW2HWSymbolRules`, `IntrinsicDeleteRules`, `UserDeleteRules`, `UserConvertRules`, `SelectionReplaceMap` in `src/main.ts` — should find none (except possibly in comments).

**Step 3: Comprehensive manual test in Obsidian**

Test matrix:
| Feature | Test | Expected |
|---------|------|----------|
| Basic conv | Type `··` | `` `cursor` `` |
| Basic conv | Type `【【` | `[[cursor]]` |
| FW2HW | Type `。。` | `.` |
| FW2HW | Type `（（` | `(cursor)` |
| Delete pair | Type `$` → auto pair `$$` → backspace | Empty |
| Delete pair | Type `==text==` → position between → backspace | Removes both `==` |
| Selection replace | Select "hello", type `·` | `` `hello` `` |
| Selection replace | Select "hello", type `【` | `[hello]` |
| Convert rule | Type `:)` (if user rule configured) | `😀` |
| Quote space | Type `>text` | `> text` |
| Auto pair patch | Type `【】` then `】` | No duplicate |
| Tabstop | Rule with `$0` `$1` | Tab navigates correctly |

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: final validation of rule engine refactor"
```
