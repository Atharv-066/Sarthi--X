// 10.0: Linguistic Minority data, the tagline fix and the translation tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LINGUISTIC, LANGUAGES, LING_COMMON, LING_TRIBAL, LING_DICT } from '../src/data/linguistic.js';
import { DICT } from '../src/translations.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const names = (secs) => secs.flatMap((s) => s.items.map((i) => i.t));

test('linguistic: 17 languages from the Word file, 31 common schemes, 16 more for the five tribal languages', () => {
  assert.equal(LANGUAGES.length, 17);
  assert.equal(names(LING_COMMON).length, 31);
  assert.equal(names(LING_TRIBAL).length, 16);
  const tribal = LANGUAGES.filter((l) => l.tribal).map((l) => l.name);
  assert.deepEqual(tribal, ['Bhili / Bhilori', 'Gondi', 'Korku', 'Kolami', 'Warli']);
  for (const l of LINGUISTIC) {
    const n = names(l.sections).length;
    assert.equal(n, tribal.includes(l.name) ? 47 : 31, `${l.name} lists ${n} schemes`);
  }
});

test('linguistic: no scheme name is repeated and every name has Marathi and Hindi text', () => {
  const all = [...names(LING_COMMON), ...names(LING_TRIBAL)];
  assert.equal(new Set(all).size, all.length);
  for (const lang of ['mr', 'hi']) for (const n of all) assert.ok(LING_DICT[lang][n] || DICT[lang][n], `${lang}: ${n}`);
});

test('linguistic: the page keeps the religious view (same file, same components, no copied page)', () => {
  const js = read('src/minority.js');
  assert.match(js, /from '\.\/data\/minority\.js'/);
  assert.match(js, /from '\.\/data\/linguistic\.js'/);
  assert.equal(readdirSync(new URL('../', import.meta.url)).filter((f) => /linguistic/i.test(f)).length, 0);
});

test('translations: Marathi and Hindi have the same keys', () => {
  const a = Object.keys(DICT.mr), b = new Set(Object.keys(DICT.hi));
  assert.deepEqual(a.filter((k) => !b.has(k)), []);
  assert.equal(a.length, b.size);
});

test('translations: the tagline is a real sentence in both languages (not the old word-by-word text)', () => {
  const key = 'Your Document Friend in the Government Maze';
  assert.equal(DICT.mr[key], 'सरकारी कागदपत्रांच्या गुंतागुंतीत तुमचा विश्वासू साथीदार');
  assert.equal(DICT.hi[key], 'सरकारी दस्तावेज़ों की उलझन में आपका भरोसेमंद साथी');
  for (const bad of ['चक्रव्यूह', 'भूलभुलैया', 'मध्य सरकारी', 'मैं सरकारी']) for (const l of ['mr', 'hi']) assert.ok(!Object.values(DICT[l]).some((v) => v.includes(bad)), bad);
});

// Same rule as src/i18n.js (unitKey): opening tags lose their attributes, spaces are collapsed.
const unitKey = (html) => html.replace(/<([a-z0-9]+)(\s[^>]*)?>/gi, '<$1>').replace(/\s+/g, ' ').trim();
test('translations: every data-tr-unit element in the pages has a Marathi and a Hindi entry with the same tags', () => {
  const tags = (h) => (h.match(/<[a-z0-9]+>/gi) || []).join('');
  let seen = 0;
  for (const f of readdirSync(new URL('../', import.meta.url)).filter((x) => x.endsWith('.html'))) {
    for (const m of read(f).matchAll(/<(h1|p|div)\b[^>]*data-tr-unit[^>]*>([\s\S]*?)<\/\1>/g)) {
      const key = unitKey(m[2]); seen++;
      for (const l of ['mr', 'hi']) {
        assert.ok(DICT[l][key], `${f} (${l}): no entry for ${key.slice(0, 60)}`);
        assert.equal(tags(DICT[l][key]), tags(key), `${f} (${l}): tags differ in ${key.slice(0, 40)}`);
      }
    }
  }
  assert.ok(seen >= 5, 'expected at least 5 sentence units, found ' + seen);
});

test('translations: a {placeholder} used in a translation exists in its English key', () => {
  for (const lang of ['mr', 'hi']) for (const [k, v] of Object.entries(DICT[lang])) {
    const want = new Set(k.match(/\{\w+\}/g) || []);
    for (const ph of v.match(/\{\w+\}/g) || []) assert.ok(want.has(ph), `${lang}: ${ph} in "${v.slice(0, 50)}" is not in its key`);
  }
});
