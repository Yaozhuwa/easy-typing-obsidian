# Custom Rules

Easy Typing uses a unified **Rule Engine** for all text transformations. Rules are defined in a simple JSON format (`SimpleRule`) and support regex matching, tabstop placeholders, scope restrictions, and JavaScript function replacements.

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

## Replacement Template Syntax

### Capture Group References

Used in regex rules to reference matched groups:

| Syntax | Meaning |
|--------|---------|
| `[[0]]` | Entire match of `trigger` (left side) |
| `[[1]]`, `[[2]]`... | Nth capture group of `trigger` |
| `[[R0]]` | Entire match of `trigger_right` (right side) |
| `[[R1]]`, `[[R2]]`... | Nth capture group of `trigger_right` |

Note: `[[n]]` first looks in left-side groups; if not found, falls back to right-side. Use `[[Rn]]` to explicitly reference the right side.

### Tabstop Placeholders

| Syntax | Meaning |
|--------|---------|
| `$0` | Primary cursor position after replacement |
| `$1`, `$2`... | Additional cursor positions (navigate with Tab) |
| `${1:default text}` | Tabstop with default text (selected when Tab-navigating) |

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

## Function Replacement (F flag)

When `options` includes `F`, the `replacement` field is treated as a JavaScript function body, compiled via `new Function()`.

### Parameters

- **Input/Delete rules**: `leftMatches: string[]`, `rightMatches: string[]`
  - `leftMatches[0]` = entire left match, `leftMatches[1]` = first capture group, etc.
  - `rightMatches[0]` = entire right match, etc.
- **SelectKey rules**: `selectionText: string`, `key: string`

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

The settings panel provides a code editor with JavaScript syntax highlighting for function rules.

## Scope Restrictions

Rules can be restricted to specific editing contexts using scope flags:

| Flag | Scope | Example Context |
|------|-------|----------------|
| `t` | Text | Normal Markdown text |
| `f` | Formula | Inside `$...$` or `$$...$$` |
| `c` | Code | Inside fenced code blocks |
| `a` | All | Any context (default) |

Additionally, you can set `scope_language` to restrict a rule to a specific programming language within code blocks (e.g., `python`, `javascript`).

## Trigger Modes

| Mode | When it fires |
|------|---------------|
| **Auto** (default) | Fires immediately when the pattern matches during typing |
| **Tab** (`T` flag) | Only fires when you press Tab after typing the pattern |

Tab-triggered rules are useful for snippets that you don't want to accidentally expand during normal typing.

## Priority System

Rules are evaluated in order of priority (lower number = higher priority):

| Priority Range | Usage |
|----------------|-------|
| 1–10 | Core built-in rules (auto-pairing, basic conversions) |
| 15 | Half-width to full-width conversion |
| 20 | Full-width to half-width conversion |
| 30 | Delete pair rules |
| 40 | Selection wrapping rules |
| 50 | Quote handling |
| 100+ | User-defined rules (default: 100) |

The first matching rule wins — subsequent rules are not evaluated.

## Managing Rules

### Settings Panel

The settings panel has two rule tabs:

- **Builtin Rules**: View and toggle built-in rules. Deleted built-in rules can be restored.
- **User Rules**: Create, edit, delete, and reorder custom rules. Supports drag-and-drop reordering.

### Import / Export

- **Export**: Download all user rules as a JSON file
- **Import**: Upload a JSON file to import rules. Duplicate rules (same trigger + trigger_right + options) are automatically skipped.

### Rule Storage

Rules are stored as JSON files in the plugin directory:
- `builtin-rules.json` — built-in rules (auto-generated, can be customized)
- `user-rules.json` — user-defined rules

## Examples

### Input Rules

Convert `:)` to emoji:
```json
{ "trigger": ":)", "replacement": "😀$0" }
```

Line-start `note-call` → Obsidian callout block (regex + tabstop):
```json
{
  "trigger": "(?<=^|\\n)([\\w-]+)-call",
  "replacement": "> [![[1]]] $0\\n> $1",
  "options": "r"
}
```

### Delete Rules

Regex delete: Task item degrades to list item:
```json
{
  "trigger": "([-+*]) \\[.\\] ",
  "replacement": "[[1]] ",
  "options": "dr"
}
```

### SelectKey Rules

Select text, press `-` to add strikethrough:
```json
{ "trigger": "-", "replacement": "~~${SEL}~~", "options": "s" }
```

### Tab-triggered Rules

Expand `lorem` to placeholder text only on Tab:
```json
{
  "trigger": "lorem",
  "replacement": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.$0",
  "options": "T"
}
```

### Function Rules

Smart date insertion with format choice:
```json
{
  "trigger": "/now",
  "replacement": "const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}$0`;",
  "options": "F"
}
```

### Scope-restricted Rules

A rule that only works inside formulas:
```json
{
  "trigger": "oiint",
  "replacement": "\\oiint$0",
  "options": "f"
}
```

A rule that only works in Python code blocks:
```json
{
  "trigger": "ifmain",
  "replacement": "if __name__ == '__main__':\\n    $0",
  "options": "cT",
  "scope_language": "python"
}
```
