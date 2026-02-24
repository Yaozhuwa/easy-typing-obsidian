# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**Easy Typing** 是一个 Obsidian 插件，通过自动文本格式化和符号编辑增强功能提升写作体验。它使用 CodeMirror 6 扩展拦截编辑器事务来实现智能文本转换。

## 构建命令

```bash
npm run dev     # 开发构建，监视模式 + 内联 sourcemap
npm run build   # 生产构建，包含 TypeScript 类型检查
npm run version # 更新 manifest.json 和 versions.json 中的版本号
```

## 架构概览

### 核心处理流程

插件通过拦截 CodeMirror 6 编辑器事务来工作：

```
用户输入 → transactionFilterPlugin (预处理)
         ↓
     视图更新 → viewUpdatePlugin (后处理)
         ↓
  自动格式化 → LineFormater.formatLineOfDoc()
         ↓
    将更改分发回编辑器
```

### 主要组件

| 文件 | 用途 |
|------|------|
| [main.ts](src/main.ts) | 插件初始化、CodeMirror 扩展、事件处理、命令注册 |
| [core.ts](src/core.ts) | 文本格式化引擎（`LineFormater`）、语法树分析、行类型检测 |
| [settings.ts](src/settings.ts) | 设置接口和多标签页 UI 配置面板 |
| [syntax.ts](src/syntax.ts) | 使用 CodeMirror 语法树进行代码块/引用块检测 |
| [utils.ts](src/utils.ts) | 事务类型检测、字符串操作、正则规则解析 |
| [tabstop.ts](src/tabstop.ts) | Tabstop 数据结构，用于类似代码片段的光标导航 |
| [tabstops_state_field.ts](src/tabstops_state_field.ts) | Tabstop 状态管理和渲染 |

### 核心设计模式

1. **事务过滤**：[main.ts](src/main.ts) 中的 `transactionFilterPlugin` 在所有编辑器更改应用前拦截
2. **语法树分析**：通过 `syntax.ts` 使用 CodeMirror 的 Lezer 解析器实现上下文感知格式化
3. **基于规则的转换**：支持正则表达式和 tabstop 的声明式转换规则
4. **IME 处理**：特殊的状态跟踪以兼容输入法编辑器

### 自定义规则系统

插件使用统一的 `RuleEngine`（[rule_engine.ts](src/rule_engine.ts)）处理所有规则，规则以 `SimpleRule` JSON 格式存储在 `builtin-rules.json` 和 `user-rules.json` 中。

#### 规则类型

