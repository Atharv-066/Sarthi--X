// "Report wrong information": a small dialog that stores a report in Firestore (collection `information_reports`).
//  * Works for signed-out visitors (reporting must be easy); firestore.rules allow CREATE only, never read/update/delete.
//  * Uses the native <dialog> element: focus is trapped inside, Esc closes it, and focus returns to the button afterwards.
//  * Text is written in English; the page-wide translator (src/i18n.js) and the hand-written entries in translations.js
//    show it in Marathi / Hindi.
import { db } from './firebase.js';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ISSUE_LABELS, LIMITS, validateReport } from './lib/report-rules.js';
import { canonicalUrl } from './lib/share.js';

export const REPORT_COLLECTION = 'information_reports';
const TIMEOUT_MS = 15000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sent = new Set();   // fingerprints of reports already stored in this browser session (double-click / re-open protection)
let attempt = null;       // { fp, ref, timedOut } - lets a retry after a timeout reuse the same document id
let inFlight = false;

const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'sx/timeout' })), ms)),
]);

function friendlyError(e) {
  switch (e?.code) {
    case 'sx/timeout':
    case 'unavailable':
    case 'deadline-exceeded':
      return 'The report could not be sent because the connection is slow or offline. Please check your internet and press Submit again.';
    case 'permission-denied':
      return 'Sorry, this report could not be accepted. Please check what you wrote and try again.';
    case 'resource-exhausted':
      return 'Too many reports were sent just now. Please try again in a few minutes.';
    default:
      return 'Something went wrong and your report was not sent. Please try again.';
  }
}

function template(ctx) {
  const uid = 'rd' + Math.random().toString(36).slice(2, 7);
  return `
  <form class="sx-dlg-form" novalidate>
    <div class="sx-dlg-head">
      <h2 id="${uid}-t">Report wrong information</h2>
      <button type="button" class="sx-dlg-x" data-close aria-label="Close this form">&#10005;</button>
    </div>
    <div class="sx-dlg-body" data-body>
      <p class="sx-dlg-guide">Document: <b>${esc(ctx.guideTitle)}</b></p>

      <div class="sx-field">
        <label for="${uid}-type">What is wrong? <span class="sx-req" aria-hidden="true">*</span></label>
        <select id="${uid}-type" name="issueType" required aria-describedby="${uid}-type-e">
          <option value="">Choose one</option>
          ${ISSUE_LABELS.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}
        </select>
        <div class="sx-err" id="${uid}-type-e" role="alert"></div>
      </div>

      <div class="sx-field">
        <label for="${uid}-desc">Describe the problem <span class="sx-req" aria-hidden="true">*</span></label>
        <textarea id="${uid}-desc" name="description" rows="5" maxlength="${LIMITS.descMax}" required aria-describedby="${uid}-desc-h ${uid}-desc-e"></textarea>
        <div class="sx-hint" id="${uid}-desc-h">Tell us what the guide says and what is correct, if you know. Please do not write Aadhaar, PAN or bank numbers.</div>
        <div class="sx-err" id="${uid}-desc-e" role="alert"></div>
      </div>

      <div class="sx-field">
        <label for="${uid}-contact">Phone or email (optional)</label>
        <input id="${uid}-contact" name="contact" type="text" maxlength="${LIMITS.contactMax}" autocomplete="off" aria-describedby="${uid}-contact-h ${uid}-contact-e">
        <div class="sx-hint" id="${uid}-contact-h">Only fill this if you want us to contact you about this report.</div>
        <div class="sx-err" id="${uid}-contact-e" role="alert"></div>
      </div>

      <div class="sx-hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

      <div class="sx-msg" data-msg role="status" aria-live="polite"></div>
    </div>
    <div class="sx-dlg-foot" data-foot>
      <button type="button" class="btn btn-outline btn-sm" data-close>Cancel</button>
      <button type="submit" class="btn btn-primary btn-sm" data-submit>Submit report</button>
    </div>
  </form>`;
}

