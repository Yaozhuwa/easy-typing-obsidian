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
const modules = new Map();
const sourceRoot = new URL('../src/', import.meta.url);
const dependencies = {
  obsidian: { Notice: class {}, Platform: { isMacOS: true } },
  '@codemirror/language': {
    syntaxTree: state => trees.get(state),
    ensureSyntaxTree: state => trees.get(state),
  },
};

// Load the production formatter, syntax classification and rule engine together.
// Only the Obsidian host and its parser are supplied by fixtures; helper modules
// and formatting dependencies are loaded from source, including circular imports.
function loadSource(file) {
  const url = file instanceof URL ? file : new URL(file, sourceRoot);
  if (modules.has(url.href)) return modules.get(url.href).exports;
  const module = { exports: {} };
  modules.set(url.href, module);
  const { code } = transformSync(readFileSync(url, 'utf8'), { loader: 'ts', format: 'cjs' });
  runInNewContext(`String.prototype.contains = String.prototype.includes;\n${code}`, {
    module, exports: module.exports, console,
    require(id) {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      if (id.startsWith('.')) return loadSource(new URL(`${id}.ts`, url));
      if (id.startsWith('src/')) return loadSource(new URL(`${id.slice(4)}.ts`, sourceRoot));
      return require(id);
    },
  }, { filename: url.pathname });
  return module.exports;
}

const core = loadSource('core.ts');
const syntax = loadSource('syntax.ts');
const { RuleEngine, RuleType, RuleScope } = loadSource('rule_engine.ts');
const { DEFAULT_SETTINGS } = loadSource('settings/settings_types.ts');
const tagPattern = String.raw`(?<!#)#[\u4e00-\u9fa5\w-\/]+`;

function fixture(text, nodes) {
  const state = EditorState.create({ doc: text });
  trees.set(state, new Tree(
    NodeType.define({ id: 0, name: 'Document' }),
    nodes.map((node, index) => new Tree(
      NodeType.define({ id: index + 1, name: node.name }), [], [], node.to - node.from,
    )),
    nodes.map(node => node.from), text.length,
  ));
  return state;
}

function tagFixture(stem, ending, metadata = stem + ending) {
  const text = `#${stem}${ending}`;
  // Captured from Obsidian 1.15.1: metadata is embedded in node names, and
  // underscores split a tag into a hashtag_meta run and a tagged ending.
  const nodes = [
    { from: 0, to: 1, name: `formatting_formatting-hashtag_hashtag_hashtag-begin_meta_tag-${metadata}` },
    ...(stem ? [{ from: 1, to: 1 + stem.length, name: 'hashtag_meta' }] : []),
    { from: 1 + stem.length, to: text.length, name: `hashtag_hashtag-end_meta_tag-${stem ? ending : metadata}` },
  ];
  return { text, nodes, state: fixture(text, nodes) };
}

function matchScopedRule(state, cursor, options, trigger = state.doc.toString()) {
  const engine = new RuleEngine();
  engine.addSimpleRule({ trigger, replacement: 'matched', options });
  const scope = syntax.detectRuleScope(state, cursor);
  return engine.process({
    kind: RuleType.Input, docText: state.doc.toString(),
    selection: { from: cursor, to: cursor }, inserted: trigger, changeType: 'input.type',
    scopeHint: scope.scope, scopeLanguage: scope.language,
  });
}

for (const [stem, ending, metadata] of [
  ['a_', 'code'], ['a_', 'inline-code'], ['a_', 'codeblock'], ['a_', 'math'],
  ['a_link_', 'code'], ['a_', 'formatting-code'], ['', 'code/math', 'codemath'],
]) {
  test(`tag classification: #${stem}${ending} remains plain text without inserted spaces`, () => {
    const { text, nodes, state } = tagFixture(stem, ending, metadata);
    const formatter = new core.LineFormater();
    for (const node of nodes) {
      assert.equal(formatter.syntaxTreeNodeNameType(node.name), core.InlineType.text, node.name);
      assert.equal(syntax.detectRuleScope(state, node.to).scope, RuleScope.Text, node.name);
    }
    const parts = formatter.parseLineWithSyntaxTree(state, 1);
    assert.equal(parts.map(part => part.content).join(''), text);
    assert.ok(parts.every(part => part.type === core.InlineType.text));
    const formatted = formatter.formatLine(state, 1, DEFAULT_SETTINGS, text.length, 0);
    assert.equal(formatted[0], text);
    assert.equal(formatted[1], text.length);
  });
}

