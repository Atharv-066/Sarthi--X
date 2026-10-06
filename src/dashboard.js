// Dashboard: working document search over all 138 Amravati services, category filter and profile-based ordering.
import './common.js';
import { SERVICES, CATEGORIES } from './data/services-index.js';
import { esc, docCardHTML, makeSearch } from './doccard.js'; // card + search are shared with the login page
import { starButtonHTML, syncStars } from './star-ui.js'; // Star button on every document card (9.O Star version)

const PAGE = 24; // cards shown before "Show more"

const FEATURED = ['aadhaar-card', 'age-nationality-domicile-certificate', 'caste-certificate', 'income-certificate', 'birth-certificate'];

const $ = (id) => document.getElementById(id);

const PURPOSE_KEY = { Admission: 'admission', Scholarship: 'scholarship', 'Education Loan': 'loan', 'Study Abroad': 'abroad', Certificates: 'certificates' };
const CAT_KEY = { OBC: 'cat:obc', 'SC / ST': 'cat:sc', EWS: 'cat:ews' };

let profile = null;
try { profile = JSON.parse(sessionStorage.getItem('sx_profile')); } catch {}

const params = new URLSearchParams(location.search);
let query = params.get('q') || '';
let cat = CATEGORIES.some((c) => c.name === params.get('cat')) ? params.get('cat') : 'All';
let shown = PAGE;

const isRec = (d) => !!(profile && profile.purpose && (d.rec.includes('all') || d.rec.includes(PURPOSE_KEY[profile.purpose]) || d.rec.includes(CAT_KEY[profile.category])));
const baseOrder = (d) => { const i = FEATURED.indexOf(d.id); return i >= 0 ? i : 100 + d.no; };
const { search } = makeSearch(SERVICES, baseOrder);

function render() {
  const q = query.trim();
  const res = search(q);
  let list = res.list.filter((d) => cat === 'All' || d.cat === cat);
  if (!q) list.sort((a, b) => (profile ? isRec(b) - isRec(a) : 0) || baseOrder(a) - baseOrder(b));

  const scope = cat === 'All' ? 'in Amravati' : `in ${cat}`;
  $('resTitle').textContent = q
    ? `${list.length} result${list.length === 1 ? '' : 's'} for "${q}" ${scope}`
    : `${list.length} document${list.length === 1 ? '' : 's'} ${scope}`;
  $('resSub').textContent = res.loose && list.length
    ? 'No exact match, so these are the closest documents. Try a shorter word such as "ration", "income" or "water".'
    : profile && profile.purpose
      ? `Recommended first for: ${[profile.education, profile.purpose, profile.category].filter(Boolean).join(' • ')}. Tap a document to see the exact office, route and documents to carry.`
      : 'Tap a document to see the exact office, route and documents to carry.';

  const depts = new Set(list.map((d) => d.dept));
  const timed = list.filter((d) => d.min);
  $('stOffices').textContent = depts.size;
  $('stForms').textContent = list.length;
  $('stTime').textContent = timed.length ? `${Math.min(...timed.map((d) => d.min))}–${Math.max(...timed.map((d) => d.max))} days` : 'On your receipt';
  // Only 5 of the 138 documents carry a processing time, so say how many the range is based on.
  $('stTimeLbl').textContent = !timed.length ? 'Processing time' : timed.length === list.length ? 'Typical processing time' : `Time known for ${timed.length} of ${list.length}`;

  document.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat)); // the quick row AND the Filter panel
  syncFilterUi(list.length);

  const page = list.slice(0, shown);
  $('resGrid').innerHTML = list.length ? page.map((d) => docCardHTML(d, { recommended: isRec(d), star: starButtonHTML('doc', d.id) })).join('')
    : `<div class="card" style="grid-column:1/-1;padding:28px;text-align:center">
        <h3>No documents found for "${esc(q)}"</h3>
        <p class="desc" style="margin:8px 0 14px">Try another word such as Aadhaar, income, caste, ration, 7/12, licence or water.</p>
        <button type="button" class="btn btn-primary btn-sm" id="showAll">Show all documents</button></div>`;
  syncStars($('resGrid'));
  $('showAll')?.addEventListener('click', () => { query = ''; cat = 'All'; shown = PAGE; $('q').value = ''; history.replaceState(null, '', 'dashboard.html'); render(); });

  const rest = list.length - page.length;
  $('moreWrap').innerHTML = rest > 0 ? `<button type="button" class="btn btn-outline" id="moreBtn">Show more (${rest} remaining)</button>` : '';
  $('moreBtn')?.addEventListener('click', () => { shown += PAGE; render(); });
}

