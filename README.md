# Easy-Typing Plugin for Obsidian
**本插件自 4.0.0 版本开始同时支持 live preview 模式（CodeMirror 6 编辑器）和旧版（CodeMirror 5）编辑器。** （在 windows10 环境下开发/测试）

**This plugin support both live preview mode (CodeMirror 6) and legacy mode (CodeMirror 5) after version 4.0.0**. (Developed/tested in windows10 environment)

这是一个 [Obsidian](https://obsidian.md/) 的书写体验增强插件。本插件可以在笔记编辑过程中自动格式化书写，比如自动在中英文之间添加空格，英文首字母大写，标点与文本间智能空格，链接 (`[[wiki link]]`, `[markdown link](file link)` 以及纯链接) 与文本间智能空格等等。并且针对中文用户提供全角符号输入增强功能，比如连续输入两个 `￥` 会变成 `$$`，并将光标定位到中间，输入两个 `【` 会变成 `[[]]`。让中文用户在很多情况下无需切换输入法，在 Obsidian 得到流畅的书写体验。

This plugin designed for better typing experience. Autoformat your note when you are typing (Auto captalize and autospace), smartly insert spaces between punctuation and text, insert spaces between links (`[wiki link]]`,  `[markdown link](file link)` and plain links) and text, etc. It also provides full-angle symbol input enhancement functions. For example, two consecutive input of `￥` will become `$$`, and the cursor will be positioned in the middle; two `【` will become `[[]]`. It can help Chinese users get smooth writing experience in Obsidian.

> ==注意==：本插件在很多情况下需要解析全文从而判断每行文本的是否需要格式化，所以对于处理超大文档的情况可能会产生卡顿。
> ==Notice==: In many cases, the plug-in parses the full text to determine if each line of text needs formatting, so it can cause delay when dealing with very large documents.

## 插件核心功能 Features
该插件对不同的功能进行细分，可以在设置面板自由地开关想设置的功能。

This plugin subdivides different features, and you can freely switch the features you want to set in the setting panel.

![插件设置面板|700](https://s1.vika.cn/space/2022/02/09/f7130aebd6a64ffb8b0203ddf5379200)
### 全角输入增强/辅助
全角输入增强/辅助功能通过根据用户的输入情境，改变输出的结果，避免了很多情况下的中英文来回切换，提高了生产效率。可以在本插件的设置面板打开 `Full-Width symbol input enhancement` 功能开关来启动该功能。

---
行首的 `》` 会变成 `>`，行首的 `、` 会变成 `/` （适配 Obsidian 内置插件 Slash commands）；

**连续输入中文符号场景**：连续输入两个 `》` (`《` ) 会变成 `>` ( `<` )；连续输入两个 `、` 会变成 `/`；连续输入两个中文冒号 `：` 会变成 `:`；连续输入两个中文句号 `。` 会变成 `.`；连续输入两个中文感叹号 `！` 会变成 `!`；连续输入两个中文括号 `（` 会被转换成英文括号 `()`，并且光标会定位在中间。

**针对代码块输入情境**：连续输入两个 `·` (即按键  \`)，会变成 \`\`，并且光标定位到中间。此时再次输入 `·`，则会变成 \`\`\`，并且光标定位到最后。选中文本的情况下，键入 `·`，会在选中文本两端各加一个 \` 符号，并且选中的区域不变。

**针对公式输入情境**：连续输入两个 `￥`，会变成 `$$` 并且光标定位到中间。此时再次键入 `￥`，会变成 `$$$$` 并且光标自动定位到中间。选中文本的情况下，键入 `￥`，会在选中文本两端各加一个 `$` 符号，并且选中的区域不变。

==在选中文本的情况下==：按键 `【` 或者 `】` 会在选中文本两边分别插入英文中括号，变成 `[选中的文本]` （编辑器默认效果是选中的文本会被替换成键入的 `【` 或者 `】` ），并且选中区域不变。其他中文按键也会产生类似的效果：
- 按键 `【` 或者 `】` -> `[选中的文本]`
- 按键 `（` 或者 `）` -> `（选中的文本）`
- 按键 `‘` 或者 `’` -> `‘选中的文本’`
- 按键 `“` 或者 `”` -> `“选中的文本”`
- 按键 `《` 或者 `》` -> `《选中的文本》`
- 按键 `{` 或者 `}` -> `{选中的文本}`
- 按键 `<` 或者 `>` -> `<选中的文本>`

### 首字母自动大写 (Auto Captalize)
![Autocapitalize](https://s1.vika.cn/space/2022/02/09/01c66adc8b1748848350d96c106bfc43)

首字母自动大写功能只会在打字的时候生效，不会影响当前行中之前或者之后的句子的首字母。首字母大写后可以撤销（Ctrl+Z）。

==注意==：由于 live prevew (新版编辑器) 的撤销操作并不单单撤销上一次编辑的操作（应该是 obsidian 的 bug），所以会过度撤销导致回到了输入首字母前的情况，从而导致首字母大写的功能无法撤销。可根据需要关闭该功能。而在旧版编辑器（Legacy mode）下不会有该问题。

The auto-capitalization feature only takes effect when typing, and does not affect the first letter of the sentence before or after the current line. Can be undone (Ctrl+Z) after capitalizing.

==Notice==: Since the undo operation of live prevew (CodeMirror6 editor) does not only undo the last editing operation (should be an obsidian bug), it will be excessively undoed and will return to the situation before entering the first letter, which will make the function of capitalizing the first letter impossible. Revoke. This feature can be turned off if desired. In legacy mode (CodeMirror5 editor), there is no such problem.

### 文本与标点间智能插入空格 
Intelligently insert spaces between text and punctuation
- 英文、数字与其前部的英文断句的标点符号之间自动添加空格
- 英文小括号 `()` 分别与其左右的文本间添加空格

### 文本与特定区块间插入空格
Intelligently insert spaces between text and  \`inline code\`, `$inline latex formula$`, `[[wiki link]]`, `[markdown link](adress)`, links like `https://obsidian.md`, etc.

1. 文本和 \`行内代码\` 间插入空格
2. 文本和 `$行内公式$` 间插入空格
3. 文本和链接 (包括 `[[wiki 链接]]` 、 `[markdown 链接](链接地址)` 以及 `https://obsidian.md` 这样的纯链接文本) 间插入空格。
4. **链接与文本智能空格功能**：该功能会更具链接的显示文本内容来决定是否在其与文本间插入空格。比如 `[[wiki 链接]]后面的文本` 就不会插入空格，因为链接显示的文本是 `wiki 链接`，其末尾的 `接` 字和其后文本的 `后` 字都为中文，就不插入空格。


### 用户自定义正则 User-Defined Regular Expressions
![自定义正则区域|700](https://s1.vika.cn/space/2022/02/09/1b9b4dac91ef41248ed134f715c89df1)
在有些情况下，用户不希望对某特定形式的内容进行格式化，比如 `{}` 内部的内容，或者 `<>` 内部的内容。**本插件可以通过用户自定义正则表达式的方式来让本插件对特定形式的内容不进行格式化**。

首先需要在设置中打开 `用户自定义正则` 的功能开关。然后在自定义正则的输入区域填写自己需要定义的正则表达式。填写的时候需要注意每一行只能写一个表达式，如果不想多匹配空格导致没有得到想要的效果，请不要在行尾随意添加空格。例如填写 `{{.*?}}` 将识别双花括号部分内容，并且不会对内部的文本进行格式化。

此外，还可以通过打开 `自定义正则表达式区域与文本间空格` 的设置开关，实现更多用户需要的功能：比如添加正则表达式 `(?<!#)#[^\s,，。？；！]+` 就可以实现标签的识别，并且在文本和标签之间自动空格。

---
自定义正则表达式示例：
- `:\w*:` : 识别出 markdown 的 emoji. For `:emoji:`.
- `{{.*?}}`: 将识别双花括号部分内容. Recognization for the double curly braces.
- `[a-zA-Z0-9_\-.]+@[a-zA-Z0-9_\-.]+`. 识别邮箱地址 Recognization for EMail address.

## 现存问题 Known Issue
### Live Preview 模式下输入法的问题
![live preview 模式-微软输入法](https://s1.vika.cn/space/2022/02/09/aa5fda89d6bc4ba99f83903b6cb622e1)
上面的 gif 演示了在新版编辑器（CodeMirror6）下，微软输入法（==或者其他在输入中文时会上屏正在输入的字符的输入法==）会出现的问题。但是下图演示的使用 legacy mode 的情况下，是可以正常输入的。这应该是 Obsidian 的 Bug。

![legacy mode-微软输入法](https://s1.vika.cn/space/2022/02/09/1cfd4dd29c634801b88a7cd8e1d5063b)

---
**解决方法**：
1. 可以选择使用在输入中文的时候，输入完毕之后文字再上屏的输入法，如搜狗输入法。
![](https://s1.vika.cn/space/2022/02/09/78ed5ecff24644f380800ae7891804d1)
2. 关闭 `中英文自动空格` 和 `英文首字母大写` 的功能。
3. 使用 legacy mode

## 更新记录
- V4.0.0 2022.02.09 
    - （在 windows10 环境下开发/测试）
    - Improvement
        - **同时支持 live preview 模式 (Support Live preview) 和 legacy editor**
        - 优化文本解析的时机和解析的范围，提升性能；在切换文档的时候重新解析文档。
        - 支持 Admonition 代码块内部文本自动格式化
        - 增加命令：格式化选中的文本
        - 增强了 `链接与文本智能空格` 的功能
        - 大大增强了 `全角字符输入增强/辅助` 功能
        - 回车后，对上一行文本进行格式化
    - Bug fix
        - 解决了某些情况下，格式化行时最终光标计算错误的 Bug。
        - 修复了解析全文时，在某些情况下在全文最后会多计算一行 undefined 的 Bug