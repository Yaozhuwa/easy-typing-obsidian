# Easy-Typing Plugin For Obsidian
[中文](https://github.com/Yaozhuwa/easy-typing-obsidian/blob/master/README_ZH.md) | English

Note: The 5.0 configuration file is incompatible with the old version. It is recommended to uninstall the old version first and then reinstall it~

This plugin is designed for better typing experience in [Obsidian](https://obsidian.md). The plugin's features includes automatic formatting of text and symbol editing enhancement during editing. Auto format text standardizes the format of the document and beautifies the appearance of the document. Editing enhancement optimizes the user's editing experience.

**Automatic text formatting** provides the feature of capitalizing the first letter. In addition, automatic text formatting can automatically add spaces to specific parts of each line during the input process according to the rules set by the user, such as spaces between Chinese and English, spaces between text and English punctuation, spaces between text and inline formula/inline code/wiki link, spaces between text blocks and user-defined regular matching blocks, etc. So as to standardize the format of the document and beautify the appearance of the document.

**Automatic text formatting takes effect immediately during editing by default**. You can also turn off the option of automatic text formatting during editing in settings. You can also use the plugin command to format the full text of the current article, the current line, or the currently selected area.

**Edit Enhance**. For example, entering two '￥' consecutively will become `$$`, and positioning the cursor in the middle, entering two `【` will become `[[|]]`. In many cases, Chinese users do not need to switch input methods to get a smooth writing experience in OBSIDIAN! The Edit Enhance features including 1. Automatic pairing/deletion of symbols; 2. Symbol editing enhancement of selected text; 3. Continuous full width symbol to half width symbol; 4. Obsidian syntax related editing enhancements. This plugin also supports user-defined conversion rules, which is highly playable.

This plugin also supports customizable conversion rules, which is highly playable.

Note: This plugin is designed for the mixed input of Chinese and English in OBSIDIAN, and may not be effective for other languages.

# Core Features
## 1. Text Autoformatting
Automatic text formatting provides the ability to capitalize the first letter. In addition, automatic text formatting can automatically add spaces to specific parts of each line during the input process according to the rules set by the user, such as spaces between Chinese and English, spaces between text and English punctuation, spaces between text and inline formula/inline code/wiki link, spaces between text blocks and user-defined regular matching blocks, etc.

![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926001743.png)

The master switch of automatic text formatting is as above. After closing, the text will not be automatically formatted during the input process. However, it will not affect the enhanced functions of symbol editing, nor will it affect the plugin's built-in commands: format full-text, format the current line/currently selected area.
### 1.1 Auto Capitalize
![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926002011.png)

This plugin provides the feature of automatically capitalizing the first letter when the input method is in English input mode, that is, the letter at the beginning of each sentence is automatically capitalized. In setting tab, you can select whether auto capitalize works only when typing or work globally. **When the Only When Typing mode is choosen, auto capitalize operation can be undone, and the letter will not be capitalized after being undone.**

### 1.2 AutoSpace between text and punctuation
![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926002044.png)

Automatic space between text and punctuation will intelligently add space between other text and English punctuation.
### 1.3 Space Policy of different inline Block
This plugin divides each text line into several blocks: text block, inline formula block, inline code block, link block, and user-defined regular matching block. The space policy between blocks can be set in settings tab.

![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926002125.png)

There are three space strategies to choose from: 1. No requirements; 2. Soft Space; 3. Strict Space. The default setting is soft space.

|Space Policy|illustration|
|:-----|:---:|
|No Require|There is no space requirement between this block and other blocks|
|Soft Space|This block can be separated from other blocks by soft spaces, that is, punctuation can also be used as a soft space.|
|Strict Space|This block must be separated from other blocks by a space.|

For instance
```markdown
some text,[[markdown link|双向链接]]还有`inline code`。其他文本。
```
This plugin devide the markdown above into 5 blocks:
1. text block：some text,
2. link block：\[\[markdown link\|双向链接\]\]
3. text block：还有
4. inline code block：\`inline code\`
5. text block：。其他文本

According to the default settings, there must be a soft space between the link block and other blocks, and the adjacent content between the link block and the left text block is a comma in English, which does not meet the requirements of soft space, so add a space between the text block 1 and the link block 2 (if it is a Chinese comma, it meets the requirements of soft space).

The adjacent content between link block 2 and text block 3 is `还`, which does not meet the soft space requirements. However, because smart space mode is selected in the space policy setting of the link text, the plugin will make smart space with the text on the right according to the display content of the link block (here is the alias of the link: `双向链接`). Then the two adjacent content of the block and text block 3 are `接还`, and no space is need between the two Chinese characters, Therefore, no space is added between the  wiki link block 2 and the text block 3.

The adjacent characters between text block 3 and inline code block 4 is `有`, which not meet the requirements of the space policy for inline code blocks, so a space is added between text block 3 and inline code block 4.

The adjacent characters between the inline code block 4 and the text block 5 is `。`, which meet the requirements of the space policy for inline code blocks, so no space is added between inline code block 4 and text block 5.

So the final formatted text is below
```markdown
some text, [[markdown link|双向链接]]还有 `inline code`。其他文本。
```
### 1.4 User-defined Regular expression match block
In some cases, users do not want to format a specific form of content, such as `{}` internal content or `<>` internal content. **This plugin can enable the plugin to not format specific forms of content by user-defined regular expressions**.

In addition, each custom regular matching block can set its left and right space policies.

![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926002222.png)

Three space strategies are represented by three symbols, No require（-）, Soft Space（=）, Strict Space（+）。

More Detail about regular expression, see [《阮一峰：正则表达式简明教程》](https://javascript.ruanyifeng.com/stdlib/regexp.html#)

#### 1.4.1 Custom regular expression syntax
In the text editing area of the custom regular expression, each line of string is a regular rule, and its format is as follows:
```
<regular expression>|<left space policy><right space policy>
```
#### 1.4.2 Examples of custom regular expression rules
For example, the second line of the default regular expression block is as follows:
```
#[\u4e00-\u9fa5\w\/]+|++
```
First, the last two chars are the left and right space strategies of the regular block. Here, `++` means that the left and right space strategies are strict spaces.

Third from the tail character must be `|`, which is used to separate the regular expression part from the left and right space strategy part to make it more visually recognizable.。

The remaining string is the regular expression itself, `#[\u4e00-\u9fa5\w\/]+`, This regular expression can match one or more characters that meet the regexp of `[\u4e00-\u9fa5\w\/]` starting with the `#` key. The characters include Chinese characters, letters, numbers, underscores, and `/`.

The simple point is to identify the tag in the Obsidian.

Obsidian's tags need to add spaces on both sides of the tag (Chinese punctuation is not allowed, it must be spaces), otherwise they will not be recognized as tags.

![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/input-tag-plugin-off.gif)

![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/input-tag-plugin-on.gif)

The two Gifs above demonstrate the difference between before and after using the custom regular expression and when inputs tag in obsidian.

#### 1.4.3 More custom regular applications
For example, the following custom regular rules in the default settings are used to identify network links(also obsidian links)
```
(https?:\/\/|ftp:\/\/|obsidian:\/\/|zotero:\/\/|www.)[^\s（）《》。,，！？;；：“”‘’\)\(\[\]\{\}']+|++
```
The following rules are used to identify the callout syntax block of the Obsidian.
```
\[\!.*?\][-+]{0,1}|-+
```

`<.*?>|--` is used to identify double angle bracket blocks to ensure that their internal text is not affected by automatic formatting. If you use the Template plugin to create a template, you need to use syntax like <% tp.file.cursor() %>. Enabling this custom rule can prevent its content from being wrongly added with spaces (because the internal `.` will be considered the end of the sentence, so this plugin will automatically add spaces between `.` and the following text).

I expect that the custom regular expression rule can meet the personalized needs of different users, and more uses of it need to be explored~~

## 2 Edit Enhance
The Edit Enhance features including 1. Automatic pairing/deletion of symbols; 2. Symbol editing enhancement of selected text; 3. Continuous full width symbol to half width symbol; 4. Obsidian syntax related editing enhancements. 

![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926003124.png)
### 2.1 Basic Edit enhance
Basic editing enhancements provide some editing enhancements based on Obsidian and Markdown syntax.

The following are the enhanced rules for all basic editing within the plugin
```python
[['··|', '`|`'], ["`·|`", "```|\n```"],
		["【【|】", "[[|]]"], ['【【|', "[[|]]"], ['￥￥|', '$|$'], ['$￥|$', "$$\n|\n$$"], ["$$|$", "$$\n|\n$$"], ['$$|', "$|$"],
		[">》|", ">>|"], ['\n》|', "\n>|"], [" 》|", " >|"], ["\n、|", "\n/|"], [' 、|', " /|"]]
```
- The first rule: ··| will convert to \`|\`
- Second rule: \`·|\` will convert to \`\`\`\\n|\`\`\`
- Third and forth rule: input【 twice will convert to \[\[|\]\]
- The penultimate rule indicates the sentence beginning input, which will be converted to slash/. (To adapt to the Obsidian core plugin Slash commands)
- And so on
### 2.2 Symbols Auto pair/delete
#### 2.2.1  Symbols Auto pair
The symbols auto pair feature, that is, the plugin will automatically complete the contents of the right half of a pair of symbols when the left half is input.

For example, if you enter 《|, you will get 《|》 (the vertical line | represents the cursor position).

The matching symbols supported in this plugin are as follows:
```python
["【】", "（）", "<>", "《》", "“”", "‘’", "「」", "『』"]
```

Since the auto pair for `(` 、`[`、`{` is supported by obsidian(`Editor→Auto pair brackets`), This plugin does not provide this feature repeatedly.

#### 2.2.2 paired symbol deletion
When there are pairing symbols on the left and right side of the cursor, if you delete backwards, the whole pairing symbol will be automatically deleted.

For example:【|】 press backspace, you will get |（| indicate cursor position）

This plugin supports the pairing and deletion of all the above automatically paired symbols. In addition, the plugin also provides quick pairing and deletion of formula blocks, code blocks and highlighted block symbols. The rules are as follows:
```python
[["$|$", "|"], ['```|\n```', '|'], ['==|==', '|'], ['$$\n|\n$$', "|"]]
```

### 2.3 Editing enhancements when text is selected
Sometimes we want to convert some parts of the text into wiki links or code blocks or formula blocks. When the text is selected, we need to input the `$` symbol to convert the selected part into a formula block. However, if the Chinese input method is used at this time, the selected text will be replaced with the ￥ symbol. This plugin will recognize these scenarios and realize what users want.

|selected|input|result| 
|:-----|:----|:-----|
|文本|【|[文本]|
|x+y|￥|\$x+y\$| 
|some code|·|\`some code\`|

In addition, entering some Chinese pairing symbols when the text is selected will also add pairing symbols to the left and right of the selected text

|selected|input|result|
|:-----|:-----|:-----|
|文本|《|《文本》| 
|文本|“ or ”|“文本”| 
|文本|‘ or ’|‘文本’|
|文本|<|<文本>|
|文本|（|（文本）| 

### 2.4 Continuous full width symbol to half width
The bultin convert rules are as follow
```python
[["。。|", ".|"], ["！！|", "!|"], ["；；|", ";|"], ["，，|", ",|"],
		["：：|", ":|"], ['？？|', '?|'], ['、、|', '/|'], ['（（|）', "(|)"], ['（（|', '(|)'],
		["》》|", ">|"], ["《《|》", "<|"], ['《《|', "<|"]]
```
For example, the first rule above represents that two consecutive Chinese periods will become English dots. The second rule indicates that entering two consecutive Chinese exclamation marks will become an English exclamation mark, and so on.

### 2.5 User defined conversion rules
![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926003149.png)

Here I learn from [aptend/typing-transformer-obsidian](https://github.com/aptend/typing-transformer-obsidian)'s idea of convert rule, which make the feature more playable。Thanks to [aptend/typing-transformer-obsidian](https://github.com/aptend/typing-transformer-obsidian)!
#### 2.5.1 Custom conversion rules with text selected
![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926003230.png)

Enter the trigger symbol and the converted left and right strings respectively in the setting column, and then click the Add Rule button on the right to generate a user-defined rule. 

For example, input `-`、`~~`、`~~` to the input area, then click the add button, You can get the first rule as shown in the figure above. 

After setting the rule, select the text and enter `-`, you'll get `~~selected~~`。

The added rules can be modified by clicking Edit or deleted.

The selected text custom conversion rule has higher priority level over the plugin's built-in conversion rule.
#### 2.5.2 Custom conversion rules when deleting
![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926003212.png)

For deletion rules, you need to enter the text status before deletion and the text status after pressing the Delete key. | is used to indicate the cursor position. The text status before and after deletion must have | to indicate the cursor position. You can add text to either side of the cursor.

The built-in symbol pairing deletion function actually adds a series of deletion rules. For example, the pairing deletion rules of `《》` are as follows

![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926003249.png)

Click the add button on the right to add rules. Each user-defined deletion rule can also be edited and deleted.

The deletion rule only takes effect when the backspace key is used to delete the text in front of the cursor. It does not take effect when the text is selected or the delete key is used to delete the text forwards.

User defined delete rules have priority over plugin's built-in delete rules.
#### 2.5.3 Custom conversion rules when typing
![](https://yaozhuwa-cloud.oss-cn-hangzhou.aliyuncs.com/Pictures/20220926003300.png)

The user-defined conversion rules for input are similar to those for deletion, except that they take effect during character input.

As shown in the figure above, I added a custom conversion rule. When I enter `:)`, the plugin will convert it to 😀。 This conversion can be undone.

The priority of user-defined conversion rules during input is lower than that of plugin's built-in conversion rules (such as automatic symbol pairing and conversion of continuous full width symbols to half width).
## Change log
FULL changelog see `./changelog.md`

### EasyTyping 5.0.0 Release!
EasyTyping 5.0.0 reconstructs the code framework, re implements all previous functions with new interfaces, greatly improves the performance and scalability of the plugin, and introduce a lot of new features.
- Improvement and new things
	- **Now support for mobile device!**
	- **The line mode has been canceled.** Now the plugin can better identify the end of Chinese input. There is no need for line mode and there will be no previous bug with incorrect input. Now, the plugin formats the text at the end of each Chinese input and at the end of each English character input.
	- **Improve automatic pairing of symbols, add feature of quick deletion of paired symbols.** When the cursor is between paired symbols, pressing the Delete key will delete all the paired symbols. For example, pressing the Delete key when "《|》" will directly delete all the 《》. More symbol pairs are supported, such as ` "`, ` $$`, ` () `, etc.
	- The feature classification of symbol input enhancement is refined and the switches are set respectively: 1. Automatic pairing/deletion of symbols; 2. Symbol editing enhancement of selected text; 3. Continuous full width symbol to half width symbol; 4. Obsidian syntax related editing enhancements. See the readme document for details.
	- **A user-defined editing and conversion rule** has been added, which supports user-defined text conversion rules for selected text, backspace deletion, and typing situations. (Thanks to aptend's idea [aptend/typing-transformer-obsidian](https://github.com/aptend/typing-transformer-obsidian))
	- **Added the setting of different block space strategies, including three space strategies: 1. No requirements; 2. Soft space; 3. Strictly space.** Soft space means that the current block can be separated from other blocks by punctuation {for example, `$formula-block$, txet-block`, formula block (`$formula-block$`) and text block (`, txet-block`) are separated by commas (`,`), and this comma is a soft space}. Strict space means that there must be a space between this block and other blocks.
	- **The feature of custom regular expression block adds the space policy settings on the both left and right sides of the custom block**, greatly enhancing the practicality and playability of the regular block. See the readme document for details.
	- Add a new command "insert code block w/wo selection", code block syntax can be inserted adaptively with and without text selected (for myself convenience).
	- **Improved performance**.
- Changes
	- **Legacy Editor is no longer supported** because CodeMirror 6 API is used.
- Acknowledge
	- Thanks to [aptend/typing-transformer-obsidian](https://github.com/aptend/typing-transformer-obsidian), I learned how to use related APIs of CodeMirror 6. 