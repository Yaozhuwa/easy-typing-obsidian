# Edit Enhancements

Easy Typing provides several smart editing features that activate during typing. These features are designed to reduce keystrokes and improve the editing flow, especially for CJK users writing in Obsidian.

## Better Code Edit

Enhances editing inside fenced code blocks:

- **Cmd/Ctrl+A selection**: Select all content within the code block (instead of the entire document)
- **Tab to indent**: Press Tab to add indentation (using the vault's configured indent style)
- **Shift+Tab to unindent**: Remove one level of indentation
- **Smart delete**: Enhanced deletion behavior inside code blocks
- **Smart paste**: When pasting inside a code block, the pasted content respects the block's indentation level

## Smart Backspace

Enhances the Backspace key for empty list items and empty quote lines:
- On an empty list item (e.g., `- `), pressing Backspace removes the list marker
- On an empty quote line (e.g., `> `), pressing Backspace removes the quote prefix

## Tabout

Press **Tab** to jump the cursor out of paired symbols. This works for a wide range of symbol pairs:

- CJK pairs: `【】`, `（）`, `《》`, `""`, `''`, `「」`, `『』`
- Standard pairs: `()`, `[]`, `{}`, `<>`, `''`, `""`
- Markdown pairs: `$$`, `$`, `**`, `*`, `__`, `_`, `==`, `~~`, `[[]]`

When the cursor is inside a pair and there are no tabstop placeholders active, pressing Tab moves the cursor past the closing symbol.

## Enhanced Mod+A

Progressive selection expansion with `Cmd/Ctrl+A`:
1. First press: Select the current line
2. Second press: Select the current text block
3. Third press: Select the entire document

This feature needs to be enabled in the **Edit Enhance** settings tab.

## Smart Paste

When pasting text inside lists or blockquotes, the plugin automatically prepends the appropriate prefix to each pasted line:
- In a list: each pasted line gets the list indentation
- In a blockquote: each pasted line gets `> ` prefix

To paste without this behavior, use **Paste Without Format** (`Mod+Shift+V`).

## Built-in Conversion Rules

The plugin includes a set of built-in conversion rules (managed through the **Builtin Rules** settings tab) that handle common CJK editing patterns:

### Auto-pairing (Priority 10)

When you type a CJK opening bracket or quote, the matching closing symbol is automatically inserted:
- `【` → `【|】`, `（` → `（|）`, `《` → `《|》`
- `"` → `"|"`, `'` → `'|'`, `「` → `「|」`, `『` → `『|』`

If the closing symbol already exists to the right of the cursor, typing it will jump over it instead of inserting a duplicate.

Deleting a CJK opening bracket also deletes the paired closing bracket.

### Full-width ↔ Half-width Conversion

**Half-width to full-width** (Priority 15): After a CJK character, English punctuation is automatically converted to its full-width equivalent:
- `,` → `，`, `.` → `。`, `?` → `？`, `!` → `！`
- `:` → `：`, `;` → `；`, `(` → `（|）`

**Full-width to half-width** (Priority 3): Typing the same full-width punctuation twice converts it to half-width:
- `。。` → `.`, `！！` → `!`, `？？` → `?`
- `，，` → `,`, `：：` → `:`, `；；` → `;`
- `（（` → `()`, `《《` → `<`

### Symbol Conversions (Priority 10)

- `··` (two middle dots) → `` `|` `` (inline code)
- `` `· `` → fenced code block
- `￥￥` / `¥¥` / `$￥` / `$¥` → `$|$` (inline formula)
- `$$` at end → `$$\n|\n$$` (block formula)
- Line-start `》` → `> ` (blockquote)
- Line-start `、` → `/`

### Delete Pairs (Priority 30)

Quick deletion of paired constructs by pressing Backspace:
- `$|$` → delete both `$`
- `==|==` → delete both `==`
- `$$\n|\n$$` → delete entire block formula
- Empty code block → delete entire block
- `[[link]]` or `![[embed]]` → delete entire wikilink

### Selection Wrapping (Priority 40)

Select text, then type a trigger character to wrap it:
- `【` → `[selected text]`
- `￥` / `¥` → `$selected text$`
- `"` / `"` → `"selected text"` / `"selected text"`
- `'` / `'` → `'selected text'` / `'selected text'`
- `《` → `《selected text》`, `（` → `（selected text）`

### Quote Handling (Priority 50)

- Typing `>` or `》` in a blockquote context adds another quote level with `> `
- Auto-adds space after `>` prefix if missing

## Commands

| Command | Hotkey | Description |
|---------|--------|-------------|
| New Line After Current | `Mod+Enter` | Insert a new line below and move cursor there |
| Toggle Comment | `Mod+/` | Toggle line comments (language-aware in code blocks) |
| Select Block | — | Expand selection to the current code/quote block |
| Enhanced Mod+A | `Mod+A` | Progressive selection: line → block → all (enable in settings) |