/** Open the report dialog. ctx = { guideId, guideTitle }. opener = the element to give focus back to. */
export function openReport(ctx, opener) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sx-dialog';
  dlg.innerHTML = template(ctx);
  document.body.appendChild(dlg);
  const $ = (sel) => dlg.querySelector(sel);
  const form = $('form');
  const msg = $('[data-msg]');
  const submitBtn = $('[data-submit]');
  const fieldOf = { issueType: 'type', description: 'desc', contact: 'contact' };
  const nameOf = { issueType: 'issueType', description: 'description', contact: 'contact' };

  const showErrors = (errors) => {
    for (const [k, id] of Object.entries(fieldOf)) {
      const box = dlg.querySelector(`[id$="-${id}-e"]`);
      const input = form.elements[nameOf[k]];
      box.textContent = errors[k] || '';
      input.toggleAttribute('aria-invalid', !!errors[k]);
    }
    const first = Object.keys(fieldOf).find((k) => errors[k]);
    if (first) form.elements[nameOf[first]].focus();
  };
  const setMsg = (text, kind) => { msg.textContent = text || ''; msg.dataset.kind = kind || ''; };

  const close = () => {
    document.documentElement.classList.remove('sx-modal-open');
    if (dlg.open && dlg.close) dlg.close();
    dlg.remove();
    if (opener?.isConnected) opener.focus();
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });                 // Esc
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });                 // click on the dark backdrop
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

  function thanks() {
    $('[data-body]').innerHTML = '<p class="sx-thanks" tabindex="-1" data-thanks>Thank you. Your report has been submitted.</p>';
    $('[data-foot]').innerHTML = '<button type="button" class="btn btn-primary btn-sm" data-close>Close</button>';
    dlg.querySelector('[data-thanks]').focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (inFlight) return; // accidental double click
    const values = { issueType: form.elements.issueType.value, description: form.elements.description.value, contact: form.elements.contact.value };
    const res = validateReport(values, {
      guideId: ctx.guideId, guideTitle: ctx.guideTitle, pageUrl: canonicalUrl(location.href), language: document.documentElement.lang || 'en',
    });
    showErrors(res.errors);
    setMsg('');
    if (!res.ok) { if (res.errors.guideId) setMsg(res.errors.guideId, 'error'); return; }

    if (form.elements.website.value) { thanks(); return; } // hidden trap field filled in: a bot. Pretend success, store nothing.
    const fp = [res.value.guideId, res.value.issueType, res.value.description].join('|');
    if (sent.has(fp)) { thanks(); return; }                 // identical report already stored in this session

    if (!db) { setMsg('Reporting is not available right now. Please try again later.', 'error'); return; }
    if (navigator.onLine === false) { setMsg(friendlyError({ code: 'unavailable' }), 'error'); return; }

    inFlight = true;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.textContent = 'Submitting…';
    setMsg('Sending your report…', 'info');
    if (!attempt || attempt.fp !== fp) attempt = { fp, ref: doc(collection(db, REPORT_COLLECTION)), timedOut: false };
    try {
      // serverTimestamp(): the time is set by Firestore, not by this device's clock.
      await withTimeout(setDoc(attempt.ref, { ...res.value, createdAt: serverTimestamp() }), TIMEOUT_MS);
      sent.add(fp);
      attempt = null;
      thanks();
    } catch (err) {
      if (err?.code === 'sx/timeout') attempt.timedOut = true;
      // A retry after a timeout reuses the same document id. If the first (queued) write already landed, the second one
      // is rejected as an update: that means the report IS stored.
      if (err?.code === 'permission-denied' && attempt?.timedOut) { sent.add(fp); attempt = null; thanks(); }
      else { console.warn('[Sarthi - X] Report failed:', err); setMsg(friendlyError(err), 'error'); }
    } finally {
      inFlight = false;
      if (submitBtn.isConnected) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.textContent = 'Submit report'; }
    }
  });

  document.documentElement.classList.add('sx-modal-open');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  form.elements.issueType.focus();
}
