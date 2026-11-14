import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const { EditorState } = require('@codemirror/state');
const { Tree, NodeType } = require('@lezer/common');
const trees = new WeakMap();
const syntaxRequests = [];
const notices = [];
const dependencies = {
  obsidian: { Notice: class { constructor(message) { notices.push(message); } } },
  '@codemirror/language': {
    ensureSyntaxTree(state, upto) {
      syntaxRequests.push(upto);
      return trees.get(state) ?? null;
    },
  },
  './core': {},
};
const source = readFileSync(new URL('../src/formatting_commands.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
const module = { exports: {} };
runInNewContext(`Array.prototype.contains = Array.prototype.includes;\n${code}`, {
  module, exports: module.exports, console,
  require(id) {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  },
});
const { deleteBlankLines } = module.exports;

function fixture(text, {
  strict = false, fences = [], tableLines = [], indentedLines = [],
  selection, syntaxReady = true,
} = {}) {
  let state = EditorState.create({ doc: text });
  const doc = state.doc;
  const nodes = [];
  const lineNode = (number, name) => {
    const line = doc.line(number);
    nodes.push({ from: line.from, to: line.to, name });
  };
  // Obsidian's empty code lines can have zero-width nodes or no node at EOF.
  // Deliberately omit them: the fence extent must protect those blank lines.
  for (const [opening, closing] of fences) {
    lineNode(opening, 'HyperMD-codeblock_HyperMD-codeblock-begin_HyperMD-codeblock-bg');
    for (let line = opening + 1; line < (closing ?? doc.lines + 1); line++) {
      if (doc.line(line).text.trim()) lineNode(line, 'HyperMD-codeblock_HyperMD-codeblock-bg');
    }
    if (closing !== undefined) {
      lineNode(closing, 'HyperMD-codeblock_HyperMD-codeblock-end_HyperMD-codeblock-bg');
    }
  }
  for (const line of tableLines) lineNode(line, 'HyperMD-table-row-0');
  for (const line of indentedLines) lineNode(line, 'hmd-indented-code_inline-code');
  nodes.sort((a, b) => a.from - b.from);
  const tree = new Tree(
    NodeType.define({ id: 0, name: 'Document' }),
    nodes.map((node, index) => new Tree(
      NodeType.define({ id: index + 1, name: node.name }), [], [], node.to - node.from,
    )),
    nodes.map(node => node.from), text.length,
  );
  const position = offset => {
    const line = state.doc.lineAt(offset);
    return { line: line.number - 1, ch: offset - line.from };
  };
  if (selection) {
    const offset = pos => doc.line(pos.line + 1).from + pos.ch;
    state = state.update({
      selection: { anchor: offset(selection.anchor), head: offset(selection.head) },
    }).state;
  }
  trees.set(state, syntaxReady ? tree : null);
  const writes = [];
  const editor = {
    cm: { get state() { return state; } },
    somethingSelected: () => !state.selection.main.empty,
    getSelection: () => state.sliceDoc(state.selection.main.from, state.selection.main.to),
    listSelections: () => [{
      anchor: position(state.selection.main.anchor), head: position(state.selection.main.head),
    }],
    setValue(value) {
      writes.push(value);
      state = EditorState.create({ doc: value });
    },
  };
  const context = {
    settings: { debug: false },
    app: { vault: { config: { strictLineBreaks: strict } } },
  };
  return {
    selectedText: () => editor.getSelection(),
    run(expected, { noWrite = false, notice = false } = {}) {
      const noticeStart = notices.length;
      const requestStart = syntaxRequests.length;
      deleteBlankLines(context, editor);
      assert.equal(state.doc.toString(), expected);
      if (noWrite) assert.deepEqual(writes, [], 'An unchanged document must not be rewritten');
      if (notice) {
        assert.equal(notices.length - noticeStart, 1);
        assert.ok(String(notices.at(-1)).includes('EasyTyping'));
        assert.deepEqual(syntaxRequests.slice(requestStart), [text.length]);
      } else {
        assert.equal(notices.length, noticeStart);
      }
    },
  };
}

const table = '| A | B |\n| --- | --- |\n| 1 | 2 |';
for (const strict of [false, true]) {
  const mode = `strict=${strict}`;

  test(`delete blank lines (${mode}): preserves every blank inside backtick and tilde fences`, () => {
    for (const fence of ['```', '~~~']) {
      const inside = `${fence}js\nfirst\n\n  \nsecond\n${fence}`;
      const text = `before\n\n${inside}\n\nafter`;
      fixture(text, { strict, fences: [[3, 8]] })
        .run(strict ? text : `before\n${inside}\nafter`);
    }
  });

  test(`delete blank lines (${mode}): unclosed fences protect blank lines through EOF`, () => {
    for (const fence of ['```', '~~~']) {
      const inside = `${fence}js\nfirst\n\n  \n`;
      const text = `before\n\n${inside}`;
      fixture(text, { strict, fences: [[3]] }).run(strict ? text : `before\n${inside}`);
    }
  });

  test(`delete blank lines (${mode}): a selection starting inside a fence keeps its blank lines`, () => {
    const text = 'outside\n\n```\nfirst\n\n  \nsecond\n```\n\noutside';
    const ends = [{ line: 4, ch: 0 }, { line: 6, ch: 6 }];
    for (const [anchor, head] of [ends, [...ends].reverse()]) {
      fixture(text, { strict, fences: [[3, 8]], selection: { anchor, head } })
        .run(text, { noWrite: true });
    }
  });

  test(`delete blank lines (${mode}): preserves exactly one separator before a table`, () => {
    for (const count of [1, 3]) {
      const text = `intro\n${'\n'.repeat(count)}${table}`;
      fixture(text, { strict, tableLines: [count + 2, count + 3, count + 4] })
        .run(`intro\n\n${table}`);
    }
  });

  test(`delete blank lines (${mode}): selected blank line is protected when table text is outside selection`, () => {
    const text = `intro\n\n${table}`;
    const editor = fixture(text, {
      strict, tableLines: [3, 4, 5],
      selection: { anchor: { line: 1, ch: 0 }, head: { line: 2, ch: 0 } },
    });
    assert.equal(editor.selectedText(), '\n');
    editor.run(text, { noWrite: true });
  });

  test(`delete blank lines (${mode}): indented code protects its separator and internal blank gaps`, () => {
    const text = 'intro\n\n    first\n\n  \n    second';
    fixture(text, { strict, indentedLines: [3, 6] }).run(text, { noWrite: true });
  });

  test(`delete blank lines (${mode}): multiple blanks before indented code collapse to one`, () => {
    fixture('intro\n\n\n    code', { strict, indentedLines: [4] })
      .run('intro\n\n    code');
  });

  test(`delete blank lines (${mode}): ordinary prose and pipe text retain existing behavior`, () => {
    const text = 'first\n\n\nnot | a table\n\nnext';
    fixture(text, { strict }).run(strict ? 'first\n\nnot | a table\n\nnext' : 'first\nnot | a table\nnext');
  });

  test(`delete blank lines (${mode}): existing list, quote and block-id boundaries are preserved`, () => {
    for (const [text, expected] of [
      ['- first\n\n\n- second', '- first\n- second'],
      ['> first\n\n\n> second', '> first\n> second'],
      ['- item\n\n\nparagraph', '- item\n\nparagraph'],
      ['> quote\n\n\n- item', '> quote\n\n- item'],
      ['text ^block\n\n\nnext', 'text ^block\n\nnext'],
    ]) {
      fixture(text, { strict }).run(expected);
    }
  });

  test(`delete blank lines (${mode}): horizontal-rule separator follows existing behavior`, () => {
    const text = 'first\n\n\n---\n\nnext';
    fixture(text, { strict }).run(strict ? text : 'first\n\n---\nnext');
  });
}

test('delete blank lines: missing complete syntax tree leaves the document untouched and reports a notice', () => {
  fixture('first\n\n\nsecond', { syntaxReady: false })
    .run('first\n\n\nsecond', { noWrite: true, notice: true });
});

test('delete blank lines: no-op command does not reset document or selection', () => {
  fixture('first\nsecond', {
    selection: { anchor: { line: 0, ch: 1 }, head: { line: 1, ch: 2 } },
  }).run('first\nsecond', { noWrite: true });
});
