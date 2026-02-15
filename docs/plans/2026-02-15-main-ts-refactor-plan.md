# main.ts 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 2220 行的 `main.ts` 拆分为 7 个职责清晰的模块，使其缩减至 ~350 行。

**Architecture:** 混合模式 — 无状态逻辑用独立函数 + PluginContext，有状态管理用 RuleManager 类，CM6 扩展用工厂函数。所有模块通过 `PluginContext` 接口与插件解耦。

**Tech Stack:** TypeScript, CodeMirror 6, Obsidian API

---

## Task 1: 创建 `plugin_context.ts`

**Files:**
- Create: `src/plugin_context.ts`

**Step 1: 创建接口文件**

```typescript
// src/plugin_context.ts
import { App } from 'obsidian';
import { EasyTypingSettings, PairString } from './settings';
import { RuleEngine } from './rule_engine';
import { LineFormater } from './core';

export interface PluginContext {
    settings: EasyTypingSettings;
    ruleEngine: RuleEngine;
    Formater: LineFormater;
    app: App;
    halfToFullSymbolMap: Map<string, string>;
    TaboutPairStrs: PairString[];
    compose_begin_pos: number;
    compose_end_pos: number;
    compose_need_handle: boolean;
    CurActiveMarkdown: string;
    onFormatArticle: boolean;
    getDefaultIndentChar(): string;
    saveSettings(): Promise<void>;
}
```

**Step 2: 验证构建**

Run: `npm run build`
Expected: PASS（新文件无人导入，不影响构建）

**Step 3: Commit**

```
git add src/plugin_context.ts
git commit -m "refactor: 添加 PluginContext 接口定义"
```

---

## Task 2: 提取 `comment_toggle.ts`

**Files:**
- Create: `src/comment_toggle.ts`
- Modify: `src/main.ts` — 删除 5 个方法（`toggleComment`, `toggleCodeBlockComment`, `toggleCodeBlockLineComment`, `toggleMarkdownComment`, `getCommentSymbol`），替换为导入调用

这是最独立的模块，不依赖 PluginContext，只需 `EditorView`。

**Step 1: 创建 `comment_toggle.ts`**

从 `main.ts:1198-1417` 搬运以下方法，转为独立函数：

- `toggleComment(view: EditorView): boolean` — 公开，入口函数
- `toggleCodeBlockComment(view: EditorView): boolean` — 内部
- `toggleCodeBlockLineComment(from, to, text, commentSymbol, cursor_pos?)` — 内部
- `toggleMarkdownComment(from, to, view: EditorView): boolean` — 内部
- `getCommentSymbol(language: string)` — 内部

注意事项：
- 原方法中 `this.toggleCodeBlockComment(view)` → `toggleCodeBlockComment(view)`
- 原方法中 `this.getCommentSymbol(...)` → `getCommentSymbol(...)`
- 原方法中 `this.toggleMarkdownComment(...)` → `toggleMarkdownComment(...)`
- 原 `toggleComment` 无 `debug` 参数（原代码实际未使用 settings.debug），保持原签名 `(view: EditorView): boolean`

导入需要：
```typescript
import { EditorView } from '@codemirror/view';
import { getCodeBlockInfoInPos } from './syntax';
```

**Step 2: 修改 `main.ts`**

1. 删除 `main.ts:1198-1417` 的 5 个方法
2. 添加导入：`import { toggleComment } from './comment_toggle';`
3. 更新 `onload()` 中命令注册（~line 217）：
   - 原：`(editor: Editor, view: MarkdownView) => this.toggleComment(editor.cm as EditorView)`
   - 改：`(editor: Editor, view: MarkdownView) => toggleComment(editor.cm as EditorView)`

**Step 3: 验证构建**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```
git add src/comment_toggle.ts src/main.ts
git commit -m "refactor: 提取注释切换逻辑到 comment_toggle.ts"
```

---

## Task 3: 提取 `rule_manager.ts`

**Files:**
- Create: `src/rule_manager.ts`
- Modify: `src/main.ts` — 删除 ~13 个方法，替换为 `ruleManager` 属性
- Modify: `src/settings.ts` — 将 `plugin.xxx()` 调用改为 `plugin.ruleManager.xxx()`

**Step 1: 创建 `rule_manager.ts`**

从 `main.ts:1991-2130` 搬运以下方法到 `RuleManager` 类：

