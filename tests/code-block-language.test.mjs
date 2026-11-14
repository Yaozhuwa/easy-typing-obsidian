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

const ruleEngine = loadSource('rule_engine.ts', { obsidian: { Notice: class {} } });
const syntax = loadSource('syntax.ts', {
  '@codemirror/language': {
    syntaxTree: state => trees.get(state),
    ensureSyntaxTree: state => trees.get(state),
  },
  './core': { getPosLineType2: () => 'text' },
  './rule_engine': ruleEngine,
  './syntax_node_types': loadSource('syntax_node_types.ts', {}),
});
const { toggleComment } = loadSource('comment_toggle.ts', { './syntax': syntax });

function fixture(text, { selection = 0, openingLine = 1, closed = true, nodeOffset = 0 } = {}) {
  let state = EditorState.create({
    doc: text,
    selection: typeof selection === 'number' ? { anchor: selection } : selection,
  });
  function attachTree() {
    const opening = state.doc.line(openingLine);
    const nodes = [{
      name: 'HyperMD-codeblock_HyperMD-codeblock-begin_HyperMD-codeblock-bg',
      from: opening.from + nodeOffset, to: opening.to,
    }];
    const bodyEnd = state.doc.lines - (closed ? 1 : 0);
    for (let lineNumber = openingLine + 1; lineNumber <= bodyEnd; lineNumber++) {
      const line = state.doc.line(lineNumber);
      nodes.push({ name: 'hmd-codeblock', from: line.from, to: line.to });
    }
    if (closed) {
      const closing = state.doc.line(state.doc.lines);
      nodes.push({
        name: 'HyperMD-codeblock_HyperMD-codeblock-end_HyperMD-codeblock-bg',
        from: closing.from, to: closing.to,
      });
    }
    // Actual Lezer traversal/resolution; token names model Obsidian's parser.
    trees.set(state, new Tree(
      NodeType.define({ id: 0, name: 'Document' }),
      nodes.map((node, index) => new Tree(
        NodeType.define({ id: index + 1, name: node.name }), [], [], node.to - node.from,
      )),
      nodes.map(node => node.from), state.doc.length,
    ));
  }
  attachTree();
  return {
    get state() { return state; },
    dispatch(...specs) {
      state = state.update(...specs).state;
      attachTree();
    },
  };
}

