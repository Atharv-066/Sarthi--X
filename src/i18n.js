// Language switcher + whole-page translator (English / मराठी / हिंदी).
// Order of lookup for every piece of text: built-in dictionary -> saved cache -> live translation (src/translator.js, no API key).
//
// HOW IT WORKS
//  * Every visible text node and every placeholder / title / aria-label / alt attribute on the page is translated,
//    and so is the browser tab title.
//  * A MutationObserver re-runs the translation whenever the page changes, so text that JavaScript renders later
//    (scheme cards, guide steps, filters, search results, error / success messages) is translated too.
//  * Translations are cached in IndexedDB, so each sentence is fetched only once per browser.
//  * If translation fails the original English stays on screen and the page keeps working.
//
// SENTENCES BROKEN BY MARKUP (10.0): the page walker translates one text node at a time, so a sentence split by <br>, <span>, <b> or
// <a> reaches the translator in pieces and comes back as nonsense ("Your Document Friend / in the / Government Maze"). Mark such an
// element data-tr-unit and give its whole content ONE entry in src/translations.js: the key is the element's HTML with every
// attribute removed (<span class="blue"> -> <span>), the value is the translated HTML with the same tags in the same order.
// Without an entry the element is translated piece by piece as before.
//
// SENTENCES WITH A NUMBER OR NAME INSIDE (10.0): a DICT key may contain {placeholders}, e.g. '{n} schemes in {m} groups'.
// It matches any text of that shape, translates the words around the placeholders and keeps (or localises) what the placeholders caught.
//
// TO ADD ANOTHER LANGUAGE: add one line to LANGS below (use the standard language code, e.g. { code: 'gu', label: 'ગુજરાતી' }).
// The engine translates everything automatically; src/translations.js only holds optional hand-written overrides.
import { DICT } from './translations.js';
import { translateTexts } from './translator.js';
import { verifiedMap } from './localize.js';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
];
const KEY = 'sx_lang';
const CHUNK = 60; // strings handed to the engine per call (the engine batches them further)

let lang = 'en';
try { lang = localStorage.getItem(KEY) || 'en'; } catch {}
if (!LANGS.some((l) => l.code === lang)) lang = 'en';

export const getLang = () => lang;

/* ---------- notices (shown in the chosen language, no translation call needed) ---------- */
const MSG = {
  offline: {
    en: 'Translation is not reachable right now, so some text is shown in English. Check your internet connection; we will retry automatically.',
    mr: 'भाषांतर सेवा सध्या उपलब्ध नाही, म्हणून काही मजकूर इंग्रजीत दाखवला आहे. इंटरनेट तपासा; आम्ही आपोआप पुन्हा प्रयत्न करू.',
    hi: 'अनुवाद सेवा अभी उपलब्ध नहीं है, इसलिए कुछ पाठ अंग्रेज़ी में दिखाया गया है। इंटरनेट जाँचें; हम अपने-आप फिर प्रयास करेंगे।',
  },
};
const say = (k) => MSG[k][lang] || MSG[k].en;

/* ---------- small toast ---------- */
let toastTimer;
function showToast(msg) {
  let el = document.querySelector('.sx-toast');
  if (!el) { el = document.createElement('div'); el.className = 'sx-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 6000);
}
/** Show a short message. Messages written in English are shown in the current language. */
export async function toast(msg) {
  let text = msg;
  if (lang !== 'en') {
    const own = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
    text = own(DICT[lang] || {}, msg) ?? own(cacheFor(lang), msg) ?? msg;
    if (text === msg) { try { text = (await tr([msg]))[0]; } catch {} }
  }
  showToast(text);
}

/* ---------- cache: memory + IndexedDB (falls back to memory only) ---------- */
const DB_NAME = 'sx_translations';
const STORE = 'tr';
const LEGACY_PREFIX = 'sx_tr_'; // old localStorage cache: imported once, then removed
const caches = {};
const loading = {};
let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const rq = indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => resolve(null);
        rq.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return dbPromise;
}

function cacheFor(l) {
  return (caches[l] ||= {});
}

