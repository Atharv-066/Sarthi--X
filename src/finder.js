// Document search on the Log in / Sign up page (logged-out preview).
//  * Uses the SAME data (data/services-index.js), the SAME search (doccard.js) and the SAME card as the dashboard.
//  * Shows the card only. The step-by-step guide stays behind login: the guide button asks the visitor to log in,
//    and after a successful login login.js opens the guide they asked for.
//  * Translation: nothing is translated here by hand. The page-wide engine in i18n.js translates the card text, placeholder
//    and messages. The only extra step is fetching translated titles (from the same cache) so a visitor can SEARCH in
//    the selected language.
import { authReady } from './auth.js';
import { getLang, tr, toast } from './i18n.js';
import { docCardHTML, makeSearch } from './doccard.js';

const $ = (id) => document.getElementById(id);
const MAX = 5; // cards shown; the rest need a more specific word
const NEXT_KEY = 'sx_next'; // read by login.js after a successful login

const input = $('finderQ');
const clearBtn = $('finderClear');
const out = $('finderRes');
if (input && clearBtn && out) init();

function init() {
  let data = null;            // { SERVICES, engine } once loaded
  let loading = null;
  const titles = new Map();   // id -> title in the selected language (empty for English)
  let titlesLang = 'en';
  let timer;

  const load = () => (loading ||= import('./data/services-index.js').then((m) => {
    const engine = makeSearch(m.SERVICES, (d) => d.no, (d) => titles.get(d.id) || '');
    data = { SERVICES: m.SERVICES, engine };
    return data;
  }));

  // Translated document names, so "आधार कार्ड" or the Marathi name of a certificate can be searched.
  async function loadTitles() {
    const lang = getLang();
    if (lang === 'en') { titles.clear(); titlesLang = 'en'; return false; }
    if (titlesLang === lang && titles.size) return false;
    const list = data.SERVICES;
    const done = await tr(list.map((d) => d.title), lang);
    if (getLang() !== lang) return false; // language changed again meanwhile
    titles.clear();
    list.forEach((d, i) => { if (done[i] && done[i] !== d.title) titles.set(d.id, done[i]); });
    titlesLang = lang;
    return true;
  }

  /* ---- spelling tolerance: only used when nothing matched ---- */
  const lev = (a, b) => {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  };
  function correct(q) {
    const words = [...data.engine.vocab()].filter((w) => /^[a-z0-9]+$/.test(w));
    let changed = false;
    const fixed = q.toLowerCase().split(/\s+/).filter(Boolean).map((t) => {
      if (t.length < 4 || !/^[a-z]+$/.test(t) || words.some((w) => w.startsWith(t))) return t;
      const limit = t.length < 7 ? 1 : 2;
      let best = null, bd = limit + 1;
      for (const w of words) {
        const d = Math.min(lev(t, w), w.length > t.length ? lev(t, w.slice(0, t.length)) : 9);
        if (d < bd) { bd = d; best = w; }
      }
      if (best) { changed = true; return best; }
      return t;
    }).join(' ');
    return changed ? fixed : null;
  }

  function find(q) {
    let res = data.engine.search(q);
    if (res.list.length && !res.loose) return res.list;
    const alt = correct(q);
    if (alt) {
      const r2 = data.engine.search(alt);
      if (r2.list.length && !r2.loose) return r2.list;
    }
    return res.list; // may be a loose (closest) match, or empty
  }

  function render() {
    const q = input.value.trim();
    clearBtn.classList.toggle('hide', !input.value);
    if (!q) { out.innerHTML = ''; return; }
    const list = find(q);
    if (!list.length) {
      out.innerHTML = `<div class="finder-empty"><b>No matching document or scheme found.</b><span>Try a shorter word such as Aadhaar, income, caste, ration, licence or water.</span></div>`;
      return;
    }
    out.innerHTML = list.slice(0, MAX).map((d) => docCardHTML(d, { guideAttr: 'data-guide' })).join('')
      + (list.length > MAX ? `<div class="finder-note">Type a little more of the name to narrow down the results.</div>` : '')
      + `<div class="finder-note finder-lock"><span aria-hidden="true">🔒</span><span>Log in or sign up to open the complete step-by-step guide.</span></div>`;
  }

  async function run() {
    await load();
    render();
    // Translated titles load once per language; search again when they arrive.
    if (getLang() !== 'en' && input.value.trim() && await loadTitles()) render();
  }

  input.addEventListener('focus', () => { load(); }, { once: true });
  input.addEventListener('input', () => { clearTimeout(timer); clearBtn.classList.toggle('hide', !input.value); timer = setTimeout(run, 150); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') clear(); });
  clearBtn.addEventListener('click', clear);
  function clear() { input.value = ''; render(); input.focus(); }

  document.addEventListener('sx:langchange', () => { titles.clear(); titlesLang = 'en'; if (data && input.value.trim()) run(); });

  /* ---- the guide needs an account ---- */
  out.addEventListener('click', async (e) => {
    const a = e.target.closest('a[data-guide]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    const user = await authReady;
    if (user) { location.href = href; return; } // already signed in: open the normal guide
    try { sessionStorage.setItem(NEXT_KEY, href); } catch {}
    toast('Please log in or sign up to view the complete step-by-step guide.');
    const card = document.getElementById('card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.remove('nudge'); void card.offsetWidth; card.classList.add('nudge');
      setTimeout(() => card.classList.remove('nudge'), 1600);
    }
    $('email')?.focus({ preventScroll: true });
  });
}
