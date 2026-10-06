// Schemes page: search + filters over the 239 student schemes in src/data/schemes.js.
// Filters: caste / category, family income, education level, what the student wants, who runs it,
// and "also applies to me" situations (girl, disability, ward of service family, workers' family, orphan, minority).
import './common.js';
import { SCHEMES, SCHEME_GROUPS } from './data/schemes.js';
import { SERVICES } from './data/services-index.js';
import { levelFromEducation, catFromCategory } from './lib/profile-map.js';
import { starButtonHTML, syncStars } from './star-ui.js'; // Star button on every scheme card (9.O Star version)

const PAGE = 24;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- option lists (labels are plain English so the translation engine / built-in dictionary can translate them) ---------- */
const CATS = [
  ['', 'All categories'], ['sc', 'SC / Nav-Buddhist'], ['st', 'ST (Scheduled Tribe)'], ['vjnt', 'VJNT / NT / DNT'], ['obc', 'OBC'],
  ['sbc', 'SBC'], ['maratha', 'Maratha / Kunbi'], ['ews', 'EWS / EBC'], ['open', 'Open / General'],
];
const INCOMES = [['', 'Any / not sure'], ['lt25', 'Up to ₹2.5 lakh'], ['m8', '₹2.5 lakh to ₹8 lakh'], ['gt8', 'Above ₹8 lakh']];
const LEVELS = [
  ['', 'Any level'], ['school', 'School (Class 5 to 10)'], ['junior', 'Junior college (Class 11 to 12)'], ['diploma', 'Diploma / ITI / Polytechnic'],
  ['ug', 'Graduation (UG)'], ['pg', 'Post-graduation (PG)'], ['phd', 'PhD / research'], ['prof', 'Professional courses (Engineering, Medical, etc.)'],
];
const WANTS = [
  ['', 'Anything'], ['money', 'Scholarship / fee reimbursement'], ['hostel', 'Hostel / living allowance'], ['fellow', 'Research fellowship'],
  ['coach', 'Competitive exam coaching'], ['skill', 'Skill / vocational training'], ['abroad', 'Study abroad'], ['loan', 'Education loan support'],
  ['grant', 'Cash award / grant / concession'],
];
const BYS = [
  ['', 'Anyone'], ['state', 'Maharashtra Government'], ['central', 'Government of India'], ['uni', 'Universities'],
  ['civic', 'Municipal corporations'], ['private', 'Trusts & companies (CSR)'],
];
const SITS = [
  ['girls', '👩‍🎓 Girl / woman student'], ['pwd', '♿ Disability'], ['wards', '🎖️ Ward of ex-serviceman, police or freedom fighter'],
  ['workers', '⛏️ Family of beedi, cine or mine workers, landless labourers or artisans'], ['orphan', '🧒 Orphan / PM CARES child'], ['minority', '🤝 Religious minority'],
];
const CAT_LABEL = { ...Object.fromEntries(CATS.filter((c) => c[0]).map((c) => [c[0], c[1]])), minority: 'Religious minority' };
const SP_LABEL = { girls: 'Girls', pwd: 'Disability', wards: 'Wards of service families', workers: 'Workers\' families', orphan: 'Orphans' };
const KIND_LABEL = { scholarship: 'Scholarship', fee: 'Fee reimbursement', fellowship: 'Fellowship', hostel: 'Hostel / living', coaching: 'Coaching / training', loan: 'Loan support', grant: 'Cash / grant' };
const LV_LABEL = { school: 'School', junior: 'Class 11-12', diploma: 'Diploma / ITI', ug: 'UG', pg: 'PG', phd: 'PhD', prof: 'Professional' };
const BY_LABEL = Object.fromEntries(BYS.filter((b) => b[0]).map((b) => [b[0], b[1]]));
const CORE = ['school', 'junior', 'diploma', 'ug', 'pg', 'phd'];
// Schemes whose name gives no core level (abroad / coaching / skill only) still belong to certain stages.
const IMPLIED = { abroad: ['ug', 'pg', 'phd'], exam: ['junior', 'ug', 'pg'], skill: ['junior', 'diploma', 'ug'] };