```typescript
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

    private pluginPath(filename: string): string { ... }
    async loadRulesFile(filename: string): Promise<SimpleRule[]> { ... }
    async saveRulesFile(filename: string, rules: SimpleRule[]): Promise<void> { ... }
    async mergeBuiltinRules(): Promise<void> { ... }
    async initRuleEngine(): Promise<void> { ... }
    async deleteBuiltinRule(id: string): Promise<void> { ... }
    async restoreBuiltinRule(id: string): Promise<void> { ... }
    async resetAllBuiltinRules(): Promise<void> { ... }
    async addUserRule(rule: SimpleRule): Promise<string> { ... }
    async updateUserRule(id: string, rule: SimpleRule): Promise<void> { ... }
    async deleteUserRule(id: string): Promise<void> { ... }
    async updateBuiltinRule(id: string, rule: SimpleRule): Promise<void> { ... }
    async toggleRuleEnabled(id: string, isBuiltin: boolean, enabled: boolean): Promise<void> { ... }
    async updateRuleTriggerMode(id: string, isBuiltin: boolean, tabMode: boolean): Promise<void> { ... }
}
```

方法体内的转换：
- `this.pluginPath(...)` → `this.pluginPath(...)`（不变，方法在同类中）
- `this.app.vault.adapter` → `this.app.vault.adapter`（不变）
- `this.settings.deletedBuiltinRuleIds` → `this.settings.deletedBuiltinRuleIds`（不变）
- `await this.saveSettings()` → `await this.savePluginSettings()`

**Step 2: 修改 `main.ts`**

1. 删除 `main.ts:1991-2130` 的所有规则管理方法及相关属性（`cachedBuiltinRules`, `cachedUserRules`, `BUILTIN_RULES_FILE`, `USER_RULES_FILE`, `pluginPath`）
2. 添加属性：`ruleManager: RuleManager;`
3. 将 `ruleEngine` 属性改为 getter：`get ruleEngine() { return this.ruleManager.ruleEngine; }`
4. 更新 `onload()` 中初始化：
   ```typescript
   this.ruleManager = new RuleManager(this.app, this.manifest, this.settings, () => this.saveSettings());
   await this.ruleManager.initRuleEngine();
   ```
5. 添加代理方法供 settings.ts 调用（或直接更新 settings.ts 的调用）

**Step 3: 修改 `settings.ts`**

更新以下调用（共 ~12 处）：
- `this.plugin.resetAllBuiltinRules()` → `this.plugin.ruleManager.resetAllBuiltinRules()`
- `this.plugin.cachedBuiltinRules` → `this.plugin.ruleManager.cachedBuiltinRules`
- `this.plugin.cachedUserRules` → `this.plugin.ruleManager.cachedUserRules`
- `this.plugin.restoreBuiltinRule(id)` → `this.plugin.ruleManager.restoreBuiltinRule(id)`
- `this.plugin.addUserRule(rule)` → `this.plugin.ruleManager.addUserRule(rule)`
- `this.plugin.updateRuleTriggerMode(...)` → `this.plugin.ruleManager.updateRuleTriggerMode(...)`
- `this.plugin.toggleRuleEnabled(...)` → `this.plugin.ruleManager.toggleRuleEnabled(...)`
- `this.plugin.updateBuiltinRule(...)` → `this.plugin.ruleManager.updateBuiltinRule(...)`
- `this.plugin.updateUserRule(...)` → `this.plugin.ruleManager.updateUserRule(...)`
- `this.plugin.deleteBuiltinRule(...)` → `this.plugin.ruleManager.deleteBuiltinRule(...)`
- `this.plugin.deleteUserRule(...)` → `this.plugin.ruleManager.deleteUserRule(...)`

**Step 4: 验证构建**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```
git add src/rule_manager.ts src/main.ts src/settings.ts
git commit -m "refactor: 提取规则管理逻辑到 RuleManager 类"
```

---

## Task 4: 提取 `rule_processor.ts`

**Files:**
- Create: `src/rule_processor.ts`
- Modify: `src/main.ts` — 删除 3 个方法

**Step 1: 创建 `rule_processor.ts`**

从 `main.ts:1634-1716` 搬运以下方法，转为接收 `PluginContext` 的独立函数：