/** Load the saved translations of language `l` into memory (once). */
function warm(l) {
  if (l === 'en') return Promise.resolve();
  return (loading[l] ||= (async () => {
    const mem = cacheFor(l);
    const db = await openDb();
    if (db) {
      await new Promise((resolve) => {
        try {
          const rq = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor(IDBKeyRange.bound(l + '|', l + '|\uffff'));
          rq.onsuccess = () => {
            const cur = rq.result;
            if (!cur) return resolve();
            mem[cur.key.slice(l.length + 1)] = cur.value;
            cur.continue();
          };
          rq.onerror = () => resolve();
        } catch { resolve(); }
      });
    }
    try {
      const old = JSON.parse(localStorage.getItem(LEGACY_PREFIX + l));
      if (old && typeof old === 'object') {
        const fresh = {};
        for (const [k, v] of Object.entries(old)) if (typeof v === 'string' && !(k in mem)) { mem[k] = v; fresh[k] = v; }
        persist(l, fresh);
      }
      localStorage.removeItem(LEGACY_PREFIX + l);
    } catch {}
  })());
}

let writeQueue = {};
let writeTimer;
function persist(l, entries) {
  if (!Object.keys(entries).length) return;
  writeQueue[l] = Object.assign(writeQueue[l] || {}, entries);
  clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    const q = writeQueue;
    writeQueue = {};
    const db = await openDb();
    if (!db) return;
    try {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      for (const [lg, map] of Object.entries(q)) for (const [k, v] of Object.entries(map)) store.put(v, lg + '|' + k);
    } catch {}
  }, 300);
}

/* ---------- text helpers ---------- */
const EDGE = '[\\s\\p{Extended_Pictographic}\\uFE0F\\u200D\\u2713\\u2605\\u2192\\u2190\\u2022\\u2304\\u2193]';
const PRE = new RegExp('^' + EDGE + '*', 'u');
const SUF = new RegExp(EDGE + '*$', 'u');
const HAS_LETTER = /\p{L}/u;

function split(s) {
  const pre = s.match(PRE)[0];
  const rest = s.slice(pre.length);
  const suf = rest.match(SUF)[0];
  const core = rest.slice(0, rest.length - suf.length).replace(/\s+/g, ' ');
  return { pre, core, suf };
}

/* ---------- sentence patterns: DICT keys with {placeholders} (10.0) ---------- */
// Placeholder names: n, a, b, m = a number (digits, dots, commas, dashes);  x = a NAME the dictionary knows (otherwise the whole
// sentence is left to the live translator, so an unknown word is never glued into a Marathi / Hindi sentence);  anything else
// (q, y, ...) = free text that is kept as it is.
const NUMERIC = new Set(['n', 'a', 'b', 'm']);
const patCache = {};
function patternsFor(l) {
  return (patCache[l] ||= Object.keys(DICT[l] || {}).filter((k) => /\{\w+\}/.test(k)).map((k) => {
    const names = [];
    const src = '^' + k.split(/(\{\w+\})/).map((part) => {
      const m = part.match(/^\{(\w+)\}$/);
      if (m) { names.push(m[1]); return NUMERIC.has(m[1]) ? '([\\d.,\u2013-]+)' : '(.+?)'; }
      return part.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    }).join('') + '$';
    return { k, names, re: new RegExp(src, 's'), weight: k.replace(/\{\w+\}/g, '').length };
  }).sort((a, b) => b.weight - a.weight));
}
const DEVANAGARI_DIGITS = '\u0966\u0967\u0968\u0969\u096a\u096b\u096c\u096d\u096e\u096f';
const PIECES = /( \u00b7 | \u2022 |, )/;
// Translate a name such as \"Muslim\" or \"Hindi \u00b7 Urdu\"; null when any piece is unknown.
function nameIn(l, v) {
  const dict = DICT[l] || {};
  if (Object.prototype.hasOwnProperty.call(dict, v)) return dict[v];
  const parts = v.split(PIECES);
  if (parts.length < 3) return null;
  const out = parts.map((p, i) => (i % 2 ? p : Object.prototype.hasOwnProperty.call(dict, p) ? dict[p] : null));
  return out.includes(null) ? null : out.join('');
}
// What a placeholder caught: digits are localised (Marathi uses Devanagari digits), known names are translated, free text is kept.
function caught(l, v, strict) {
  if (/^[\d.,\u2013-]+$/.test(v)) return l === 'mr' ? v.replace(/\d/g, (d) => DEVANAGARI_DIGITS[d]) : v;
  const n = nameIn(l, v);
  if (n !== null) return n;
  return strict ? null : v.split(PIECES).map((p, i) => (i % 2 ? p : (nameIn(l, p) ?? p))).join('');
}
function fromPattern(l, text) {
  for (const p of patternsFor(l)) {
    const m = text.match(p.re);
    if (!m) continue;
    let ok = true;
    const out = DICT[l][p.k].replace(/\{(\w+)\}/g, (all, name) => {
      const i = p.names.indexOf(name);
      if (i < 0) return all;
      const v = caught(l, m[i + 1], name === 'x');
      if (v === null) ok = false;
      return v ?? '';
    });
    if (ok) return out;
  }
  // A list joined with \" \u00b7 \" whose every piece is a known label (the level tags \"UG \u00b7 PG\").
  const listed = nameIn(l, text);
  return listed !== null && !Object.prototype.hasOwnProperty.call(DICT[l] || {}, text) ? listed : null;
}

