import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const stateModule = require('@codemirror/state');
const { EditorState, EditorSelection } = stateModule;
const { Tree, NodeType } = require('@lezer/common');
const trees = new WeakMap();
const LineType = { text: 'text', list: 'list', codeblock: 'codeblock' };
const core = {
  LineType,
  getPosLineType2(state, position) {
    return /^\s*(?:[-*+]|\d+\.) /.test(state.doc.lineAt(position).text)
      ? LineType.list : LineType.text;
  },
};

function loadSource(file, dependencies) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
  const module = { exports: {} };
  runInNewContext(`String.prototype.contains = String.prototype.includes;\n${code}`, {
    module, exports: module.exports, console,
    require(id) {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

const language = {
  syntaxTree: state => trees.get(state),
  ensureSyntaxTree: state => trees.get(state),
};
const syntax = loadSource('syntax.ts', {
  '@codemirror/language': language,
  './core': core,
  './rule_engine': { RuleScope: { Text: 'text', Code: 'code', Formula: 'formula' } },
});
const { handleModA } = loadSource('keyboard_handlers.ts', {
  '@codemirror/state': stateModule,
  '@codemirror/language': language,
  obsidian: {},
  './settings': {},
  './rule_processor': {},
  './syntax': syntax,
  './core': core,
  './tabstops_state_field': {},
  './utils': {},
});

const closingNames = {
  legacy: 'formatting-code_inline-code',
  '1.15': 'formatting_formatting-code_formatting-code-end_inline-code',
};

function codeNodes(start, body, delimiter = '`', version = '1.15', scope = '') {
  const from = start + delimiter.length;
  const to = from + body.length;
  const openingName = version === 'legacy'
    ? 'formatting-code_inline-code' : 'formatting_formatting-code_inline-code';
  return [
    { from: start, to: from, name: scope + openingName },
    { from, to, name: scope + 'inline-code' },
    { from: to, to: to + delimiter.length, name: scope + closingNames[version] },
  ];
}

function fixture(text, selection, nodes = [], settings = {}) {
  // Use a real Lezer tree so resolve biases, sibling traversal and iteration
  // behave like the parser. Token names model the Obsidian inline-code nodes.
  const tree = new Tree(
    NodeType.define({ id: 0, name: 'Document' }),
    nodes.map((node, index) => new Tree(
      NodeType.define({ id: index + 1, name: node.name }), [], [], node.to - node.from,
    )),
    nodes.map(node => node.from),
    text.length,
  );
  let state = EditorState.create({
    doc: text,
    selection: typeof selection === 'number' ? { anchor: selection } : selection,
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
    settings: { BetterCodeEdit: true, EnhanceModA: false, ...settings },
    app: { vault: { config: {} } },
  };
  return {
    select(expectedFrom, expectedTo) {
      assert.equal(handleModA(context, view), true);
      assert.equal(state.selection.main.from, expectedFrom);
      assert.equal(state.selection.main.to, expectedTo);
      assert.equal(state.doc.toString(), text, 'Mod+A must not edit the document');
    },
    delegate() {
      const before = state.selection;
      assert.equal(handleModA(context, view), false);
      assert.ok(state.selection.eq(before), 'Delegation must preserve every selection');
      assert.equal(state.doc.toString(), text);
    },
  };
}

for (const version of Object.keys(closingNames)) {
  test(`inline code selection (${version}): content start, middle and end exclude delimiters`, () => {
    const text = 'before `abc` after';
    const start = text.indexOf('`');
    for (const cursor of [start + 1, start + 2, start + 4]) {
      fixture(text, cursor, codeNodes(start, 'abc', '`', version)).select(start + 1, start + 4);
    }
  });
}

test('inline code selection: multi-backtick delimiters preserve internal backticks and spaces', () => {
  for (const [delimiter, body] of [['``', 'a`b'], ['```', 'a``b'], ['``', ' abc ']]) {
    const text = `${delimiter}${body}${delimiter}`;
    fixture(text, delimiter.length + 1, codeNodes(0, body, delimiter))
      .select(delimiter.length, delimiter.length + body.length);
  }
});

for (const [name, prefix, suffix, scope] of [
  ['bold', '**', '**', 'strong_'],
  ['list', '- before ', ' after', 'list-1_'],
  ['heading', '# Before ', ' after', 'header_header-1_'],
]) {
  test(`inline code selection: takes precedence inside ${name}`, () => {
    const text = `${prefix}\`abc\`${suffix}`;
    fixture(text, prefix.length + 2, codeNodes(prefix.length, 'abc', '`', '1.15', scope), {
      EnhanceModA: true,
    }).select(prefix.length + 1, prefix.length + 4);
  });
}

test('inline code selection: partial forward and reverse selections expand within the same span', () => {
  for (const selection of [{ anchor: 2, head: 3 }, { anchor: 3, head: 2 }]) {
    fixture('`abcd`', selection, codeNodes(0, 'abcd')).select(1, 5);
  }
});

test('inline code selection: selecting the full content again delegates to native selection', () => {
  const editor = fixture('`abc` tail', 2, codeNodes(0, 'abc'));
  editor.select(1, 4);
  editor.delegate();
  fixture('`abc` tail', { anchor: 4, head: 1 }, codeNodes(0, 'abc')).delegate();
});

test('inline code selection: repeated Mod+A continues existing line and paragraph expansion', () => {
  const text = 'before `abc` after\nnext line';
  const editor = fixture(text, 9, codeNodes(7, 'abc'), { EnhanceModA: true });
  editor.select(8, 11);
  editor.select(0, text.indexOf('\n'));
  editor.select(0, text.length);
  editor.delegate();
});

test('inline code selection: repeated Mod+A continues existing list-content expansion', () => {
  const text = '- before `abc` after';
  const editor = fixture(text, 11, codeNodes(9, 'abc'), { EnhanceModA: true });
  editor.select(10, 13);
  editor.select(2, text.length);
});

test('inline code selection: a selection spanning two code spans is not narrowed', () => {
  fixture('`one` and `two`', { anchor: 2, head: 12 }, [
    ...codeNodes(0, 'one'), ...codeNodes(10, 'two'),
  ]).delegate();
});

test('inline code selection: delimiter positions and overlapping outside selections are not captured', () => {
  const text = '``abc`` tail';
  for (const selection of [0, 1, 6, 7, { anchor: 0, head: 3 }, { anchor: 2, head: 7 }]) {
    fixture(text, selection, codeNodes(0, 'abc', '``')).delegate();
  }
});

test('inline code selection: unclosed and escaped backticks are not inline code', () => {
  for (const text of ['before `abc', 'before \\`abc`', '``']) {
    fixture(text, text.length).delegate();
  }
});

test('inline code selection: an unclosed span cannot use the next line\'s opening marker', () => {
  // Obsidian 1.15.1 emits these nodes for this input; the newline and ordinary
  // second-line text have no nodes, so the two markers are still siblings.
  fixture('`a\nb`', 2, [
    { from: 0, to: 1, name: 'formatting_formatting-code_inline-code' },
    { from: 1, to: 2, name: 'inline-code' },
    { from: 4, to: 5, name: 'formatting_formatting-code_inline-code' },
  ]).delegate();
});

test('inline code selection: missing content between sibling nodes prevents pairing', () => {
  for (const [from, to] of [[1, 3], [3, 5]]) {
    fixture('`ab c`', from + 1, [
      { from: 0, to: 1, name: 'formatting_formatting-code_inline-code' },
      { from, to, name: 'inline-code' },
      { from: 5, to: 6, name: closingNames['1.15'] },
    ]).delegate();
  }
});

test('inline code selection: opening and closing delimiter lengths must agree', () => {
  for (const [opening, closing] of [['``', '`'], ['`', '``']]) {
    const from = opening.length;
    const to = from + 3;
    fixture(`${opening}abc${closing}`, from + 1, [
      { from: 0, to: from, name: 'formatting_formatting-code_inline-code' },
      { from, to, name: 'inline-code' },
      { from: to, to: to + closing.length, name: closingNames['1.15'] },
    ]).delegate();
  }
});

test('inline code selection: contiguous content nodes belong to one span', () => {
  const nodes = [
    { from: 0, to: 1, name: 'formatting_formatting-code_inline-code' },
    { from: 1, to: 2, name: 'inline-code' },
    { from: 2, to: 3, name: 'inline-code' },
    { from: 3, to: 4, name: 'inline-code' },
    { from: 4, to: 5, name: closingNames['1.15'] },
  ];
  for (const selection of [1, 2, 3, 4, { anchor: 3, head: 1 }]) {
    fixture('`a b`', selection, nodes).select(1, 4);
  }
});

test('inline code selection: fenced code retains the existing block-selection behavior', () => {
  const text = '```\n`abc`\n```';
  fixture(text, 6, [
    { from: 0, to: 3, name: 'hmd-codeblock-begin' },
    { from: 4, to: 9, name: 'hmd-codeblock' },
    { from: 10, to: 13, name: 'hmd-codeblock-end' },
  ]).select(4, 9);
});

test('inline code selection: BetterCodeEdit controls the new behavior independently of EnhanceModA', () => {
  const text = 'before `abc` after';
  fixture(text, 9, codeNodes(7, 'abc'), { BetterCodeEdit: false }).delegate();
  fixture(text, 9, codeNodes(7, 'abc'), { BetterCodeEdit: false, EnhanceModA: true })
    .select(0, text.length);
});

test('inline code selection: multiple cursors are left unchanged', () => {
  fixture('`abcd`', EditorSelection.create([
    EditorSelection.cursor(2), EditorSelection.cursor(4),
  ]), codeNodes(0, 'abcd')).delegate();
});
