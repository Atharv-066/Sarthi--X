// Profile page (9.O Star version): Starred Schemes, Starred Documents, Expired Documents.
// Nothing is stored here. Everything is read from the user's saved data (src/userdata.js) and from the existing scheme and document
// data, so it can never disagree with the Star buttons on the other pages.
import './common.js';
import { requireAuth, displayLabel } from './auth.js';
import { SERVICES } from './data/services-index.js';
import { SCHEMES, SCHEME_GROUPS } from './data/schemes.js';
import { linkOf, esc } from './doccard.js';
import { formatDate, parseDate } from './guide-meta.js';
import { getLang } from './i18n.js';
import { subscribe, retry, setExpiry, getState } from './userdata.js';
import { starButtonHTML, syncStars } from './star-ui.js';
import { groupExpiry } from './lib/user-rules.js';

const $ = (id) => document.getElementById(id);
const svcById = new Map(SERVICES.map((s) => [s.id, s]));
const schemeByNo = new Map(SCHEMES.map((s) => [String(s.no), s]));
const groupOf = (s) => (SCHEME_GROUPS[s.g - 1] || '').replace(/\s*Schemes?$/i, '');
const dateText = (iso) => esc(formatDate(parseDate(iso), getLang()));

/* ---------- small pieces ---------- */
const empty = (icon, title, hint, href, cta) => `
  <div class="pf-empty">
    <div class="pf-empty-ic" aria-hidden="true">${icon}</div>
    <b>${title}</b>
    <span>${hint}</span>
    ${href ? `<a class="btn btn-outline btn-sm" href="${href}">${cta}</a>` : ''}
  </div>`;

const gone = (what, action) => `
  <div class="card pf-row pf-gone">
    <div class="icon-badge ib-amber">⚠️</div>
    <div class="pf-main"><span class="pf-title">${what}</span><div class="pf-sub">It may have been removed or renamed.</div></div>
    <div class="pf-actions">${action}</div>
  </div>`;

function schemeRow(no) {
  const s = schemeByNo.get(no);
  if (!s) return gone('This scheme is no longer available', starButtonHTML('scheme', no, { toast: true }));
  const href = `schemes.html?scheme=${s.no}`;
  return `
  <div class="card pf-row">
    <div class="icon-badge ib-purple">🎓</div>
    <div class="pf-main">
      <a class="pf-title" href="${href}">${esc(s.title)}</a>
      <div class="pf-sub">${esc(groupOf(s))} · <span data-no-translate>#${s.no}</span></div>
    </div>
    <div class="pf-actions">
      <a class="btn btn-outline btn-sm" href="${href}">View details →</a>
      ${starButtonHTML('scheme', s.no, { toast: true })}
    </div>
  </div>`;
}

function docRow(id, expiryById) {
  const d = svcById.get(id);
  if (!d) return gone('This document is no longer available', starButtonHTML('doc', id, { toast: true }));
  const href = esc(linkOf(d));
  const x = expiryById.get(id);
  const tag = x ? ` · ${statusTag(x)}` : '';
  return `
  <div class="card pf-row">
    <div class="icon-badge ${esc(d.badge)}">${d.icon}</div>
    <div class="pf-main">
      <a class="pf-title" href="${href}">${esc(d.title)}</a>
      <div class="pf-sub">${esc(d.cat)} · ${esc(d.dept)}${tag}</div>
    </div>
    <div class="pf-actions">
      <a class="btn btn-outline btn-sm" href="${href}">View details →</a>
      ${starButtonHTML('doc', d.id, { toast: true })}
    </div>
  </div>`;
}

function statusTag(r) {
  if (r.state === 'expired') return '<span class="sx-tag bad">Expired</span>';
  if (r.state === 'soon') return '<span class="sx-tag warn">Expiring soon</span>';
  return '<span class="sx-tag ok">Valid</span>';
}

