# Customizable Conversion Rules

Easy Typing plugin supports user-defined conversion rules to meet personalized editing needs.

## Rule Types

### 1. Conversion Rules for Selected Text

When text is selected and a specific trigger symbol is entered, the text will be converted to a specified format.

Format: `trigger symbol,left string,right string`

Example: `-,~~,~~` means that when `-` is entered after selecting text, it will convert the text to `~~selected text~~`

### 2. Conversion Rules for Deletion

When using the backspace key to delete text, specific text formats will be converted to other formats.

Format for matching text before deletion: `text before cursor|text after cursor`
Format for matching text after deletion: `text before cursor|text after cursor`

Example: Before deletion: `<|>`, After deletion: `|` means that when the cursor is between `<>`, pressing the backspace key will delete the entire `<>`

More examples:

- Before deletion: `- [ ] |`, After deletion: `- |` means that when the cursor is after `- [ ]`, pressing the backspace key will delete the entire `[ ]`, effectively turning an empty task item into a list item.

### 3. Conversion Rules for Input

When inputting specific character sequences, they will be automatically converted to other formats.

Format for matching text before conversion: `text before cursor|text after cursor`
Format for matching text after conversion: `text before cursor|text after cursor`

Example: Before conversion: `:)|`, After conversion: `😀|` means that inputting `:)` will be automatically converted to the smiling face emoji 😀, with the cursor positioned after it

## Syntax for Custom Conversion and Deletion Rules

- Use `|` to represent the cursor position
- Deletion rules and input rules support regular expression matching, in the format `r/regex before cursor/|r/regex after cursor/`
- In the converted text, use `[[n]]` to reference the content captured by regular expression matching groups, where n is a zero-based index. `[[0]]` refers to the first matching group, `[[1]]` to the second, and so on.
  - Note: `[[n]]` is only valid in the text after conversion
  - For the mth group matched by the regex after the cursor, use `[[m+n-1]]`, where n is the number of groups matched by the regex before the cursor.
- Use `$n` (where n is a number) to represent multiple cursor positions. `$0` represents the first cursor position, `$1` the second, and so on.
  - You can use `${n: text}` to indicate that the text is selected
  - In multi-cursor scenarios, after the rule takes effect, you can switch between cursor positions using the Tab key.
  - Note: `$n` is only valid in the text after conversion

## Advanced Usage

### Example of Multiple Cursors and Regular Expressions

Example 1: Custom conversion rule: Match `r/(?<=^|\n)([\w-]+)-call/|`, Convert to `> [![[0]]] $0\n> $1`, which will convert `note-call` at the beginning of a line to:
```
> [!note] $0
> $1
```
Here, $0 and $1 represent different cursor positions, which can be switched between using the Tab key.
![](/assets/multi-cursor.gif)

Example 2: Match `r/t_(\d|i)/|`, Convert to `$t_{[[0]]}$`, which will convert `t_1` inline to `$t_{1}$`

Example 3: Custom deletion rule, Before: `r/ ?!?\[\[[^\n\[\]]*\]\]/|`, After: `|`, which allows one-click deletion of the wikilink `[[link content]]` before the cursor.