/* ---------- search index ---------- */
// s.g is the 1-based group number from the source list.
const groupOf = (s) => SCHEME_GROUPS[s.g - 1] || '';
const SYN = {
  scholarship: 'scholarship shishyavrutti शिष्यवृत्ती छात्रवृत्ति', hostel: 'hostel vasatigruh वसतिगृह हॉस्टल', fellowship: 'fellowship research phd',
  coaching: 'coaching training classes', loan: 'loan interest', fee: 'fee freeship tuition', grant: 'grant award cash',
  girls: 'girls girl women female', pwd: 'disability disabled divyang handicapped pwd', wards: 'wards ex servicemen army police defence freedom fighter',
};
const hayOf = new Map(SCHEMES.map((s) => [s.no, ' ' + norm([
  s.title, groupOf(s), s.cats.map((c) => CAT_LABEL[c] || c).join(' '), s.sp.map((x) => SYN[x]).join(' '), s.kind.map((k) => SYN[k]).join(' '),
  s.lv.map((l) => LV_LABEL[l] || l).join(' '), BY_LABEL[s.by] || '',
].join(' '))]));
const has = (hay, k) => hay.includes(' ' + k);

/* ---------- state ---------- */
const params = new URLSearchParams(location.search);
const pick = (key, list) => { const v = params.get(key) || ''; return list.some((o) => o[0] === v) ? v : ''; };
const state = {
  q: params.get('q') || '',
  cat: pick('cat', CATS), inc: pick('inc', INCOMES), lvl: pick('lvl', LEVELS), want: pick('want', WANTS), by: pick('by', BYS),
  sp: new Set((params.get('sp') || '').split(',').filter((x) => SITS.some((s) => s[0] === x))),
  showHigh: false, // "show income-tested schemes anyway" when income is above 8 lakh
};
// Answers from the home page ("Let's Get Started", saved in sessionStorage as sx_profile) pre-select the filters,
// but only when the student opens Schemes without any filter in the address. Unknown answers pre-select nothing.
let fromProfile = null; // { cat, lvl } = which filters came from the profile
if (![...params.keys()].length) {
  try {
    const p = JSON.parse(sessionStorage.getItem('sx_profile'));
    const cat = catFromCategory(p?.category); // "SC / ST" is ambiguous, so the student picks SC or ST
    const lvl = levelFromEducation(p?.education);
    if (cat) state.cat = cat;
    if (lvl) state.lvl = lvl;
    if (cat || lvl) fromProfile = { cat: !!cat, lvl: !!lvl };
  } catch {}
}
// ?scheme=<number>: opened from Profile -> Starred Schemes. That one scheme is shown on its own (any filter change or "Show all schemes" ends it).
let focusNo = (() => { const n = Number(params.get('scheme')); return SCHEMES.some((s) => s.no === n) ? n : 0; })();
let shown = PAGE;

/* ---------- matching ---------- */
const personalised = () => !!(state.cat || state.sp.size);

function levelOK(s) {
  if (!state.lvl) return true;
  if (state.lvl === 'prof') return s.lv.includes('prof');
  if (!s.lv.length) return true;
  const core = s.lv.filter((l) => CORE.includes(l));
  if (core.length) return core.includes(state.lvl);
  const implied = s.lv.flatMap((l) => IMPLIED[l] || []);
  return !implied.length || implied.includes(state.lvl);
}
function wantOK(s) {
  switch (state.want) {
    case 'money': return s.kind.includes('scholarship') || s.kind.includes('fee');
    case 'hostel': return s.kind.includes('hostel');
    case 'fellow': return s.kind.includes('fellowship');
    case 'coach': return s.lv.includes('exam');
    case 'skill': return s.lv.includes('skill');
    case 'abroad': return s.lv.includes('abroad');
    case 'loan': return s.kind.includes('loan');
    case 'grant': return s.kind.includes('grant');
    default: return true;
  }
}
function eligibleFor(s) {
  if (!personalised()) return true;
  const mine = new Set([state.cat, state.sp.has('minority') ? 'minority' : ''].filter(Boolean));
  const catOK = !mine.size || s.cats.includes('all') || s.cats.some((c) => mine.has(c));
  const spOK = !s.sp.length || s.sp.some((x) => state.sp.has(x));
  return catOK && spOK;
}
const baseMatch = (s) => eligibleFor(s) && levelOK(s) && wantOK(s) && (!state.by || s.by === state.by);
const incomeHides = (s) => state.inc === 'gt8' && !state.showHigh && s.need === 'need';

