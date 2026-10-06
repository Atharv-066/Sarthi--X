// Minority Schemes page. Two views share this one page and one set of components (10.0):
//   Religious minority  - pick a religion (or "For everyone"), then filter by type and by the official certificates you hold.
//   Linguistic minority - pick your language; same cards, filters, search and address handling.
// Typing in the search box searches every group of the current view at once and merges repeated scheme names.
import './common.js';
import { RELIGIONS, EVERYONE, RULES } from './data/minority.js';
import { LINGUISTIC, LING_RULES, LING_DICT } from './data/linguistic.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]+/g, ' ').replace(/\s+/g, ' ').trim();
const has = (hay, k) => hay.includes(' ' + k);
// Linguistic view: the Marathi and Hindi names are searchable too, so a visitor can type in either language whatever the screen language is.
const altNames = (name) => (state.m === 'language' ? ' ' + norm((LING_DICT.mr[name] || '') + ' ' + (LING_DICT.hi[name] || '')) : '');

const NOTICE_RELIGION = '<b>Read this first:</b> belonging to a religious minority does not by itself make you OBC, SBC, VJNT or SC. Sections marked <b>Only with official certificate</b> apply only if you hold that certificate.';
const NOTICE_LANGUAGE = '<b>Read this first:</b> your language only decides which schemes are listed for you. Every scheme still has its own rules: religion or minority community, category, income, course, domicile, age and gender. Sections marked <b>Only with official ST certificate</b> apply only if you hold that certificate.';

const MODES = {
  religion: {
    groups: [...RELIGIONS, EVERYONE],
    rules: RULES,
    types: [['', 'Everything'], ['scholarship', 'Scholarships and fees'], ['central', 'Central schemes (PM VIKAS)'], ['business', 'Business and self-employment'], ['loan', 'Education loans'], ['agri', 'Agriculture']],
    certs: [['obc', 'OBC'], ['sbc', 'SBC'], ['vjnt', 'VJNT'], ['sc', 'SC / Neo-Buddhist']],
    heading: 'Religious minority schemes',
    intro: 'Choose your religion to see the schemes listed for you, or search above to look across all of them.',
    all: 'All religions', back: '← All religions',
    placeholder: 'Search schemes, e.g. scholarship, loan, PM VIKAS, MUDRA, hostel, agriculture',
    ariaSearch: 'Search minority schemes',
    notice: NOTICE_RELIGION,
    searchSub: 'Searching every religion and the "For everyone" lists. Repeated scheme names are shown once.',
    groupSub: (g) => (g.id === 'everyone'
      ? 'Category lists, agriculture and business schemes that are not tied to one religion.'
      : 'Minority schemes first, then schemes that need an official category certificate, then central, business, loan and agriculture schemes.'),
    noHit: 'Try one short word such as scholarship, loan, MUDRA or agriculture.',
  },
  language: {
    groups: LINGUISTIC,
    rules: LING_RULES,
    types: [['', 'Everything'], ['scholarship', 'Scholarships and fees'], ['education', 'Hostels, schools and education support'], ['training', 'Skills, coaching and training'], ['loan', 'Loans and credit'], ['development', 'Housing, area development and other programmes']],
    certs: [['st', 'ST']],
    heading: 'Linguistic minority schemes',
    intro: 'Choose your language to see the schemes listed for you, or search above to look across all of them.',
    all: 'All languages', back: '← All languages',
    placeholder: 'Search schemes, e.g. scholarship, hostel, loan, training, madrasa, housing',
    ariaSearch: 'Search linguistic minority schemes',
    notice: NOTICE_LANGUAGE,
    searchSub: 'Searching every language. Repeated scheme names are shown once.',
    groupSub: () => 'Schemes listed for this language. Each scheme still has its own eligibility rules.',
    noHit: 'Try one short word such as scholarship, hostel, loan or training.',
  },
};
let MODE = MODES.religion;
let GROUPS = MODE.groups, TYPES = MODE.types, KIND_LABEL, CERTS = MODE.certs, CERT_LABEL;
function bindMode(m) {
  MODE = MODES[m]; GROUPS = MODE.groups; TYPES = MODE.types; CERTS = MODE.certs;
  KIND_LABEL = Object.fromEntries(TYPES.filter((t) => t[0]).map((t) => [t[0], t[1]]));
  CERT_LABEL = Object.fromEntries(CERTS);
}
bindMode('religion');
const isScheme = (it) => !it.r; // pointers ("see agriculture list") and "none listed" are not schemes
const count = (g) => g.sections.reduce((n, s) => n + s.items.filter(isScheme).length, 0);