test('tag classification: code-only and formula-only rules cannot run in ordinary tags', () => {
  for (const ending of ['code', 'inline-code', 'codeblock', 'math']) {
    const { text, state } = tagFixture('a_', ending);
    assert.equal(matchScopedRule(state, text.length, 'c'), null, text);
    assert.equal(matchScopedRule(state, text.length, 'f'), null, text);
    assert.equal(matchScopedRule(state, text.length, 't')?.newText, 'matched', text);
  }
});

test('tag classification: an enabled tag-protection regex receives each complete tag as user-defined text', () => {
  // Tag protection is opt-in; the shipped default leaves its example commented.
  for (const [stem, ending] of [['a_', 'code'], ['a_', 'math'], ['', '中文code']]) {
    const { text, state } = tagFixture(stem, ending);
    const settings = {
      ...DEFAULT_SETTINGS, UserDefinedRegSwitch: true, UserDefinedRegExp: `${tagPattern}|++`,
    };
    const formatter = new core.LineFormater();
    const parts = formatter.parseLineWithSyntaxTree(state, 1, settings.UserDefinedRegExp);
    assert.equal(parts.length, 1, text);
    assert.equal(parts[0].type, core.InlineType.user, text);
    assert.equal(parts[0].content, text);
    assert.equal(parts[0].begin, 0);
    assert.equal(parts[0].end, text.length);
    assert.equal(parts[0].leftSpaceRequire, core.SpaceState.strict);
    assert.equal(parts[0].rightSpaceRequire, core.SpaceState.strict);
    assert.equal(formatter.formatLine(state, 1, settings, text.length, 0)[0], text);
  }
});

test('tag classification: protected tags keep their configured boundary-space policy', () => {
  const tag = tagFixture('', '中文code');
  const text = `前${tag.text}。`;
  const state = fixture(text, tag.nodes.map(node => ({ ...node, from: node.from + 1, to: node.to + 1 })));
  for (const [policy, expected] of [['--', text], ['++', `前 ${tag.text} 。`]]) {
    const settings = {
      ...DEFAULT_SETTINGS, UserDefinedRegSwitch: true, UserDefinedRegExp: `${tagPattern}|${policy}`,
    };
    assert.equal(new core.LineFormater().formatLine(state, 1, settings, text.length, 0)[0], expected);
  }
});

test('tag classification: tag metadata cannot classify a plain line as a Markdown structure', () => {
  for (const ending of ['code', 'inline-code', 'codeblock', 'math', 'list', 'table', 'quote', 'callout', 'hmd-frontmatter']) {
    const { text, state } = tagFixture('a_', ending);
    assert.equal(core.getPosLineType(state, text.length), core.LineType.text, text);
    assert.equal(core.getPosLineType2(state, text.length), core.LineType.text, text);
  }
});

test('tag classification: actual list and quote context survives removal of tag metadata', () => {
  for (const [prefix, context, beginning, middle, ending, expectedType] of [
    ['- ', 'formatting_formatting-list_formatting-list-ul_list-1',
      'formatting_formatting-hashtag_hashtag_hashtag-begin_list-1_meta_tag-a_codeblock',
      'hashtag_list-1_meta', 'hashtag_hashtag-end_list-1_meta_tag-codeblock', core.LineType.list],
    ['> ', 'formatting_formatting-quote_formatting-quote-1_quote_quote-1',
      'formatting_formatting-hashtag_hashtag_hashtag-begin_meta_quote_quote-1_tag-a_codeblock',
      'hashtag_meta_quote_quote-1', 'hashtag_hashtag-end_meta_quote_quote-1_tag-codeblock', core.LineType.quote],
  ]) {
    const text = `${prefix}#a_codeblock`;
    const state = fixture(text, [
      { from: 0, to: 2, name: context },
      { from: 2, to: 3, name: beginning },
      { from: 3, to: 5, name: middle },
      { from: 5, to: text.length, name: ending },
    ]);
    assert.equal(core.getPosLineType(state, text.length), core.LineType.text);
    assert.equal(core.getPosLineType2(state, text.length), expectedType);
    assert.equal(syntax.detectRuleScope(state, text.length).scope, RuleScope.Text);
    assert.equal(new core.LineFormater().formatLine(state, 1, DEFAULT_SETTINGS, text.length, 0)[0], text);
  }
});