```typescript
import { EditorView } from '@codemirror/view';
import { PluginContext } from './plugin_context';
import { RuleType, TxContext, RuleScope } from './rule_engine';
import { tabstopSpecsToTabstopGroups } from './tabstop';
import { addTabstopsEffect } from './tabstops_state_field';
import { getPosLineType, LineType } from './core';

export function triggerCvtRule(ctx: PluginContext, view: EditorView, cursor_pos: number, changeType: string = 'input.type'): boolean { ... }
export function triggerPuncRectify(ctx: PluginContext, view: EditorView, change_from_pos: number): boolean { ... }
export function handleEndComposeTypeKey(ctx: PluginContext, event: KeyboardEvent, view: EditorView): void { ... }
```

方法体内的转换：
- `this.ruleEngine.process(...)` → `ctx.ruleEngine.process(...)`
- `this.settings?.debug` → `ctx.settings?.debug`
- `this.settings.PuncRectify` → `ctx.settings.PuncRectify`
- `this.halfToFullSymbolMap.get(...)` → `ctx.halfToFullSymbolMap.get(...)`
- `this.compose_need_handle` → `ctx.compose_need_handle`
- `this.compose_begin_pos` → `ctx.compose_begin_pos`
- `this.triggerCvtRule(...)` → `triggerCvtRule(ctx, ...)`
- `this.triggerPuncRectify(...)` → `triggerPuncRectify(ctx, ...)`
- `this.settings.AutoFormat` → `ctx.settings.AutoFormat`
- `this.isCurrentFileExclude()` → 暂时直接在此函数中内联该检查，或从 formatting_commands 导入（但该模块尚未创建）

**关于 `handleEndComposeTypeKey` 中对 `isCurrentFileExclude` 和 `Formater.formatLineOfDoc` 的调用：**
这两个依赖尚未提取。有两种处理方式：
1. 将它们作为 PluginContext 的方法暴露（需在接口中添加 `isCurrentFileExclude(): boolean`）
2. 延迟到 Task 5 提取 formatting_commands 后再处理

推荐方案 1：在 `PluginContext` 中添加 `isCurrentFileExclude(): boolean`，main.ts 中实现此方法。这样 rule_processor 可以直接调用 `ctx.isCurrentFileExclude()`。待 Task 5 提取后，`isCurrentFileExclude` 将从 formatting_commands 导入并在 main.ts 中代理。

**Step 2: 更新 `plugin_context.ts`**

添加 `isCurrentFileExclude(): boolean` 到接口。

**Step 3: 修改 `main.ts`**

1. 删除 `triggerCvtRule`, `triggerPuncRectify`, `handleEndComposeTypeKey` 三个方法
2. 添加导入：`import { triggerCvtRule, triggerPuncRectify, handleEndComposeTypeKey } from './rule_processor';`
3. 更新调用处（在 `viewUpdatePlugin` 和 `handleTabDown` 中）：
   - `this.triggerCvtRule(view, pos)` → `triggerCvtRule(this, view, pos)`
   - `this.triggerPuncRectify(view, pos)` → `triggerPuncRectify(this, view, pos)`
4. 更新 `onKeyup` 中的调用：
   - `this.handleEndComposeTypeKey(event, view)` → `handleEndComposeTypeKey(this, event, view)`

**Step 4: 验证构建**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```
git add src/rule_processor.ts src/plugin_context.ts src/main.ts
git commit -m "refactor: 提取规则处理逻辑到 rule_processor.ts"
```

---

## Task 5: 提取 `formatting_commands.ts`

**Files:**
- Create: `src/formatting_commands.ts`
- Modify: `src/main.ts` — 删除 7 个方法

**Step 1: 创建 `formatting_commands.ts`**

从 `main.ts:1718-1989` 搬运以下方法：

```typescript
import { Editor, MarkdownView, Notice } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { ensureSyntaxTree } from '@codemirror/language';
import { PluginContext } from './plugin_context';
import { getPosLineType, LineType } from './core';

export function isCurrentFileExclude(ctx: PluginContext): boolean { ... }
export function formatArticle(ctx: PluginContext, editor: Editor, view: MarkdownView): void { ... }
export function formatSelectionOrCurLine(ctx: PluginContext, editor: Editor, view: MarkdownView): void { ... }
export function preFormatOneLine(ctx: PluginContext, editor: Editor, lineNumber: number, ch?: number): [string, number] { ... }
export function deleteBlankLines(ctx: PluginContext, editor: Editor): void { ... }
export function convert2CodeBlock(ctx: PluginContext, editor: Editor): void { ... }
export function switchAutoFormatting(ctx: PluginContext): void { ... }
```