/* ---------- units: one sentence split by markup (10.0) ---------- */
const UNIT = '[data-tr-unit]';
const unitTracked = new Map(); // element -> { en: original innerHTML, out: translated innerHTML }
const activeUnits = new Set(); // elements whose whole content has a dictionary entry (their text nodes are skipped)
const tagsOf = (html) => [...html.matchAll(/<([a-z0-9]+)(\s[^>]*)?>/gi)].map((m) => ({ name: m[1].toLowerCase(), open: m[0] }));
const unitKey = (html) => html.replace(/<([a-z0-9]+)(\s[^>]*)?>/gi, '<$1>').replace(/\s+/g, ' ').trim();
function unitHtml(l, en) {
  const val = (DICT[l] || {})[unitKey(en)];
  if (typeof val !== 'string') return null;
  const queues = {};
  for (const t of tagsOf(en)) (queues[t.name] ||= []).push(t.open); // the original opening tags (with class / href) in order
  return val.replace(/<([a-z0-9]+)>/gi, (all, name) => (queues[name.toLowerCase()]?.shift() ?? all));
}
function applyUnits() {
  activeUnits.clear();
  document.querySelectorAll(UNIT).forEach((el) => {
    if (el.closest(NO_TR)) return;
    const rec = unitTracked.get(el);
    const en = rec && el.innerHTML === rec.out ? rec.en : el.innerHTML;
    const out = unitHtml(lang, en);
    if (out === null) { if (rec) unitTracked.delete(el); return; }
    activeUnits.add(el);
    if (el.innerHTML !== out) { el.innerHTML = out; unitTracked.set(el, { en, out }); }
    else if (!rec) unitTracked.set(el, { en, out });
  });
}
function revertUnits() {
  for (const [el, rec] of unitTracked) if (el.isConnected && el.innerHTML === rec.out) el.innerHTML = rec.en;
  unitTracked.clear();
  activeUnits.clear();
}

/* ---------- translation engine ---------- */
let failedAt = 0;
let retryTimer;
const pending = new Map(); // "lang|text" -> Promise<void> (so two passes never request the same sentence twice)

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (lang !== 'en') { failedAt = 0; pass(); } }, 21000);
}

async function fetchChunk(l, texts) {
  const result = await translateTexts(texts, l);
  const failed = result.failedTexts || new Set();
  const c = cacheFor(l);
  const saved = {};
  texts.forEach((t, i) => {
    if (failed.has(t) || typeof result[i] !== 'string' || !result[i].trim()) return;
    c[t] = result[i];   // identical results (names, "OTP") are cached too, so they are not requested again
    saved[t] = result[i];
  });
  persist(l, saved);
  if (failed.size) { failedAt = Date.now(); scheduleRetry(); showToast(say('offline')); }
}

/**
 * Translate English strings into the current language (or `forLang`).
 * Returns a same-length array. A string that cannot be translated is returned in English, never an error.
 */
export async function tr(list, forLang = lang) {
  if (forLang === 'en') return list.slice();
  await warm(forLang);
  const dict = DICT[forLang] || {};
  const own = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
  // Order: VERIFIED guide translations (src/data/guide-translations.js, reviewed by a person) -> hand-written DICT
  // -> saved cache -> live translation. A verified string is never sent to the live service.
  const verified = await verifiedMap(forLang);
  const known = (k) => (verified.has(k) ? verified.get(k) : own(dict, k) ?? fromPattern(forLang, k));
  const cache = cacheFor(forLang);
  const need = [...new Set(list.filter((s) => known(s) === null && own(cache, s) === null && HAS_LETTER.test(s)))];

  if (need.length) {
    const waits = [];
    const fresh = [];
    for (const t of need) {
      const p = pending.get(forLang + '|' + t);
      if (p) waits.push(p); else fresh.push(t);
    }
    if (fresh.length && Date.now() - failedAt > 20000) {
      for (let i = 0; i < fresh.length; i += CHUNK) {
        const part = fresh.slice(i, i + CHUNK);
        const p = fetchChunk(forLang, part).catch((e) => {
          failedAt = Date.now();
          scheduleRetry();
          console.warn('[Sarthi - X] translation failed:', e);
          showToast(say('offline'));
        }).finally(() => part.forEach((t) => pending.delete(forLang + '|' + t)));
        part.forEach((t) => pending.set(forLang + '|' + t, p));
        waits.push(p);
      }
    }
    await Promise.all(waits);
  }
  const c2 = cacheFor(forLang);
  return list.map((s) => known(s) ?? own(c2, s) ?? s);
}

