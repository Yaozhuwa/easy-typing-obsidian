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
const notices = [];
const diagnostics = [];

class PluginHost {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
    this.commands = [];
    this.extensions = [];
  }
  registerEditorExtension(extension) { this.extensions.push(extension); }
  addCommand(command) { this.commands.push(command); }
  addSettingTab() {}
  registerEvent() {}
}

const dependencies = {
  obsidian: {
    Notice: class { constructor(message) { notices.push(message); } },
    Plugin: PluginHost,
    Platform: { isMacOS: true },
    moment: { locale: () => 'zh-cn' },
  },
  '@codemirror/language': {
    syntaxTree: state => trees.get(state),
    ensureSyntaxTree: state => trees.get(state),
  },
};

// Exercise the production formatter and its actual dependencies. Only the
// Obsidian host and syntax-tree provider are replaced by a plain-text fixture.
function loadSource(file) {
  const url = file instanceof URL ? file : new URL(file, sourceRoot);
  if (modules.has(url.href)) return modules.get(url.href).exports;
  const module = { exports: {} };
  modules.set(url.href, module);
  const { code } = transformSync(readFileSync(url, 'utf8'), { loader: 'ts', format: 'cjs' });
  runInNewContext(`String.prototype.contains = String.prototype.includes;\n${code}`, {
    module, exports: module.exports,
    console: {
      ...console,
      log: () => {},
      error: (...args) => diagnostics.push(args),
      warn: (...args) => diagnostics.push(args),
    },
    require(id) {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      if (url.pathname.endsWith('/main.ts') && Object.hasOwn(mainDependencies, id)) {
        return mainDependencies[id];
      }
      if (id.startsWith('.')) return loadSource(new URL(`${id}.ts`, url));
      if (id.startsWith('src/')) return loadSource(new URL(`${id.slice(4)}.ts`, sourceRoot));
      return require(id);
    },
  }, { filename: url.pathname });
  return module.exports;
}

const core = loadSource('core.ts');
const { DEFAULT_SETTINGS } = loadSource('settings/settings_types.ts');
const formatter = new core.LineFormater();

// Startup uses real main.ts, settings defaults, locale, parser and formatter.
// UI registration and rule-file initialization are unrelated to regex migration.
const mainDependencies = {
  './settings': { DEFAULT_SETTINGS, EasyTypingSettingTab: class {} },
  './rule_manager': { RuleManager: class { async initRuleEngine() {} } },
  './cm_extensions': { createTransactionFilter: () => [], createViewUpdatePlugin: () => [] },
  './tabstops_state_field': { tabstopsStateField: { extension: [] } },
  './keyboard_handlers': {},
  './formatting_commands': {},
  './comment_toggle': {},
  './lang/locale': loadSource('lang/locale/index.ts'),
};

function pluginWithData(data) {
  const { default: EasyTypingPlugin } = loadSource('main.ts');
  const app = { vault: { on() {} }, workspace: { on() {} } };
  const plugin = new EasyTypingPlugin(app, { id: 'easy-typing-obsidian' });
  plugin.loadData = async () => data;
  return plugin;
}

function fixture(text) {
  const state = EditorState.create({ doc: text });
  trees.set(state, new Tree(NodeType.define({ id: 0, name: 'Document' }), [], [], text.length));
  return state;
}

function parse(text, source) {
  return formatter.parseLineWithSyntaxTree(fixture(text), 1, source);
}

function userParts(text, source) {
  return Array.from(parse(text, source).filter(part => part.type === core.InlineType.user), part => ({
    content: part.content, begin: part.begin, end: part.end,
    left: part.leftSpaceRequire, right: part.rightSpaceRequire,
  }));
}

function format(text, source, enabled = true) {
  const settings = {
    ...DEFAULT_SETTINGS,
    UserDefinedRegSwitch: enabled,
    UserDefinedRegExp: source,
  };
  // prevCh = 0 ensures this exercises the entire line, including spacing rules.
  return formatter.formatLine(fixture(text), 1, settings, text.length, 0)[0];
}

