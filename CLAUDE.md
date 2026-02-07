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

1. **事务过滤**：[main.ts:~1600](src/main.ts) 中的 `transactionFilterPlugin` 在所有编辑器更改应用前拦截
2. **语法树分析**：通过 `syntax.ts` 使用 CodeMirror 的 Lezer 解析器实现上下文感知格式化
3. **基于规则的转换**：支持正则表达式和 tabstop 的声明式转换规则
4. **IME 处理**：特殊的状态跟踪以兼容输入法编辑器

### 自定义规则系统

插件提供三种用户自定义规则类型，所有规则都使用 `|` 标记光标位置：

| 规则类型 | 设置字段 | 触发时机 | 示例 |
|---------|---------|---------|------|
| **选择替换规则** | `userSelRepRuleTrigger`<br>`userSelRepRuleValue` | 选中文字后输入触发字符 | 输入 `-` → `~~选中文字~~` |
| **删除规则** | `userDeleteRulesStrList` | Backspace 删除时 | 删除 `$` → 删除整个 `$$` |
| **转换规则** | `userConvertRulesStrList` | 输入匹配模式时 | 输入 `:)` → `😀` |

#### 规则语法

- **普通文本规则**：`:)|` → 输入 `:)` 时转换为 `😀`
- **正则表达式规则**：以 `r/` 开头，`r/(?<=\s)hello|/` → 匹配 `hello` 前有空格的情况
- **Tabstop 占位符**：使用 `[[0]]`、`[[1]]` 等引用正则捕获组

#### 内置规则

[main.ts:72-95](src/main.ts) 定义了多个内置规则集：
- `BasicConvRules`：基础转换（如 `··|` → `` `|` ``）
- `FW2HWSymbolRules`：全角转半角符号
- `IntrinsicDeleteRules`：内置删除规则
- `QuoteSpaceRules`：引用符号空格处理

#### 规则处理函数

- `ruleStringList2RuleList()`：将字符串规则列表转换为 `ConvertRule` 对象
- `triggerCvtRule()`：在 [main.ts:1818](src/main.ts) 触发转换规则
- 规则刷新方法：`refreshSelectionReplaceRule()`、`refreshUserDeleteRule()`、`refreshUserConvertRule()`

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