方法体内的转换：
- `this.onFormatArticle = true` → `ctx.onFormatArticle = true`
- `this.preFormatOneLine(...)` → `preFormatOneLine(ctx, ...)`
- `this.Formater.formatLine(...)` → `ctx.Formater.formatLine(...)`
- `this.settings` → `ctx.settings`
- `this.CurActiveMarkdown` → `ctx.CurActiveMarkdown`
- `this.app` → `ctx.app`

注意 `convert2CodeBlock` 和 `switchAutoFormatting` 实际上只用 `editor` 和 `ctx.settings`，依赖很少。

**Step 2: 修改 `main.ts`**

1. 删除 `formatArticle`, `isCurrentFileExclude`, `formatSelectionOrCurLine`, `formatOneLine`（废弃函数直接删除）, `preFormatOneLine`, `deleteBlankLines`, `switchAutoFormatting`, `convert2CodeBlock` 共 8 个方法
2. 添加导入
3. 更新 `onload()` 中所有命令回调：
   - `this.formatArticle(editor, view)` → `formatArticle(this, editor, view)`
   - `this.formatSelectionOrCurLine(editor, view)` → `formatSelectionOrCurLine(this, editor, view)`
   - `this.deleteBlankLines(editor)` → `deleteBlankLines(this, editor)`
   - `this.convert2CodeBlock(editor)` → `convert2CodeBlock(this, editor)`
   - `this.switchAutoFormatting()` → `switchAutoFormatting(this)`
   - `this.selectBlockInCurser(...)` → 留在键盘处理中（Task 6）
4. 更新 `viewUpdatePlugin` 中对 `isCurrentFileExclude` 的调用：
   - `this.isCurrentFileExclude()` → `isCurrentFileExclude(this)`
5. main.ts 上的 `isCurrentFileExclude()` 方法现在可以代理到导入的函数：
   ```typescript
   isCurrentFileExclude() { return isCurrentFileExclude_fn(this); }
   ```
   （因为 PluginContext 接口要求它，而 rule_processor 已经通过 ctx 调用它）

**Step 3: 验证构建**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```
git add src/formatting_commands.ts src/main.ts
git commit -m "refactor: 提取格式化命令到 formatting_commands.ts"
```

---

## Task 6: 提取 `keyboard_handlers.ts`

**Files:**
- Create: `src/keyboard_handlers.ts`
- Modify: `src/main.ts` — 删除 ~9 个方法（~900 行，最大的一步）

这是最大的提取。键盘 handler 将按设计拆为链式子函数。

**Step 1: 创建 `keyboard_handlers.ts`**

从 `main.ts:731-1632`（加上 1419-1495）搬运，重构为：

```typescript
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { MarkdownView } from 'obsidian';
import { PluginContext } from './plugin_context';
import { triggerCvtRule } from './rule_processor';
import { isCurrentFileExclude } from './formatting_commands';
import { isCodeBlockInPos, getCodeBlockInfoInPos, getQuoteInfoInPos, selectCodeBlockInPos } from './syntax';
import { getPosLineType, getPosLineType2, LineType } from './core';
import { consumeAndGotoNextTabstop } from './tabstops_state_field';
import { taboutCursorInPairedString } from './utils';
import { StrictLineMode } from './settings';

// ===== Tab =====
function tabTabstopJump(view: EditorView): boolean { ... }
function tabTriggerRule(ctx: PluginContext, view: EditorView): boolean { ... }
function tabCodeBlockIndent(ctx: PluginContext, view: EditorView): boolean { ... }
function tabInlineCodeEscape(ctx: PluginContext, view: EditorView): boolean { ... }
function tabPairStringTabout(ctx: PluginContext, view: EditorView): boolean { ... }

export function handleTabDown(ctx: PluginContext, view: EditorView): boolean {
    return tabTabstopJump(view)
        || tabTriggerRule(ctx, view)
        || tabCodeBlockIndent(ctx, view)
        || tabInlineCodeEscape(ctx, view)
        || tabPairStringTabout(ctx, view);
}

// ===== Enter =====
function enterCollapsedHeading(ctx: PluginContext, view: EditorView): boolean { ... }
function enterCodeBlockIndent(ctx: PluginContext, view: EditorView): boolean { ... }
function enterStrictLineBreak(ctx: PluginContext, view: EditorView): boolean { ... }

export function handleEnter(ctx: PluginContext, view: EditorView): boolean {
    const state = view.state;
    const s = state.selection;
    if (s.ranges.length > 1) return false;

    return enterCollapsedHeading(ctx, view)
        || enterCodeBlockIndent(ctx, view)
        || enterStrictLineBreak(ctx, view);
}

// ===== Backspace =====
function backspaceEmptyQuote(...): { changes: any[]; cursor: number } | null { ... }
function backspaceEmptyListItem(...): { changes: any[]; cursor: number } | null { ... }

export function handleBackspace(view: EditorView): boolean { ... }

// ===== 其他 =====
export function handleShiftEnter(ctx: PluginContext, view: EditorView): boolean { ... }
export function handleModA(ctx: PluginContext, view: EditorView): boolean { ... }
export function goNewLineAfterCurLine(ctx: PluginContext, view: EditorView): boolean { ... }
export function getBlockLinesInPos(ctx: PluginContext, state: EditorState, pos: number): [number, number] { ... }
export function selectBlockInCursor(ctx: PluginContext, view: EditorView): boolean { ... }
```

