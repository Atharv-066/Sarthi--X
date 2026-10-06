// 9.O Star version tests: stars, step progress, expiry, translations and wiring.
// Pure file / logic checks (no browser, no Firebase, no network), like the other tests in this folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SERVICES } from '../src/data/services-index.js';
import { SERVICES as FULL } from '../src/data/services.js';
import { SCHEMES } from '../src/data/schemes.js';
import { STAR_DICT } from '../src/data/star-translations.js';
import { DICT } from '../src/translations.js';
import { cleanId, cleanStep, stepKey, readUserData, applyOp, progress, toIso, expiryStatus, groupExpiry, EMPTY, SOON_DAYS } from '../src/lib/user-rules.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const D = (y, m, d) => new Date(y, m - 1, d, 15, 30); // a time of day in the afternoon, to prove only the DAY counts

/* ---------- ids ---------- */
test('every real scheme number and document id is accepted as a star id', () => {
  for (const s of SCHEMES) assert.equal(cleanId('scheme', s.no), String(s.no), `scheme #${s.no}`);
  for (const d of SERVICES) assert.equal(cleanId('doc', d.id), d.id, `document ${d.id}`);
});
test('bad ids are rejected, never thrown on', () => {
  for (const bad of ['', null, undefined, '0', '-1', '1.5', 'abc', '12345', '../x', 'a b']) assert.equal(cleanId('scheme', bad), '', String(bad));
  for (const bad of ['', null, undefined, 'Has Caps', 'a/b', 'x'.repeat(101), 'a.b']) assert.equal(cleanId('doc', bad), '', String(bad));
  assert.equal(cleanId('nothing', 'income-certificate'), '');
  assert.equal(cleanStep('b12'), 'b12'); assert.equal(cleanStep('12'), ''); assert.equal(cleanStep('b'), '');
  assert.equal(stepKey('b', 0), 'b1');
});

/* ---------- reading saved data ---------- */
test('readUserData: missing / broken data gives an empty, usable object', () => {
  for (const raw of [undefined, null, 'x', 5, [], {}]) assert.deepEqual(readUserData(raw), { schemes: [], docs: [], steps: {}, expiry: {} });
});
test('readUserData: keeps good entries, drops bad ones, removes duplicates', () => {
  const d = readUserData({
    starredSchemes: ['12', '12', 'x', 40, null], starredDocs: ['income-certificate', 'BAD ID', 'income-certificate'],
    steps: { 'income-certificate': ['a1', 'a1', 'zz', 7], 'bad id': ['a1'], 'aadhaar-card': [] },
    docExpiry: { 'aadhaar-card': '2027-03-31', 'income-certificate': 'not a date', 'bad id': '2027-03-31' },
  });
  assert.deepEqual(d.schemes, ['12', '40']);
  assert.deepEqual(d.docs, ['income-certificate']);
  assert.deepEqual(d.steps, { 'income-certificate': ['a1'] });
  assert.deepEqual(d.expiry, { 'aadhaar-card': '2027-03-31' });
});

/* ---------- star changes ---------- */
test('star: starring twice keeps one copy; unstar removes only that item', () => {
  let d = EMPTY;
  d = applyOp(d, { type: 'star', kind: 'scheme', id: '5', on: true });
  d = applyOp(d, { type: 'star', kind: 'scheme', id: '5', on: true });
  d = applyOp(d, { type: 'star', kind: 'scheme', id: '9', on: true });
  d = applyOp(d, { type: 'star', kind: 'doc', id: 'income-certificate', on: true });
  assert.deepEqual(d.schemes, ['5', '9']);
  d = applyOp(d, { type: 'star', kind: 'scheme', id: '5', on: false });
  d = applyOp(d, { type: 'star', kind: 'scheme', id: '5', on: false }); // unstarring something not starred is harmless
  assert.deepEqual(d.schemes, ['9']);
  assert.deepEqual(d.docs, ['income-certificate'], 'document stars are untouched');
});
test('star: rapid click sequence ends in the state of the last click, and the input is never mutated', () => {
  const start = { schemes: ['1'], docs: [], steps: {}, expiry: {} };
  const snapshot = JSON.stringify(start);
  let d = start;
  for (const on of [true, false, true, false, true, false]) d = applyOp(d, { type: 'star', kind: 'scheme', id: '1', on });
  assert.deepEqual(d.schemes, []);
  assert.equal(JSON.stringify(start), snapshot);
});
test('star: an invalid id changes nothing', () => {
  const d = applyOp({ schemes: ['1'], docs: [], steps: {}, expiry: {} }, { type: 'star', kind: 'scheme', id: '<script>', on: true });
  assert.deepEqual(d.schemes, ['1']);
});
test('users are separate: one user\'s data object never leaks into another', () => {
  const a = applyOp(EMPTY, { type: 'star', kind: 'doc', id: 'caste-certificate', on: true });
  const b = applyOp(EMPTY, { type: 'star', kind: 'scheme', id: '2', on: true });
  assert.deepEqual(a.schemes, []); assert.deepEqual(b.docs, []);
  assert.deepEqual(EMPTY, { schemes: [], docs: [], steps: {}, expiry: {} }, 'the shared EMPTY value is never changed');
});