test('tag classification: genuine inline code still has code scope, including tag-shaped contents', () => {
  const text = '`#a_code`';
  const nodes = [
    { from: 0, to: 1, name: 'formatting_formatting-code_inline-code' },
    { from: 1, to: 8, name: 'inline-code' },
    { from: 8, to: 9, name: 'formatting_formatting-code_formatting-code-end_inline-code' },
  ];
  const state = fixture(text, nodes);
  const formatter = new core.LineFormater();
  for (const node of nodes) assert.equal(formatter.syntaxTreeNodeNameType(node.name), core.InlineType.code);
  assert.equal(syntax.detectRuleScope(state, 8).scope, RuleScope.Code);
  assert.equal(matchScopedRule(state, 8, 'c', '#a_code')?.newText, 'matched');
  assert.equal(matchScopedRule(state, 8, 't', '#a_code'), null);
  assert.equal(formatter.formatLine(state, 1, DEFAULT_SETTINGS, text.length, 0)[0], text);
});

test('tag classification: legacy multi-backtick code keeps internal backticks as code', () => {
  const text = '``a`b``';
  const state = fixture(text, [
    { from: 0, to: 2, name: 'formatting-code_inline-code' },
    { from: 2, to: 5, name: 'inline-code' },
    { from: 5, to: 7, name: 'formatting-code_inline-code' },
  ]);
  const formatter = new core.LineFormater();
  assert.ok(formatter.parseLineWithSyntaxTree(state, 1).every(part => part.type === core.InlineType.code));
  assert.equal(syntax.detectRuleScope(state, 5).scope, RuleScope.Code);
  assert.equal(formatter.formatLine(state, 1, DEFAULT_SETTINGS, text.length, 0)[0], text);
});

test('tag classification: fenced code still has code scope and its language', () => {
  const text = '```html\nvalue\n```';
  const state = fixture(text, [
    { from: 0, to: 7, name: 'HyperMD-codeblock_HyperMD-codeblock-begin_HyperMD-codeblock-bg' },
    { from: 8, to: 13, name: 'hmd-codeblock_tag' },
    { from: 14, to: 17, name: 'HyperMD-codeblock_HyperMD-codeblock-end_HyperMD-codeblock-bg' },
  ]);
  const scope = syntax.detectRuleScope(state, 13);
  assert.equal(scope.scope, RuleScope.Code);
  assert.equal(scope.language, 'html');
  assert.equal(core.getPosLineType(state, 10), core.LineType.codeblock);
  assert.equal(core.getPosLineType2(state, 10), core.LineType.codeblock);
  assert.equal(matchScopedRule(state, 13, 'c', 'value')?.newText, 'matched');
});

test('tag classification: math highlighting inside a fenced block remains code scope', () => {
  const text = '```latex\nx\n```';
  const state = fixture(text, [
    { from: 0, to: 8, name: 'HyperMD-codeblock_HyperMD-codeblock-begin_HyperMD-codeblock-bg' },
    { from: 9, to: 10, name: 'hmd-codeblock_math' },
    { from: 11, to: 14, name: 'HyperMD-codeblock_HyperMD-codeblock-end_HyperMD-codeblock-bg' },
  ]);
  assert.equal(new core.LineFormater().syntaxTreeNodeNameType('hmd-codeblock_math'), core.InlineType.code);
  assert.equal(syntax.detectRuleScope(state, 10).scope, RuleScope.Code);
  assert.equal(syntax.detectRuleScope(state, 10).language, 'latex');
  assert.equal(matchScopedRule(state, 10, 'c', 'x')?.newText, 'matched');
  assert.equal(matchScopedRule(state, 10, 'f', 'x'), null);
});