function search(list, q) {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) return { list: list.map((s) => [s, 0]), loose: false };
  const score = (s, all) => {
    const h = hayOf.get(s.no), t = ' ' + norm(s.title);
    const hits = toks.filter((k) => has(h, k));
    if (!hits.length || (all && hits.length !== toks.length)) return 0;
    return hits.length + toks.filter((k) => has(t, k)).length * 2;
  };
  let out = list.map((s) => [s, score(s, true)]).filter((x) => x[1] > 0), loose = false;
  if (!out.length && toks.length > 1) { out = list.map((s) => [s, score(s, false)]).filter((x) => x[1] > 0); loose = true; }
  return { list: out, loose };
}

function rank(s) { // higher = shown earlier when no search text
  let r = 0;
  if (state.cat && s.cats.includes(state.cat)) r += 3;
  if (state.sp.has('minority') && s.cats.includes('minority')) r += 3;
  if (s.sp.some((x) => state.sp.has(x))) r += 2;
  if (state.inc === 'lt25' && s.need === 'need') r += 1;
  return r;
}

/* ---------- documents the student will probably need ---------- */
const DOC_LABEL = {
  'income-certificate': 'Income certificate', 'caste-certificate': 'Caste certificate', 'non-creamy-layer-certificate': 'Non-creamy layer certificate',
  'ews-certificate': 'EWS certificate', 'disability-certificate': 'Disability certificate', 'age-nationality-domicile-certificate': 'Domicile certificate',
};
const linkOf = (d) => d.href || `guide.html?s=${encodeURIComponent(d.id)}`;
function docsFor(s) {
  const ids = [];
  if (s.need === 'need') ids.push('income-certificate');
  if (s.cats.some((c) => ['sc', 'st', 'obc', 'vjnt', 'sbc', 'maratha'].includes(c))) ids.push('caste-certificate');
  if (s.cats.some((c) => ['obc', 'vjnt', 'sbc'].includes(c))) ids.push('non-creamy-layer-certificate');
  if (s.cats.includes('ews')) ids.push('ews-certificate');
  if (s.sp.includes('pwd')) ids.push('disability-certificate');
  if (s.by === 'state' || s.by === 'uni') ids.push('age-nationality-domicile-certificate');
  return [...new Set(ids)].map((id) => SERVICES.find((d) => d.id === id)).filter(Boolean).slice(0, 4);
}

/* ---------- rendering ---------- */
const optionsHtml = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');

function cardHtml(s) {
  const forTags = s.cats.includes('all') ? [] : s.cats.slice(0, 3).map((c) => `<span class="tag t-for">For ${esc(CAT_LABEL[c] || c)}</span>`).concat(s.cats.length > 3 ? [`<span class="tag t-for">+${s.cats.length - 3} more</span>`] : []);
  const spTags = s.sp.map((x) => `<span class="tag t-for">${esc(SP_LABEL[x])}</span>`);
  const basis = s.need === 'need' ? '<span class="tag t-need" title="The scheme name points to an income / means test. Check the official limit.">Income limit likely</span>'
    : s.need === 'merit' ? '<span class="tag t-merit">Merit-based</span>' : '';
  const core = s.lv.filter((l) => CORE.includes(l));
  const lvTag = core.length && core.length < CORE.length ? `<span class="tag">${core.map((l) => esc(LV_LABEL[l])).join(' · ')}</span>` : '';
  const kindTags = s.kind.slice(0, 2).map((k) => `<span class="tag">${esc(KIND_LABEL[k])}</span>`);
  const docs = docsFor(s);
  const q = encodeURIComponent(`${s.title} Maharashtra official`);
  return `
  <article class="card sch-card">
    <div class="top-row"><h3>${esc(s.title)}</h3><span class="top-tags"><span class="no">#${s.no}</span>${starButtonHTML('scheme', s.no)}</span></div>
    <div class="grp">${esc(groupOf(s).replace(/\s*Schemes?$/i, ''))}</div>
    <div class="tags">${forTags.join('')}${spTags.join('')}${basis}${kindTags.join('')}${lvTag}<span class="tag">${esc(BY_LABEL[s.by])}</span></div>
    ${docs.length ? `<div class="docs-line">📋 Papers you may need: ${docs.map((d) => `<a href="${esc(linkOf(d))}">${esc(DOC_LABEL[d.id] || d.title)}</a>`).join(' · ')}</div>` : ''}
    <div class="foot"><a class="btn btn-outline btn-sm" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener noreferrer">Find official details ↗</a></div>
  </article>`;
}