function syncUrl() {
  const p = new URLSearchParams();
  if (query.trim()) p.set('q', query.trim());
  if (cat !== 'All') p.set('cat', cat);
  history.replaceState(null, '', p.toString() ? '?' + p : 'dashboard.html');
}

// Category chips come from the data, so new categories appear automatically.
// The same chips are drawn twice - in the compact quick row and in the header Filter panel - and both drive the one `cat` state.
const chipsHTML = [{ name: 'All', icon: '' }, ...CATEGORIES].map((c) =>
  `<button type="button" class="chip-outline chip" data-cat="${esc(c.name)}">${c.icon ? c.icon + ' ' : ''}${esc(c.name)}</button>`).join('');
$('catRow').innerHTML = chipsHTML;
$('fpChips').innerHTML = chipsHTML;

function pickCategory(name, { fromPanel = false } = {}) {
  cat = name; shown = PAGE; syncUrl(); render();
  // The visitor may be far down the 138-document list: bring the filtered results into view.
  if (fromPanel) {
    const head = $('resTitle').closest('.results-head');
    if (head && head.getBoundingClientRect().top < 0) head.scrollIntoView({ block: 'start' });
  }
}
$('catRow').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) pickCategory(b.dataset.cat); });
$('fpChips').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) pickCategory(b.dataset.cat, { fromPanel: true }); });

/* ---------- Filter control (header, next to Home) ---------- */
const filterBtn = $('filterBtn'), panel = $('filterPanel');

function syncFilterUi(count) {
  const on = cat !== 'All';
  $('filterBadge').hidden = !on;
  filterBtn.classList.toggle('on', on || !panel.hidden);
  $('fpClear').disabled = !on;
  $('fpDone').textContent = `Show ${count} document${count === 1 ? '' : 's'}`;
}
function placePanel() {
  const header = document.querySelector('header.site');
  const top = (header ? header.getBoundingClientRect().bottom : 72) + 6;
  panel.style.top = top + 'px';
  panel.style.maxHeight = `calc(100vh - ${top + 12}px)`;
  if (window.innerWidth > 560) {
    const r = filterBtn.getBoundingClientRect();
    panel.style.left = Math.max(12, Math.min(r.left, window.innerWidth - panel.offsetWidth - 12)) + 'px';
  } else panel.style.left = ''; // phones: full-width sheet (CSS)
}
function openFilter() {
  panel.hidden = false;
  filterBtn.setAttribute('aria-expanded', 'true');
  filterBtn.classList.add('on');
  placePanel();
  (panel.querySelector('[data-cat].active') || panel).focus({ preventScroll: true });
}
function closeFilter(returnFocus = false) {
  if (panel.hidden) return;
  panel.hidden = true;
  filterBtn.setAttribute('aria-expanded', 'false');
  filterBtn.classList.toggle('on', cat !== 'All');
  if (returnFocus) filterBtn.focus();
}
filterBtn.addEventListener('click', () => (panel.hidden ? openFilter() : closeFilter()));
$('fpClose').addEventListener('click', () => closeFilter(true));
$('fpDone').addEventListener('click', () => { closeFilter(true); $('resTitle').closest('.results-head')?.scrollIntoView({ block: 'start' }); });
$('fpClear').addEventListener('click', () => pickCategory('All', { fromPanel: true }));
document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && !filterBtn.contains(e.target)) closeFilter(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) closeFilter(true); });
window.addEventListener('resize', () => { if (!panel.hidden) placePanel(); });

// On phones the header menu scrolls sideways and common.js centres the current tab; keep Home and Filter in view.
document.querySelector('nav.main')?.scrollTo({ left: 0 });

$('q').value = query;
$('searchForm').addEventListener('submit', (e) => { e.preventDefault(); query = $('q').value; shown = PAGE; syncUrl(); render(); });
let typing;
$('q').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { query = $('q').value; shown = PAGE; syncUrl(); render(); }, 180); });
render();