for (const [header, expectedLanguage] of [
  ['```java', 'java'],
  ['```java title:Test.java', 'java'],
  ['```JAVA title:"Test File.java" fold ln:true', 'java'],
  ['``` \t JaVa\t title="Test File.java"  ', 'java'],
  ['~~~python title:demo.py', 'python'],
  ['````css title:theme.css', 'css'],
  ['```mystery title:java', 'mystery'],
  ['```title:Test.java', 'title:test.java'],
  ['```', ''],
  ['``` \t ', ''],
]) {
  test(`code block language: ${JSON.stringify(header)}`, () => {
    const fence = header.match(/[`~]{3,}/)[0];
    const text = `${header}\nvalue\n${fence}`;
    const view = fixture(text);
    const [info] = syntax.getCodeBlocksInfos(view.state);
    assert.equal(info.language, expectedLanguage);
    assert.equal(info.start_pos, 0);
    assert.equal(info.indent, 0);
    assert.equal(info.code_start_pos, text.indexOf('value'));
    assert.equal(info.code_end_pos, text.indexOf('value') + 'value'.length);
    assert.equal(info.end_pos, text.length);
  });
}

for (const [name, prefix, bodyPrefix, nodeOffset] of [
  ['indented fence', '  ', '  ', 0],
  ['quoted fence', '> ', '> ', 0],
  ['nested quote', '> > ', '> > ', 0],
  ['list fence', '- ', '  ', 0],
  ['quote token starts after its prefix', '> ', '> ', 2],
]) {
  test(`code block language: ${name} keeps its existing offsets`, () => {
    const text = `intro\n${prefix}\`\`\`java title:Test.java\n${bodyPrefix}int value = 1;\n${bodyPrefix}\`\`\``;
    const view = fixture(text, { openingLine: 2, nodeOffset });
    const [info] = syntax.getCodeBlocksInfos(view.state);
    assert.deepEqual({ ...info }, {
      language: 'java',
      start_pos: text.indexOf('```'), end_pos: text.length,
      code_start_pos: text.indexOf('int value'),
      code_end_pos: text.indexOf('int value') + 'int value = 1;'.length,
      indent: prefix.length,
    });
  });
}

test('code block language: empty and unfinished blocks preserve their ranges', () => {
  const empty = fixture('```java title:Test.java\n```');
  const [emptyInfo] = syntax.getCodeBlocksInfos(empty.state);
  assert.equal(emptyInfo.language, 'java');
  assert.equal(emptyInfo.code_start_pos, empty.state.doc.line(1).to);
  assert.equal(emptyInfo.code_end_pos, emptyInfo.code_start_pos);
  const unfinished = fixture('```java title:Test.java\nint value = 1;', { closed: false });
  const [unfinishedInfo] = syntax.getCodeBlocksInfos(unfinished.state);
  assert.equal(unfinishedInfo.language, 'java');
  assert.equal(unfinishedInfo.code_start_pos, unfinished.state.doc.line(2).from);
  assert.equal(unfinishedInfo.code_end_pos, unfinished.state.doc.length);
  assert.equal(unfinishedInfo.end_pos, unfinished.state.doc.length);
});

for (const [language, body, commented] of [
  ['java', 'int value = 1;', '// int value = 1;'],
  ['python', 'value = 1', '# value = 1'],
  ['css', 'color: red;', '/* color: red; */'],
]) {
  test(`code block comment: ${language} title preserves single-line round trip`, () => {
    const header = `\`\`\`${language} title:"Example File" fold`;
    const text = `${header}\n  ${body}\n\`\`\``;
    const view = fixture(text, { selection: text.indexOf(body) + 2 });
    assert.equal(toggleComment(view), true);
    assert.equal(view.state.doc.toString(), `${header}\n  ${commented}\n\`\`\``);
    assert.equal(toggleComment(view), true);
    assert.equal(view.state.doc.toString(), text);
  });
}

test('code block comment: Java title preserves multiline round trip and fence metadata', () => {
  const header = '```JAVA title:Test.java ln:true';
  const text = `${header}\nint a = 1;\n  int b = 2;\n\`\`\``;
  const view = fixture(text, {
    selection: { anchor: text.indexOf('int a'), head: text.indexOf('int b') + 'int b = 2;'.length },
  });
  assert.equal(toggleComment(view), true);
  assert.equal(view.state.doc.toString(), `${header}\n// int a = 1;\n  // int b = 2;\n\`\`\``);
  assert.equal(toggleComment(view), true);
  assert.equal(view.state.doc.toString(), text);
});

for (const header of ['```mystery title:java', '```', '```title:Test.java']) {
  test(`code block comment: unknown or absent language stays unhandled (${header})`, () => {
    const text = `${header}\nvalue\n\`\`\``;
    const view = fixture(text, { selection: text.indexOf('value') });
    const before = view.state.selection;
    assert.equal(toggleComment(view), false);
    assert.equal(view.state.doc.toString(), text);
    assert.ok(view.state.selection.eq(before));
  });
}

test('code block scope: title metadata does not prevent a Java-only rule from matching', () => {
  const engine = new ruleEngine.RuleEngine();
  engine.addSimpleRule({ trigger: 'foo', replacement: 'bar', options: 'c', scope_language: 'java' });
  for (const language of ['JAVA', 'python']) {
    const text = `\`\`\`${language} title:Test.java\nfoo\n\`\`\``;
    const cursor = text.indexOf('foo') + 3;
    const view = fixture(text, { selection: cursor });
    const scope = syntax.detectRuleScope(view.state, cursor);
    assert.deepEqual({ ...scope }, { scope: 'code', language: language.toLowerCase() });
    const result = engine.process({
      kind: ruleEngine.RuleType.Input, docText: text,
      selection: { from: cursor, to: cursor }, inserted: 'foo', changeType: 'input.type',
      scopeHint: scope.scope, scopeLanguage: scope.language,
    });
    if (language === 'JAVA') assert.equal(result?.newText, 'bar');
    else assert.equal(result, null);
  }
});
