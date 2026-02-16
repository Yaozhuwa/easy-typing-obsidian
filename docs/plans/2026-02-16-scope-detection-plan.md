# Scope 检测实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让规则引擎在匹配规则时自动检测光标所在位置的实际 scope（Text / Code / Formula），并支持按代码块语言过滤，替代当前硬编码的 `RuleScope.All`。

**Architecture:** 在 `syntax.ts` 新增 `detectRuleScope()` 函数，使用 CodeMirror 语法树 `resolveInner()` 检测光标位置的 scope 类型。扩展 `TxContext`/`ConvertRule`/`SimpleRule` 以传递和存储 `scopeLanguage`。在三处 TxContext 构建点调用检测函数替代硬编码 `RuleScope.All`。在设置 UI 中为 Code scope 添加语言文本框。

**Tech Stack:** TypeScript, CodeMirror 6 (`@codemirror/language`), Obsidian API

**Design Doc:** `docs/plans/2026-02-16-scope-detection-design.md`

---

### Task 1: 新增 `detectRuleScope()` 函数

**Files:**
- Modify: `src/syntax.ts:1-4` (imports) + append function at end

**Step 1: 在 `syntax.ts` 顶部添加 import**

在现有 imports 后追加：

```typescript
import { RuleScope } from './rule_engine';
```

**Step 2: 在 `syntax.ts` 底部添加 `ScopeInfo` 接口和 `detectRuleScope()` 函数**

在文件末尾追加：

```typescript
export interface ScopeInfo {
    scope: RuleScope;
    language?: string;
}

export function detectRuleScope(state: EditorState, pos: number): ScopeInfo {
    const tree = syntaxTree(state);
    const node = tree.resolveInner(pos, -1);
    const name = node.name;

    if (name.contains('math')) {
        return { scope: RuleScope.Formula };
    }

    if (name.contains('code') && !name.contains('link')) {
        const codeBlockInfo = getCodeBlockInfoInPos(state, pos);
        return {
            scope: RuleScope.Code,
            language: codeBlockInfo?.language || undefined,
        };
    }

    return { scope: RuleScope.Text };
}
```

逻辑说明：
- 使用 `resolveInner(pos, -1)` 取光标位置最深语法节点（`-1` 表示偏向左侧）
- 节点名含 `math` → Formula（包括行内公式 `$` 和公式块 `$$`）
- 节点名含 `code` 且不含 `link` → Code（含行内代码和代码块）
  - 行内代码：`getCodeBlockInfoInPos` 返回 `null`，`language` 为 `undefined`
  - 代码块：`language` 为具体语言名（如 `'python'`、`'java'`）
- 其他 → Text
- 判断逻辑与 `core.ts:49` 的 `syntaxTreeNodeNameType()` 一致

**Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功，无错误

**Step 4: Commit**

```bash
git add src/syntax.ts
git commit -m "feat: add detectRuleScope() for cursor-level scope detection"
```

---

### Task 2: 扩展规则引擎支持 `scopeLanguage`

**Files:**
- Modify: `src/rule_engine.ts:45-67` (SimpleRule, TxContext, ConvertRule interfaces)
- Modify: `src/rule_engine.ts:181-236` (normalizeRule method)
- Modify: `src/rule_engine.ts:432-441` (process method scope check)

**Step 1: 扩展 `SimpleRule` 接口**

在 `src/rule_engine.ts:56`（`description` 字段后面）添加：

```typescript
scope_language?: string;  // Code scope 下限定代码块语言，如 'python'
```

**Step 2: 扩展 `TxContext` 接口**

在 `src/rule_engine.ts:65`（`scopeHint` 字段后面）添加：

```typescript
scopeLanguage?: string;   // 仅 Code scope 时有值
```

**Step 3: 扩展 `ConvertRule` 接口**

在 `src/rule_engine.ts:33`（`scope` 字段后面）添加：

```typescript
scopeLanguage?: string;   // 限定代码块语言
```

**Step 4: 在 `normalizeRule()` 中读入 `scope_language`**

在 `normalizeRule` 方法的两个 `return` 语句中都添加 `scopeLanguage` 字段。

SelectKey 分支（约 line 203-213），在 `replacement` 后添加：

```typescript
scopeLanguage: simple.scope_language,
```

Input/Delete 分支（约 line 221-236），在 `replacement` 后添加：

```typescript
scopeLanguage: simple.scope_language,
```

**Step 5: 在 `process()` 的 scope 检查后追加语言检查**

在 `src/rule_engine.ts:440`（现有 scope 检查行之后）添加一行：

```typescript
if (rule.scopeLanguage && ctx.scopeLanguage !== rule.scopeLanguage) continue;
```

