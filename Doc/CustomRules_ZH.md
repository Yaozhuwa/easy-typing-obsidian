# 自定义规则

Easy Typing 使用统一的**规则引擎**处理所有文本转换。规则以简单的 JSON 格式（`SimpleRule`）定义，支持正则匹配、tabstop 占位符、作用域限定和 JavaScript 函数替换。

## 规则类型

### 输入规则（Input）

输入时自动触发。当光标前（和可选的光标后）的文本匹配规则模式时，匹配的文本被替换。

**示例**：输入 `:)` 变为 `😀`
```json
{ "trigger": ":)", "replacement": "😀$0" }
```

### 删除规则（Delete）

按退格键时触发。规则匹配光标前后的文本。

**示例**：在 `$...$` 之间删除 `$` 时删除整个配对
```json
{ "trigger": "$", "trigger_right": "$", "replacement": "", "options": "d" }
```

### 选中替换规则（SelectKey）

选中文本后输入字符时触发。`trigger` 字段列出触发字符。

**示例**：选中文字，按 `-`，用 `~~` 包裹
```json
{ "trigger": "-", "replacement": "~~${SEL}~~", "options": "s" }
```

## 规则字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `trigger` | string | 左侧匹配模式（SelectKey 为触发字符列表） |
| `trigger_right` | string | 右侧匹配模式（光标后的文本） |
| `replacement` | string | 替换模板 |
| `options` | string | 选项标志（见下文） |
| `priority` | number | 优先级——数值越小越先匹配（默认：100） |
| `enabled` | boolean | 是否启用（默认：true） |
| `description` | string | 可读描述 |
| `scope_language` | string | 限定到特定代码块语言（如 `python`） |

## 选项标志

多个标志可组合使用，如 `dr` = 删除 + 正则。

| 标志 | 含义 |
|------|------|
| `d` | 删除规则类型 |
| `s` | 选中替换规则类型 |
| `r` | `trigger`（和 `trigger_right`）为正则表达式 |
| `T` | Tab 触发（仅按 Tab 时生效，不自动触发） |
| `t` | 作用域：仅文本 |
| `f` | 作用域：仅公式 |
| `c` | 作用域：仅代码 |
| `a` | 作用域：全部（默认，无需指定） |
| `F` | `replacement` 为 JavaScript 函数体 |

如果未指定 `d` 或 `s`，规则为输入规则。

## 替换模板语法

### 捕获组引用

在正则规则中引用匹配的分组：

| 语法 | 含义 |
|------|------|
| `[[0]]` | `trigger`（左侧）的整个匹配 |
| `[[1]]`、`[[2]]`... | `trigger` 的第 n 个捕获组 |
| `[[R0]]` | `trigger_right`（右侧）的整个匹配 |
| `[[R1]]`、`[[R2]]`... | `trigger_right` 的第 n 个捕获组 |

注：`[[n]]` 优先取左侧分组；如果左侧没有该下标，回退到右侧。使用 `[[Rn]]` 显式引用右侧。

### Tabstop 占位符

| 语法 | 含义 |
|------|------|
| `$0` | 替换后的主光标位置 |
| `$1`、`$2`... | 额外的光标位置（用 Tab 导航） |
| `${1:默认文本}` | 带默认文本的 tabstop（Tab 导航时文本被选中） |

注：光标跳转顺序为 $0, $1, $2, ...

### 特殊变量（SelectKey 规则）

| 语法 | 含义 |
|------|------|
| `${SEL}` | 选中的文本 |
| `${KEY}` | 触发的按键 |

### 转义序列

| 输入 | 输出 |
|------|------|
| `\n` | 换行符 |
| `\t` | Tab |
| `\r` | 回车 |
| `\\` | 字面反斜杠 |

## 函数替换（F 标志）

当 `options` 包含 `F` 时，`replacement` 字段被视为 JavaScript 函数体，通过 `new Function()` 编译。

### 参数

- **输入/删除规则**：`leftMatches: string[]`、`rightMatches: string[]`
  - `leftMatches[0]` = 整个左侧匹配，`leftMatches[1]` = 第一个捕获组，以此类推
  - `rightMatches[0]` = 整个右侧匹配，以此类推
