# Function Replacement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable rules to use JavaScript function bodies as replacements, compiled via `new Function()`, with the `F` options flag.

**Architecture:** Add `F` flag to `parseOptions()`, compile function strings in `normalizeRule()`, wrap execution in error-handling in `applyReplacement()`. Settings UI gets an "Is Function" toggle and `Fn` badge. All changes are additive — existing string rules are unaffected.

**Tech Stack:** TypeScript, Obsidian API (`Notice`), CodeMirror 6 (unchanged)

---

### Task 1: Add `F` flag parsing to `parseOptions()`

**Files:**
- Modify: `src/rule_engine.ts:98-123`

**Step 1: Update return type**

In `parseOptions()`, add `isFunctionReplacement: boolean` to the return type and parse it from the options string.

```typescript
static parseOptions(options: string = ''): {
	type: RuleType;
	triggerMode: RuleTriggerMode;
	isRegex: boolean;
	isFunctionReplacement: boolean;
	scope: RuleScope[];
} {
	// ... existing code ...
	const isFunctionReplacement = options.includes('F');

	return { type, triggerMode, isRegex, isFunctionReplacement, scope };
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Any callers of `parseOptions()` that destructure will simply ignore the new field.

**Step 3: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: add F flag parsing in parseOptions()"
```

---

### Task 2: Compile function bodies in `normalizeRule()`

**Files:**
- Modify: `src/rule_engine.ts:164-196`

**Step 1: Add compilation logic**

After `const opts = RuleEngine.parseOptions(simple.options);`, add function compilation when `F` flag is present and replacement is a string:

```typescript
static normalizeRule(simple: SimpleRule): Omit<ConvertRule, 'id'> {
	const opts = RuleEngine.parseOptions(simple.options);

	// Compile function replacement when F flag is present
	let replacement: ConvertRule['replacement'] = simple.replacement;
	if (opts.isFunctionReplacement && typeof simple.replacement === 'string') {
		try {
			if (opts.type === RuleType.SelectKey) {
				replacement = new Function('selectionText', 'key', simple.replacement) as
					(selectionText: string, key: string) => string | void;
			} else {
				replacement = new Function('leftMatches', 'rightMatches', simple.replacement) as
					(leftMatches: string[], rightMatches: string[]) => string | void;
			}
		} catch (e) {
			console.error(`[RuleEngine] Failed to compile function for rule "${simple.id ?? '?'}":`, e);
			// Use no-op function so rule is effectively disabled
			replacement = () => undefined;
			// Notify user — import { Notice } from 'obsidian' at top of file
			new Notice(`[EasyTyping] Rule "${simple.id ?? '?'}" has invalid function body: ${(e as Error).message}`);
		}
	}

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
			replacement,
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
		replacement,
	};
}
```

**Step 2: Add import**

Add `Notice` import at top of `rule_engine.ts`:

```typescript
import { Notice } from 'obsidian';
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: compile function replacement strings in normalizeRule()"
```

---

### Task 3: Add runtime error handling in `applyReplacement()`

**Files:**
- Modify: `src/rule_engine.ts:454-496`

**Step 1: Add debounced error notification**

Add a private field and helper method to `RuleEngine`:

```typescript
// Add as class field (after line 94)
private fnErrorLastNotify: Map<string, number> = new Map();

// Add as method (before process())
private notifyFunctionError(ruleId: string, error: unknown): void {
	const now = Date.now();
	const last = this.fnErrorLastNotify.get(ruleId) ?? 0;
	if (now - last > 5000) {
		this.fnErrorLastNotify.set(ruleId, now);
		const msg = error instanceof Error ? error.message : String(error);
		new Notice(`[EasyTyping] Rule "${ruleId}" runtime error: ${msg}`);
	}
	console.error(`[RuleEngine] Runtime error in rule "${ruleId}":`, error);
}
```

**Step 2: Wrap function calls in try/catch**

In `applyReplacement()`, wrap the existing function invocation block (lines 461-472) in try/catch:

```typescript
if (typeof rule.replacement === 'function') {
	try {
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
	} catch (e) {
		this.notifyFunctionError(rule.id, e);
		return null;
	}
} else {
	text = rule.replacement;
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: add runtime error handling for function rules"
```

---

### Task 4: Add locale strings for function UI

**Files:**
- Modify: `src/lang/locale/en-US.ts:147-160` (ruleEditModal section)
- Modify: `src/lang/locale/zh-CN.ts:148-161`
- Modify: `src/lang/locale/zh-TW.ts` (same section)
- Modify: `src/lang/locale/ru-RU.ts` (same section)

**Step 1: Add strings to all locale files**

In each locale's `ruleEditModal` object, add:

**en-US.ts:**
```typescript
fieldIsFunction: "Is Function",
functionHintInputDelete: "Available args: leftMatches (string[]), rightMatches (string[]). Return a string or undefined to skip.",
functionHintSelectKey: "Available args: selectionText (string), key (string). Return a string or undefined to skip.",
functionPlaceholder: "// Example:\nconst d = new Date();\nreturn `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}$0`;",
```

**zh-CN.ts:**
```typescript
fieldIsFunction: "函数替换",
functionHintInputDelete: "可用参数：leftMatches (string[])、rightMatches (string[])。返回字符串或 undefined 跳过。",
functionHintSelectKey: "可用参数：selectionText (string)、key (string)。返回字符串或 undefined 跳过。",
functionPlaceholder: "// 示例：\nconst d = new Date();\nreturn `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}$0`;",
```

**zh-TW.ts and ru-RU.ts:** Same pattern, translated appropriately.

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lang/locale/
git commit -m "feat: add locale strings for function replacement UI"
```

---

### Task 5: Add `Fn` tag to rule list and "Is Function" toggle to `RuleEditModal`

**Files:**
- Modify: `src/settings.ts:545-616` (buildRuleItem)
- Modify: `src/settings.ts:730-916` (RuleEditModal)
- Modify: `styles.css`

**Step 1: Add `Fn` badge in `buildRuleItem()`**

In `buildRuleItem()` (around line 546), parse `isFunctionReplacement` from options and add the tag in the `createFragment` callback:

```typescript
buildRuleItem(container: HTMLElement, rule: SimpleRule, isBuiltin: boolean): void {
	const opts = RuleEngine.parseOptions(rule.options);
	const typeLabel = this.getRuleTypeLabel(opts.type);
	const typeCls = this.getRuleTypeCls(opts.type);
	const enabled = rule.enabled !== false;
	const isTab = opts.triggerMode === RuleTriggerMode.Tab;
	const isFn = opts.isFunctionReplacement;  // NEW

	// ... preview code unchanged ...

	const setting = new Setting(container)
		.setClass('et-rule-item')
		.setName(createFragment(f => {
			f.createSpan({ cls: `et-rule-type-tag ${typeCls}`, text: typeLabel });
			const modeTag = f.createSpan({
				cls: `et-rule-trigger-mode ${isTab ? 'et-trigger-mode-tab' : 'et-trigger-mode-auto'}`,
				text: isTab ? 'Tab' : 'Auto',
			});
			// ... existing modeTag event listener ...
			if (isFn) {
				f.createSpan({ cls: 'et-rule-type-tag et-rule-type-fn', text: 'Fn' });
			}
			f.createSpan({ text: preview });
		}))
		// ... rest unchanged ...
```

**Step 2: Add CSS for `Fn` tag**

In `styles.css`, add after the `.et-rule-type-selectkey` block:

```css
.et-rule-type-fn {
    background-color: rgba(156, 39, 176, 0.15);
    color: #9c27b0;
    border: 1px solid rgba(156, 39, 176, 0.3);
}
```

**Step 3: Add form state and toggle to `RuleEditModal`**

Add `isFunction: boolean = false;` to the form state fields (line ~741).

In the constructor, parse it from initial options:
```typescript
if (initial.options !== undefined || initial.trigger !== undefined) {
	const opts = RuleEngine.parseOptions(initial.options);
	this.ruleType = opts.type;
	this.triggerMode = opts.triggerMode;
	this.isRegex = opts.isRegex;
	this.isFunction = opts.isFunctionReplacement;  // NEW
	this.ruleScope = opts.scope[0] || RuleScope.All;
}
```

In `onOpen()`, add the toggle **after the "Is Regex" toggle** (after line ~837):

```typescript
// Is Function
const fnSetting = new Setting(contentEl)
	.setName(locale.settings.ruleEditModal.fieldIsFunction)
	.addToggle(toggle => {
		toggle.setValue(this.isFunction);
		toggle.onChange(v => {
			this.isFunction = v;
			this.refreshVisibility(contentEl);
		});
	});
fnSetting.settingEl.dataset.field = 'isFunction';
```

**Step 4: Add function hint label**

After the replacement textarea (after line ~829), add a hint element:

```typescript
// Function hint (hidden when not function mode)
const fnHint = contentEl.createEl('div', {
	cls: 'setting-item-description',
	text: '',
});
fnHint.dataset.field = 'fnHint';
fnHint.style.marginTop = '-10px';
fnHint.style.marginBottom = '10px';
fnHint.style.fontSize = '12px';
fnHint.style.fontFamily = 'var(--font-monospace)';
```

**Step 5: Update `refreshVisibility()` to handle function mode**

```typescript
refreshVisibility(contentEl: HTMLElement) {
	const triggerRightEl = contentEl.querySelector('[data-field="triggerRight"]') as HTMLElement;
	if (triggerRightEl) {
		triggerRightEl.style.display = this.ruleType === EngineRuleType.SelectKey ? 'none' : '';
	}

	// Function hint
	const fnHint = contentEl.querySelector('[data-field="fnHint"]') as HTMLElement;
	if (fnHint) {
		fnHint.style.display = this.isFunction ? '' : 'none';
		fnHint.textContent = this.ruleType === EngineRuleType.SelectKey
			? locale.settings.ruleEditModal.functionHintSelectKey
			: locale.settings.ruleEditModal.functionHintInputDelete;
	}

	// Make replacement textarea monospace when function mode is on
	const replacementArea = contentEl.querySelector('textarea') as HTMLTextAreaElement;
	if (replacementArea) {
		if (this.isFunction) {
			replacementArea.style.fontFamily = 'var(--font-monospace)';
			replacementArea.style.minHeight = '120px';
			if (!replacementArea.value) {
				replacementArea.placeholder = locale.settings.ruleEditModal.functionPlaceholder;
			}
		} else {
			replacementArea.style.fontFamily = '';
			replacementArea.style.minHeight = '60px';
			replacementArea.placeholder = '';
		}
	}
}
```

**Step 6: Update `buildSimpleRule()` to include `F` flag**

In `buildSimpleRule()` (line ~892):

```typescript
buildSimpleRule(): SimpleRule {
	let options = '';
	if (this.ruleType === EngineRuleType.Delete) options += 'd';
	else if (this.ruleType === EngineRuleType.SelectKey) options += 's';
	if (this.triggerMode === RuleTriggerMode.Tab) options += 'T';
	if (this.isRegex) options += 'r';
	if (this.isFunction) options += 'F';  // NEW
	if (this.ruleScope === RuleScope.Text) options += 't';
	else if (this.ruleScope === RuleScope.Formula) options += 'f';
	else if (this.ruleScope === RuleScope.Code) options += 'c';

	return {
		trigger: this.trigger,
		trigger_right: this.triggerRight || undefined,
		replacement: this.replacement,
		options: options || undefined,
		priority: this.priority,
		description: this.description || undefined,
		enabled: this.enabled,
	};
}
```

**Step 7: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 8: Commit**

```bash
git add src/settings.ts styles.css
git commit -m "feat: add Fn tag badge and Is Function toggle in settings UI"
```

---

### Task 6: Update CLAUDE.md documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add `F` flag to options table**

In the `#### options 标志` table, add a row:

```markdown
| `F` | replacement 为函数体（JS 代码） |
```

**Step 2: Add function replacement section**

After the `#### 替换模板语法` section, add:

```markdown
#### 函数替换（F 标志）

当 options 包含 `F` 时，replacement 字段被视为 JavaScript 函数体，通过 `new Function()` 编译。

**参数**：
- Input/Delete 规则：`leftMatches: string[]`, `rightMatches: string[]`
- SelectKey 规则：`selectionText: string`, `key: string`

**返回值**：
- 返回 `string` → 进入标准模板处理管道（支持 `$0`、`[[1]]` 等）
- 返回 `undefined` → 跳过此规则

**示例**：
```jsonc
// 输入 /date 插入当前日期
{ "trigger": "/date", "replacement": "const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}$0`;", "options": "F" }
```
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document F flag for function replacement in CLAUDE.md"
```

---

### Task 7: Verify end-to-end

**Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Manual verification in Obsidian**

1. Open Obsidian with the plugin loaded
2. Go to Settings → Easy Typing → User Rules
3. Click "+" to add a new rule:
   - Type: Input
   - Trigger: `/date`
   - Is Function: ON
   - Replacement: `const d = new Date(); return d.toISOString().slice(0,10) + '$0';`
   - Description: "Insert current date"
4. Save and type `/date` in a note → should insert today's date
5. Test error handling: create a rule with `throw new Error("test")` → should see Notice on trigger
6. Test syntax error: create a rule with `if (` → should see Notice on save/load
7. Verify existing string rules still work unchanged

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

## File Summary

| File | Type of Change |
|------|---------------|
| `src/rule_engine.ts` | `parseOptions()` + `normalizeRule()` + `applyReplacement()` + error handling |
| `src/settings.ts` | `RuleEditModal` toggle + `buildRuleItem()` Fn badge + `refreshVisibility()` |
| `styles.css` | `.et-rule-type-fn` CSS class |
| `src/lang/locale/en-US.ts` | 4 new strings |
| `src/lang/locale/zh-CN.ts` | 4 new strings |
| `src/lang/locale/zh-TW.ts` | 4 new strings |
| `src/lang/locale/ru-RU.ts` | 4 new strings |
| `CLAUDE.md` | Document `F` flag |