方法体内的转换（关键项）：
- `this.settings.Tabout` → `ctx.settings.Tabout`
- `this.settings.BetterCodeEdit` → `ctx.settings.BetterCodeEdit`
- `this.settings.CollapsePersistentEnter` → `ctx.settings.CollapsePersistentEnter`
- `this.settings.StrictModeEnter` → `ctx.settings.StrictModeEnter`
- `this.settings.EnhanceModA` → `ctx.settings.EnhanceModA`
- `this.TaboutPairStrs` → `ctx.TaboutPairStrs`
- `this.getDefaultIndentChar()` → `ctx.getDefaultIndentChar()`
- `this.triggerCvtRule(view, pos, 'tab')` → `triggerCvtRule(ctx, view, pos, 'tab')`
- `this.getBlockLinesInPos(state, pos)` → `getBlockLinesInPos(ctx, state, pos)`
- `this.app.workspace.getActiveViewOfType(MarkdownView)` → `ctx.app.workspace.getActiveViewOfType(MarkdownView)`
- `this.app.vault.config.strictLineBreaks` → `ctx.app.vault.config.strictLineBreaks`
- `this.settings.StrictLineMode` → `ctx.settings.StrictLineMode`

**Step 2: 修改 `main.ts`**

1. 删除 `handleTabDown`, `handleEnter`, `handleBackspace`, `handleShiftEnter`, `handleModA`, `goNewLineAfterCurLine`, `getBlockLinesInPos`, `selectBlockInCurser`, `onKeyup` 共 9 个方法
2. 添加导入
3. 更新 `onload()` 中的 keymap 注册：
   ```typescript
   { key: "Tab", run: (v) => handleTabDown(this, v) },
   { key: "Enter", run: (v) => handleEnter(this, v) },
   { key: "Backspace", run: (v) => { if (!this.settings.BetterBackspace) return false; return handleBackspace(v); } },
   { key: "Mod-a", run: (v) => handleModA(this, v) },
   { key: "Shift-Enter", run: (v) => handleShiftEnter(this, v) },
   ```
4. 更新 `onKeyup` DOM 事件处理，改为内联或导入的函数
5. 更新命令回调：
   - `this.selectBlockInCurser(editor.cm)` → `selectBlockInCursor(this, editor.cm)`
   - `this.goNewLineAfterCurLine(editor.cm)` → `goNewLineAfterCurLine(this, editor.cm)`

**Step 3: 验证构建**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```
git add src/keyboard_handlers.ts src/main.ts
git commit -m "refactor: 提取键盘处理逻辑到 keyboard_handlers.ts"
```

---

## Task 7: 提取 `cm_extensions.ts`

**Files:**
- Create: `src/cm_extensions.ts`
- Modify: `src/main.ts` — 删除 `transactionFilterPlugin`, `viewUpdatePlugin`, `normalPaste`

**Step 1: 创建 `cm_extensions.ts`**

从 `main.ts:278-606` 搬运：

