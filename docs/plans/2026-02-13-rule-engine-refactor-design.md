# Rule Engine Refactor Design

## Overview

Refactor the existing three separate rule systems (input convert, delete, selection replace) into a unified `RuleEngine` class with a single `ConvertRule` data structure. The engine lives in a new file `src/rule_engine.ts`, and the existing `transactionFilterPlugin` / `viewUpdatePlugin` structure remains unchanged — they construct a `TxContext` and call `ruleEngine.process()`.

## Data Types

### Enums

```typescript
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
```

### ConvertRule (complete rule)

```typescript
export interface ConvertRule {
  id: string;
  description: string;
  enabled: boolean;
  type: RuleType;
  triggerMode: RuleTriggerMode;
  triggerKeys?: string[];        // selectKey: list of trigger keys
  scope: RuleScope[];
  priority: number;              // lower = higher priority
  match: {
    left: string;                // input/delete: left-side pattern
    right: string;               // input/delete: right-side pattern
    isRegex: boolean;
  };
  replacement: string |
    ((leftMatches: string[], rightMatches: string[]) => string | void) |
    ((selectionText: string, key: string) => string | void);
}
```

### SimpleRule (user-facing shorthand)

```typescript
export interface SimpleRule {
  id?: string;
  trigger: string;               // input/delete: left-side match; selectKey: key pattern
  trigger_right?: string;        // input/delete: right-side match
  replacement: string |
    ((leftMatches: string[], rightMatches: string[]) => string | void) |
    ((selectionText: string, key: string) => string | void);
  options?: string;
  enabled?: boolean;             // default true
  description?: string;          // default ''
  priority?: number;             // default 100
}
```

### Options string format

Characters compose freely:

| Char | Meaning | Category | Default |
|------|---------|----------|---------|
| `i` | input trigger | type | yes |
| `d` | delete trigger | type | |
| `s` | selectKey trigger | type | |
| `A` | auto trigger | trigger mode | yes |
| `T` | Tab trigger | trigger mode | |
| `r` | regex | regex flag | |
| `t` | text scope | scope | |
| `f` | formula scope | scope | |
| `c` | code scope | scope | |
| `a` | all scopes | scope | yes |

### TxContext (trigger context)

```typescript
export interface TxContext {
  kind: RuleType;
  docText: string;
  selection: { from: number; to: number };
  inserted: string;
  changeType: string;
  scopeHint: RuleScope;          // caller detects scope via syntax tree
  debug?: boolean;
  key?: string;                  // selectKey: the actual key pressed
}
```

### Result types

```typescript
export interface MatchResult {
  rule: ConvertRule;
  leftMatches: string[];
  rightMatches: string[];
  matchRange: { from: number; to: number };
}

export interface ApplyResult {
  newText: string;
  cursor: number;
  tabstops: TabstopSpec[];
  matchRange: { from: number; to: number };
}
```

## RuleEngine Class

### Storage

Dual structure for optimal read/write:
- `rulesById: Map<string, ConvertRule>` — O(1) lookup by id
- `sortedRules: ConvertRule[]` — always sorted by priority (ascending), zero-cost iteration

Mutations maintain both in sync:
- `addRule`: binary insert into `sortedRules`, set in Map
- `removeRule`: delete from Map, splice from array
- `updateRule`: if priority unchanged, in-place update; if changed, remove + re-insert

### Public API

```typescript
export class RuleEngine {
  // Rule management
  addRule(rule: Omit<ConvertRule, 'id'> & { id?: string }): string;
  addSimpleRule(simple: SimpleRule): string;
  addSimpleRules(rules: SimpleRule[]): string[];
  removeRule(id: string): boolean;
  updateRule(id: string, patch: Partial<Omit<ConvertRule, 'id'>>): boolean;
  setEnabled(id: string, enabled: boolean): void;
  getRules(): readonly ConvertRule[];
  getRulesByType(type: RuleType): ConvertRule[];
  clear(): void;

  // Execution
  process(ctx: TxContext): ApplyResult | null;

  // Loading
  loadFromFiles(builtinRules: SimpleRule[], userRules: SimpleRule[]): void;

  // Static utilities
  static normalizeRule(simple: SimpleRule): Omit<ConvertRule, 'id'>;
  static parseOptions(options: string): { type; triggerMode; isRegex; scope };
  static parseTriggerKeys(pattern: string): string[];
}
```

### process() flow

```
process(ctx)
  for rule of sortedRules:
    skip if !enabled
    skip if rule.type !== ctx.kind
    skip if triggerMode mismatch
    skip if scope mismatch (rule.scope vs ctx.scopeHint)

    switch ctx.kind:
      SelectKey:
        skip if key not in triggerKeys
        → applySelectKeyRule(rule, ctx)
      Input / Delete:
        → matchAndApplyTextRule(rule, ctx)

    first hit → return ApplyResult
  return null
```