function withoutDiagnostics(action) {
  notices.length = 0;
  diagnostics.length = 0;
  action();
  assert.deepEqual([...notices], [], 'formatting must not display a configuration Notice');
  assert.deepEqual([...diagnostics], [], 'formatting must not log the same configuration error per keystroke');
}

function config(source) {
  return loadSource('formatting/custom_regex_config.ts').getCustomRegexConfig(source);
}

function migrate(source, addSpaces) {
  return loadSource('formatting/custom_regex_config.ts').migrateLegacyDefaultRegexConfig(source, addSpaces);
}

// Historical shipped defaults: the original two lines, and the four-line 4.0.8 default.
const legacyTwoLines = ':\\w*:\n{{.*?}}';
const legacyFourLines = `${legacyTwoLines}\n<.*?>\n\\[\\!.*?\\][+-]{0,1}`;
const withPolicy = (source, policy) => source.split('\n').map(line => `${line}|${policy}`).join('\n');

test('custom regex core: consecutive and indented comments and blank lines stay silent', () => {
  const source = '// first\n// second\n  // indented\n\t\n\n#中文code|--';
  withoutDiagnostics(() => {
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(userParts('#中文code', source)[0]?.content, '#中文code');
    }
  });
});

for (const [name, newline] of [['LF', '\n'], ['CRLF', '\r\n'], ['CR', '\r']]) {
  test(`custom regex core: ${name} configuration applies every valid rule`, () => {
    const source = ['#中文code|--', '#标签math|=+'].join(newline);
    withoutDiagnostics(() => {
      for (let attempt = 0; attempt < 2; attempt++) {
        assert.deepEqual(userParts('#中文code #标签math', source), [
          { content: '#中文code', begin: 0, end: 7, left: core.SpaceState.none, right: core.SpaceState.none },
          { content: '#标签math', begin: 8, end: 15, left: core.SpaceState.soft, right: core.SpaceState.strict },
        ]);
      }
    });
  });
}

test('custom regex core: suffix whitespace is tolerated and the spacing policy still applies', () => {
  withoutDiagnostics(() => {
    assert.equal(format('前#中文code。', '#中文code|++ \t'), '前 #中文code 。');
    assert.equal(format('前#中文code。', '#中文code|-- \t'), '前#中文code。');
  });
});

test('custom regex core: significant spaces in the pattern are preserved', () => {
  withoutDiagnostics(() => {
    assert.deepEqual(userParts('x foo y', ' foo |--  '), [
      { content: ' foo ', begin: 1, end: 6, left: core.SpaceState.none, right: core.SpaceState.none },
    ]);
    assert.deepEqual(userParts('foo', ' foo |--  '), []);
    assert.deepEqual(userParts('a b', ' |--'), [
      { content: ' ', begin: 1, end: 2, left: core.SpaceState.none, right: core.SpaceState.none },
    ]);
  });
});

test('custom regex core: malformed rules are skipped without repeated Notices or console errors', () => {
  const source = 'missing-policy\n[|++\n#中文code|--\n|++';
  withoutDiagnostics(() => {
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(format('前#中文code。', source), '前#中文code。');
      assert.equal(core.isCursorInUserDefinedRegexBlock('前#中文code。', 4, source), true);
      assert.equal(core.isCursorInUserDefinedRegexBlock('前#中文code。', 8, source), false);
    }
  });
});

test('custom regex core: a disabled custom rule no longer protects mixed-language text', () => {
  const source = '#中文code|--';
  assert.equal(format('前#中文code。', source), '前#中文code。');
  assert.equal(format('前#中文code。', source, false), '前#中文 code。');
});

test('custom regex core: an invalid regex does not log again for every input', () => {
  withoutDiagnostics(() => {
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(format('中文code', '[|++'), '中文 code');
    }
  });
});

