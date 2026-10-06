// Added to every document guide (guide.html and the hand-written doc-*.html pages) without changing their markup:
//   1. A Star button next to the title.
//   2. A checkbox on every step + a progress bar ("3 / 5 steps completed").
//   3. A small card where the user can note the expiry date of their own copy (shown in Profile -> Expired Documents).
// Steps are read from the page that is on screen, so nothing is duplicated and new guides get this automatically.
import { currentGuide, formatDate, parseDate } from './guide-meta.js';
import { getLang, tr } from './i18n.js';
import { subscribe, toggleStep, stepsDone, setExpiry, expiryOf, getState, rememberReturnPage } from './userdata.js';
import { starButtonHTML, syncStars } from './star-ui.js';
import { stepKey, progress, expiryStatus, toIso } from './lib/user-rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);
// Change the page only when the value is different (the page translator re-scans after every DOM write).
const setText = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
const setAttr = (el, k, v) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
const setHidden = (el, v) => { if (el && el.hidden !== v) el.hidden = v; };
const setHTML = (el, v) => { if (el && el.dataset.h !== v) { el.innerHTML = v; el.dataset.h = v; } };

/* ============ 1. Star next to the title ============ */
function mountStar(g) {
  const h1 = document.querySelector('.doc-hero h1');
  if (!h1 || h1.closest('.sx-title-row')) return;
  const row = document.createElement('div');
  row.className = 'sx-title-row';
  h1.replaceWith(row);
  row.append(h1);
  row.insertAdjacentHTML('beforeend', starButtonHTML('doc', g.id, { text: true }));
  syncStars(row);
}

/* ============ 2. Step checklist + progress ============ */
// guide.html has three step lists (Before you go / office / online); the office and online lists are alternatives, so progress counts
// "Before you go" plus the route that is open. The hand-written pages have one list.
function findGroups() {
  if ($('secA')) return [['a', $('secA')], ['b', $('secB')], ['c', $('secC')]].filter((x) => x[1]).map(([g, sec]) => ({ g, sec, steps: [...sec.querySelectorAll('.step')] }));
  const steps = [...document.querySelectorAll('.layout > div:first-child .step')];
  return steps.length ? [{ g: 'h', sec: null, steps }] : [];
}

const WORDS_EN = { done: 'Mark as done', undone: 'Mark as not done' };
let words = { ...WORDS_EN };

function mountChecklist(g) {
  const groups = findGroups();
  if (!groups.some((x) => x.steps.length)) return; // a document with no steps shows no checklist and no progress bar

  const items = []; // { key, el, btn, group }
  for (const grp of groups) {
    grp.steps.forEach((el, i) => {
      const card = el.querySelector('.step-card');
      if (!card || card.classList.contains('sx-has-check')) return;
      const key = stepKey(grp.g, i);
      const title = card.querySelector('h3, .g-item');
      if (title) title.id = title.id || `sx-t-${key}`;
      const body = document.createElement('div');
      body.className = 'sx-step-body';
      while (card.firstChild) body.appendChild(card.firstChild);
      body.insertAdjacentHTML('beforeend', '<div class="sx-done-row"><span class="sx-done-tag">Completed</span></div>');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sx-check';
      btn.id = `sx-c-${key}`;
      btn.setAttribute('role', 'checkbox');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('data-no-translate', ''); // its words are translated below, because they change with the state
      if (title) btn.setAttribute('aria-labelledby', `sx-c-${key} sx-t-${key}`);
      btn.innerHTML = '<span class="sx-box" aria-hidden="true">☐</span>';
      btn.addEventListener('click', () => toggleStep(g.id, key));
      card.classList.add('sx-has-check');
      card.append(btn, body);
      items.push({ key, el, btn, grp });
    });
  }
  if (!items.length) return;

  // Progress card, above the first step list.
  const host = document.querySelector('.layout > div:first-child');
  const card = document.createElement('div');
  card.className = 'card sx-progress';
  card.id = 'sxProgress';
  card.innerHTML = `
    <div class="sx-pg-head"><b class="sx-pg-title">Document Application Progress</b><span class="sx-pg-route" hidden></span></div>
    <div class="sx-pg-line"><span class="sx-pg-count" data-no-translate></span> <span>steps completed</span><span class="sx-pg-left" hidden> · <span data-no-translate></span> <span>incomplete</span></span></div>
    <div class="sx-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="sx-bar-fill"></span></div>
    <div class="sx-pg-foot"><span class="sx-pg-pct" data-no-translate>0%</span><span class="sx-pg-all" hidden>All steps completed. Well done!</span></div>
    <div class="sx-pg-note" role="status" hidden></div>`;
  // guide.html: after the route card (before "Before you go"). Hand-written pages: right under the "Step-by-step guide" heading.
  const anchor = host.querySelector('.route-card') || host.querySelector('.steps-title');
  anchor ? anchor.after(card) : host.prepend(card);

  const visible = () => items.filter((x) => !x.grp.sec || !x.grp.sec.hidden);

  function paint() {
    const done = stepsDone(g.id);
    const vis = visible();
    const p = progress(vis.map((x) => x.key), done);
    for (const x of items) {
      const on = done.has(x.key);
      if (x.el.classList.contains('sx-done') !== on) x.el.classList.toggle('sx-done', on);
      setAttr(x.btn, 'aria-checked', String(on));
      setText(x.btn.querySelector('.sx-box'), on ? '☑' : '☐');
      setAttr(x.btn, 'aria-label', on ? words.undone : words.done);
      setAttr(x.btn, 'title', on ? words.undone : words.done);
    }
    setHidden(card, p.total === 0);
    setText(card.querySelector('.sx-pg-count'), `${p.done} / ${p.total}`);
    const left = card.querySelector('.sx-pg-left');
    setHidden(left, p.done === 0 || p.done === p.total);
    setText(left.querySelector('[data-no-translate]'), String(p.total - p.done));
    setText(card.querySelector('.sx-pg-pct'), `${p.pct}%`);
    const w = `${p.pct}%`; const fill = card.querySelector('.sx-bar-fill'); if (fill.style.width !== w) fill.style.width = w;
    setAttr(card.querySelector('.sx-bar'), 'aria-valuenow', String(p.pct));
    const full = p.total > 0 && p.done === p.total;
    if (card.classList.contains('complete') !== full) card.classList.toggle('complete', full);
    setHidden(card.querySelector('.sx-pg-all'), !full);

    // Which route is being counted (guide.html only).
    const routeEl = card.querySelector('.sx-pg-route');
    const tabs = [...document.querySelectorAll('[data-tab]')];
    if (tabs.length) {
      const open = tabs.find((t) => t.classList.contains('active'));
      setHidden(routeEl, false);
      setText(routeEl, open?.dataset.tab === 'C' ? 'Online / portal route' : 'At the government office');
    }

    // Sign-in / loading problems, in the card (never a blank or broken box).
    const note = card.querySelector('.sx-pg-note');
    const st = getState().status;
    if (st === 'signedout') {
      if (!note.querySelector('a')) {
        note.innerHTML = '<a href="login.html" class="sx-login-link">Log in to save your progress</a>';
        note.querySelector('a').addEventListener('click', rememberReturnPage);
      }
      setHidden(note, false);
    } else if (st === 'error') {
      note.querySelector('a')?.remove();
      setText(note, 'Your saved progress could not be loaded. Check your connection and reload the page.');
      setHidden(note, false);
    } else if (!note.hidden) { note.textContent = ''; setHidden(note, true); }
  }

  async function loadWords() {
    const out = await tr([WORDS_EN.done, WORDS_EN.undone], getLang());
    words = { done: out[0], undone: out[1] };
    paint();
  }

  subscribe(paint);
  document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => queueMicrotask(paint))); // office <-> online switch
  document.addEventListener('sx:langchange', loadWords);
  if (getLang() !== 'en') loadWords();
}

