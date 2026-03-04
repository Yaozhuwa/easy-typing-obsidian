<h1 align="center">Obsidian Easy Typing</h1>
<div align="center">

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=插件下载量&query=%24%5B%22easy-typing-obsidian%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json) ![latest download](https://img.shields.io/github/downloads/Yaozhuwa/easy-typing-obsidian/latest/total?style=plastic)

[中文 | [English](https://github.com/Yaozhuwa/easy-typing-obsidian)]

</div>

Easy Typing 是一个 [Obsidian](https://obsidian.md/) 书写体验增强插件，提供自动文本格式化、智能编辑增强和强大的规则引擎，用于自定义文本转换。

## ⚡ 快速入门

安装并启用插件后，以下功能**开箱即用**，无需任何配置：

- 中英文、中文与数字之间**自动加空格** —— 让排版更美观
- 中文语境下输入英文标点**自动转为全角** —— 无需手动切换标点
- 中日韩括号/引号**自动配对** —— 输入 `（` 自动补全 `）`
- 输入 `··`（两个中文间隔号）**快速创建行内代码** —— 不用切换输入法打反引号
- **Tab 跳出配对符号** —— 按 Tab 直接跳出括号/引号
- **智能退格** —— 空列表项和空引用行一键清除

> 💡 所有自动格式化操作都可以通过 `Ctrl/Cmd+Z` 立即撤销，放心使用。

想进一步自定义？在插件设置中可以调整每项功能的行为。

## 核心功能

### 1. 文本自动格式化

输入时自动格式化文本：
- **自动添加空格**：不同文字类型之间自动加空格（如中英文之间、中文和数字之间等）
- **自动大写**：英文句首字母自动大写
- **行内元素间距**：行内代码、公式、链接的间距策略，支持无间距、软空格、严格空格三种模式
- **自定义正则区块**：用正则表达式保护特定文本不被格式化
- **前缀词典**：输入过程中抑制过早的空格插入

支持中文、日文、韩文、英文、俄文、数字，以及用户自定义文字类别。

[详细文档 →](./Doc/AutoFormatting_ZH.md)

### 2. 编辑增强

输入时智能生效的编辑功能：
- **增强代码块编辑**：增强代码块内的编辑（Cmd/Ctrl+A 选中、Tab 缩进、删除、粘贴）
- **智能退格键**：增强删除空列表项或空引用行的功能
- **Tab 跳出配对符号**：按 Tab 键跳出配对符号（`【】`、`（）`、`《》`、引号、行内代码等）
- **增强 Mod+A**：渐进式选择扩展（当前行 → 当前文本块 → 全文）
- **智能粘贴**：在列表或引用块中粘贴时，自动添加缩进和列表/引用符号
- **严格换行**：回车自动输入两个换行符（Markdown 段落分隔）
- **折叠标题回车**：在折叠的标题行按回车时，不展开折叠内容，直接在下方添加同级标题行

[详细文档 →](./Doc/EditEnhancements_ZH.md)

### 3. 规则引擎

强大的统一规则引擎处理所有文本转换，支持三种规则类型：

| 类型 | 触发方式 | 示例 |
|------|---------|------|
| **输入转换** | 输入匹配模式时触发 | `··` → `` `$0` ``（行内代码） |
| **删除规则** | 按退格键时触发 | 删除 `$` → 删除整个 `$...$` 配对 |
| **选中替换** | 选中文字后输入时触发 | 选中文字 + `￥` → `$文字$` |

插件自带丰富的**内置规则**（自动配对、全角半角转换、符号转换等），同时支持用户**自定义规则**：
- **正则匹配**和捕获组引用（`[[1]]`、`[[R1]]`）
- **Tabstop 占位符**（`$0`、`$1`、`${1:默认值}`）和 Tab 跳转
- **作用域限定**——将规则限定在文本、公式或代码上下文中
- **函数替换**——在替换字段中编写 JavaScript 逻辑
- **基于优先级**的排序和拖拽排序
- **自动触发**或者**Tab 触发**
- **导入/导出**用户规则（JSON 格式）

[详细文档 →](./Doc/CustomRules_ZH.md)

### 4. 内置命令

| 命令 | 默认快捷键 | 说明 |
|------|-----------|------|
| 格式化全文 | `Mod+Shift+S` | 对整个文档应用自动格式化 |
| 格式化选中/当前行 | `Mod+Shift+L` | 格式化选中文本或当前行 |
| 删除多余空行 | `Mod+Shift+K` | 删除文档中的多余空行 |
| 当前行后新建行 | `Mod+Enter` | 在当前行下方新建一行并跳转 |
| 插入代码块 | `Mod+Shift+N` | 将选中内容转为代码块 |
| 切换自动格式化 | `Ctrl+Tab` | 启用/禁用自动格式化 |
| 不格式化粘贴 | `Mod+Shift+V` | 普通粘贴（跳过智能粘贴） |
| 切换注释 | `Mod+/` | 切换注释（支持代码块内的语言注释） |
| 选择代码块 | — | 扩展选区到当前块 |

### 5. 其他设置

- **输入法修复**：中文输入法、macOS 右键菜单、微软输入法的兼容性选项
- **文件排除**：通过文件路径模式排除特定文件，不进行自动格式化

## 更新记录

完整的更新记录见 [changelog.md](./changelog.md)

## 致谢

- https://github.com/artisticat1/obsidian-latex-suite
- https://github.com/aptend/typing-transformer-obsidian
- https://marcus.se.net/obsidian-plugin-docs/

## 赞助

如果你喜欢这个插件，并对我表示感谢，你可以在这里请我喝一杯奶茶！

<img src="assets/donate.png" width="400">

<a href="https://www.buymeacoffee.com/yaozhuwa"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=yaozhuwa&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
