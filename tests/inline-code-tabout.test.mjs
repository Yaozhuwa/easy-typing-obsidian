import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const { EditorState, EditorSelection } = require('@codemirror/state');
const trees = new WeakMap();

// Exercise the real Tab handler and paired-symbol fallback. Obsidian supplies the
// parser and other Tab features at runtime; isolate those unrelated features here.
function loadSource(file, modules) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
  const module = { exports: {} };
  runInNewContext(`String.prototype.contains = String.prototype.includes;\n${code}`, {
    module,
    exports: module.exports,
    require(id) {
      if (!(id in modules)) throw new Error(`Unexpected dependency: ${id}`);
      return modules[id];
    },
    console,
  });
  return module.exports;
}

const utils = loadSource('utils.ts', {
  '@codemirror/state': require('@codemirror/state'),
  obsidian: { Platform: { isMacOS: true } },
});
const { handleTabDown } = loadSource('keyboard_handlers.ts', {
  '@codemirror/state': require('@codemirror/state'),
  '@codemirror/language': { syntaxTree: state => trees.get(state) },
  obsidian: {},
  './settings': {},
  './rule_processor': { triggerCvtRule: () => false },
  './syntax': { isCodeBlockInPos: () => false },
  './core': {},
  './tabstops_state_field': { consumeAndGotoNextTabstop: () => false },
  './utils': utils,
});

function fixture(text, cursor, closingName, options = {}) {
  const delimiter = options.delimiter ?? '`';
  const start = text.indexOf(delimiter);
  const end = text.indexOf(delimiter, start + delimiter.length);
  const nodes = [
    { from: start, to: start + delimiter.length, name: 'formatting-code_inline-code' },
    { from: start + delimiter.length, to: end, name: 'inline-code' },
    { from: end, to: end + delimiter.length, name: closingName },
    ...(options.after ?? []),
  ];
  const tree = {
    resolve(position) {
      return nodes.find(node => node.from <= position && position < node.to)
        ?? { from: 0, to: text.length, name: 'Document' };
    },
  };
  let state = EditorState.create({
    doc: text,
    selection: typeof cursor === 'number' ? { anchor: cursor } : cursor,
    extensions: [EditorState.allowMultipleSelections.of(true)],
  });
  trees.set(state, tree);
  const view = {
    get state() { return state; },
    dispatch(spec) {
      state = state.update(spec).state;
      trees.set(state, tree);
    },
  };
  const context = {
    settings: { Tabout: true, BetterCodeEdit: true, ...options.settings },
    TaboutPairStrs: [{ left: '**', right: '**' }, { left: '*', right: '*' }],
  };
  return {
    pressTab(expectedPosition, expectedHandled = true) {
      assert.equal(handleTabDown(context, view), expectedHandled);
      assert.equal(state.selection.main.head, expectedPosition);
      assert.equal(state.doc.toString(), text, 'TabOut must not edit the document');
    },
  };
}

// The 1.15 token names were captured from the actual Obsidian 1.15.1 parser.
const versions = {
  legacy: 'formatting-code_inline-code',
  '1.15': 'formatting_formatting-code_formatting-code-end_inline-code',
};
for (const [version, closingName] of Object.entries(versions)) {
  test(`${version}: Tab immediately before closing backtick exits code`, () => {
    fixture('`abc` tail', 4, closingName).pressTab(5);
  });
  test(`${version}: middle of code stops before the delimiter, then exits`, () => {
    const editor = fixture('`abc` tail', 2, closingName);
    editor.pressTab(4);
    editor.pressTab(5);
  });
  test(`${version}: end-of-line fallback does not skip the first Tab stop`, () => {
    const editor = fixture('`abc`', 2, closingName);
    editor.pressTab(4);
    editor.pressTab(5);
  });
  test(`${version}: adjacent code spans do not change the destination`, () => {
    const editor = fixture('`abc` `def`', 2, closingName, {
      after: [
        { from: 6, to: 7, name: 'formatting-code_inline-code' },
        { from: 7, to: 10, name: 'inline-code' },
        { from: 10, to: 11, name: closingName },
      ],
    });
    editor.pressTab(4);
    editor.pressTab(5);
  });
  test(`${version}: double-backtick behavior is preserved`, () => {
    const editor = fixture('``a`b`` tail', 5, closingName, { delimiter: '``' });
    editor.pressTab(6);
    editor.pressTab(7);
  });
  test(`${version}: other formatting after code uses the paired-symbol handler`, () => {
    fixture('**`abc`** tail', 7, closingName, {
      after: [{ from: 7, to: 9, name: 'formatting_formatting-strong_formatting-strong-end_strong' }],
    }).pressTab(9);
  });
  for (const setting of ['Tabout', 'BetterCodeEdit']) {
    test(`${version}: disabled ${setting} leaves Tab unhandled`, () => {
      fixture('`abc` tail', 4, closingName, { settings: { [setting]: false } }).pressTab(4, false);
    });
  }
  test(`${version}: multiple cursors leave Tab unhandled`, () => {
    fixture('`abc` tail', EditorSelection.create([
      EditorSelection.cursor(2), EditorSelection.cursor(4),
    ]), closingName).pressTab(2, false);
  });
}
