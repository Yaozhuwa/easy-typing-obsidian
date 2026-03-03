<h1 align="center">Obsidian Easy Typing</h1>
<div align="center">

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22easy-typing-obsidian%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json) ![latest download](https://img.shields.io/github/downloads/Yaozhuwa/easy-typing-obsidian/latest/total?style=plastic)

[[中文](https://github.com/Yaozhuwa/easy-typing-obsidian/blob/master/README_ZH.md) | English]
</div>

Easy Typing is an enhancement plugin for [Obsidian](https://obsidian.md) that improves the writing experience through automatic text formatting, smart editing enhancements, and a powerful rule engine for custom text transformations.

## Core Features

### 1. Text Auto-formatting

Automatically formats text as you type:
- **Auto-capitalize** the first letter of sentences
- **Auto-spacing** between different script pairs (e.g. Chinese and English, Chinese and digits, etc.)
- **Inline element spacing** for code, formulas, and links — configurable as none, soft, or strict
- **User-defined regex blocks** to protect special text patterns from formatting
- **Prefix dictionary** to suppress premature space insertion while typing

Supports Chinese, Japanese, Korean, English, Russian, digits, and user-defined script categories.

[Detailed documentation →](./Doc/AutoFormatting.md)

### 2. Edit Enhancements

Smart editing features that work as you type:
- **Better Code Edit**: Enhanced editing inside code blocks (Cmd/Ctrl+A selection, Tab indent, delete, paste)
- **Better Backspace**: Enhanced deletion of empty list items and empty quote lines
- **Tabout**: Press Tab to jump out of paired symbols (`【】`, `（）`, `《》`, quotes, inline code, etc.)
- **Enhanced Mod+A**: Progressive selection expansion (current line → current block → entire document)
- **Smart Paste**: Auto-add indentation and list/quote prefixes when pasting inside lists or quotes

[Detailed documentation →](./Doc/EditEnhancements.md)

### 3. Rule Engine

A powerful, unified rule engine handles all text transformations with three rule types:

| Type | Trigger | Example |
|------|---------|---------|
| **Input** | Triggered when you type a matching pattern | `··` → `` `$0` `` (inline code) |
| **Delete** | Triggered on Backspace | Delete `$` → delete entire `$...$` pair |
| **SelectKey** | Triggered when you type after selecting text | Select text + `￥` → `$text$` |

Rules support:
- **Regex matching** with capture group references (`[[1]]`, `[[R1]]`)
- **Tabstop placeholders** (`$0`, `$1`, `${1:default}`) with Tab navigation
- **Scope-aware execution** — restrict rules to text, formula, or code contexts
- **Function replacements** — write JavaScript logic in the replacement field
- **Priority-based ordering** and drag-and-drop reordering
- **Tab-triggered** or **auto-triggered**
- **Import/Export** user rules as JSON

[Detailed documentation →](./Doc/CustomRules.md)

### 4. Built-in Commands

| Command | Default Hotkey | Description |
|---------|---------------|-------------|
| Format Article | `Mod+Shift+S` | Apply auto-formatting to the entire document |
| Format Selection/Line | `Mod+Shift+L` | Format selected text or current line |
| Delete Blank Lines | `Mod+Shift+K` | Remove extra blank lines |
| New Line After Current | `Mod+Enter` | Create new line below and jump to it |
| Insert Code Block | `Mod+Shift+N` | Convert selection to code block |
| Toggle Auto-format | `Ctrl+Tab` | Enable/disable auto-formatting |
| Paste Without Format | `Mod+Shift+V` | Plain paste (bypass Smart Paste) |
| Toggle Comment | `Mod+/` | Toggle comments (supports code block languages) |
| Select Block | — | Expand selection to current block |

### 5. Other Settings

- **Strict Line Break**: Enter creates double line break (Markdown paragraph break)
- **Collapsed Heading Enter**: Enter on a collapsed heading adds a sibling heading without expanding
- **IME fixes**: Compatibility options for Chinese IME, macOS context menu, and MS IME
- **File exclusion**: Exclude specific files from auto-formatting by path pattern

## Changelog

For a full changelog, see [changelog.md](./changelog.md)

## Acknowledgements

- https://github.com/artisticat1/obsidian-latex-suite
- https://github.com/aptend/typing-transformer-obsidian
- https://marcus.se.net/obsidian-plugin-docs/

## Support

If you like this plugin and want to say thanks, you can buy me a coffee here!

<img src="assets/donate.png" width="400">

<a href="https://www.buymeacoffee.com/yaozhuwa"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=yaozhuwa&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