- **选中替换规则**：`selectionText: string`、`key: string`

### 返回值

- 返回 `string` → 进入标准模板处理（支持 `$0`、`[[1]]` 等）
- 返回 `undefined` → 跳过此规则（不进行替换）

### 示例

输入 `/date` 插入当前日期：
```json
{
  "trigger": "/date",
  "replacement": "const d = new Date(); return d.toISOString().slice(0, 10) + '$0';",
  "options": "F"
}
```

设置面板为函数规则提供了带 JavaScript 语法高亮的代码编辑器。

## 作用域限定

使用作用域标志将规则限定在特定编辑上下文中：

| 标志 | 作用域 | 示例上下文 |
|------|--------|-----------|
| `t` | 文本 | 普通 Markdown 文本 |
| `f` | 公式 | `$...$` 或 `$$...$$` 内部 |
| `c` | 代码 | 围栏代码块内部 |
| `a` | 全部 | 任何上下文（默认） |

此外，可以设置 `scope_language` 将规则限定到代码块内的特定编程语言（如 `python`、`javascript`）。

## 触发模式

| 模式 | 触发时机 |
|------|---------|
| **自动**（默认） | 输入时模式匹配后立即触发 |
| **Tab**（`T` 标志） | 仅在输入模式后按 Tab 时触发 |

Tab 触发规则适合用作代码片段，避免在正常输入时意外展开。

## 优先级系统

规则按优先级顺序求值（数值越小优先级越高）：

| 优先级范围 | 用途 |
|-----------|------|
| 1–10 | 核心内置规则（自动配对、基础转换） |
| 15 | 半角转全角 |
| 20 | 全角转半角 |
| 30 | 删除配对规则 |
| 40 | 选中包裹规则 |
| 50 | 引用处理 |
| 100+ | 用户自定义规则（默认：100） |

第一个匹配的规则生效——后续规则不再求值。

## 管理规则

### 设置面板

设置面板有两个规则标签页：

- **内置规则**：查看和切换内置规则。已删除的内置规则可以恢复。
- **用户规则**：创建、编辑、删除和排序自定义规则。支持拖拽排序。

### 导入/导出

- **导出**：将所有用户规则下载为 JSON 文件
- **导入**：上传 JSON 文件导入规则。重复的规则（相同的 trigger + trigger_right + options）会自动跳过。

### 规则存储

规则以 JSON 文件存储在插件目录中：
- `builtin-rules.json` — 内置规则（自动生成，可自定义）
- `user-rules.json` — 用户自定义规则

## 示例

### 输入规则

将 `:)` 转为表情：
```json
{ "trigger": ":)", "replacement": "😀$0" }
```

行首 `note-call` → Obsidian Callout 块（正则 + tabstop）：
```json
{
  "trigger": "(?<=^|\\n)([\\w-]+)-call",
  "replacement": "> [![[1]]] $0\\n> $1",
  "options": "r"
}
```

### 删除规则

正则删除：任务项退化为列表项：
```json
{
  "trigger": "([-+*]) \\[.\\] ",
  "replacement": "[[1]] ",
  "options": "dr"
}
```

### 选中替换规则

选中文字，按 `-` 添加删除线：
```json
{ "trigger": "-", "replacement": "~~${SEL}~~", "options": "s" }
```

### Tab 触发规则

输入 `lorem` 后按 Tab 展开占位文本：
```json
{
  "trigger": "lorem",
  "replacement": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.$0",
  "options": "T"
}
```

### 函数规则

智能时间插入：
```json
{
  "trigger": "/now",
  "replacement": "const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}$0`;",
  "options": "F"
}
```

### 作用域限定规则

仅在公式中生效的规则：
```json
{
  "trigger": "oiint",
  "replacement": "\\oiint$0",
  "options": "f"
}
```

仅在 Python 代码块中生效的规则：
```json
{
  "trigger": "ifmain",
  "replacement": "if __name__ == '__main__':\\n    $0",
  "options": "cT",
  "scope_language": "python"
}
```