test('tag classification: indented code retains code classification and scope', () => {
  const text = '    value';
  const name = 'hmd-indented-code_inline-code';
  const state = fixture(text, [{ from: 0, to: text.length, name }]);
  assert.equal(new core.LineFormater().syntaxTreeNodeNameType(name), core.InlineType.code);
  assert.equal(syntax.detectRuleScope(state, text.length).scope, RuleScope.Code);
  assert.equal(matchScopedRule(state, text.length, 'c', 'value')?.newText, 'matched');
});

test('tag classification: real math retains formula classification and scoped rules', () => {
  const text = '$x$';
  const nodes = [
    { from: 0, to: 1, name: 'formatting_formatting-math_formatting-math-begin_keyword_math' },
    { from: 1, to: 2, name: 'math_variable-2' },
    { from: 2, to: 3, name: 'formatting_formatting-math_formatting-math-end_keyword_math_math-' },
  ];
  const state = fixture(text, nodes);
  const formatter = new core.LineFormater();
  for (const node of nodes) assert.equal(formatter.syntaxTreeNodeNameType(node.name), core.InlineType.formula);
  assert.equal(syntax.detectRuleScope(state, 2).scope, RuleScope.Formula);
  assert.equal(core.getPosLineType(state, 2), core.LineType.formula);
  assert.equal(core.getPosLineType2(state, 2), core.LineType.formula);
  assert.equal(matchScopedRule(state, 2, 'f', 'x')?.newText, 'matched');
  assert.equal(matchScopedRule(state, 2, 'c', 'x'), null);
});

test('tag classification: display math with tag-shaped content retains formula scope', () => {
  const text = '$$\n#a_math\n$$';
  const state = fixture(text, [
    { from: 0, to: 2, name: 'formatting_formatting-math_formatting-math-begin_keyword_math_math-block' },
    { from: 3, to: 4, name: 'math' },
    { from: 4, to: 5, name: 'math_variable-2' },
    { from: 5, to: 6, name: 'math_tag' },
    { from: 6, to: 10, name: 'math_variable-2' },
    { from: 11, to: 13, name: 'formatting_formatting-math_formatting-math-end_keyword_math_math-' },
  ]);
  const formatter = new core.LineFormater();
  assert.equal(formatter.syntaxTreeNodeNameType('HyperMD-math'), core.InlineType.formula);
  assert.ok(formatter.parseLineWithSyntaxTree(state, 2).every(part => part.type === core.InlineType.formula));
  assert.equal(syntax.detectRuleScope(state, 10).scope, RuleScope.Formula);
  assert.equal(core.getPosLineType(state, 6), core.LineType.formula);
  assert.equal(core.getPosLineType2(state, 6), core.LineType.formula);
  assert.equal(matchScopedRule(state, 10, 'f', '#a_math')?.newText, 'matched');
});

test('tag classification: HyperMD-math container nodes retain formula classification', () => {
  const state = fixture('$$\nx\n$$', [
    { from: 0, to: 2, name: 'HyperMD-math' },
    { from: 3, to: 4, name: 'HyperMD-math' },
    { from: 5, to: 7, name: 'HyperMD-math' },
  ]);
  const parts = new core.LineFormater().parseLineWithSyntaxTree(state, 2);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].type, core.InlineType.formula);
  assert.equal(syntax.detectRuleScope(state, 4).scope, RuleScope.Formula);
  assert.equal(core.getPosLineType(state, 4), core.LineType.formula);
  assert.equal(core.getPosLineType2(state, 4), core.LineType.formula);
});

test('tag classification: links containing code or math names keep text scope and link parsing', () => {
  const text = '[[code_math]]';
  const nodes = [
    { from: 0, to: 2, name: 'formatting-link_formatting-link-start' },
    { from: 2, to: 11, name: 'hmd-internal-link' },
    { from: 11, to: 13, name: 'formatting-link_formatting-link-end' },
  ];
  const state = fixture(text, nodes);
  const formatter = new core.LineFormater();
  for (const node of nodes) assert.equal(formatter.syntaxTreeNodeNameType(node.name), core.InlineType.text);
  assert.equal(syntax.detectRuleScope(state, 11).scope, RuleScope.Text);
  const parts = formatter.parseLineWithSyntaxTree(state, 1);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].type, core.InlineType.wikilink);
  assert.equal(parts[0].content, text);
});
