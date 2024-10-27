# User-defined Regular Expression Blocks

As part of the text auto-formatting feature, Easy Typing plugin allows users to define special blocks through custom regular expressions and set specific space strategies for these blocks.

## Purpose

1. Prevent specific content from being formatted
2. Set special space rules for content in specific formats
3. Recognize and protect special syntax structures

## Syntax

In the text editing area for custom regular expressions, each line of string is a regular rule, in the following format:

```
<regular expression>|<left space strategy><right space strategy>
```

## Space Strategies

Three space strategies are represented by three symbols:
- No space requirement (-)
- Soft space (=)
- Strict space (+)

These strategies align with the space strategies for different blocks in the main auto-formatting feature.

## Examples

1. Recognizing Obsidian tags:
   ```
   #[\u4e00-\u9fa5\w\/]+|++
   ```
   This rule will recognize content starting with `#` followed by Chinese characters, letters, numbers, underscores, or slashes, and require strict spaces on both sides.

2. Recognizing network links:
   ```
   (file:///|https?://|ftp://|obsidian://|zotero://|www.)[^\s（）《》。,，！？;；：""''\)\(\[\]\{\}']+|++
   ```
   This rule will recognize various types of links and require strict spaces on both sides.

3. Recognizing Obsidian callout syntax:
   ```
   \[\!.*?\][-+]{0,1}|-+
   ```
   This rule will recognize the header of callout syntax to prevent incorrect formatting.

4. Recognizing double angle brackets:
   ```
   <.*?>|--
   ```
   This rule will recognize double angle bracket blocks to ensure their internal text is not affected by auto-formatting.

5. Recognizing numeric time:
   ```
   \d{2}:\d{1,2}|++
   ```
   This rule will recognize time text like 12:16, preventing auto-formatting from mistakenly adding spaces.

## Usage

1. Navigate to the custom regular expression section in the plugin settings
2. Add your regular expressions following the syntax described above
3. The plugin will apply these rules during the auto-formatting process

## Notes

- Writing regular expressions requires some basic knowledge
- Overly complex or inefficient regular expressions may affect plugin performance
- From version v5.5.0, comment lines (starting with //) are supported in the custom regular expression area

For more information on text auto-formatting, please refer to the [Text Auto-formatting](./AutoFormatting.md) document.
