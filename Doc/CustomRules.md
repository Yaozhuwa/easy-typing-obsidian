# Rule Engine

Easy Typing uses a unified **Rule Engine** for all text transformations — from built-in full-width/half-width punctuation conversion to your own custom shortcut rules, all powered by the same engine.

## Table of Contents

- [Built-in Rules Overview](#built-in-rules-overview)
- [Custom Rules Quick Start](#custom-rules-quick-start)
- [Rule Types](#rule-types)
- [Rule Fields](#rule-fields)
- [Option Flags](#option-flags)
- [Replacement Template Syntax](#replacement-template-syntax)
- [Function Replacement (F flag)](#function-replacement-f-flag)
- [Scope Restrictions](#scope-restrictions)
- [Trigger Modes](#trigger-modes)
- [Priority System](#priority-system)
- [Managing Rules](#managing-rules)
- [Examples](#examples)

---

## Built-in Rules Overview

The plugin ships with a set of built-in rules covering common CJK editing patterns. These rules can be viewed and toggled in the **Builtin Rules** settings tab.

### Auto-pairing (Priority 10)

When you type a CJK opening bracket or quote, the matching closing symbol is automatically inserted:
- `【` → `【|】`, `（` → `（|）`, `《` → `《|》`
- `"` → `"|"`, `'` → `'|'`, `「` → `「|」`, `『` → `『|』`

> 💡 `|` indicates cursor position. If the closing symbol already exists to the right of the cursor, typing it will jump over it instead of inserting a duplicate.

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

Open plugin settings → **User Rules** tab → click the "Add Rule" button.

### Step 2: Fill in the Rule

For example, to turn `:)` into 😀:

| Field | Value |
|-------|-------|
| Trigger (left match) | `:)` |
| Replacement | `😀$0` |

`$0` marks where the cursor will be placed after replacement.

### Step 3: Test

Type `:)` in the editor — it automatically becomes `😀` with the cursor after the emoji.

> 💡 Want to learn more? Read the full rule reference below.

---

## Rule Types

### Input Rules

Triggered automatically as you type. When the text before (and optionally after) the cursor matches the rule's pattern, the matched text is replaced.

**Example**: Type `:)` and it becomes `😀`
```json
{ "trigger": ":)", "replacement": "😀$0" }
```

### Delete Rules

Triggered when pressing Backspace. The rule matches the text immediately before and after the cursor.

**Example**: Deleting `$` between `$...$` removes the entire pair
```json
{ "trigger": "$", "trigger_right": "$", "replacement": "", "options": "d" }
```

### SelectKey Rules

Triggered when you type a character while text is selected. The `trigger` field lists the trigger characters.

**Example**: Select text, press `-`, and it wraps with `~~`
```json
{ "trigger": "-", "replacement": "~~${SEL}~~", "options": "s" }
```

---

## Rule Fields

| Field | Type | Description |
|-------|------|-------------|
| `trigger` | string | Left-side match pattern (or trigger characters for SelectKey) |
| `trigger_right` | string | Right-side match pattern (text after cursor) |
| `replacement` | string | Replacement template |
| `options` | string | Option flags (see below) |
| `priority` | number | Priority — lower numbers match first (default: 100) |
| `enabled` | boolean | Whether the rule is active (default: true) |
| `description` | string | Human-readable description |
| `scope_language` | string | Restrict to a specific code block language (e.g., `python`) |

---

## Option Flags

Combine multiple flags in a single string, e.g., `dr` = Delete + Regex.

| Flag | Meaning |
|------|---------|
| `d` | Delete rule type |
| `s` | SelectKey rule type |
| `r` | `trigger` (and `trigger_right`) are regular expressions |
| `T` | Tab-triggered (only fires on Tab press, not automatically) |
| `t` | Scope: text only |
| `f` | Scope: formula only |
| `c` | Scope: code only |
| `a` | Scope: all (default, no need to specify) |
| `F` | `replacement` is a JavaScript function body |

If none of `d` or `s` is specified, the rule is an Input rule.

---

## Replacement Template Syntax

### Capture Group References

Used in regex rules to reference matched groups:

| Syntax | Meaning |
|--------|---------|
| `[[0]]` | Entire match of `trigger` (left side) |
| `[[1]]`, `[[2]]`... | Nth capture group of `trigger` |
| `[[R0]]` | Entire match of `trigger_right` (right side) |
| `[[R1]]`, `[[R2]]`... | Nth capture group of `trigger_right` |

> 💡 `[[n]]` first looks in left-side groups; if not found, falls back to right-side. Use `[[Rn]]` to explicitly reference the right side.

### Tabstop Placeholders

| Syntax | Meaning |
|--------|---------|
| `$0` | Primary cursor position after replacement |
| `$1`, `$2`... | Additional cursor positions (navigate with Tab) |
| `${1:default text}` | Tabstop with default text (selected when Tab-navigating) |

Cursor jump order: $0 → $1 → $2 → ...

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

---

## Function Replacement (F flag)

When `options` includes `F`, the `replacement` field is treated as a JavaScript function body, compiled via `new Function()`.

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
```json
{
  "trigger": "/date",
  "replacement": "const d = new Date(); return d.toISOString().slice(0, 10) + '$0';",
  "options": "F"
}
```

> 💡 The settings panel provides a code editor with JavaScript syntax highlighting for function rules.

---

## Scope Restrictions

Rules can be restricted to specific editing contexts using scope flags:

| Flag | Scope | Example Context |
|------|-------|----------------|
| `t` | Text | Normal Markdown text |
| `f` | Formula | Inside `$...$` or `$$...$$` |
| `c` | Code | Inside fenced code blocks |
| `a` | All | Any context (default) |

Additionally, you can set `scope_language` to restrict a rule to a specific programming language within code blocks (e.g., `python`, `javascript`).

---

## Trigger Modes

| Mode | When it fires |
|------|---------------|
| **Auto** (default) | Fires immediately when the pattern matches during typing |
| **Tab** (`T` flag) | Only fires when you press Tab after typing the pattern |

Tab-triggered rules are useful for snippets that you don't want to accidentally expand during normal typing.

---

## Priority System

Rules are evaluated in order of priority (lower number = higher priority). **The first matching rule wins** — subsequent rules are not evaluated.

| Priority Range | Usage |
|----------------|-------|
| 1–10 | Core built-in rules (auto-pairing, basic conversions) |
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

### 📝 Input Rules

**Convert `:)` to emoji**:
```json
{ "trigger": ":)", "replacement": "😀$0" }
```

**Line-start `note-call` → Obsidian callout block** (regex + tabstop):
```json
{
  "trigger": "(?<=^|\\n)([\\w-]+)-call",
  "replacement": "> [![[1]]] $0\\n> $1",
  "options": "r"
}
```

Note: When entering directly in the settings panel, the trigger for this rule should be written as `(?<=^|\n)([\w-]+)-call`, and the replacement as `> [![[1]]] $0\n> $1`.

### 🗑️ Delete Rules

**Task item degrades to list item** (regex delete):
```json
{
  "trigger": "([-+*]) \\[.\\] ",
  "replacement": "[[1]] ",
  "options": "dr"
}
```

### ✂️ SelectKey Rules

**Select text + `-` to add strikethrough**:
```json
{ "trigger": "-", "replacement": "~~${SEL}~~", "options": "s" }
```

### ⌨️ Tab-triggered Rules

**Expand `lorem` to placeholder text only on Tab**:
```json
{
  "trigger": "lorem",
  "replacement": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.$0",
  "options": "T"
}
```

### 🔧 Function Rules

**Smart date-time insertion**:
```json
{
  "trigger": "/now",
  "replacement": "const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}$0`;",
  "options": "F"
}
```

### 🎯 Scope-restricted Rules

**Formula-only rule**:
```json
{
  "trigger": "oiint",
  "replacement": "\\oiint$0",
  "options": "f"
}
```

**Python code block only**:
```json
{
  "trigger": "ifmain",
  "replacement": "if __name__ == '__main__':\\n    $0",
  "options": "cT",
  "scope_language": "python"
}
```