/* ---------- steps + progress ---------- */
test('steps: tick, untick, and the guide entry disappears when its last step is unticked', () => {
  let d = applyOp(EMPTY, { type: 'step', id: 'income-certificate', key: 'a1', on: true });
  d = applyOp(d, { type: 'step', id: 'income-certificate', key: 'b2', on: true });
  d = applyOp(d, { type: 'step', id: 'income-certificate', key: 'a1', on: true });
  assert.deepEqual([...d.steps['income-certificate']].sort(), ['a1', 'b2']);
  d = applyOp(d, { type: 'step', id: 'income-certificate', key: 'a1', on: false });
  d = applyOp(d, { type: 'step', id: 'income-certificate', key: 'b2', on: false });
  assert.deepEqual(d.steps, {});
});
test('steps: progress on one document never touches another', () => {
  let d = applyOp(EMPTY, { type: 'step', id: 'aadhaar-card', key: 'h1', on: true });
  d = applyOp(d, { type: 'step', id: 'caste-certificate', key: 'h1', on: true });
  d = applyOp(d, { type: 'step', id: 'aadhaar-card', key: 'h1', on: false });
  assert.deepEqual(d.steps, { 'caste-certificate': ['h1'] });
});
test('progress: counts, percentage, only steps that are on screen, zero and one step', () => {
  assert.deepEqual(progress(['a1', 'a2', 'b1', 'b2', 'b3'], ['a1', 'a2', 'b1']), { done: 3, total: 5, pct: 60 });
  assert.deepEqual(progress(['a1', 'a2'], ['a1', 'a2', 'c1', 'c2']), { done: 2, total: 2, pct: 100 }, 'ticks on the hidden route do not count');
  assert.deepEqual(progress([], ['a1']), { done: 0, total: 0, pct: 0 });
  assert.deepEqual(progress(['h1'], []), { done: 0, total: 1, pct: 0 });
  assert.deepEqual(progress(['h1'], ['h1']), { done: 1, total: 1, pct: 100 });
  assert.equal(progress(['a1', 'a2', 'a3'], ['a1']).pct, 33);
});
test('every guide fits the step key format (at most 999 steps per list)', () => {
  for (const s of FULL) for (const k of ['a', 'b', 'c']) assert.ok(s[k].length < 1000 && cleanStep(stepKey(k, s[k].length - 1) || 'a1') !== undefined, s.id);
});

/* ---------- expiry ---------- */
test('toIso: real dates only, between 1990 and 2100', () => {
  assert.equal(toIso('2027-03-31'), '2027-03-31');
  assert.equal(toIso('15 September 2026'), '2026-09-15');
  for (const bad of ['', 'abc', '2026-02-30', '2026-13-01', '1989-12-31', '2101-01-01', null, undefined]) assert.equal(toIso(bad), '', String(bad));
});
test('expiryStatus: valid THROUGH the expiry day, expired from the next day', () => {
  const now = D(2026, 10, 4);
  assert.equal(expiryStatus('2026-10-03', now).state, 'expired');
  assert.equal(expiryStatus('2026-10-03', now).days, -1);
  assert.equal(expiryStatus('2026-10-04', now).state, 'soon', 'expires today: still valid today');
  assert.equal(expiryStatus('2026-10-04', now).days, 0);
  assert.equal(expiryStatus(`2026-11-0${3}`, now).state, 'soon');   // 30 days away
  assert.equal(expiryStatus('2026-11-04', now).state, 'valid');     // 31 days away
  assert.equal(expiryStatus('2030-01-01', now).state, 'valid');
  assert.equal(expiryStatus('garbage', now).state, 'invalid');
  assert.equal(SOON_DAYS, 30);
});
test('groupExpiry: valid documents are never listed as expired; lists are ordered', () => {
  const now = D(2026, 10, 4);
  const g = groupExpiry({ a: '2026-01-01', b: '2026-10-03', c: '2026-10-20', d: '2028-01-01', e: 'bad' }, now);
  assert.deepEqual(g.expired.map((r) => r.id), ['b', 'a'], 'most recently expired first');
  assert.deepEqual(g.active.map((r) => r.id), ['c', 'd'], 'soonest first');
  assert.deepEqual(groupExpiry({}, now), { expired: [], active: [] });
  assert.deepEqual(groupExpiry(undefined, now), { expired: [], active: [] });
});
test('expiry: saved by day, cleared with an empty date', () => {
  let d = applyOp(EMPTY, { type: 'expiry', id: 'aadhaar-card', iso: '2027-03-31' });
  assert.deepEqual(d.expiry, { 'aadhaar-card': '2027-03-31' });
  d = applyOp(d, { type: 'expiry', id: 'aadhaar-card', iso: 'nonsense' }); // not a date: treated as "clear", never stored
  assert.deepEqual(d.expiry, {});
});

