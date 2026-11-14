import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const stateModule = require('@codemirror/state');
const viewModule = require('@codemirror/view');
const { EditorState } = stateModule;
const { EditorView } = viewModule;
const modules = new Map();
const dependencies = {
  '@codemirror/state': stateModule,
  '@codemirror/view': viewModule,
  obsidian: { Notice: class {}, Platform: { isIosApp: false } },
  './core': {
    LineType: { text: 0, table: 1 },
    getPosLineType: () => 0,
    isCursorInUserDefinedRegexBlock: () => false,
  },
  './syntax': { detectRuleScope: () => ({ scope: 'text' }) },
  './formatting_commands': { isCurrentFileExclude: () => false },
};

// Load the real update listener, rule pipeline, built-in rules and tabstop logic.
// These fixtures are plain-text editors; only Obsidian and syntax classification
// are replaced. No browser or operating-system IME is needed for the event order.
function loadSource(id) {
  if (Object.hasOwn(dependencies, id)) return dependencies[id];
  if (modules.has(id)) return modules.get(id).exports;
  if (!/^\.\/[a-z_]+$/.test(id)) throw new Error(`Unexpected dependency: ${id}`);
  const file = new URL(`../src/${id.slice(2)}.ts`, import.meta.url);
  const source = readFileSync(file, 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
  const module = { exports: {} };
  modules.set(id, module);
  runInNewContext(`String.prototype.contains = String.prototype.includes;\n${code}`, {
    module, exports: module.exports, require: loadSource, console,
  }, { filename: file.pathname });
  return module.exports;
}

const { RuleEngine } = loadSource('./rule_engine');
const { DEFAULT_BUILTIN_RULES } = loadSource('./default_rules');
const { createViewUpdatePlugin } = loadSource('./cm_extensions');
const { tabstopsStateField } = loadSource('./tabstops_state_field');

function createEditors() {
  const engine = new RuleEngine();
  engine.addSimpleRules(DEFAULT_BUILTIN_RULES);
  const processed = [];
  const context = {
    settings: { AutoFormat: false },
    composeStates: new WeakMap(),
    onFormatArticle: false,
    pasteDetected: false,
    plainPasteInProgress: false,
    ruleEngine: {
      process(input) {
        processed.push({ text: input.docText, cursor: input.selection.from });
        return engine.process(input);
      },
    },
  };
  const listenerExtension = createViewUpdatePlugin(context);

  function applyUpdate(view, specs, recordWrite = false) {
    const transaction = view.state.update(...specs);
    if (recordWrite && transaction.docChanged) view.writes.push(transaction.newDoc.toString());
    view.state = transaction.state;
    const event = {
      view,
      state: transaction.state,
      startState: transaction.startState,
      docChanged: transaction.docChanged,
      transactions: [transaction],
    };
    for (const listener of view.state.facet(EditorView.updateListener)) listener(event);
  }

  const update = (view, ...specs) => applyUpdate(view, specs);

  function editor(text = '') {
    return {
      composing: false,
      state: EditorState.create({
        doc: text,
        selection: { anchor: text.length },
        extensions: [listenerExtension, tabstopsStateField],
      }),
      writes: [],
      dispatch(...specs) {
        // Record only document writes, not tabstop-cleanup effects. Plugin
        // dispatches also notify the listener, as they do in a real editor.
        applyUpdate(this, specs, true);
      },
    };
  }

  function compose(view, text, from = 0) {
    view.composing = true;
    update(view, {
      changes: { from, to: view.state.doc.length, insert: text },
      selection: { anchor: from + text.length },
      userEvent: 'input.type.compose',
    });
  }

  function finish(view) {
    view.composing = false;
    update(view);
  }

  return { editor, update, compose, finish, processed };
}

test('IME: background empty updates cannot consume another editor\'s composition or write its document', () => {
  const { editor, compose, update, finish, processed } = createEditors();
  const active = editor();
  const background = editor('“');

  // Other plugins can dispatch empty updates to every open editor during each
  // IME step. Previously each such update paired B's quote and consumed A's flag.
  for (const text of ['n', 'ni', '你']) {
    compose(active, text);
    update(background);
  }
  finish(active);

  assert.equal(background.state.doc.toString(), '“');
  assert.equal(background.state.selection.main.anchor, 1);
  assert.deepEqual(background.writes, []);
  assert.equal(active.state.doc.toString(), '你');
  assert.deepEqual(processed, [{ text: '你', cursor: 1 }]);
});

test('IME: the originating editor processes composition exactly once', () => {
  const { editor, compose, update, finish, processed } = createEditors();
  const view = editor();
  compose(view, '“');
  assert.deepEqual(processed, [], 'Composition must not trigger rules before it ends');
  finish(view);
  update(view);
  update(view);

  assert.equal(view.state.doc.toString(), '“”');
  assert.equal(view.state.selection.main.anchor, 1);
  assert.deepEqual(view.writes, ['“”']);
  assert.deepEqual(processed, [{ text: '“', cursor: 1 }]);
});

test('IME: cancelled composition does not trigger an input rule', () => {
  const { editor, compose, update, finish, processed } = createEditors();
  const view = editor();
  compose(view, 'n');
  compose(view, '');
  finish(view);
  update(view);

  assert.equal(view.state.doc.toString(), '');
  assert.equal(view.state.selection.main.anchor, 0);
  assert.deepEqual(view.writes, []);
  assert.deepEqual(processed, []);
});

test('IME: ordinary non-composing input still uses the built-in pairing rule', () => {
  const { editor, update, processed } = createEditors();
  const view = editor();
  update(view, {
    changes: { from: 0, insert: '“' },
    selection: { anchor: 1 },
    userEvent: 'input.type',
  });

  assert.equal(view.state.doc.toString(), '“”');
  assert.equal(view.state.selection.main.anchor, 1);
  assert.deepEqual(view.writes, ['“”']);
  assert.deepEqual(processed, [{ text: '“', cursor: 1 }]);
});

test('IME: interleaved editors retain independent composition ranges', () => {
  const { editor, compose, finish, processed } = createEditors();
  const first = editor('first: ');
  const second = editor('second: ');
  compose(first, '甲', 7);
  compose(second, '乙', 8);
  finish(second);
  finish(first);

  assert.equal(first.state.doc.toString(), 'first: 甲');
  assert.equal(second.state.doc.toString(), 'second: 乙');
  assert.deepEqual(first.writes, []);
  assert.deepEqual(second.writes, []);
  assert.deepEqual(processed, [
    { text: 'second: 乙', cursor: 9 },
    { text: 'first: 甲', cursor: 8 },
  ]);
});
