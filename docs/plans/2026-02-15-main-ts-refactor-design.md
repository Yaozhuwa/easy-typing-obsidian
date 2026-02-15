# main.ts 重构设计

## 目标

将 `main.ts`（2220 行）拆分为 7 个职责清晰的模块，使其缩减至 ~350 行。

## 架构方案：混合模式

- **无状态逻辑** → 独立函数 + `PluginContext`
- **有状态管理** → `RuleManager` 类
- **CM6 扩展** → 工厂函数

## 新文件结构

```
src/
├── main.ts                  (~350 行) 插件生命周期 + 命令注册 + 扩展组装
├── plugin_context.ts         (~30 行)  PluginContext 接口
├── cm_extensions.ts          (~460 行) transactionFilter + viewUpdate 工厂函数
├── keyboard_handlers.ts      (~900 行) 键盘处理独立函数
├── comment_toggle.ts         (~220 行) 注释切换独立函数
├── formatting_commands.ts    (~230 行) 文档/行/选区格式化独立函数
├── rule_processor.ts         (~90 行)  规则触发独立函数
├── rule_manager.ts           (~170 行) RuleManager 类（CRUD + 文件 I/O）
```

## PluginContext 接口

```typescript
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

属性名与现有 `this.*` 保持一致，`EasyTypingPlugin implements PluginContext`。

## 模块 API

### comment_toggle.ts

不依赖 PluginContext，只需 `EditorView` + `debug`。

```typescript
export function toggleComment(view: EditorView, debug: boolean): void;
// 内部: toggleCodeBlockComment, toggleCodeBlockLineComment,
//       toggleMarkdownComment, getCommentSymbol
```

### keyboard_handlers.ts

大型 handler 拆为链式子函数：

```
handleTabDown(ctx, view)
 ├─ tabTabstopJump(view)
 ├─ tabTriggerRule(ctx, view)
 ├─ tabCodeBlockIndent(ctx, view)
 ├─ tabInlineCodeEscape(ctx, view)
 └─ tabPairStringTabout(ctx, view)

handleEnter(ctx, view)
 ├─ enterCollapsedHeading(ctx, view)
 ├─ enterCodeBlockIndent(ctx, view)
 └─ enterStrictLineBreak(ctx, view)

handleBackspace(view)                  — 无需 ctx
 ├─ backspaceEmptyQuote(...)
 └─ backspaceEmptyListItem(...)
```

其余导出: handleShiftEnter, handleModA, goNewLineAfterCurLine,
getBlockLinesInPos, selectBlockInCursor

### formatting_commands.ts

```typescript
export function formatArticle(ctx: PluginContext, view: EditorView): void;
export function formatSelectionOrCurLine(ctx: PluginContext, view: EditorView): void;
export function preFormatOneLine(ctx: PluginContext, view: EditorView, lineNumber: number): void;
export function deleteBlankLines(ctx: PluginContext, view: EditorView): void;
export function convert2CodeBlock(ctx: PluginContext, view: EditorView): void;
export function isCurrentFileExclude(ctx: PluginContext): boolean;
```

### rule_processor.ts

```typescript
export function triggerCvtRule(ctx: PluginContext, view: EditorView, pos: number, changeType: string): boolean;
export function triggerPuncRectify(ctx: PluginContext, view: EditorView, pos: number): void;
export function handleEndComposeTypeKey(ctx: PluginContext, view: EditorView, pos: number): void;
```

### cm_extensions.ts

```typescript
export function createTransactionFilter(ctx: PluginContext): Extension;
export function createViewUpdatePlugin(ctx: PluginContext): Extension;
export function normalPaste(view: EditorView): void;
```

### rule_manager.ts

```typescript
export class RuleManager {
    ruleEngine: RuleEngine;
    cachedBuiltinRules: SimpleRule[];
    cachedUserRules: SimpleRule[];

    constructor(app: App, manifest: PluginManifest,
                settings: EasyTypingSettings,
                saveSettings: () => Promise<void>);

    async initRuleEngine(): Promise<void>;
    async loadRulesFile(filename: string): Promise<SimpleRule[]>;
    async saveRulesFile(filename: string, rules: SimpleRule[]): Promise<void>;
    async addUserRule(rule: SimpleRule): Promise<void>;
    async updateUserRule(id: string, rule: SimpleRule): Promise<void>;
    async deleteUserRule(id: string): Promise<void>;
    async updateBuiltinRule(id: string, rule: SimpleRule): Promise<void>;
    async deleteBuiltinRule(id: string): Promise<void>;
    async restoreBuiltinRule(id: string): Promise<void>;
    async resetAllBuiltinRules(): Promise<void>;
    async toggleRuleEnabled(id: string, isBuiltin: boolean, enabled: boolean): Promise<void>;
    async updateRuleTriggerMode(id: string, isBuiltin: boolean, isTab: boolean): Promise<void>;
}
```

main.ts 中通过 `this.ruleManager` 访问，`get ruleEngine()` 代理到 `ruleManager.ruleEngine`。

## 迁移顺序

每步保证 `npm run build` 通过，单独 commit。

| 步骤 | 模块 | 原因 |
|------|------|------|
| 1 | `plugin_context.ts` | 接口定义，后续模块依赖 |
| 2 | `comment_toggle.ts` | 最独立，零状态依赖 |
| 3 | `rule_manager.ts` | 自包含 CRUD + 文件 I/O |
| 4 | `rule_processor.ts` | 依赖 ruleEngine |
| 5 | `formatting_commands.ts` | 依赖 PluginContext |
| 6 | `keyboard_handlers.ts` | 最大块，依赖 rule_processor + formatting |
| 7 | `cm_extensions.ts` | 调用 rule_processor + formatting_commands |
| 8 | 清理 main.ts | 移除残留，确认最终形态 |

## settings.ts 适配

- `plugin.addUserRule()` → `plugin.ruleManager.addUserRule()`
- `plugin.ruleEngine` → 通过 getter 代理，settings.ts 无需改动规则引擎访问
- 其余设置页代码不变