function expiryRow(r) {
  const d = svcById.get(r.id);
  const when = `<span>Expiry date:</span> <span data-no-translate>${dateText(r.iso)}</span>`;
  const left = r.state === 'expired'
    ? `<span data-no-translate>${-r.days}</span> <span>days ago</span>`
    : `<span data-no-translate>${r.days}</span> <span>days left</span>`;
  const stop = `<button type="button" class="btn btn-outline btn-sm" data-stop="${esc(r.id)}">Stop tracking</button>`;
  if (!d) return gone('This document is no longer available', stop);
  const href = esc(linkOf(d));
  return `
  <div class="card pf-row${r.state === 'expired' ? ' pf-expired' : ''}">
    <div class="icon-badge ${esc(d.badge)}">${d.icon}</div>
    <div class="pf-main">
      <a class="pf-title" href="${href}">${esc(d.title)}</a>
      <div class="pf-sub">${statusTag(r)} ${when} · ${left}</div>
    </div>
    <div class="pf-actions">
      <a class="btn btn-outline btn-sm" href="${href}">View details →</a>
      ${stop}
    </div>
  </div>`;
}

/* ---------- page ---------- */
const NO_DATA = 'Add an expiry date on a document\'s page and it will be checked here every day.';

let lastKey = '';
function render(state = getState(), force = false) {
  // Ticking a step or starring on another tab changes saved data this page does not show: skip the rebuild (it re-triggers translation).
  const key = JSON.stringify([state.status, getLang(), state.data.schemes, state.data.docs, state.data.expiry, new Date().toDateString()]);
  if (!force && key === lastKey) return;
  lastKey = key;
  const box = $('pfState');
  const lists = ['pfSchemes', 'pfDocs', 'pfExpired', 'pfActive'].map($);
  if (state.status === 'loading') {
    box.hidden = false; box.className = 'pf-state'; box.textContent = 'Loading your saved items…';
    lists.forEach((l) => { l.innerHTML = ''; });
    return;
  }
  if (state.status === 'error' || state.status === 'signedout') {
    box.hidden = false; box.className = 'pf-state bad';
    box.innerHTML = `<span>We could not load your saved items. Check your internet connection and try again.</span> <button type="button" class="btn btn-primary btn-sm" id="pfRetry">Try again</button>`;
    lists.forEach((l) => { l.innerHTML = ''; });
    $('pfRetry').addEventListener('click', () => (state.status === 'error' ? retry() : location.reload()));
    return;
  }
  box.hidden = true; box.textContent = '';

  const { schemes, docs, expiry } = state.data;
  const groups = groupExpiry(expiry);
  const byId = new Map([...groups.expired, ...groups.active].map((r) => [r.id, r]));

  $('pfSchemeN').textContent = String(schemes.length);
  $('pfDocN').textContent = String(docs.length);
  $('pfSchemes').innerHTML = schemes.length
    ? [...schemes].reverse().map(schemeRow).join('') // newest star first
    : empty('☆', 'No starred schemes yet', 'Tap the ☆ on any scheme to keep it here.', 'schemes.html', 'Browse schemes →');
  $('pfDocs').innerHTML = docs.length
    ? [...docs].reverse().map((id) => docRow(id, byId)).join('')
    : empty('☆', 'No starred documents yet', 'Tap the ☆ on any document to keep it here.', 'dashboard.html', 'Browse documents →');

  $('pfExpired').innerHTML = groups.expired.length
    ? groups.expired.map(expiryRow).join('')
    : empty('✅', 'No expired documents', NO_DATA, groups.active.length ? '' : 'dashboard.html', 'Browse documents →');

  $('pfActiveWrap').hidden = !groups.active.length;
  $('pfActiveN').textContent = String(groups.active.length);
  $('pfActive').innerHTML = groups.active.map(expiryRow).join('');

  syncStars(document.querySelector('main'));
}

// "Stop tracking" (clears the expiry date only; the document and its stars are untouched).
document.addEventListener('click', async (e) => {
  const b = e.target.closest?.('[data-stop]');
  if (!b || b.disabled) return;
  b.disabled = true;
  const ok = await setExpiry(b.dataset.stop, '');
  if (!ok) b.disabled = false; // saving failed: the message is already shown, the row stays
});

requireAuth().then((u) => {
  if (!u) return;
  const who = $('pfWho');
  who.textContent = [u.displayName, u.email || u.phoneNumber].filter(Boolean).join(' · ') || displayLabel(u);
});

subscribe(render);
document.addEventListener('sx:langchange', () => render(getState(), true));

// A document expires at midnight: if the page stays open past it, update the lists.
let day = new Date().toDateString();
setInterval(() => { const n = new Date().toDateString(); if (n !== day) { day = n; render(getState(), true); } }, 60000);