/* ============ 3. Expiry date of the user's own copy ============ */
function mountExpiry(g) {
  const side = document.querySelector('.layout > div:nth-child(2)');
  if (!side || $('sxExpiry')) return;
  const card = document.createElement('div');
  card.className = 'card side-card sx-expiry';
  card.id = 'sxExpiry';
  card.innerHTML = `
    <h4>📅 Expiry date of my copy</h4>
    <p class="sx-hint">Optional. If your copy of this document has an expiry date, add it here. Once that day has passed, it is listed under Expired Documents in your Profile.</p>
    <div class="sx-exp-row">
      <input type="date" id="sxExpDate" min="1990-01-01" max="2100-12-31" aria-label="Expiry date">
      <button type="button" class="btn btn-primary btn-sm" id="sxExpSave">Save date</button>
      <button type="button" class="btn btn-outline btn-sm" id="sxExpClear" hidden>Remove</button>
    </div>
    <div class="sx-exp-status" id="sxExpStatus" role="status"></div>`;
  const firstCard = side.querySelector('.side-card');
  firstCard ? firstCard.after(card) : side.prepend(card); // after "Documents to carry"

  const input = $('sxExpDate'), save = $('sxExpSave'), clear = $('sxExpClear'), status = $('sxExpStatus');
  let busy = false, dirty = false;
  input.addEventListener('input', () => { dirty = true; });

  function say(html, bad = false) {
    if (status.classList.contains('bad') !== bad) status.classList.toggle('bad', bad);
    setHTML(status, html);
  }

  function paint() {
    const st = getState().status;
    const iso = expiryOf(g.id);
    if (!dirty) input.value = iso; // never overwrite a date the visitor is typing
    setHidden(clear, !iso);
    if (st === 'signedout') { say('<a href="login.html" class="sx-login-link">Log in to save the expiry date</a>'); status.querySelector('a')?.addEventListener('click', rememberReturnPage); return; }
    if (!iso) { say(''); return; }
    const s = expiryStatus(iso);
    const when = `<span>Expiry date:</span> <span data-no-translate>${esc(formatDate(parseDate(iso), getLang()))}</span>`;
    if (s.state === 'expired') say(`<span class="sx-tag bad">Expired</span> ${when} · <span data-no-translate>${-s.days}</span> <span>days ago</span>`, true);
    else if (s.state === 'soon') say(`<span class="sx-tag warn">Expiring soon</span> ${when} · <span data-no-translate>${s.days}</span> <span>days left</span>`);
    else say(`<span class="sx-tag ok">Valid</span> ${when}`);
  }

  save.addEventListener('click', async () => {
    if (busy) return;
    const iso = toIso(input.value);
    if (!iso) { say('Please choose a valid expiry date.', true); return; }
    busy = true; save.disabled = true;
    const ok = await setExpiry(g.id, iso);
    busy = false; save.disabled = false;
    if (ok) { dirty = false; paint(); }
  });
  clear.addEventListener('click', async () => {
    if (busy) return;
    busy = true; clear.disabled = true;
    const ok = await setExpiry(g.id, '');
    busy = false; clear.disabled = false;
    if (ok) { dirty = false; input.value = ''; paint(); }
  });
  subscribe(paint);
  document.addEventListener('sx:langchange', paint);
}

export function mountDocExtras() {
  const g = currentGuide();
  if (!g) return;
  mountStar(g);
  mountChecklist(g);
  mountExpiry(g);
}
