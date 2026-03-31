# Text Auto-formatting

Easy Typing automatically formats text as you type, adding proper spacing between different scripts and inline elements, capitalizing sentences, and respecting special text patterns.

## Table of Contents

- [Out of the Box](#out-of-the-box)
- [Auto Spacing Between Scripts](#auto-spacing-between-scripts)
- [Auto Capitalize](#auto-capitalize)
- [Inline Element Spacing](#inline-element-spacing)
- [Advanced Configuration](#advanced-configuration)
- [Areas Excluded from Formatting](#areas-excluded-from-formatting)
- [Commands](#commands)
- [File Exclusion](#file-exclusion)

---

## Out of the Box

After installing the plugin, the following auto-formatting features are enabled by default:

| Feature | Default |
|---------|---------|
| Spacing between Chinese and English | Enabled |
| Spacing between Chinese and digits | Enabled |
| Spacing between digits and English | Enabled |
| Sentence capitalization | Disabled |
| Inline code spacing | Soft space |
| Inline formula spacing | Soft space |
| Link spacing | Soft space |

> 💡 All auto-formatting actions can be undone immediately with `Ctrl/Cmd+Z`.

To adjust, open plugin settings → **Auto Format** tab.

---

## Auto Spacing Between Scripts

The most commonly used feature. The plugin automatically inserts spaces between adjacent characters from different script categories as you type.

**Examples**:

| Input | Formatted |
|-------|-----------|
| `你好world` | `你好 world` |
| `使用Python3编程` | `使用 Python3 编程` |
| `共100个` | `共 100 个` |

### Language Pair Configuration

In the **Auto Format** settings tab, you can configure which script pairs should have spaces inserted between them. Defaults:
- Chinese ↔ English
- Chinese ↔ Digit
- Digit ↔ English

You can add or remove pairs, and use the CJK meta-category to match Chinese, Japanese, and Korean simultaneously.

### Supported Script Categories

| Category | Character Range |
|----------|----------------|
| Chinese | CJK Unified Ideographs & Extension A (U+4E00–U+9FFF, U+3400–U+4DBF) |
| Japanese | Hiragana (U+3040–U+309F), Katakana (U+30A0–U+30FF, U+31F0–U+31FF) |
| Korean | Hangul Syllables (U+AC00–U+D7AF), Hangul Jamo (U+1100–U+11FF, U+3130–U+318F) |
| English | A-Z, a-z |
| Digit | 0-9 |
| Russian | Cyrillic (U+0400–U+04FF) |
| CJK | Meta-category: Chinese + Japanese + Korean |

---

## Auto Capitalize

Automatically capitalizes the first letter of sentences in English text. Capitalization is triggered as you type — if the result is undesired, you can undo it immediately.

---

## Inline Element Spacing

The plugin divides each line into segments: **text**, **inline code**, **inline formula**, **links**, and **user-defined regex blocks**. For each inline element type, you can configure a space strategy:

| Strategy | Behavior | Example |
|----------|----------|---------|
| **None** | No spacing requirement | `文字\`code\`` |
| **Soft space** | Punctuation or explicit space counts as a separator | `文字，\`code\`` or `文字 \`code\`` |
| **Strict space** | A real space character is required | `文字 \`code\`` |

Default settings:
- Inline code: Soft space
- Inline formula: Soft space
- Links: Soft space (with smart mode that skips wikilinks in certain contexts)

---

## Advanced Configuration

### Custom Script Categories

You can define custom script categories using Unicode character class patterns. For example, you could define a "Greek" category with pattern `\u0391-\u03C9` to add spacing between Greek and other scripts.

### Prefix Dictionary

When you type a word character by character, the plugin might insert a space too early — for example, inserting a space after `n` when you're about to type `n8n`. The prefix dictionary prevents this by suppressing space insertion for known prefixes.

Entries can be separated by commas, spaces, or newlines. Two formats are supported:

| Format | Syntax | Description | Example |
|--------|--------|-------------|---------|
| Literal word | Plain text | Supports prefix matching — suppresses spacing during the entire typing process | `n8n` → no spacing while typing `n`, `n8`, `n8n` |
| Regex pattern | Wrapped in `/.../` | **No prefix matching** — only suppresses spacing on complete match | `/[23][dD]/` → matches `2d`, `3D`, etc. |

### Soft Space Symbols

You can configure additional symbols that should be treated as soft-space separators. Common full-width punctuation is built in on both sides. Quotes (' \") are built in on both sides, opening brackets ([ ( {) are built in on the left side, and closing brackets (] ) }) plus half-width punctuation (. , ? ! : ;) are built in on the right side. Configure extra symbols separately for left-side and right-side soft spaces.

### User-defined Regular Expression Blocks

You can define special text patterns using regular expressions. Text matching these patterns is treated as an atomic block — it won't be broken apart by auto-formatting, and you can specify its spacing behavior.

#### Syntax

Each line in the regex block configuration follows this format:

```
<regex>|<left_strategy><right_strategy>
```

Space strategy symbols:
- `-` : No spacing requirement
- `+` : Strict space
- `=` : Soft space (not commonly used, usually pick `-` or `+`)

Lines starting with `//` are treated as comments.

#### Default Regex Blocks

The plugin includes several default regex blocks:

| Pattern | Strategy | Purpose |
|---------|----------|---------| 
| `{{.*?}}` | `++` | Templater / Dataview expressions |
| `<.*?>` | `--` | HTML tags |
| `\[\!.*?\][-+]{0,1}` | `-+` | Obsidian Callout headers |
| `(file:///\|https?://\|...)...` | `--` | URLs |
| `[a-zA-Z0-9_\-.]+@[a-zA-Z0-9_\-.]+` | `++` | Email addresses |
| `(?<!#)#[\u4e00-\u9fa5\w-\/]+` | `++` | Obsidian tags |


## Areas Excluded from Formatting

Auto-formatting does not apply to:
- Code blocks (fenced with ` ``` ` or `~~~`)
- Math blocks (`$$...$$`)
- Frontmatter (YAML between `---`)

---

## Commands

| Command | Hotkey | Description |
|---------|--------|-------------|
| Format Article | `Mod+Shift+S` | Apply formatting to entire document |
| Format Selection/Line | `Mod+Shift+L` | Format selected text or current line |
| Toggle Auto-format | `Ctrl+Tab` | Enable/disable auto-formatting |

---

## File Exclusion

In the **Other** settings tab, you can list file paths (one per line) to exclude from auto-formatting. If a file's path contains any of the listed strings, auto-formatting is disabled for that file.