```typescript
import { Transaction, TransactionSpec, EditorState, Extension } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { PluginContext } from './plugin_context';
import { triggerCvtRule, triggerPuncRectify } from './rule_processor';
import { isCurrentFileExclude } from './formatting_commands';
import { RuleType, TxContext, RuleScope } from './rule_engine';
import { tabstopSpecsToTabstopGroups } from './tabstop';
import { addTabstopsEffect, hasTabstops, removeAllTabstops, isInsideCurTabstop } from './tabstops_state_field';
import { getCodeBlockInfoInPos, isCodeBlockInPos } from './syntax';
import { getPosLineType, LineType } from './core';
import { getTypeStrOfTransac, print } from './utils';
import { Editor } from 'obsidian';
import { Platform } from 'obsidian';

export function createTransactionFilter(ctx: PluginContext): Extension {
    return EditorState.transactionFilter.of((tr: Transaction): TransactionSpec | readonly TransactionSpec[] => {
        // 原 transactionFilterPlugin 方法体，this → ctx
        ...
    });
}

export function createViewUpdatePlugin(ctx: PluginContext): Extension {
    return EditorView.updateListener.of((update: ViewUpdate) => {
        // 原 viewUpdatePlugin 方法体，this → ctx
        ...
    });
}

export async function normalPaste(editor: Editor, debug?: boolean): Promise<void> {
    // 原 normalPaste 方法体
    // this.settings?.debug → debug 参数
    ...
}
```

方法体内的转换：
- `this.settings` → `ctx.settings`
- `this.ruleEngine.process(...)` → `ctx.ruleEngine.process(...)`
- `this.Formater.formatLineOfDoc(...)` → `ctx.Formater.formatLineOfDoc(...)`
- `this.onFormatArticle` → `ctx.onFormatArticle`
- `this.compose_need_handle` → `ctx.compose_need_handle`（读写）
- `this.compose_begin_pos` → `ctx.compose_begin_pos`（读写）
- `this.compose_end_pos` → `ctx.compose_end_pos`（读写）
- `this.getDefaultIndentChar()` → `ctx.getDefaultIndentChar()`
- `this.triggerCvtRule(view, pos)` → `triggerCvtRule(ctx, view, pos)`
- `this.triggerPuncRectify(view, pos)` → `triggerPuncRectify(ctx, view, pos)`
- `this.isCurrentFileExclude()` → `isCurrentFileExclude(ctx)` 或 `ctx.isCurrentFileExclude()`

**Step 2: 修改 `main.ts`**

1. 删除 `transactionFilterPlugin`, `viewUpdatePlugin`, `normalPaste` 三个方法
2. 添加导入：`import { createTransactionFilter, createViewUpdatePlugin, normalPaste } from './cm_extensions';`
3. 更新 `onload()` 中扩展注册：
   ```typescript
   this.registerEditorExtension([
       createTransactionFilter(this),
       createViewUpdatePlugin(this),
       ...
   ]);
   ```
4. 更新 paste 命令：
   - `this.normalPaste(editor)` → `normalPaste(editor, this.settings?.debug)`

**Step 3: 验证构建**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```
git add src/cm_extensions.ts src/main.ts
git commit -m "refactor: 提取 CM6 扩展到 cm_extensions.ts"
```

---

## Task 8: 清理 main.ts + 最终验证

**Files:**
- Modify: `src/main.ts` — 最终清理

**Step 1: 审查 main.ts 最终形态**

确认 `main.ts` 只包含：
- 导入语句
- `EasyTypingPlugin` 类定义
- 属性声明
- `onload()` — 初始化 + 命令注册 + 扩展注册 + 事件监听
- `onunload()`
- `getDefaultIndentChar()`
- `isCurrentFileExclude()` — 代理到 formatting_commands
- `getCommandNameMap()`
- `getEditor()`
- `loadSettings()`
- `saveSettings()`

**Step 2: 添加 `implements PluginContext`**

```typescript
export default class EasyTypingPlugin extends Plugin implements PluginContext {
```

确认所有 PluginContext 接口属性和方法都已实现。

**Step 3: 清理无用导入**

检查 main.ts 顶部的 import 语句，删除不再需要的导入。

**Step 4: 验证构建**

Run: `npm run build`
Expected: PASS

**Step 5: 验证行数**

Run: `wc -l src/main.ts`
Expected: ~300-400 行

Run: `wc -l src/*.ts | sort -rn`
验证总体文件分布合理。

**Step 6: Commit**

```
git add src/main.ts src/plugin_context.ts
git commit -m "refactor: 清理 main.ts，完成模块拆分"
```
