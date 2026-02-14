# Function Replacement for Rule Engine

## Context

The rule engine refactor introduced a unified `RuleEngine` with `ConvertRule` and `SimpleRule` types. The type system already declares function signatures for `ConvertRule.replacement`, but there is no practical way to define or use function-based replacements:

- `SimpleRule.replacement` is always a string in JSON files
- `normalizeRule()` passes the string through unchanged
- The settings UI only accepts string replacements
- Built-in rules in `default_rules.ts` are all string-based

Function replacements enable:
- **Consolidation**: A single function rule replaces many individual rules (e.g., one rule for all Chinese paired symbol auto-pairing instead of 6+ separate rules)
- **Dynamic content**: `/date` → current date, `/time` → current time
- **Conditional logic**: Return `undefined` to skip the rule based on runtime conditions

## Design

### `F` Options Flag

Add `F` to the options flag vocabulary. When present, `replacement` (a string) is treated as a JavaScript function body, not a template.

Composes with all existing flags: `Fr` (function + regex), `Fs` (function + SelectKey), `Fd` (function + Delete), `FT` (function + Tab trigger).

### Compilation

`normalizeRule()` detects `F` flag and compiles the replacement string via `new Function()`:

- **Input/Delete rules**: `new Function('leftMatches', 'rightMatches', body)`
  - `leftMatches: string[]` — regex capture groups from left pattern
  - `rightMatches: string[]` — regex capture groups from right pattern
- **SelectKey rules**: `new Function('selectionText', 'key', body)`
  - `selectionText: string` — the selected text
  - `key: string` — the trigger key pressed

Compilation happens once at rule load time. The resulting function is stored in `ConvertRule.replacement`.

### Return Semantics

- Return a `string` → processed through standard pipeline (unescape → expandVariables → parseTabstops). Functions can return template markers like `$0`, `[[1]]`, etc.
- Return `undefined` (or no explicit return) → rule is skipped

### Error Handling

**Compilation errors** (in `normalizeRule()`):
- Catch `SyntaxError` from `new Function()`
- Show `Notice` with rule ID and error
- Set replacement to a no-op function returning `undefined` (rule effectively disabled)
- Log full error to console

**Runtime errors** (in `applyReplacement()`):
- Catch exceptions from function invocation
- Show debounced `Notice` (suppress repeats within 5s per rule ID)
- Return `null` (skip this rule)
- Log to console

### Settings UI

**RuleEditModal**:
- Add "Is Function" toggle (maps to `F` in options)
- When ON: replacement textarea gets monospace font, larger min-height
- Show hint label with available arguments based on rule type
- Show placeholder with example function body

**Rule list**:
- Add `Fn` tag badge for function rules (alongside existing type/mode tags)

### Serialization

No special handling needed. Function rules store the body string in `replacement` with `F` in `options`. JSON serialization works as-is for both `builtin-rules.json` and `user-rules.json`.

### Scope

Functions execute in global scope via `new Function()` — they can access `window`, `document`, `app` (Obsidian global). This is intentional for accessing runtime state.

### Migration

Purely additive. No migration needed. Existing rules without `F` flag work exactly as before.

## Files to Modify

| File | Changes |
|------|---------|
| `src/rule_engine.ts` | `parseOptions()`: parse `F` flag. `normalizeRule()`: compile function body. `applyReplacement()`: error handling with debounced Notice. Add `notifyFunctionError()` helper. |
| `src/settings.ts` | `RuleEditModal`: add "Is Function" toggle, monospace textarea, argument hints. Rule list: add `Fn` tag. |
| `src/default_rules.ts` | (Optional) Add example built-in function rules |
| `CLAUDE.md` | Document `F` flag in options table |

## Examples

```jsonc
// Input: /date → current date
{
  "trigger": "/date",
  "replacement": "const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}$0`;",
  "options": "F",
  "description": "Insert current date"
}

// SelectKey: uppercase selected text
{
  "trigger": "[a-zA-Z]",
  "replacement": "return selectionText.toUpperCase();",
  "options": "sF",
  "description": "Uppercase selection"
}

// Delete + function: conditional delete
{
  "trigger": "\\(",
  "trigger_right": "\\)",
  "replacement": "if (leftMatches[0].length > 1) return undefined; return '';",
  "options": "drF",
  "description": "Delete parens only if single char"
}
```

## Verification

1. Build: `npm run build` passes
2. Manual test in Obsidian:
   - Create a function rule `/date` → verify it inserts current date
   - Create a function rule with syntax error → verify Notice appears on load
   - Create a function rule that throws at runtime → verify debounced Notice
   - Verify existing string rules still work unchanged
   - Toggle `F` on/off in rule edit modal and verify behavior switches