function render() {
  const base = SCHEMES.filter(baseMatch);
  const visible = base.filter((s) => !incomeHides(s));
  const hiddenByIncome = base.length - visible.length;
  const res = search(visible, state.q);
  const focus = focusNo ? SCHEMES.find((s) => s.no === focusNo) : null;
  const list = focus ? [focus] : res.list.sort((a, b) => b[1] - a[1] || rank(b[0]) - rank(a[0]) || a[0].no - b[0].no).map((x) => x[0]);

  const q = state.q.trim();
  $('resTitle').textContent = focus ? 'Scheme details' : q
    ? `${list.length} scheme${list.length === 1 ? '' : 's'} for "${q}"`
    : `${list.length} scheme${list.length === 1 ? '' : 's'} ${personalised() || state.lvl || state.want || state.by || state.inc ? 'match your filters' : 'for students'}`;
  $('resSub').textContent = focus ? 'This is the scheme you opened from your starred items. Tap "Show all schemes" to see the full list.' : res.loose && list.length
    ? 'No exact match, so these are the closest schemes. Try one short word such as "hostel", "UPSC" or "PhD".'
    : 'Choose your category, income and level to narrow the list. Tap "Find official details" to confirm the latest rules.';

  // Stats
  $('stCount').textContent = list.length;
  $('stState').textContent = list.filter((s) => s.by === 'state').length;
  $('stCentral').textContent = list.filter((s) => s.by === 'central').length;

  // Active-filter count
  const active = [state.cat, state.inc, state.lvl, state.want, state.by].filter(Boolean).length + state.sp.size;
  $('fActive').textContent = active ? `${active} filter${active === 1 ? '' : 's'} on` : 'No filters on. Showing everything.';
  $('fCountMobile').textContent = active ? `(${active})` : '';

  // Notes
  const notes = [];
  if (focus) notes.push('<div class="notice info">Showing one scheme. <button type="button" class="linkbtn" id="showAllSchemes">Show all schemes</button></div>');
  if (fromProfile) {
    const fromHome = (fromProfile.cat ? 1 : 0) + (fromProfile.lvl ? 1 : 0);
    if (fromHome && active === fromHome) {
      const what = fromProfile.cat && fromProfile.lvl ? 'Category and education level' : fromProfile.cat ? 'Category' : 'Education level';
      notes.push(`<div class="notice info">${what} pre-selected from the answers you gave on the home page. Change it any time.</div>`);
    }
  }
  if (state.inc === 'gt8' && hiddenByIncome > 0 && !state.showHigh) notes.push(`<div class="notice"><b>${hiddenByIncome} income-tested scheme${hiddenByIncome === 1 ? ' is' : 's are'} hidden.</b> Most of them have a family income limit at or below ₹8 lakh a year, but limits differ. <button type="button" class="linkbtn" id="showHigh">Show them anyway</button></div>`);
  if (state.inc === 'gt8' && state.showHigh) notes.push('<div class="notice">Showing income-tested schemes too. Check each scheme\'s official income limit before applying. <button type="button" class="linkbtn" id="hideHigh">Hide them again</button></div>');
  if ((state.inc === 'lt25' || state.inc === 'm8') && list.some((s) => s.need === 'need')) notes.push('<div class="notice info">Schemes marked <b>Income limit likely</b> usually need an income certificate. The exact limit differs by scheme.</div>');
  if (state.cat === 'ews' && state.inc === 'gt8') notes.push('<div class="notice">EWS / EBC benefits are for families under the income limit, so these schemes may not apply at this income.</div>');
  $('notes').innerHTML = notes.join('');
  $('showAllSchemes')?.addEventListener('click', () => { focusNo = 0; shown = PAGE; syncUrl(); render(); });
  $('showHigh')?.addEventListener('click', () => { state.showHigh = true; render(); });
  $('hideHigh')?.addEventListener('click', () => { state.showHigh = false; render(); });

  // Cards
  const page = list.slice(0, shown);
  $('resGrid').innerHTML = list.length ? page.map(cardHtml).join('') : `
    <div class="card" style="grid-column:1/-1;padding:28px;text-align:center">
      <h3>No schemes match${q ? ` "${esc(q)}"` : ' these filters'}</h3>
      <p class="desc" style="margin:8px 0 14px">Try removing a filter, or search a shorter word such as post matric, hostel, UPSC, PhD or abroad.</p>
      <button type="button" class="btn btn-primary btn-sm" id="clearAll">Reset all filters</button></div>`;
  $('clearAll')?.addEventListener('click', resetAll);
  syncStars($('resGrid'));
  const rest = list.length - page.length;
  $('moreWrap').innerHTML = rest > 0 ? `<button type="button" class="btn btn-outline" id="moreBtn">Show more (${rest} remaining)</button>` : '';
  $('moreBtn')?.addEventListener('click', () => { shown += PAGE; render(); });

  document.querySelectorAll('[data-sp]').forEach((b) => { const on = state.sp.has(b.dataset.sp); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set('q', state.q.trim());
  for (const k of ['cat', 'inc', 'lvl', 'want', 'by']) if (state[k]) p.set(k, state[k]);
  if (state.sp.size) p.set('sp', [...state.sp].join(','));
  history.replaceState(null, '', p.toString() ? '?' + p : 'schemes.html');
}
function update() { focusNo = 0; shown = PAGE; state.showHigh = state.inc === 'gt8' ? state.showHigh : false; fromProfile = null; syncUrl(); render(); }

function resetAll() {
  focusNo = 0;
  Object.assign(state, { q: '', cat: '', inc: '', lvl: '', want: '', by: '', showHigh: false });
  state.sp.clear(); fromProfile = null; shown = PAGE;
  $('q').value = '';
  for (const [id, key] of [['fCat', 'cat'], ['fInc', 'inc'], ['fLvl', 'lvl'], ['fWant', 'want'], ['fBy', 'by']]) $(id).value = state[key];
  syncUrl(); render();
}

/* ---------- wire up ---------- */
const SELECTS = [['fCat', 'cat', CATS], ['fInc', 'inc', INCOMES], ['fLvl', 'lvl', LEVELS], ['fWant', 'want', WANTS], ['fBy', 'by', BYS]];
for (const [id, key, list] of SELECTS) {
  $(id).innerHTML = optionsHtml(list, state[key]);
  $(id).addEventListener('change', () => { state[key] = $(id).value; update(); });
}
$('sitRow').innerHTML = SITS.map(([v, l]) => `<button type="button" class="chip-outline chip" data-sp="${v}" aria-pressed="false">${l}</button>`).join('');
$('sitRow').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sp]'); if (!b) return;
  state.sp.has(b.dataset.sp) ? state.sp.delete(b.dataset.sp) : state.sp.add(b.dataset.sp);
  update();
});
$('resetBtn').addEventListener('click', resetAll);

$('q').value = state.q;
$('searchForm').addEventListener('submit', (e) => { e.preventDefault(); state.q = $('q').value; update(); });
let typing;
$('q').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { state.q = $('q').value; update(); }, 180); });

// On small screens the filter box starts collapsed (it is open on desktop).
if (matchMedia('(max-width: 820px)').matches) $('filters').open = false;

render();