/** Convenience: translate one string. */
export const trOne = async (text, forLang = lang) => (await tr([text], forLang))[0];

/* ---------- page translation ---------- */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
const NO_TR = '[data-no-translate], .word, .brand, .lang, .lang-btn, .sx-lang-dd, .sx-toast';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

const tracked = new Map();     // Text node -> { en, out }
const attrTracked = new Map(); // Element -> { attr: { en, out } }
let titleRec = null;           // { en, out } for document.title
const BRAND_SUFFIX = /\s[\u2014-]\s*Sarthi - X$/; // "Guide \u2014 Sarthi - X": only the first part is translated
let seq = 0;
let observer;

function fixOptionValues() {
  // <option>Admission</option> has no value attribute, so its value IS its text.
  // Freeze the English value first so translating the label never changes saved answers.
  document.querySelectorAll('option:not([value])').forEach((o) => o.setAttribute('value', o.textContent.trim()));
}

function textNodes() {
  const list = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || SKIP_TAGS.has(p.tagName) || p.closest(NO_TR)) continue;
    if (activeUnits.size) { const u = p.closest(UNIT); if (u && activeUnits.has(u)) continue; }
    if (!HAS_LETTER.test(n.nodeValue)) continue;
    list.push(n);
  }
  return list;
}

function attrTargets() {
  const list = [];
  document.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach((el) => {
    if (el.closest(NO_TR)) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const rec = attrTracked.get(el)?.[a];
      const cur = el.getAttribute(a);
      const en = rec && cur === rec.out ? rec.en : cur;
      if (HAS_LETTER.test(en)) list.push({ el, a, en });
    }
  });
  return list;
}

function revert() {
  revertUnits();
  for (const [node, t] of tracked) if (node.isConnected && node.nodeValue === t.out) node.nodeValue = t.en;
  tracked.clear();
  for (const [el, rec] of attrTracked) for (const [a, t] of Object.entries(rec)) if (el.isConnected && el.getAttribute(a) === t.out) el.setAttribute(a, t.en);
  attrTracked.clear();
  if (titleRec && document.title === titleRec.out) document.title = titleRec.en;
  titleRec = null;
}

function titleTarget() {
  const cur = document.title;
  if (!cur) return null;
  const en = titleRec && cur === titleRec.out ? titleRec.en : cur;
  const m = en.match(BRAND_SUFFIX);
  const core = (m ? en.slice(0, m.index) : en).trim();
  if (!core || !HAS_LETTER.test(core)) return null;
  return { en, core, suffix: m ? m[0] : '' };
}

// Text that is on screen (or close to it) is translated first, so the page looks translated quickly;
// the rest of the page follows straight after in the background.
function isNear(el) {
  if (!el) return true;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return false;
  return r.bottom >= -300 && r.top <= window.innerHeight + 700;
}

async function applyGroup(items, titleItem, my) {
  const cores = [...new Set([...items.map((x) => x.core), ...(titleItem ? [titleItem.core] : [])])];
  if (!cores.length) return true;
  const done = await tr(cores, lang);
  if (my !== seq) return false; // a newer pass (or a language change) took over
  const map = new Map(cores.map((c, i) => [c, done[i]]));

  observer?.disconnect();
  for (const x of items) {
    const out = x.pre + map.get(x.core) + x.suf;
    if (x.kind === 'n') {
      if (!x.n.isConnected || out === x.n.nodeValue) continue;
      x.n.nodeValue = out;
      tracked.set(x.n, { en: x.en, out });
    } else {
      if (!x.el.isConnected) continue;
      x.el.setAttribute(x.a, out);
      const rec = attrTracked.get(x.el) || {};
      rec[x.a] = { en: x.en, out };
      attrTracked.set(x.el, rec);
    }
  }
  if (titleItem) {
    const out = map.get(titleItem.core) + titleItem.suffix;
    document.title = out;
    titleRec = { en: titleItem.en, out };
  }
  for (const n of tracked.keys()) if (!n.isConnected) tracked.delete(n);
  observe();
  return true;
}

