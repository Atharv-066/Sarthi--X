// Audit regression tests (9.O audit): checks that keep the pages, the data and the Firestore rules consistent with each other.
// Pure file checks: no browser, no Firebase, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SERVICES } from '../src/data/services-index.js';
import { ISSUE_LABELS, LIMITS, LANGS_ALLOWED } from '../src/lib/report-rules.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const pages = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));

test('audit: every page has a meta description (404 excluded) and a scroll-aware header id', () => {
  for (const f of pages) {
    const s = read(f);
    if (f !== '404.html') assert.match(s, /<meta name="description" content="[^"]{30,}"/, `${f}: meta description missing or too short`);
    for (const m of s.matchAll(/<header class="site2?"([^>]*)>/g)) assert.match(m[1], /id="siteHeader"/, `${f}: <header class="site"> has no id="siteHeader" (scroll shadow would not work)`);
  }
});

test('audit: no page has a duplicate id', () => {
  for (const f of pages) {
    const ids = [...read(f).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual(dup, [], `${f}: duplicate ids ${dup}`);
  }
});

test('audit: every element login.js looks up by id exists in login.html (except ones it creates itself)', () => {
  const html = read('login.html');
  const have = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const created = new Set(['swap']); // login.js writes this link into #alt on every tab switch
  const used = new Set([...read('src/login.js').matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]));
  for (const id of ['finderQ', 'finderClear', 'finderRes']) used.add(id); // finder.js
  const missing = [...used].filter((id) => !have.has(id) && !created.has(id));
  assert.deepEqual(missing, [], 'ids missing from login.html: ' + missing);
});

test('audit: guide ids are unique and safe for the report rule (a-z, 0-9, hyphen)', () => {
  const ids = SERVICES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate guide id');
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, `guide id "${id}" would be rejected by firestore.rules`);
});

test('audit: firestore.rules and src/lib/report-rules.js describe the same report', () => {
  const rules = read('firestore.rules');
  for (const label of ISSUE_LABELS) assert.ok(rules.includes(`'${label}'`), `rules do not allow issue type "${label}"`);
  const inRules = [...rules.match(/d\.issueType in \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(inRules.sort(), [...ISSUE_LABELS].sort(), 'issue types differ');
  for (const [name, re] of [
    ['guideIdMax', /d\.guideId\.size\(\) <= (\d+)/], ['titleMax', /d\.guideTitle\.size\(\) <= (\d+)/], ['descMin', /d\.description\.size\(\) >= (\d+)/],
    ['descMax', /d\.description\.size\(\) <= (\d+)/], ['contactMax', /d\.contact\.size\(\) <= (\d+)/], ['urlMax', /d\.pageUrl\.size\(\) <= (\d+)/],
  ]) assert.equal(Number(rules.match(re)[1]), LIMITS[name], `${name} differs between firestore.rules and report-rules.js`);
  assert.deepEqual([...rules.match(/d\.language in \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]), LANGS_ALLOWED);
});

test('audit: the users profile rule demands a verified email for email + password sign-in', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /match \/users\/\{uid\}[\s\S]*?emailOk\(\)/);
  assert.match(rules, /sign_in_provider != 'password' \|\| request\.auth\.token\.email_verified == true/);
});

test('audit: the user menu keeps the visitor name and email away from the translation service', () => {
  const s = read('src/auth.js');
  assert.ok((s.match(/data-no-translate/g) || []).length >= 2, 'name button and name/email block must carry data-no-translate');
});