### SelectKey rule semantics

- `trigger` = key pattern: single char `"-"` or character class `"[({"`
- `parseTriggerKeys("[({")` → `["(", "{"]`
- `replacement` receives `(selectionText, key)` for functions
- String templates support `${SELECTION}`, `${KEY}`, and tabstops

## Template Syntax

| Syntax | Meaning | Applicable types |
|--------|---------|-----------------|
| `$0`, `$1` ... | Tabstop (lower number = earlier in tab order) | all |
| `${0:default}` | Tabstop with default value | all |
| `${0:${SELECTION}}` | Tabstop defaulting to selected text | selectKey |
| `${KEY}` | Trigger key (standalone or in tabstop default) | selectKey |
| `${SELECTION}` | Selected text (standalone or in tabstop default) | selectKey |
| `[[0]]`, `[[1]]` | Regex capture group (plain substitution) | input/delete |

### Template expansion pipeline

1. **expandVariables**: resolve `[[n]]` capture groups, standalone `${SELECTION}` / `${KEY}`
2. **parseTabstops**: resolve `$n`, `${n:default}` (including nested `${SELECTION}` / `${KEY}` in defaults), produce final text + `TabstopSpec[]`

## File Storage

### File structure

```
.obsidian/plugins/easy-typing-obsidian/
  ├── builtin-rules.json     // built-in rules (user-editable)
  ├── user-rules.json        // user custom rules
  ├── data.json              // settings (includes deletedBuiltinRuleIds)
  └── main.js
```

Both files are `SimpleRule[]` in JSON format.

### Settings addition

```typescript
export interface EasyTypingSettings {
  // ... existing fields
  deletedBuiltinRuleIds: string[];  // blacklist of deleted built-in rule IDs
}
```

### Built-in rules have fixed IDs

```typescript
const DEFAULT_BUILTIN_RULES: (SimpleRule & { id: string })[] = [
  { id: 'builtin-001', trigger: '··', replacement: '`$0`$1', priority: 10, description: '中文点转代码' },
  // ...
];
```

### Plugin initialization

```
onload():
  if builtin-rules.json not exists:
    write DEFAULT_BUILTIN_RULES
  else:
    mergeBuiltinRules()       // append new rules by id, skip existing & deleted

  if user-rules.json not exists:
    write []

  load both files → ruleEngine.loadFromFiles(builtin, user)
```

### Plugin update merge

```typescript
async mergeBuiltinRules(): Promise<void> {
  const current = await loadRulesFile(BUILTIN_RULES_FILE);
  const existingIds = new Set(current.map(r => r.id).filter(Boolean));
  const deletedIds = new Set(this.settings.deletedBuiltinRuleIds);

  const newRules = DEFAULT_BUILTIN_RULES.filter(
    r => !existingIds.has(r.id) && !deletedIds.has(r.id)
  );
  if (newRules.length === 0) return;

  await saveRulesFile(BUILTIN_RULES_FILE, [...current, ...newRules]);
}
```

### UI operations → persistence

| UI action | Engine call | File operation |
|-----------|-----------|----------------|
| Toggle enable/disable | `setEnabled(id, bool)` | Save to corresponding file |
| Edit rule | `updateRule(id, patch)` | Save to corresponding file |
| Delete built-in rule | `removeRule(id)` | Remove from `builtin-rules.json` + add id to `deletedBuiltinRuleIds` in `data.json` |
| Delete user rule | `removeRule(id)` | Remove from `user-rules.json` |
| Restore deleted built-in | `addSimpleRule(default)` | Add to `builtin-rules.json` + remove id from blacklist |
| Reset all built-in | `loadFromFiles(DEFAULT, user)` | Overwrite `builtin-rules.json` + clear blacklist |
| Add user rule | `addSimpleRule(rule)` | Append to `user-rules.json` |
| Import rules file | `addSimpleRules(rules)` | Append to `user-rules.json` |

## Refactor Scope

- **In scope**: `src/rule_engine.ts` (new), type definitions, rule parsing, matching, execution, template expansion, file I/O helpers
- **Minimal changes**: `src/main.ts` (replace rule arrays with RuleEngine instance, construct TxContext in existing hooks), `src/settings.ts` (add `deletedBuiltinRuleIds`)
- **Not in scope**: `transactionFilterPlugin` / `viewUpdatePlugin` overall structure, settings UI redesign, `src/core.ts` LineFormater