完整的两行检查将是：
```typescript
// Scope check: RuleScope.All on either side means "no restriction"
if (ctx.scopeHint !== RuleScope.All && !rule.scope.includes(RuleScope.All) && !rule.scope.includes(ctx.scopeHint)) continue;
// Language check: rule specifies language → must match exactly
if (rule.scopeLanguage && ctx.scopeLanguage !== rule.scopeLanguage) continue;
```

**Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功，无错误。现有代码不传 `scopeLanguage`，新字段为 optional，不影响已有行为。

**Step 7: Commit**

```bash
git add src/rule_engine.ts
git commit -m "feat: extend rule engine with scopeLanguage support"
```

---

### Task 3: 三处调用点接入 `detectRuleScope`

**Files:**
- Modify: `src/cm_extensions.ts:7,10` (imports) + lines 44, 230 (TxContext 构建)
- Modify: `src/rule_processor.ts:3` (imports) + line 15 (TxContext 构建)

**Step 1: 修改 `cm_extensions.ts` imports**

在 `src/cm_extensions.ts:10`，将：
```typescript
import { getCodeBlockInfoInPos, isCodeBlockInPos } from './syntax';
```
改为：
```typescript
import { getCodeBlockInfoInPos, isCodeBlockInPos, detectRuleScope } from './syntax';
```

**Step 2: 修改 SelectKey 的 TxContext（`cm_extensions.ts:38-47`）**

将 `scopeHint: RuleScope.All,` 替换为使用 `detectRuleScope`：

```typescript
const selCtx: TxContext = {
    kind: RuleType.SelectKey,
    docText: tr.startState.doc.toString(),
    selection: { from: fromA, to: toA },
    inserted: insertedStr,
    changeType: changeTypeStr,
    scopeHint: detectRuleScope(tr.startState, fromA).scope,
    scopeLanguage: detectRuleScope(tr.startState, fromA).language,
    key: insertedStr,
    debug: ctx.settings?.debug,
};
```

优化：提取变量避免重复调用：

```typescript
const selScope = detectRuleScope(tr.startState, fromA);
const selCtx: TxContext = {
    kind: RuleType.SelectKey,
    docText: tr.startState.doc.toString(),
    selection: { from: fromA, to: toA },
    inserted: insertedStr,
    changeType: changeTypeStr,
    scopeHint: selScope.scope,
    scopeLanguage: selScope.language,
    key: insertedStr,
    debug: ctx.settings?.debug,
};
```

说明：SelectKey 使用 `fromA`（选区起始位置）检测 scope。

**Step 3: 修改 Delete 的 TxContext（`cm_extensions.ts:224-232`）**

```typescript
const delScope = detectRuleScope(tr.startState, toA);
const delCtx: TxContext = {
    kind: RuleType.Delete,
    docText: tr.startState.doc.toString(),
    selection: { from: toA, to: toA },
    inserted: '',
    changeType: changeTypeStr,
    scopeHint: delScope.scope,
    scopeLanguage: delScope.language,
    debug: ctx.settings?.debug,
};
```

说明：Delete 使用 `toA`（Backspace 光标位置）检测 scope。

**Step 4: 修改 `rule_processor.ts` imports**

在 `src/rule_processor.ts:3`，将：
```typescript
import { RuleType, TxContext, RuleScope } from './rule_engine';
```
改为：
```typescript
import { RuleType, TxContext } from './rule_engine';
```

并添加新 import：
```typescript
import { detectRuleScope } from './syntax';
```

注意：不再需要 `RuleScope` import，因为不再使用 `RuleScope.All`。

**Step 5: 修改 Input 的 TxContext（`rule_processor.ts:8-17`）**

```typescript
export function triggerCvtRule(ctx: PluginContext, view: EditorView, cursor_pos: number, changeType: string = 'input.type'): boolean {
    const inputScope = detectRuleScope(view.state, cursor_pos);
    const cvtCtx: TxContext = {
        kind: RuleType.Input,
        docText: view.state.doc.toString(),
        selection: { from: cursor_pos, to: cursor_pos },
        inserted: '',
        changeType: changeType,
        scopeHint: inputScope.scope,
        scopeLanguage: inputScope.language,
        debug: ctx.settings?.debug,
    };
```

说明：Input 使用 `cursor_pos`（输入光标位置）检测 scope。

**Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功。此时三处调用点均使用真实 scope 检测，规则引擎的 scope 过滤正式生效。

**Step 7: Commit**

```bash
git add src/cm_extensions.ts src/rule_processor.ts
git commit -m "feat: wire up detectRuleScope at all TxContext creation sites"
```

---

### Task 4: 设置 UI 支持 `scope_language`