/* ---------- translations ---------- */
test('Marathi and Hindi have exactly the same new keys and none is empty', () => {
  assert.deepEqual(Object.keys(STAR_DICT.mr).sort(), Object.keys(STAR_DICT.hi).sort());
  for (const l of ['mr', 'hi']) for (const [k, v] of Object.entries(STAR_DICT[l])) assert.ok(v.trim() && v !== k, `${l}: "${k}" has no real translation`);
});
test('every new key is really used in the code (no typo, no stale key) and reaches the dictionary the pages use', () => {
  const src = ['src/profile.js', 'src/doc-extras.js', 'src/star-ui.js', 'src/userdata.js', 'src/schemes.js', 'src/auth.js', 'profile.html']
    .map(read).join('\n').replace(/\\(['"])/g, '$1');
  for (const k of Object.keys(STAR_DICT.mr)) {
    assert.ok(src.includes(k), `"${k}" is in the dictionary but not in the code`);
    for (const l of ['mr', 'hi']) assert.ok(k in DICT[l], `"${k}" did not reach DICT.${l}`);
  }
});
test('merging the new words never replaced an existing translation', () => {
  const t = read('src/translations.js');
  assert.match(t, /hasOwnProperty\.call\(DICT\[lang\], k\)/);
  assert.equal(DICT.mr['Browse schemes'], 'योजना पहा'); // an existing entry that the new list does not touch
});

/* ---------- wiring ---------- */
test('storage uses the existing user document, arrayUnion / arrayRemove, and only the signed-in uid', () => {
  const s = read('src/userdata.js');
  assert.match(s, /doc\(db, 'users', user\.uid\)/);
  assert.match(s, /arrayUnion/); assert.match(s, /arrayRemove/);
  assert.doesNotMatch(s, /collection\(/, 'no second collection / database');
  assert.match(s, /CACHE_PREFIX \+ state\.user\.uid/, 'the local copy is keyed by uid');
  assert.match(read('src/auth.js'), /startsWith\('sx_ud_'\)/, 'logout removes the local copy');
});
test('the Firestore rules already let a user touch only their own document (where stars and progress live)', () => {
  const r = read('firestore.rules');
  assert.match(r, /match \/users\/\{uid\}[\s\S]*?request\.auth\.uid == uid/);
});
test('all five hand-written document pages get the extras (each is a guide with steps)', () => {
  for (const d of SERVICES.filter((x) => x.href)) {
    const html = read(d.href);
    assert.match(html, /src="\/src\/docpage\.js"/, d.href);
    assert.ok((html.match(/class="[^"]*\bstep-card\b[^"]*"/g) || []).length >= 1, `${d.href} has no step cards`);
  }
  assert.ok(SERVICES.filter((x) => x.href).length >= 5);
  assert.match(read('src/docpage.js'), /mountDocExtras\(\)/);
  assert.match(read('src/guide.js'), /mountDocExtras\(\)/);
});
test('the login page card is unchanged: no star there (nobody is signed in)', () => {
  assert.doesNotMatch(read('src/finder.js'), /sx-star|star-ui|starButton/);
  assert.match(read('src/dashboard.js'), /star: starButtonHTML\('doc', d\.id\)/);
});
test('profile page: protected (no data-public), has all sections, and is reachable from the user menu', () => {
  const h = read('profile.html');
  assert.doesNotMatch(h, /<body[^>]*data-public/);
  for (const id of ['pfSchemes', 'pfDocs', 'pfExpired', 'pfActive', 'pfState']) assert.ok(h.includes(`id="${id}"`), id);
  assert.match(read('src/auth.js'), /PROFILE_PAGE = 'profile\.html'/);
});
test('Profile "View details" for a scheme opens an existing page that can show it', () => {
  assert.match(read('src/profile.js'), /schemes\.html\?scheme=\$\{s\.no\}/);
  assert.match(read('src/schemes.js'), /params\.get\('scheme'\)/);
});