test('custom regex parser: errors have one-based source lines and preserve valid rule order', () => {
  withoutDiagnostics(() => {
    const parsed = config('// comment\r\nfoo|+-\r\n\t\r\nbad\r\n[|++\r\n|--\r\nbar|=+');
    assert.deepEqual(Array.from(parsed.errors, ({ line, kind }) => ({ line, kind })), [
      { line: 4, kind: 'format' }, { line: 5, kind: 'regex' }, { line: 6, kind: 'format' },
    ]);
    assert.ok(parsed.errors.find(error => error.kind === 'regex').message);
    assert.deepEqual(Array.from(parsed.rules, rule => [rule.regex.source, rule.regex.flags, rule.left, rule.right]), [
      ['foo', 'g', '+', '-'], ['bar', 'g', '=', '+'],
    ]);
  });
});

test('custom regex parser: empty and whitespace-only configurations and shipped defaults are valid', () => {
  withoutDiagnostics(() => {
    for (const source of [undefined, '', ' \t\r\n\r\n  // comment\r// next']) {
      const parsed = config(source);
      assert.equal(parsed.rules.length, 0);
      assert.equal(parsed.errors.length, 0);
    }
    const parsed = config(DEFAULT_SETTINGS.UserDefinedRegExp);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.rules.length, 5);
    assert.equal(userParts('前{{中文code}}。', DEFAULT_SETTINGS.UserDefinedRegExp)[0]?.content, '{{中文code}}');
  });
});

test('custom regex parser: cache retains only the latest source configuration', () => {
  const first = config('first|++');
  assert.equal(config('first|++'), first);
  const second = config('second|--');
  assert.notEqual(second, first);
  const revisited = config('first|++');
  assert.notEqual(revisited, first);
  assert.equal(config('first|++'), revisited);
});

test('custom regex core: reused compiled regexes reset lastIndex for each parse', () => {
  const source = '#中文code|--';
  const compiled = config(source).rules[0].regex;
  compiled.lastIndex = 999;
  assert.equal(userParts('#中文code', source)[0]?.content, '#中文code');
  compiled.lastIndex = 5;
  assert.equal(core.isCursorInUserDefinedRegexBlock('#中文code', 2, source), true);
  assert.equal(userParts('#中文code #中文code', source).length, 2);
  assert.equal(userParts('#中文code', source).length, 1);
});

test('custom regex core: zero-width matches terminate and do not hide later nonempty matches', () => {
  // A VM deadline interrupts synchronous regex loops too, so this regression
  // cannot hang the test runner if a zero-width progress guard is removed.
  const result = runInNewContext('parse("ab", "(?=a)|b|--")', { parse }, { timeout: 1000 });
  assert.deepEqual(Array.from(result, part => [part.content, part.type, part.begin, part.end]), [
    ['a', core.InlineType.text, 0, 1], ['b', core.InlineType.user, 1, 2],
  ]);
  const onlyEmpty = runInNewContext('parse("abc", "^|$|--")', { parse }, { timeout: 1000 });
  assert.equal(onlyEmpty.length, 1);
  assert.equal(onlyEmpty[0].content, 'abc');
  assert.equal(onlyEmpty[0].type, core.InlineType.text);
});

for (const [version, source] of [['original two-line', legacyTwoLines], ['4.0.8 four-line', legacyFourLines]]) {
  test(`custom regex migration: ${version} default gains its historical spacing policy`, () => {
    const migrated = migrate(source);
    assert.equal(migrated, withPolicy(source, '++'));
    assert.equal(config(migrated).errors.length, 0);
    assert.equal(config(migrated).rules.length, source.split('\n').length);
  });
}

test('custom regex migration: disabled legacy UserPartSpace preserves no-added-space policies', () => {
  for (const source of [legacyTwoLines, legacyFourLines]) {
    assert.equal(migrate(source, false), withPolicy(source, '--'));
  }
});

test('custom regex migration: historical CRLF and CR defaults accept a final newline', () => {
  for (const source of [legacyTwoLines, legacyFourLines]) {
    for (const newline of ['\r\n', '\r']) {
      assert.equal(migrate(source.replaceAll('\n', newline) + newline), withPolicy(source, '++'));
    }
  }
});