**Files:**
- Modify: `src/lang/locale/types.ts:47` (Locale type)
- Modify: `src/lang/locale/en-US.ts:154` (en-US locale)
- Modify: `src/lang/locale/zh-CN.ts:153` (zh-CN locale)
- Modify: `src/lang/locale/zh-TW.ts:153` (zh-TW locale)
- Modify: `src/lang/locale/ru-RU.ts:155` (ru-RU locale)
- Modify: `src/settings.ts:852-869` (RuleEditModal form state)
- Modify: `src/settings.ts:1002-1012` (Scope dropdown in onOpen)
- Modify: `src/settings.ts:1048-1096` (refreshVisibility)
- Modify: `src/settings.ts:1098-1118` (buildSimpleRule)

**Step 1: 添加 locale 字符串**

`types.ts` 中 `ruleEditModal` 部分，在 `fieldScope` 后添加：
```typescript
fieldScopeLanguage: string;
```

`en-US.ts`，`fieldScope` 之后：
```typescript
fieldScopeLanguage: "Language (optional)",
```

`zh-CN.ts`，`fieldScope` 之后：
```typescript
fieldScopeLanguage: "语言（可选）",
```

`zh-TW.ts`，`fieldScope` 之后：
```typescript
fieldScopeLanguage: "語言（可選）",
```

`ru-RU.ts`，`fieldScope` 之后：
```typescript
fieldScopeLanguage: "Язык (необязательно)",
```

**Step 2: `RuleEditModal` 添加 `scopeLanguage` 状态字段**

在 `src/settings.ts:864`（`ruleScope` 字段后面）添加：

```typescript
scopeLanguage: string = '';
```

**Step 3: 构造函数中读入 `scope_language`**

在 `src/settings.ts:889`（`this.ruleScope = opts.scope[0] || RuleScope.All;` 之后）添加：

```typescript
if (initial.scope_language !== undefined) this.scopeLanguage = initial.scope_language;
```

注意：`scope_language` 不在 `options` 中解析，而是 `SimpleRule` 的独立字段，需要从 `initial` 直接读取。但当前 `SimpleRule` 还没有此字段的 UI 输入。我们需要检查 `initial` 中是否有 `scope_language`。由于 Task 2 已在 `SimpleRule` 中添加了 `scope_language` 字段，编辑已有规则时会从 JSON 中带入。

**Step 4: `onOpen()` 中 Scope 下拉框后添加语言文本框**

在 Scope dropdown 代码块（`src/settings.ts:1002-1012`）之后，Priority 代码块之前，插入：

```typescript
// Scope Language (only visible when scope is Code)
const scopeLangSetting = new Setting(contentEl)
    .setName(locale.settings.ruleEditModal.fieldScopeLanguage)
    .addText(text => {
        text.setPlaceholder('e.g. python, javascript');
        text.setValue(this.scopeLanguage);
        text.onChange(v => this.scopeLanguage = v.trim().toLowerCase());
    });
scopeLangSetting.settingEl.dataset.field = 'scopeLanguage';
```

同时修改 Scope dropdown 的 `onChange` 回调以触发 `refreshVisibility`：

将 `src/settings.ts:1011`：
```typescript
dropdown.onChange((v: string) => this.ruleScope = v as RuleScope);
```
改为：
```typescript
dropdown.onChange((v: string) => {
    this.ruleScope = v as RuleScope;
    this.refreshVisibility(contentEl);
});
```

**Step 5: `refreshVisibility()` 中控制语言文本框显隐**

在 `refreshVisibility` 方法末尾（`src/settings.ts:1096` 之前）添加：

```typescript
// Scope Language only visible when scope is Code
const scopeLangEl = contentEl.querySelector('[data-field="scopeLanguage"]') as HTMLElement;
if (scopeLangEl) {
    scopeLangEl.style.display = this.ruleScope === RuleScope.Code ? '' : 'none';
}
```

**Step 6: `buildSimpleRule()` 中写入 `scope_language`**

在 `src/settings.ts:1116`（`enabled: this.enabled,` 之后）添加：

```typescript
scope_language: (this.ruleScope === RuleScope.Code && this.scopeLanguage) ? this.scopeLanguage : undefined,
```

完整的 `buildSimpleRule` return 语句将是：

```typescript
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
```

**Step 7: 构建验证**

Run: `npm run build`
Expected: 构建成功。

**Step 8: Commit**

```bash
git add src/settings.ts src/lang/locale/types.ts src/lang/locale/en-US.ts src/lang/locale/zh-CN.ts src/lang/locale/zh-TW.ts src/lang/locale/ru-RU.ts
git commit -m "feat: add scope language field to rule edit UI"
```
