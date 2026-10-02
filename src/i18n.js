// Language switcher + page translator (English / मराठी / हिंदी).
// Order of lookup for every piece of text: built-in dictionary -> saved cache -> Bhashini.
import { DICT } from './translations.js';
import { translateTexts, bhashiniConfigured } from './bhashini.js';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
];
const KEY = 'sx_lang';
const CACHE_PREFIX = 'sx_tr_';
const CHUNK = 20;

let lang = 'en';
try { lang = localStorage.getItem(KEY) || 'en'; } catch {}
if (!LANGS.some((l) => l.code === lang)) lang = 'en';

export const getLang = () => lang;

/* ---------- small toast ---------- */
let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.sx-toast');
  if (!el) { el = document.createElement('div'); el.className = 'sx-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

/* ---------- cache ---------- */
const caches = {};
function cacheFor(l) {
  if (!caches[l]) {
    try { caches[l] = JSON.parse(localStorage.getItem(CACHE_PREFIX + l)) || {}; } catch { caches[l] = {}; }
  }
  return caches[l];
}
let saveTimer;
function saveCache(l) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const c = cacheFor(l);
      const keys = Object.keys(c);
      if (keys.length > 4000) keys.slice(0, keys.length - 3000).forEach((k) => delete c[k]);
      localStorage.setItem(CACHE_PREFIX + l, JSON.stringify(c));
    } catch {}
  }, 400);
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

/* ---------- translation engine ---------- */
let failedAt = 0;
let warned = false;
const pending = new Map(); // "lang|text" -> Promise<string>

async function fetchChunk(l, texts) {
  const result = await translateTexts(texts, l);
  const c = cacheFor(l);
  texts.forEach((t, i) => { if (result[i] && result[i] !== t) c[t] = result[i]; });
  saveCache(l);
  return result;
}

/** Translate English strings into the current language. Returns same-length array (English kept on failure). */
export async function tr(list, forLang = lang) {
  if (forLang === 'en') return list.slice();
  const dict = DICT[forLang] || {};
  const cache = cacheFor(forLang);
  const own = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
  const out = list.map((s) => own(dict, s) ?? own(cache, s));
  const need = [...new Set(list.filter((s, i) => out[i] === null && HAS_LETTER.test(s)))];

  if (need.length) {
    if (!bhashiniConfigured) {
      if (!warned) { warned = true; toast('Add your Bhashini keys to .env to translate the whole page. Menu and labels are already translated.'); }
    } else if (Date.now() - failedAt > 20000) {
      const waits = [];
      const fresh = need.filter((t) => !pending.has(forLang + '|' + t));
      for (let i = 0; i < fresh.length; i += CHUNK) {
        const part = fresh.slice(i, i + CHUNK);
        const p = fetchChunk(forLang, part);
        part.forEach((t, idx) => pending.set(forLang + '|' + t, p.then((r) => r[idx])));
        waits.push(p.catch((e) => {
          failedAt = Date.now();
          console.warn('[Sarthi - X] Bhashini translation failed:', e);
          toast('Translation service is not reachable right now. Showing English for the rest of the page.');
        }));
      }
      await Promise.all(waits);
      need.forEach((t) => pending.delete(forLang + '|' + t));
    }
  }
  const c2 = cacheFor(forLang);
  return list.map((s, i) => out[i] ?? own(c2, s) ?? s);
}

/* ---------- page translation ---------- */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
const NO_TR = '[data-no-translate], .word, .brand, .lang, .lang-btn, .sx-lang-dd, .sx-toast';
const ATTRS = ['placeholder', 'title', 'aria-label'];

const tracked = new Map();     // Text node -> { en, out }
const attrTracked = new Map(); // Element -> { attr: { en, out } }
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
  for (const [node, t] of tracked) if (node.isConnected && node.nodeValue === t.out) node.nodeValue = t.en;
  tracked.clear();
  for (const [el, rec] of attrTracked) for (const [a, t] of Object.entries(rec)) if (el.isConnected && el.getAttribute(a) === t.out) el.setAttribute(a, t.en);
  attrTracked.clear();
}

async function pass() {
  const my = ++seq;
  fixOptionValues();
  if (lang === 'en') { observer?.disconnect(); revert(); observe(); return; }

  const nodes = textNodes().map((n) => {
    const t = tracked.get(n);
    const en = t && n.nodeValue === t.out ? t.en : n.nodeValue;
    return { n, en, t, ...split(en) };
  }).filter((x) => x.core && HAS_LETTER.test(x.core) && !(x.t && x.n.nodeValue === x.t.out));
  const attrs = attrTargets().map((x) => ({ ...x, ...split(x.en) })).filter((x) => x.core);

  if (!nodes.length && !attrs.length) return;
  document.documentElement.classList.add('sx-busy');
  const cores = [...new Set([...nodes, ...attrs].map((x) => x.core))];
  const done = await tr(cores, lang);
  document.documentElement.classList.remove('sx-busy');
  if (my !== seq) return; // a newer pass (or a language change) took over
  const map = new Map(cores.map((c, i) => [c, done[i]]));

  observer?.disconnect();
  for (const x of nodes) {
    if (!x.n.isConnected) continue;
    const out = x.pre + map.get(x.core) + x.suf;
    if (out === x.n.nodeValue) continue;
    x.n.nodeValue = out;
    tracked.set(x.n, { en: x.en, out });
  }
  for (const x of attrs) {
    const out = x.pre + map.get(x.core) + x.suf;
    x.el.setAttribute(x.a, out);
    const rec = attrTracked.get(x.el) || {};
    rec[x.a] = { en: x.en, out };
    attrTracked.set(x.el, rec);
  }
  for (const n of tracked.keys()) if (!n.isConnected) tracked.delete(n);
  observe();
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
  warned = false;
  try { localStorage.setItem(KEY, code); } catch {}
  refreshSwitchers();
  observer?.disconnect();
  revert();      // back to English first, so mr -> hi translates from the English source
  observe();
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
