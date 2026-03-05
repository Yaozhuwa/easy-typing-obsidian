# Edit Enhancements

Easy Typing provides several smart editing features that activate during typing. These features are designed to reduce keystrokes and improve the editing flow, especially for CJK users writing in Obsidian.

> 💡 This page covers **editing behavior enhancements** (shortcuts, cursor navigation, pasting, etc.). For **auto-pairing, full-width/half-width punctuation conversion, and symbol shortcuts**, see [Rule Engine → Built-in Rules](./CustomRules.md#built-in-rules-overview).

## Table of Contents

- [Better Code Edit](#better-code-edit)
- [Smart Backspace](#smart-backspace)
- [Tabout](#tabout)
- [Enhanced Mod+A](#enhanced-moda)
- [Smart Paste](#smart-paste)
- [Strict Line Break](#strict-line-break)
- [Collapsed Heading Enter](#collapsed-heading-enter)
- [Commands](#commands)

---

## Better Code Edit

Enhances editing inside fenced code blocks:

| Action | Behavior |
|--------|----------|
| **Cmd/Ctrl+A** | Select all content within the code block (instead of the entire document) |
| **Tab** | Add indentation (using the vault's configured indent style) |
| **Shift+Tab** | Remove one level of indentation |
| **Backspace** | Enhanced deletion behavior inside code blocks |
| **Paste** | Pasted content respects the block's indentation level |

---

## Smart Backspace

Enhances the Backspace key for empty list items and empty quote lines:

| Context | Effect |
|---------|--------|
| Empty list item (e.g., `- `) | Backspace removes the list marker |
| Empty quote line (e.g., `> `) | Backspace removes the quote prefix |

---

## Tabout

Press **Tab** to jump the cursor out of paired symbols. When the cursor is inside a pair and there are no tabstop placeholders active, pressing Tab moves the cursor past the closing symbol.

Supported symbol pairs:

| Category | Symbols |
|----------|---------|
| CJK pairs | `【】`, `（）`, `《》`, `""`, `''`, `「」`, `『』` |
| Standard pairs | `()`, `[]`, `{}`, `<>`, `''`, `""` |
| Markdown pairs | `$$`, `$`, `**`, `*`, `__`, `_`, `==`, `~~`, `[[]]` |

---

## Enhanced Mod+A

Progressive selection expansion with `Cmd/Ctrl+A`:

| Press | Effect |
|-------|--------|
| 1st | Select the current line |
| 2nd | Select the current text block |
| 3rd | Select the entire document |

> This feature needs to be enabled in the **Edit Enhance** settings tab.

---

## Smart Paste

When pasting text inside lists or blockquotes, the plugin automatically prepends the appropriate prefix to each pasted line:

| Context | Auto-handling |
|---------|--------------|
| In a list | Each pasted line gets the list indentation |
| In a blockquote | Each pasted line gets `> ` prefix |


---

## Strict Line Break

When enabled, pressing Enter inserts two newlines, creating a Markdown paragraph break. Ideal for users who prefer "one Enter = one paragraph".

Configure in the **Other** settings tab.

---

## Collapsed Heading Enter

When pressing Enter on a collapsed heading, the plugin does not expand the collapsed content. Instead, it adds a sibling heading of the same level below. Useful for quickly building document outlines.

Configure in the **Other** settings tab.

---

## Commands

| Command | Hotkey | Description |
|---------|--------|-------------|
| New Line After Current | `Mod+Enter` | Insert a new line below and move cursor there |
| Toggle Comment | `Mod+/` | Toggle line comments (language-aware in code blocks) |
| Select Block | — | Expand selection to the current code/quote block |
| Enhanced Mod+A | `Mod+A` | Progressive selection: line → block → all (enable in settings) |