/* ---------- state (kept in the address so a view can be shared) ---------- */
const state = { m: 'religion', g: '', q: '', type: '', certs: new Set() };
function readUrl() {
  const p = new URLSearchParams(location.search);
  state.m = p.get('m') === 'language' ? 'language' : 'religion'; // the religious view keeps its old addresses (no m)
  bindMode(state.m);
  state.g = GROUPS.some((g) => g.id === p.get('r')) ? p.get('r') : '';
  state.q = p.get('q') || '';
  state.type = TYPES.some((t) => t[0] === p.get('type')) ? p.get('type') : '';
  state.certs = new Set((p.get('cert') || '').split(',').filter((c) => CERT_LABEL[c]));
}
function writeUrl(push) {
  const p = new URLSearchParams();
  if (state.m === 'language') p.set('m', 'language');
  if (state.g) p.set('r', state.g);
  if (state.q.trim()) p.set('q', state.q.trim());
  if (state.type) p.set('type', state.type);
  if (state.certs.size) p.set('cert', [...state.certs].join(','));
  const url = p.toString() ? '?' + p : 'minority.html';
  push ? history.pushState(null, '', url) : history.replaceState(null, '', url);
}

/* ---------- matching ---------- */
function certOK(sec) { return !state.certs.size || !sec.certs.length || sec.certs.some((c) => state.certs.has(c)); }
const typeOK = (sec) => !state.type || sec.kind === state.type;
const secKey = (g, s) => ' ' + norm([g.name, s.title, s.qual, KIND_LABEL[s.kind] || ''].join(' '));

function tokensMatch(hay, toks, all = true) {
  const hits = toks.filter((k) => has(hay, k));
  return all ? hits.length === toks.length : hits.length > 0;
}

/* ---------- rendering ---------- */
const extLink = (t) => `<a class="ext" href="https://www.google.com/search?q=${encodeURIComponent(t + ' Maharashtra official')}" target="_blank" rel="noopener noreferrer" title="Find official details" aria-label="Find official details for ${esc(t)}">↗</a>`;

function itemHtml(it) {
  if (it.r === 'none') return '<li class="muted"><span class="tx">No scheme listed in the source data.</span></li>';
  if (it.r === 'agri') return '<li class="ptr"><span class="tx">General agriculture schemes apply to everyone (not religion-specific).</span><button type="button" class="linkbtn" data-goto="agri">View agriculture schemes</button></li>';
  if (it.r === 'note') return `<li class="ptr"><span class="tx">${esc(it.t.replace('(see Section 7)', '(see the "For everyone" list)'))}</span></li>`;
  return `<li><span class="tx">${esc(it.t)}</span>${it.v ? '<span class="tag t-verify" title="Check that this scheme is still running">Verify status</span>' : ''}${extLink(it.t)}</li>`;
}
function sectionHtml(sec, items) {
  const cert = sec.certs.length ? `<span class="tag t-cert">Only with official ${sec.certs.map((c) => CERT_LABEL[c]).join(' / ')} certificate</span>` : '';
  return `<article class="card sec-card"><h3>${esc(sec.title)}</h3>${sec.qual ? `<div class="qual">${esc(sec.qual)}</div>` : ''}
    <div class="tags"><span class="tag t-kind">${esc(KIND_LABEL[sec.kind])}</span>${cert}</div>
    <ul class="items">${items.map(itemHtml).join('')}</ul></article>`;
}

