import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'easy-typing-spacing-'));
after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));
const bundlePath = join(temporaryDirectory, 'formatter.cjs');

// Compile the production formatter and dictionary. Only unrelated Obsidian
// dependencies are replaced, so these tests exercise the real spacing logic.
await build({
  stdin: {
    contents: `
      export { applyLanguagePairSpacing } from './src/formatting/text_formatter';
      export { PrefixDictionary } from './src/formatting/prefix_dictionary';
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: bundlePath,
  plugins: [{
    name: 'isolate-formatting-dependencies',
    setup(builder) {
      builder.onResolve({ filter: /^\.\.\/(core|utils)$/ }, args => ({
        path: args.path,
        namespace: 'formatting-stubs',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'formatting-stubs' }, args => ({
        contents: args.path.endsWith('core')
          ? 'export const SpaceState = { none: 0, soft: 1, strict: 2 };'
          : 'export function isParamDefined(value) { return typeof value !== "undefined"; }',
        loader: 'js',
      }));
    },
  }],
});

const require = createRequire(import.meta.url);
const { applyLanguagePairSpacing, PrefixDictionary } = require(bundlePath);
const languagePairs = [
  { a: 'chinese', b: 'english' },
  { a: 'chinese', b: 'digit' },
  { a: 'digit', b: 'english' },
];

function contextFor({ text, cursor, previous, offset = 0, marker = true }) {
  return {
    content: marker ? text.slice(0, cursor) + '\0' + text.slice(cursor) : text,
    curCh: cursor + offset,
    prevCh: previous === undefined ? undefined : previous + offset,
    offset,
  };
}

function format(fixture) {
  return applyLanguagePairSpacing(
    contextFor(fixture), languagePairs, new PrefixDictionary(fixture.dictionary),
  );
}

// Golden results captured from b8526a6 before the performance fix. In particular,
// preserve literal/regex and cursor semantics rather than dropping the dictionary
// or limiting long input. Some cross-script prefix finalization behavior predates
// this fix; changing that behavior is deliberately outside this regression suite.
// Columns: name, text, cursor, previous cursor, dictionary, output, output cursor, offset.
const fixtures = [
  ["literal b站", "b站", 2, 0, "b站", "b站\u0000", 2, 0],
  ["literal n8n", "n8n", 3, 0, "n8n", "n8n\u0000", 3, 0],
  ["literal python3", "python3", 7, 0, "python3", "python3\u0000", 7, 0],
  ["prefix typing", "n8", 2, 1, "n8n", "n8\u0000", 2, 0],
  ["prefix mismatch", "n8x", 3, 2, "n8n", "n 8 x\u0000", 5, 0],
  ["prefix finalized space", "n8 ", 3, 2, "n8n", "n 8 \u0000", 4, 0],
  ["prefix finalized enter", "n8", 2, 2, "n8n", "n 8\u0000", 3, 0],
  ["cross-script prefix", "b站", 2, 1, "b站长", "b站\u0000", 2, 0],
  ["cross-script mismatch", "b站x", 3, 2, "b站长", "b站 x\u0000", 4, 0],
  ["cross-script prefix space", "b站 ", 3, 2, "b站长", "b站 \u0000", 3, 0],
  ["cross-script prefix enter", "b站", 2, 2, "b站长", "b站\u0000", 2, 0],
  ["word left of seed", "b站中a", 4, 0, "b站", "b站中 a\u0000", 5, 0],
  ["word contains middle seed", "a中b文c", 3, 0, "a中b文c", "a中b\u0000文c", 3, 0],
  ["word right of seed", "中b站", 1, 0, "b站", "中\u0000b站", 1, 0],
  ["completed prefix then new script", "python3中文", 9, 0, "python3", "python3 中文\u0000", 10, 0],
  ["alternatives longest exact", "a中b", 3, 0, "/a|a中b/", "a中b\u0000", 3, 0],
  ["regex gi", "B站", 2, 0, "/b站/gi", "B站\u0000", 2, 0],
  ["regex sticky", "2D", 2, 0, "/[1234][dD]/y", "2D\u0000", 2, 0],
  ["regex multiline", "A中\nb文", 5, 0, "/a中|b文/im", "A中\nb文\u0000", 5, 0],
  ["regex exact versus substring", "x2Dy", 4, 0, "/[1234][dD]/", "x 2 Dy\u0000", 6, 0],
  ["formatting separators", "中**abc**", 8, 0, "", "中 **abc**\u0000", 9, 0],
  ["undefined prevCh", "中abc", 4, undefined, "", "中abc\u0000", 4, 0],
  ["offset cursor", "中文abc", 5, 0, "", "中文 abc\u0000", 15, 9],
  ["zero marker middle", "a中b文", 2, 0, "a中b文", "a中\u0000b文", 2, 0],
  ["lookahead inside match", "a中", 2, 0, "/a(?=中)中/", "a中\u0000", 2, 0],
  ["lookahead cannot see beyond candidate", "a中b", 3, 0, "/a(?=中)/", "a 中 b\u0000", 5, 0],
  ["lookbehind inside match", "a中", 2, 0, "/a(?<=a)中/", "a中\u0000", 2, 0],
  ["lookbehind cannot see before candidate", "a中b", 3, 0, "/(?<=a)中b/", "a 中 b\u0000", 5, 0],
  ["nongreedy alternative", "a中b", 3, 0, "/a.*?中|a中b/", "a中b\u0000", 3, 0],
  ["empty match", "a中b", 3, 0, "/(?:)/g", "a 中 b\u0000", 5, 0],
  ["optional empty match", "a中b", 3, 0, "/a?/y", "a中 b\u0000", 4, 0],
];
for (const [name, text, cursor, previous, dictionary, content, curCh, offset = 0] of fixtures) {
  test(`formatting: ${name}`, () => {
    const fixture = { text, cursor, previous, dictionary, offset };
    assert.deepEqual(format(fixture), { ...contextFor(fixture), content, curCh });
  });
}

for (const cursor of [1, 3, 5]) {
  test(`formatting: dictionary word contains seed at cursor ${cursor}`, () => {
    const fixture = {
      text: 'a中b文c', cursor, previous: 0, dictionary: 'a中b文c', marker: false,
    };
    assert.deepEqual(format(fixture), contextFor(fixture));
  });
}

test('prefix dictionary: regex alternatives and flags remain stateless', () => {
  for (const [raw, token, rejected] of [
    ['/a|a中b/', 'a中b', 'xa中b'],
    ['/b站/gi', 'B站', 'B站x'],
    ['/[1234][dD]/y', '2D', 'x2D'],
    ['/a.中/su', 'a\n中', 'a\n中x'],
  ]) {
    const dictionary = new PrefixDictionary(raw);
    for (let iteration = 0; iteration < 3; iteration++) {
      assert.equal(dictionary.isExactMatch(token), true, raw);
      assert.equal(dictionary.isExactMatch(rejected), false, raw);
    }
  }
});

function differentialCases() {
  let seed = 0x378a600;
  const random = limit => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  };
  const tokens = ['中', 'a', '文', 'B', '2', 'n8', 'b站', 'python3', '_', ' ', '**', '。', '😀'];
  const dictionaries = [
    '', 'b站, n8n, python3', 'a中b, 中文x', '/a|a中b/gi, /[1234][dD]/',
    'b站长, python3, /[a-z]中文?/iy', '/中|a中/u',
  ];
  return Array.from({ length: 64 }, () => {
    const text = Array.from({ length: 3 + random(6) }, () => tokens[random(tokens.length)]).join('');
    const positions = [0];
    for (const character of text) positions.push(positions.at(-1) + character.length);
    const cursor = random(3) === 0 ? positions[random(positions.length)] : text.length;
    const previous = [0, Math.max(0, cursor - 1), cursor][random(3)];
    const dictionary = dictionaries[random(dictionaries.length)];
    const offset = random(2) * 11;
    const marker = Boolean(random(2));
    return { text, cursor, previous, dictionary, offset, marker };
  });
}

// Fixed-seed, short-input differential oracle from b8526a6. Store its results so
// normal test runs neither need Git history nor execute the slow implementation.
const baselineResults = [
  ["中 _222 中\u0000中python3", 8],
  ["B😀中", 15],
  ["n8b站😀****B python 3", 31],
  ["python3文Ba b站中b 站", 28],
  ["。文文文2\u0000😀", 5],
  ["aB😀**中", 18],
  ["😀B **b站**", 21],
  ["文。B** a", 18],
  ["2文文。", 15],
  ["n 8 \u0000中****python3Bn8", 4],
  ["_**a中n8", 18],
  ["。文 **_**_。", 21],
  ["B中Bb站B 2", 19],
  ["b 站 a 文 n 8 n 8**", 28],
  ["n8Bpython3_B ", 24],
  ["__b站b站b站2 中", 22],
  ["python 3 b 站 n 8_", 28],
  ["😀。中**", 17],
  ["pyt\u0000hon3b站n8b站B😀", 3],
  [" 。**", 15],
  ["😀中  2 b 站 python3", 29],
  ["2n8。😀", 17],
  ["。**_22 😀文", 21],
  ["a 22**_a\u0000", 8],
  ["a__B😀", 17],
  ["。B中 。n8", 18],
  [" 中 2 中。B", 19],
  ["b站文a文😀a B", 21],
  ["_。a。", 15],
  ["2a** n\u00008文", 6],
  ["中a。\u0000**文 😀", 3],
  [" 2python3 中****", 26],
  ["b站B😀_a文", 19],
  ["中中。**文 python3", 25],
  ["a****  B", 19],
  ["n8 😀**n8B **", 24],
  ["B\u0000**😀B", 1],
  ["文\u0000。B2a", 1],
  ["中222python 3", 23],
  ["**n\u00008python3B", 3],
  ["2。n8python3_。2", 25],
  ["。。n 8 p\u0000ython3b站😀ab站", 7],
  ["中python3a😀**", 24],
  ["python3😀中**b站**", 27],
  ["😀中2😀\u0000 2中2", 6],
  ["a文 b 站**😀b 站 pytho\u0000n3", 19],
  ["😀2 ", 15],
  ["_a 😀", 16],
  ["中b站python3python3。a**a", 33],
  ["b 站。_n 8😀😀文😀", 26],
  ["文a😀a", 16],
  ["b站**中_", 17],
  ["_中中_", 15],
  ["n 82 中**😀😀n\u00008。", 13],
  ["B中 a\u0000。2", 4],
  ["a文python3", 20],
  ["😀\u0000 n8_", 2],
  ["a_B\u0000", 3],
  ["python3。中😀中Bpython 3", 32],
  ["文\u0000😀**2", 1],
  ["😀 2😀文", 18],
  [" a😀 中。", 18],
  ["python3_😀B", 22],
  ["😀python3 😀_文B文", 27],
];
test('baseline differential: 64 deterministic short inputs preserve text and cursor', () => {
  const cases = differentialCases();
  assert.equal(cases.length, baselineResults.length);
  for (let index = 0; index < cases.length; index++) {
    const [content, curCh] = baselineResults[index];
    assert.deepEqual(format(cases[index]), {
      ...contextFor(cases[index]), content, curCh,
    }, `case ${index}: ${JSON.stringify(cases[index])}`);
  }
});

// A subprocess gives a real hard deadline even when the formatter blocks the
// event loop. Measure just formatting, excluding process startup and bundling.
// The old implementation takes ~8 s for 600 alternating characters here; the
// generous 1.5 s budget leaves ample room for slower CI hosts after the fix.
const performanceProgram = `
  const { performance } = require('node:perf_hooks');
  const { applyLanguagePairSpacing, PrefixDictionary } = require(process.argv[1]);
  const size = Number(process.argv[2]);
  const dictionary = new PrefixDictionary(process.argv[3]);
  const languagePairs = ${JSON.stringify(languagePairs)};
  const run = text => applyLanguagePairSpacing({
    content: text + '\\0', curCh: text.length, prevCh: 0, offset: 0,
  }, languagePairs, dictionary);
  for (let i = 0; i < 4; i++) run('a中b文');
  const text = 'a中'.repeat(size / 2);
  const start = performance.now();
  const result = run(text);
  process.stdout.write(JSON.stringify({
    elapsedMs: performance.now() - start, content: result.content, curCh: result.curCh,
  }));
`;
for (const size of [600, 1000]) {
  for (const [name, dictionary] of [
    ['empty dictionary', ''],
    ['default dictionary', 'n8n, /[1234][dD]/\npython3, Python3'],
  ]) {
    test(`performance: ${size} alternating characters, ${name}`, () => {
      const child = spawnSync(process.execPath, ['-e', performanceProgram, bundlePath, String(size), dictionary], {
        encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL',
      });
      assert.ifError(child.error);
      assert.equal(child.status, 0, child.stderr);
      const result = JSON.parse(child.stdout);
      assert.equal(result.content, 'a中'.repeat(size / 2).split('').join(' ') + '\0');
      assert.equal(result.curCh, size * 2 - 1);
      assert.ok(result.elapsedMs < 1500, `Formatting took ${result.elapsedMs.toFixed(1)} ms; budget is 1500 ms`);
    });
  }
}
