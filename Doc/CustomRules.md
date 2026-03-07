# Rule Engine

Easy Typing uses a unified **Rule Engine** for all text transformations — from built-in full-width/half-width punctuation conversion to your own custom shortcut rules, all powered by the same engine.

## Table of Contents

- [Built-in Rules Overview](#built-in-rules-overview)
- [Custom Rules Quick Start](#custom-rules-quick-start)
- [Rule Edit Panel](#rule-edit-panel)
- [Replacement Template Syntax](#replacement-template-syntax)
- [Function Replacement](#function-replacement)
- [Priority System](#priority-system)
- [Managing Rules](#managing-rules)
- [Examples](#examples)
- [Appendix: JSON Format & Option Flags](#appendix-json-format--option-flags)

---

## Built-in Rules Overview

The plugin ships with a set of built-in rules covering common CJK editing patterns. These rules can be viewed and toggled in the **Builtin Rules** settings tab.

### Auto-pairing (Priority 10)

When you type a CJK opening bracket or quote, the matching closing symbol is automatically inserted:
- `【` → `【|】`, `（` → `（|）`, `《` → `《|》`
- `"` → `"|"`, `'` → `'|'`, `「` → `「|」`, `『` → `『|』`

> `|` indicates cursor position. If the closing symbol already exists to the right of the cursor, typing it will jump over it instead of inserting a duplicate.

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

| Input | Output | Description |
|-------|--------|-------------|
| `··` (two middle dots) | `` `|` `` | Inline code |
| `` `· `` | Fenced code block | Code block |
| `￥￥` / `¥¥` / `$￥` / `$¥` | `$|$` | Inline formula |
| `$$` at end of line | `$$\n|\n$$` | Block formula |
| `》` at line start | `> ` | Blockquote |
| `、` at line start | `/` | Quick input |

### Delete Pairs (Priority 30)

Quick deletion of paired constructs by pressing Backspace:

| Action | Effect |
|--------|--------|
| Backspace in `$|$` | Delete both `$` |
| Backspace in `==|==` | Delete both `==` |
| Backspace in `$$\n|\n$$` | Delete entire block formula |
| Backspace in empty code block | Delete entire block |
| Backspace in `[[link]]` or `![[embed]]` | Delete entire wikilink |

### Selection Wrapping (Priority 40)

Select text, then type a trigger character to wrap it:

| Trigger | Output |
|---------|--------|
| `【` | `[selected text]` |
| `￥` / `¥` | `$selected text$` |
| `"` / `"` | `"selected text"` / `"selected text"` |
| `'` / `'` | `'selected text'` / `'selected text'` |
| `《` | `《selected text》` |
| `（` | `（selected text）` |

### Quote Handling (Priority 50)

- Typing `>` or `》` in a blockquote context adds another quote level with `> `
- Auto-adds space after `>` prefix if missing

---

## Custom Rules Quick Start

Create your first rule in just 3 steps:

### Step 1: Open Settings

Open plugin settings → **User Rules** tab → click the `+` button.

### Step 2: Fill in the Rule

For example, to turn `->` into `→`:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| **Match Before Cursor** | `->` |
| **Replacement** | `→$0` |

`$0` marks where the cursor will be placed after replacement. Leave all other fields at their defaults.

### Step 3: Test

Type `->` in the editor — it automatically becomes `→` with the cursor after the arrow.

> Want to learn more? Read the full reference below.

---

## Rule Edit Panel

Click `+` (add) or the gear icon (edit) to open the rule edit panel. The panel is organized into the following sections:

### Basic Settings

| Field | Description |
|-------|-------------|
| **Type** | Three rule types that determine when the rule fires (see below) |
| **Trigger Mode** | Auto or Tab trigger (only visible for Input rules) |

**Three rule types**:

| Type | When it fires | Typical use |
|------|---------------|-------------|
| **Input** | Automatically as you type | Text replacement, symbol conversion, snippets |
| **Delete** | When pressing Backspace | Delete paired symbols |
| **SelectKey** | When typing a character while text is selected | Wrap selected text with symbols |

**Two trigger modes** (Input rules only):

| Mode | Description |
|------|-------------|
| **Auto** | Fires immediately when the pattern matches (default) |
| **Tab** | Only fires when you press Tab after typing the pattern, preventing accidental expansion |

### Match

| Field | Description |
|-------|-------------|
| **Match Before Cursor** | Text to the **left** of the cursor that must match. For SelectKey rules, this is the "Trigger Key" field |
| **Match After Cursor** | Text to the **right** of the cursor that must match (optional, not available for SelectKey) |
| **Use Regex Matching** | When enabled, the match fields are parsed as regular expressions |

**About matching**:
- By default, matching is **plain text** — what you type is matched exactly
- When "Use Regex Matching" is enabled, you can use full regex syntax (e.g., `\d+`, `[a-z]+`, `(.*?)`)
- For SelectKey rules, each character in the "Trigger Key" field is an independent trigger key (e.g., `【￥` means both `【` and `￥` can trigger the rule)

### Replacement

| Field | Description |
|-------|-------------|
| **Use Function Replacement** | When enabled, the replacement field becomes a JavaScript code editor |
| **Replacement** | The text used to replace the match (supports template syntax, see below) |

### Other

| Field | Description |
|-------|-------------|
| **Scope** | Restrict which editing context the rule applies to |
| **Language** | Restrict to a specific code block language, e.g., `python` (only visible when scope is "Code") |
| **Priority** | Lower number = higher priority, default 100 |
| **Description** | A note to help you identify the rule |

**Scope options**:

| Option | Meaning |
|--------|---------|
| **All** | Active in any context (default) |
| **Text** | Only in normal Markdown text |
| **Formula** | Only inside `$...$` or `$$...$$` |
| **Code** | Only inside fenced code blocks |

---

## Replacement Template Syntax

The replacement field supports the following special syntax:

### Tabstop Placeholders

| Syntax | Meaning |
|--------|---------|
| `$0` | Primary cursor position after replacement |
| `$1`, `$2`... | Additional cursor positions (navigate with Tab) |
| `${1:default text}` | Tabstop with default text (selected when Tab-navigating) |

Cursor jump order: $0 → $1 → $2 → ...

### Capture Group References (requires Regex Matching)

| Syntax | Meaning |
|--------|---------|
| `[[0]]` | Entire match of "Match Before Cursor" |
| `[[1]]`, `[[2]]`... | Nth capture group of "Match Before Cursor" |
| `[[R0]]` | Entire match of "Match After Cursor" |
| `[[R1]]`, `[[R2]]`... | Nth capture group of "Match After Cursor" |

> `[[n]]` first looks in the left-side groups; if not found, falls back to the right side. Use `[[Rn]]` to explicitly reference the right side.

### Special Variables (SelectKey rules)

| Syntax | Meaning |
|--------|---------|
| `${SEL}` | The selected text |
| `${KEY}` | The trigger key that was pressed |

### Escape Sequences

| Input | Output |
|-------|--------|
| `\n` | Newline |
| `\t` | Tab |
| `\r` | Carriage return |
| `\\` | Literal backslash |

> **Note**: In the settings panel, typing `\n` directly represents a newline. In JSON files, due to JSON's own escaping rules, you need to write `\\n` instead.

---

## Function Replacement

When "Use Function Replacement" is enabled, the replacement field becomes a code editor with JavaScript syntax highlighting. The code you write is executed as a function body.

### Parameters

| Rule Type | Parameters | Description |
|-----------|------------|-------------|
| Input / Delete | `leftMatches: string[]` | `leftMatches[0]` = entire left match, `[1]` = first capture group... |
| Input / Delete | `rightMatches: string[]` | `rightMatches[0]` = entire right match... |
| SelectKey | `selectionText: string` | The selected text |
| SelectKey | `key: string` | The trigger key |

### Return Value

- Return a `string` → enters the standard template pipeline (supports `$0`, `[[1]]`, etc.)
- Return `undefined` → skip this rule (no replacement)

### Example

Insert current date when typing `/date`:

Panel fields:

| Field | Value |
|-------|-------|
| Match Before Cursor | `/date` |
| Use Function Replacement | Enabled |
| Replacement | See code below |

```javascript
const d = new Date();
return d.toISOString().slice(0, 10) + '$0';
```

---

## Priority System

Rules are evaluated in order of priority (lower number = higher priority). **The first matching rule wins** — subsequent rules are not evaluated.

| Priority Range | Usage |
|----------------|-------|
| 1-10 | Core built-in rules (auto-pairing, basic conversions) |
| 15 | Half-width to full-width conversion |
| 20 | Full-width to half-width conversion |
| 30 | Delete pair rules |
| 40 | Selection wrapping rules |
| 50 | Quote handling |
| 100+ | User-defined rules (default: 100) |

---

## Managing Rules

### Settings Panel

The settings panel has two rule tabs:

| Tab | Function |
|-----|----------|
| **Builtin Rules** | View and toggle built-in rules. Deleted built-in rules can be restored. |
| **User Rules** | Create, edit, delete, and reorder custom rules. Supports drag-and-drop reordering. |

### Import / Export

- **Export**: Download all user rules as a JSON file
- **Import**: Upload a JSON file to import rules. Duplicate rules (same trigger + trigger_right + options) are automatically skipped.

### Rule Storage

Rules are stored as JSON files in the plugin directory:
- `builtin-rules.json` — built-in rules (auto-generated, can be customized)
- `user-rules.json` — user-defined rules

---

## Examples

### Simple Text Replacement (Input Rule)

**Convert `->` to `→`**:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| Match Before Cursor | `->` |
| Replacement | `→$0` |

**Convert `:)` to emoji**:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| Match Before Cursor | `:)` |
| Replacement | `😀$0` |

### Regex Rule (Input)

**Line-start `note-call` → Obsidian callout block**:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| Match Before Cursor | `(?<=^\|\n)([\w-]+)-call` |
| Use Regex Matching | Enabled |
| Replacement | `> [![[1]]] $0\n> $1` |

### Delete Rule

**Task item degrades to list item**:

| Panel Field | Value |
|-------------|-------|
| Type | Delete |
| Match Before Cursor | `([-+*]) \[.\] ` |
| Use Regex Matching | Enabled |
| Replacement | `[[1]] ` |

### SelectKey Rule

**Select text + `-` to add strikethrough**:

| Panel Field | Value |
|-------------|-------|
| Type | SelectKey |
| Trigger Key | `-` |
| Replacement | `~~${SEL}~~` |

### Tab-triggered Rule

**Expand `lorem` to placeholder text only on Tab**:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| Trigger Mode | Tab |
| Match Before Cursor | `lorem` |
| Replacement | `Lorem ipsum dolor sit amet, consectetur adipiscing elit.$0` |

### Function Rule

**Smart date-time insertion**:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| Match Before Cursor | `/now` |
| Use Function Replacement | Enabled |
| Replacement | See code below |

```javascript
const d = new Date();
const pad = n => String(n).padStart(2, '0');
return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}$0`;
```

### Scope-restricted Rules

**Formula-only rule**:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| Match Before Cursor | `oiint` |
| Replacement | `\oiint$0` |
| Scope | Formula |

**Python code block only**:

| Panel Field | Value |
|-------------|-------|
| Type | Input |
| Trigger Mode | Tab |
| Match Before Cursor | `ifmain` |
| Replacement | `if __name__ == '__main__':\n    $0` |
| Scope | Code |
| Language | `python` |

---

## Appendix: JSON Format & Option Flags

When using import/export, rules are saved in JSON format. Understanding the mapping between JSON fields and panel settings helps with batch editing.

### JSON Field Reference

| JSON Field | Panel Equivalent | Description |
|------------|-----------------|-------------|
| `trigger` | Match Before Cursor / Trigger Key | Match pattern or trigger characters |
| `trigger_right` | Match After Cursor | Right-side match (optional) |
| `replacement` | Replacement | Template text or function body |
| `options` | Encoded from multiple settings | See option flags table below |
| `priority` | Priority | Lower = higher priority (default: 100) |
| `enabled` | Toggle switch | Whether the rule is active (default: true) |
| `description` | Description | Human-readable note |
| `scope_language` | Language | Restrict to specific code block language |

### Option Flags (`options` field)

The `options` string encodes multiple panel settings as single-letter flags:

| Flag | Panel Equivalent | Meaning |
|------|-----------------|---------|
| `d` | Type = Delete | Delete rule |
| `s` | Type = SelectKey | SelectKey rule |
| _(no d/s)_ | Type = Input | Input rule (default) |
| `r` | Use Regex Matching = Enabled | trigger and trigger_right are regular expressions |
| `F` | Use Function Replacement = Enabled | replacement is a JavaScript function body |
| `T` | Trigger Mode = Tab | Only fires on Tab press |
| `t` | Scope = Text | Text context only |
| `f` | Scope = Formula | Formula context only |
| `c` | Scope = Code | Code context only |
| `a` | Scope = All | Any context (default, no need to specify) |

Multiple flags can be combined, e.g., `dr` = Delete + Regex, `cT` = Code scope + Tab trigger.

### JSON Example

```json
{
  "trigger": "->",
  "replacement": "→$0",
  "priority": 100,
  "description": "Arrow replacement"
}
```

This corresponds to: Type=Input, Match Before Cursor=`->`, Replacement=`→$0`, Priority=100.

> **Panel input vs JSON**: In the panel, typing `\n` directly represents a newline; in JSON, due to JSON's own escaping, you need to write `\\n` for newline and `\\t` for tab.