function renderPicker() {
  $('picker').innerHTML = GROUPS.map((g) => `<button type="button" class="card rel-card${g.id === 'everyone' ? ' everyone' : ''}" data-g="${g.id}">
      <span class="nm">${esc(g.name)}</span><span class="ct">${count(g)} schemes in ${g.sections.length} groups</span><span class="go">View schemes →</span></button>`).join('');
}

function renderGroup() {
  const g = GROUPS.find((x) => x.id === state.g);
  const toks = norm(state.q).split(' ').filter(Boolean);
  let shownSecs = 0, shownItems = 0, hiddenCert = 0;
  const cards = [];
  for (const sec of g.sections) {
    if (!typeOK(sec)) continue;
    if (!certOK(sec)) { hiddenCert++; continue; }
    let items = sec.items;
    if (toks.length) {
      const base = secKey(g, sec);
      items = items.filter((it) => isScheme(it) && tokensMatch(base + ' ' + norm(it.t) + altNames(it.t), toks));
    }
    if (!items.length) continue;
    shownSecs++; shownItems += items.filter(isScheme).length;
    cards.push(sectionHtml(sec, items));
  }
  $('resTitle').textContent = `${g.name}: ${shownItems} scheme${shownItems === 1 ? '' : 's'} in ${shownSecs} group${shownSecs === 1 ? '' : 's'}`;
  $('resSub').textContent = MODE.groupSub(g);
  const notes = [];
  if (hiddenCert) notes.push(`<div class="notice info">${hiddenCert} group${hiddenCert === 1 ? ' is' : 's are'} hidden because ${hiddenCert === 1 ? 'it needs' : 'they need'} a certificate you did not tick. <button type="button" class="linkbtn" id="clearCerts">Show all groups</button></div>`);
  $('notes').innerHTML = notes.join('');
  $('results').innerHTML = cards.length ? `<div class="sec-grid">${cards.join('')}</div>`
    : `<div class="card" style="padding:26px;text-align:center;margin-top:18px"><h3>Nothing matches</h3><p class="desc" style="margin:8px 0 0">Try a different word, or set "Show" back to Everything.</p></div>`;
  $('clearCerts')?.addEventListener('click', () => { state.certs.clear(); update(false); });
}

function renderSearchAll() {
  const toks = norm(state.q).split(' ').filter(Boolean);
  const map = new Map(); // normalised scheme name -> { t, v, occ: [{g, sec}] }
  for (const g of GROUPS) for (const sec of g.sections) {
    if (!typeOK(sec) || !certOK(sec)) continue;
    for (const it of sec.items) {
      if (!isScheme(it)) continue;
      const k = norm(it.t); const e = map.get(k) || { t: it.t, v: 0, occ: [] };
      e.v = e.v || it.v || 0; e.occ.push({ g, sec }); map.set(k, e);
    }
  }
  const run = (all) => [...map.values()].filter((e) => {
    const hay = ' ' + norm(e.t + ' ' + e.occ.map((o) => o.g.name + ' ' + o.sec.title + ' ' + o.sec.qual + ' ' + KIND_LABEL[o.sec.kind]).join(' ')) + altNames(e.t);
    return tokensMatch(hay, toks, all);
  });
  let list = run(true), loose = false;
  if (!list.length && toks.length > 1) { list = run(false); loose = true; }
  $('resTitle').textContent = `${list.length} scheme${list.length === 1 ? '' : 's'} for "${state.q.trim()}"`;
  $('resSub').textContent = loose ? 'No exact match, so these are the closest schemes.' : MODE.searchSub;
  $('notes').innerHTML = '';
  $('results').innerHTML = list.length ? `<div class="res-list">${list.map((e) => {
    const names = [...new Set(e.occ.map((o) => o.g.name))];
    const certs = e.occ.every((o) => o.sec.certs.length) ? [...new Set(e.occ.flatMap((o) => o.sec.certs))] : [];
    const kinds = [...new Set(e.occ.map((o) => o.sec.kind))];
    return `<article class="card res-item"><div class="tx">${esc(e.t)} ${extLink(e.t)}</div>
      <div class="tags">${kinds.map((k) => `<span class="tag t-kind">${esc(KIND_LABEL[k])}</span>`).join('')}${certs.length ? `<span class="tag t-cert">Only with official ${certs.map((c) => CERT_LABEL[c]).join(' / ')} certificate</span>` : ''}${e.v ? '<span class="tag t-verify">Verify status</span>' : ''}</div>
      <div class="listed">${names.length === GROUPS.length && state.m === 'language' ? 'Listed for: all languages' : 'Listed for: ' + names.map(esc).join(' · ')}</div></article>`;
  }).join('')}</div>` : `<div class="card" style="padding:26px;text-align:center;margin-top:18px"><h3>No schemes match "${esc(state.q.trim())}"</h3><p class="desc" style="margin:8px 0 0">${MODE.noHit}</p></div>`;
}

