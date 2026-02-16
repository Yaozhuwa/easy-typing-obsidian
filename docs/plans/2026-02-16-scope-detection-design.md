# Scope 检测设计

## 目标

让规则引擎在匹配规则时检测光标所在位置的实际 scope（Text / Code / Formula），并支持按代码块语言过滤，替代当前硬编码的 `RuleScope.All`。

## 现状问题

1. **三处 TxContext 构建全部硬编码 `scopeHint: RuleScope.All`**：
   - `cm_extensions.ts` SelectKey 规则（选中替换）
   - `cm_extensions.ts` Delete 规则（Backspace）
   - `rule_processor.ts` Input 规则（输入转换）
2. **规则引擎的 scope 检查逻辑已就绪**（`rule_engine.ts:440`），但因 ctx 始终为 ALL，实际不生效
3. **无法区分代码块语言**，用户不能写"仅在 Python 代码块中生效"的规则

## 方案

### 1. 新增 `detectRuleScope()` — `src/syntax.ts`

用 CodeMirror 语法树 `resolveInner(pos, -1)` 获取光标位置最深节点，判断 scope：

```typescript
import { RuleScope } from './rule_engine';

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

- 行内代码（`` ` ``）：`scope: Code`，`language: undefined`
- 代码块（` ``` `）：`scope: Code`，`language` 为具体语言名
- 行内公式（`$`）/ 公式块（`$$`）：`scope: Formula`
- 其他：`scope: Text`

### 2. 扩展 TxContext — `src/rule_engine.ts`

```typescript
export interface TxContext {
    // ...existing fields
    scopeHint: RuleScope;
    scopeLanguage?: string;   // 仅 Code 时有值，如 'python'、'java'
}
```

### 3. 扩展 SimpleRule + ConvertRule

SimpleRule 新增可选字段：

```typescript
interface SimpleRule {
    // ...existing fields
    scope_language?: string;  // 限定代码块语言，空 = 匹配所有代码块
}
```

ConvertRule 编译时从 SimpleRule 读入：

```typescript
interface ConvertRule {
    // ...existing fields
    scopeLanguage?: string;
}
```

### 4. 匹配逻辑扩展 — `RuleEngine.process()`

在现有 scope 检查后追加语言检查：

```typescript
// 现有 scope 检查
if (ctx.scopeHint !== RuleScope.All && !rule.scope.includes(RuleScope.All) && !rule.scope.includes(ctx.scopeHint)) continue;
// 新增语言检查：规则指定了语言时，必须精确匹配
if (rule.scopeLanguage && ctx.scopeLanguage !== rule.scopeLanguage) continue;
```

### 5. 三处调用适配

| 位置 | pos 参数 | 说明 |
|------|---------|------|
| `cm_extensions.ts` SelectKey | `fromA`（选区起始） | 用选区起始位置检测 |
| `cm_extensions.ts` Delete | `toA`（删除位置） | 用 Backspace 光标位置检测 |
| `rule_processor.ts` Input | `cursor_pos` | 用输入光标位置检测 |

每处调用 `detectRuleScope(state, pos)`，将返回的 `scope` 和 `language` 分别填入 `scopeHint` 和 `scopeLanguage`。

### 6. 设置 UI — `src/settings.ts`

`RuleEditModal` 中 Scope 下拉框选择 Code 时，显示额外文本框 "Language (optional)"。`buildSimpleRule()` 将值写入 `scope_language` 字段。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/syntax.ts` | 新增 `ScopeInfo` 接口 + `detectRuleScope()` 函数 |
| `src/rule_engine.ts` | `TxContext` 加 `scopeLanguage`，`ConvertRule` 加 `scopeLanguage`，`compileRule` 读入 `scope_language`，`process()` 加语言检查 |
| `src/cm_extensions.ts` | 2 处 `scopeHint` 改用 `detectRuleScope` |
| `src/rule_processor.ts` | 1 处 `scopeHint` 改用 `detectRuleScope` |
| `src/settings.ts` | `RuleEditModal` 加语言文本框，`buildSimpleRule` 写入 `scope_language` |

## 迁移顺序

每步保证 `npm run build` 通过，单独 commit。

| 步骤 | 改动 | 原因 |
|------|------|------|
| 1 | `syntax.ts` 新增 `detectRuleScope()` | 基础设施，后续步骤依赖 |
| 2 | `rule_engine.ts` 扩展 TxContext + ConvertRule + 匹配逻辑 | 引擎层支持 |
| 3 | `cm_extensions.ts` + `rule_processor.ts` 调用 `detectRuleScope` | 接入检测 |
| 4 | `settings.ts` UI 支持 `scope_language` | 用户可配置 |