| 类型 | options 标志 | 触发时机 | 示例 |
|------|-------------|---------|------|
| **Input（输入转换）** | 无（默认） | 输入匹配模式时 | 输入 `··` → `` ` `` |
| **Delete（删除）** | `d` | Backspace 删除时 | 删除 `$` → 删除整个 `$$` |
| **SelectKey（选中替换）** | `s` | 选中文字后输入触发字符 | 选中文字按 `￥` → `$选中文字$` |

#### SimpleRule 字段

```typescript
interface SimpleRule {
  id?: string;
  trigger: string;          // 左侧匹配模式
  trigger_right?: string;   // 右侧匹配模式（光标右边的文本）
  replacement: string;      // 替换模板
  options?: string;         // 选项标志组合
  priority?: number;        // 优先级（数值越小越先匹配，默认 100）
  enabled?: boolean;        // 是否启用
  description?: string;     // 描述
}
```

#### options 标志

| 标志 | 含义 |
|------|------|
| `d` | Delete 类型 |
| `s` | SelectKey 类型 |
| `r` | trigger 为正则表达式 |
| `T` | Tab 键触发（而非自动触发） |
| `t` | 作用域限定为文本 |
| `f` | 作用域限定为公式 |
| `c` | 作用域限定为代码 |
| `a` | 所有作用域（默认，无需显式指定） |
| `F` | replacement 为函数体（JS 代码） |

可组合使用，如 `dr` = Delete + 正则，`rt` = 正则 + 文本作用域。

#### 替换模板语法

**捕获组引用**（正则规则中使用）：

| 语法 | 含义 |
|------|------|
| `[[0]]` | trigger（左侧）的整个匹配 `match[0]` |
| `[[1]]`, `[[2]]`... | trigger 的第 n 个捕获组 |
| `[[R0]]` | trigger_right（右侧）的整个匹配 |
| `[[R1]]`, `[[R2]]`... | trigger_right 的第 n 个捕获组 |

注：`[[n]]` 优先取左侧，左侧无该下标时 fallback 到右侧同下标。`[[Rn]]` 显式引用右侧。

**Tabstop（光标跳转位）**：

| 语法 | 含义 |
|------|------|
| `$0` | 主光标位置（替换后光标落点） |
| `$1`, `$2`... | Tab 可跳转的位置，按数字顺序 |
| `${1:默认值}` | 带默认文本的 tabstop |

**特殊变量**（SelectKey 规则中使用）：

| 语法 | 含义 |
|------|------|
| `${SELECTION}` | 选中的文本 |
| `${KEY}` | 触发的按键 |

**转义序列**（用户输入的规则会自动处理）：

| 输入 | 输出 |
|------|------|
| `\n` | 换行符 |
| `\t` | Tab |
| `\r` | 回车 |
| `\\` | 字面反斜杠 |

#### trigger 字段中的反斜杠处理

设置面板中 trigger 和 trigger_right 字段的反斜杠处理逻辑：

**存储与显示的转换**：
- 保存规则时：`RuleEngine.unescapeText()` 处理转义序列（`\\` → `\`）
- 显示规则时：`RuleEngine.escapeText()` 逆向转换（但不处理单个 `\`）

**运行时匹配逻辑**（`rule_engine.ts:476-481`）：

| 选项 | trigger 存储值 | 匹配时处理 |
|------|---------------|-----------|
| 有 `r`（正则） | `\` | 直接作为正则 `\`，匹配字面 `\` |
| 无 `r`（普通） | `\` | `escapeRegex('\')` → `\\`，正则 `\\$` 也匹配字面 `\` |

**重要**：无 `r` 选项时，输入 `\` 或 `\\` 效果相同，都会匹配编辑器中的字面反斜杠。这是预期行为，因为非正则模式下代码会自动用 `escapeRegex()` 转义特殊字符。

若要匹配其他正则特殊字符（如 `.`、`*`、`+` 等），请启用 `r` 选项并在 trigger 中直接编写正则表达式。

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
{ "trigger": "/date", "replacement": "const d=new Date(); return d.toISOString().slice(0,10)+'$0';", "options": "F" }
```

#### 规则示例

```jsonc
// 输入转换：输入 :) 后光标在表情后
{ "trigger": ":)", "replacement": "😀$0" }

// 正则输入：行首 note-call → Callout 块
{ "trigger": "(?<=^|\\n)([\\w-]+)-call", "replacement": "> [![[1]]] $0\\n> $1", "options": "r" }

// 删除规则：删除 $ 时删除整个 $...$
{ "trigger": "$", "trigger_right": "$", "replacement": "", "options": "d" }

// 正则删除：任务项退化为列表项
{ "trigger": "([-+*]) \\[.\\] ", "replacement": "[[1]] ", "options": "dr" }

// 选中替换：选中文字按 - 加删除线
{ "trigger": "-", "replacement": "~~${SELECTION}~~", "options": "s" }
```

#### 内置规则

[default_rules.ts](src/default_rules.ts) 中定义了 `DEFAULT_BUILTIN_RULES`，按优先级分层：

| 优先级 | 类别 | 说明 |
|--------|------|------|
| 10 | 基础转换 | `··` → `` ` ``，`【【` → `[[`，`￥￥` → `$` 等 |
| 20 | 全角转半角 | `。。` → `.`，`！！` → `!` 等 |
| 25 | 自动配对补丁 | 防止重复右括号 |
| 30 | 内置删除规则 | 删除 `$...$`、`==...==` 等配对 |
| 40 | 选中替换规则 | 选中文字加 `[]`、`$...$`、`` ` `` 等 |
| 50 | 引用/额外规则 | 正则匹配，引用符号转换和空格处理 |
| 100+ | 用户规则 | 用户自定义（默认优先级） |

#### 规则管理

- 规则文件存储在插件目录：`builtin-rules.json`、`user-rules.json`

### 行类型检测

[core.ts](src/core.ts) 中的 `LineFormater` 类使用 CodeMirror 语法树识别：
- 文本、代码块、公式、引用、列表、表格、frontmatter 行
- 内联元素（代码、数学公式、链接）以实现上下文感知格式化

### 设置管理

- `EasyTypingSettings` 接口：约 30 个配置选项
- `EasyTypingSettingTab`：多标签页设置 UI
- 设置通过 Obsidian 的 `saveData()` / `loadData()` 持久化

## CodeMirror 6 集成

插件注册了多个 CodeMirror 6 扩展：
- `transactionFilterPlugin`：事务前过滤
- `viewUpdatePlugin`：事务后自动格式化
- 自定义键盘映射：Tab、Enter、Backspace、Mod+A、Shift+Enter
- `EditorView.atomicRanges`：用于 tabstop 渲染

## 外部依赖

构建将 Obsidian 和 CodeMirror 包外部化（见 [esbuild.config.mjs](esbuild.config.mjs)）：
- `obsidian`、`electron`
- `@codemirror/*` 包
- `@lezer/*` 包
- Node.js 内置模块

## 本地化

[src/lang/locale/](src/lang/locale/) 中的语言文件支持：英文、简体中文、繁体中文、俄文

## 文档

- [README.md](README.md) / [README_ZH.md](README_ZH.md) - 功能概述
- [Doc/](Doc/) - 详细功能文档（自动格式化、编辑增强、自定义规则）
- [changelog.md](changelog.md) - 版本历史