function render() {
  const searching = !!state.q.trim();
  const inGroup = !!state.g;
  $('picker').hidden = inGroup || searching;
  $('filters').hidden = !(inGroup || searching);
  $('curName').textContent = inGroup ? GROUPS.find((g) => g.id === state.g).name : MODE.all;
  $('backBtn').hidden = !inGroup;
  $('backBtn').textContent = MODE.back;
  document.querySelectorAll('[data-m]').forEach((b) => { const on = b.dataset.m === state.m; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
  if ($('notice').dataset.mode !== state.m) { $('notice').innerHTML = MODE.notice; $('notice').dataset.mode = state.m; }
  if ($('q').placeholder !== MODE.placeholder) { $('q').placeholder = MODE.placeholder; $('q').setAttribute('aria-label', MODE.ariaSearch); }
  if ($('fType').dataset.mode !== state.m) buildFilters();
  if ($('rulesList').dataset.mode !== state.m) { $('rulesList').innerHTML = MODE.rules.map((r) => `<li>${esc(r)}</li>`).join(''); $('rulesList').dataset.mode = state.m; }
  if ($('picker').dataset.mode !== state.m) { renderPicker(); $('picker').dataset.mode = state.m; }
  $('fType').value = state.type;
  document.querySelectorAll('[data-cert]').forEach((b) => { const on = state.certs.has(b.dataset.cert); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  if (searching && !inGroup) renderSearchAll();
  else if (inGroup) renderGroup();
  else {
    $('resTitle').textContent = MODE.heading;
    $('resSub').textContent = MODE.intro;
    $('notes').innerHTML = ''; $('results').innerHTML = '';
  }
}
function update(push = false) { writeUrl(push); render(); }

/* ---------- wire up ---------- */
function buildFilters() { // the "Show" list and the certificate chips belong to the current view
  $('fType').innerHTML = TYPES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  $('certRow').innerHTML = CERTS.map(([v, l]) => `<button type="button" class="chip-outline chip" data-cert="${v}" aria-pressed="false">${esc(l)}</button>`).join('');
  $('fType').dataset.mode = state.m;
}

$('modeTabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === state.m) return;
  state.m = b.dataset.m; bindMode(state.m);
  state.g = ''; state.q = ''; $('q').value = ''; state.type = ''; state.certs.clear();
  update(true);
});
$('picker').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; state.g = b.dataset.g; update(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('backBtn').addEventListener('click', () => { state.g = ''; state.q = ''; $('q').value = ''; state.type = ''; state.certs.clear(); update(true); });
$('fType').addEventListener('change', () => { state.type = $('fType').value; update(); });
$('certRow').addEventListener('click', (e) => { const b = e.target.closest('[data-cert]'); if (!b) return; state.certs.has(b.dataset.cert) ? state.certs.delete(b.dataset.cert) : state.certs.add(b.dataset.cert); update(); });
$('results').addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (!b) return; state.g = 'everyone'; state.type = b.dataset.goto; state.q = ''; $('q').value = ''; update(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });

readUrl(); $('q').value = state.q;
$('searchForm').addEventListener('submit', (e) => { e.preventDefault(); state.q = $('q').value; update(); });
let typing; $('q').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { state.q = $('q').value; update(); }, 180); });
window.addEventListener('popstate', () => { readUrl(); $('q').value = state.q; render(); });

render();
