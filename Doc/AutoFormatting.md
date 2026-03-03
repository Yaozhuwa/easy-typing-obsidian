# Text Auto-formatting

Easy Typing automatically formats text as you type, adding proper spacing between different scripts and inline elements, capitalizing sentences, and respecting special text patterns.

## Auto Capitalize

Automatically capitalizes the first letter of sentences in English text. Capitalization is triggered as you type — if the result is undesired, you can undo it immediately.

## Auto Spacing Between Script Pairs

The plugin automatically inserts spaces between adjacent characters from different script categories. For example, between Chinese and English, or between Chinese and digits.

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

### Language Pair Configuration

In the **Auto Format** settings tab, you can configure which script pairs should have spaces inserted between them. By default:
- Chinese ↔ English
- Chinese ↔ Digit
- Digit ↔ English

You can add or remove pairs, and use the CJK meta-category to match Chinese, Japanese, and Korean simultaneously.

### Custom Script Categories

You can define custom script categories using Unicode character class patterns. For example, you could define a "Greek" category with pattern `\u0391-\u03C9` to add spacing between Greek and other scripts.

## Inline Element Spacing

The plugin divides each line into segments: **text**, **inline code**, **inline formula**, **links**, and **user-defined regex blocks**. For each inline element type, you can configure a space strategy:

| Strategy | Behavior |
|----------|----------|
| **None** | No spacing requirement |
| **Soft space** | Soft space allowed — punctuation or explicit space counts as a separator |
| **Strict space** | A real space character is required |

Default settings:
- Inline code: Soft space
- Inline formula: Soft space
- Links: Soft space (with smart mode that skips wikilinks in certain contexts)

## Prefix Dictionary

When you type a word character by character, the plugin might insert a space too early — for example, inserting a space after `n` when you're about to type `n8n`. The prefix dictionary prevents this by suppressing space insertion for known prefixes.

Enter one entry per line. Two formats are supported:

- **Literal words**: e.g., `n8n` — suppresses spacing while typing `n`, `n8`, `n8n` (supports prefix matching)
- **Regex patterns**: Wrapped in `/.../` — e.g., `/[23][dD]/` matches `2d`, `3D`, etc. Note: regex **does not support prefix matching** — it only suppresses spacing when the entire token matches

## Soft Space Symbols

You can configure additional symbols that should be treated as soft-space separators (in addition to the built-in ones like common punctuation). Configure separately for left-side and right-side soft spaces.

## User-defined Regular Expression Blocks

You can define special text patterns using regular expressions. Text matching these patterns is treated as an atomic block — it won't be broken apart by auto-formatting, and you can specify its spacing behavior.

### Syntax

Each line in the regex block configuration follows this format:

```
<regex>|<left_strategy><right_strategy>
```

Space strategy symbols:
- `-` : No spacing requirement
- `+` : Strict space
- `=` : Soft space (not commonly used, usually pick `-` or `+`)

Lines starting with `//` are treated as comments.

### Default Regex Blocks

The plugin includes several default regex blocks:

| Pattern | Strategy | Purpose |
|---------|----------|---------|
| `{{.*?}}` | `++` | Templater / Dataview expressions |
| `<.*?>` | `--` | HTML tags |
| `\[\!.*?\][-+]{0,1}` | `-+` | Obsidian Callout headers |
| `(file:///\|https?://\|...)...` | `--` | URLs |
| `[a-zA-Z0-9_\-.]+@[a-zA-Z0-9_\-.]+` | `++` | Email addresses |
| `(?<!#)#[\u4e00-\u9fa5\w-\/]+` | `++` | Obsidian tags |

### Examples

Recognize time patterns (prevent `12:30` from being formatted):
```
\d{2}:\d{1,2}|++
```

Protect LaTeX commands:
```
\\[a-zA-Z]+|--
```

## Areas Excluded from Formatting

Auto-formatting does not apply to:
- Code blocks (fenced with ` ``` ` or `~~~`)
- Math blocks (`$$...$$`)
- Frontmatter (YAML between `---`)

## Commands

| Command | Hotkey | Description |
|---------|--------|-------------|
| Format Article | `Mod+Shift+S` | Apply formatting to entire document |
| Format Selection/Line | `Mod+Shift+L` | Format selected text or current line |
| Toggle Auto-format | `Ctrl+Tab` | Enable/disable auto-formatting |

## File Exclusion

In the **Other** settings tab, you can list file paths (one per line) to exclude from auto-formatting. If a file's path contains any of the listed strings, auto-formatting is disabled for that file.