test('custom regex migration: migrated defaults are idempotent even if the old switch changes', () => {
  for (const source of [legacyTwoLines, legacyFourLines]) {
    for (const addSpaces of [true, false]) {
      const migrated = migrate(source, addSpaces);
      assert.equal(migrate(migrated, addSpaces), migrated);
      assert.equal(migrate(migrated, !addSpaces), migrated);
    }
  }
});

test('custom regex migration: arbitrary custom patterns and current policies are never guessed or rewritten', () => {
  for (const source of [
    'custom.*', ':\\w*:', '{{.*?}}', `${legacyTwoLines}\ncustom.*`,
    `${legacyTwoLines}\n// comment`, ':\\w+:\n{{.*?}}',
    ' foo |--  \r\nbar|=+', withPolicy(legacyTwoLines, '-+'), DEFAULT_SETTINGS.UserDefinedRegExp,
  ]) {
    assert.equal(migrate(source), source, source);
    assert.equal(migrate(source, false), source, source);
  }
});

test('custom regex lifecycle: actual loadSettings migrates known defaults before startup formatting', async () => {
  for (const [source, legacySwitch, expectedPolicy] of [
    [legacyTwoLines, undefined, '++'],
    [legacyFourLines, true, '++'],
    [legacyTwoLines.replaceAll('\n', '\r\n'), false, '--'],
    [legacyFourLines, false, '--'],
  ]) {
    notices.length = 0;
    diagnostics.length = 0;
    const data = { UserDefinedRegExp: source, UserPartSpace: legacySwitch };
    const plugin = pluginWithData(data);
    await plugin.onload();
    assert.equal(plugin.settings.UserDefinedRegExp, withPolicy(source.replaceAll('\r\n', '\n'), expectedPolicy));
    assert.equal(data.UserDefinedRegExp, source, 'loading does not mutate the persisted source object');
    assert.ok(plugin.commands.length > 0, 'onload proceeds through command registration');
    assert.ok(plugin.extensions.length > 0, 'onload proceeds through editor registration');
    const text = '前{{中文code}}。';
    const expected = expectedPolicy === '++' ? '前 {{中文code}} 。' : text;
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(plugin.Formater.formatLine(fixture(text), 1, plugin.settings, text.length, 0)[0], expected);
    }
    assert.deepEqual([...notices], []);
    assert.deepEqual([...diagnostics], []);
  }
});

test('custom regex lifecycle: invalid custom rules receive one startup summary and remain silent while typing', async () => {
  notices.length = 0;
  diagnostics.length = 0;
  const source = 'custom.*\n[|++\n#中文code|--';
  const plugin = pluginWithData({ UserDefinedRegExp: source });
  await plugin.loadSettings();
  assert.equal(plugin.settings.UserDefinedRegExp, source);
  assert.deepEqual([...notices], [], 'settings loading alone has no notification side effect');
  await plugin.onload();
  assert.equal(notices.length, 1);
  assert.match(notices[0], /1, 2/);
  const startupNotice = notices[0];
  const text = '前#中文code。';
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal(plugin.Formater.formatLine(fixture(text), 1, plugin.settings, text.length, 0)[0], text);
    assert.equal(core.isCursorInUserDefinedRegexBlock(text, 3, plugin.settings.UserDefinedRegExp), true);
  }
  assert.deepEqual([...notices], [startupNotice]);
  assert.deepEqual([...diagnostics], []);
});

test('custom regex lifecycle: fresh defaults and disabled invalid configurations produce no startup summary', async () => {
  for (const data of [null, { UserDefinedRegSwitch: false, UserDefinedRegExp: 'custom.*\n[|++' }]) {
    notices.length = 0;
    diagnostics.length = 0;
    const plugin = pluginWithData(data);
    await plugin.onload();
    if (!data) assert.equal(plugin.settings.UserDefinedRegExp, DEFAULT_SETTINGS.UserDefinedRegExp);
    assert.deepEqual([...notices], []);
    assert.deepEqual([...diagnostics], []);
  }
});