async function pass() {
  const my = ++seq;
  fixOptionValues();
  if (lang === 'en') { observer?.disconnect(); revert(); observe(); return; }
  observer?.disconnect(); applyUnits(); observe(); // whole-sentence elements first, so their pieces are never sent on their own

  const nodes = textNodes().map((n) => {
    const t = tracked.get(n);
    const en = t && n.nodeValue === t.out ? t.en : n.nodeValue;
    return { kind: 'n', n, en, t, ...split(en) };
  }).filter((x) => x.core && HAS_LETTER.test(x.core) && !(x.t && x.n.nodeValue === x.t.out));
  const attrs = attrTargets().map((x) => ({ kind: 'a', ...x, ...split(x.en) })).filter((x) => x.core);
  const titleItem = titleTarget();

  const all = [...nodes, ...attrs];
  if (!all.length && !titleItem) return;
  const near = [];
  const far = [];
  for (const x of all) (isNear(x.kind === 'n' ? x.n.parentElement : x.el) ? near : far).push(x);

  document.documentElement.classList.add('sx-busy');
  try {
    if (await applyGroup(near, titleItem, my)) {
      for (let i = 0; i < far.length; i += 400) { // far content: in slices, so the page stays responsive
        if (!(await applyGroup(far.slice(i, i + 400), null, my))) break;
      }
    }
  } finally {
    if (my === seq) document.documentElement.classList.remove('sx-busy');
  }
}

let debounce;
function observe() {
  if (!observer) {
    observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(pass, 150);
    });
  }
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  const titleEl = document.querySelector('title');
  if (titleEl) observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
}

/* ---------- language switcher UI ---------- */
function labelOf(code) { return LANGS.find((l) => l.code === code)?.label || 'English'; }

function refreshSwitchers() {
  document.querySelectorAll('.sx-lang-label').forEach((el) => { el.textContent = labelOf(lang); });
  document.querySelectorAll('.sx-lang-dd a').forEach((a) => a.classList.toggle('on', a.dataset.lang === lang));
  document.documentElement.lang = lang;
}

export async function setLang(code) {
  if (!LANGS.some((l) => l.code === code) || code === lang) return;
  lang = code;
  failedAt = 0;
  try { localStorage.setItem(KEY, code); } catch {}
  refreshSwitchers();
  observer?.disconnect();
  revert();      // back to English first, so mr -> hi translates from the English source
  observe();
  document.dispatchEvent(new CustomEvent('sx:langchange', { detail: { lang } })); // other scripts may listen to this
  await pass();
}

const GLOBE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" stroke-width="1.6"/></svg>';
const CHEV = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function mountSwitcher(host) {
  host.classList.add('sx-lang-host');
  host.setAttribute('role', 'button');
  host.setAttribute('tabindex', '0');
  host.setAttribute('aria-haspopup', 'listbox');
  host.innerHTML = `${GLOBE}<span class="sx-lang-label" data-no-translate>${labelOf(lang)}</span>${CHEV}`;
  const dd = document.createElement('div');
  dd.className = 'sx-lang-dd';
  dd.innerHTML = LANGS.map((l) => `<a href="#" data-lang="${l.code}" lang="${l.code}">${l.label}</a>`).join('');
  host.appendChild(dd);
  const toggle = (e) => { e.stopPropagation(); dd.classList.toggle('open'); };
  host.addEventListener('click', toggle);
  host.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
  dd.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-lang]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    dd.classList.remove('open');
    setLang(a.dataset.lang);
  });
}

function initSwitchers() {
  document.getElementById('langMenu')?.remove(); // old placeholder menu (replaced below)
  let hosts = [...document.querySelectorAll('#langBtn, .lang')];
  if (!hosts.length) {
    const f = document.createElement('div');
    f.className = 'lang sx-lang-float';
    document.body.appendChild(f);
    hosts = [f];
  }
  hosts.forEach(mountSwitcher);
  document.addEventListener('click', () => document.querySelectorAll('.sx-lang-dd.open').forEach((d) => d.classList.remove('open')));
  refreshSwitchers();
}

function boot() {
  fixOptionValues();
  initSwitchers();
  observe();
  if (lang !== 'en') pass();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
