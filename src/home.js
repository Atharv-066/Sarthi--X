// Home page: protects the page and saves the "Let's Get Started" answers.
import './common.js';
import { requireAuth } from './auth.js';
import { db } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { tr } from './i18n.js';

const $ = (id) => document.getElementById(id);
const fields = { education: 'fEducation', city: 'fCity', purpose: 'fPurpose', category: 'fCategory' };
let currentUser = null;

function setSelect(id, value) {
  const el = $(id);
  if (el && value && [...el.options].some((o) => o.value === value || o.text === value)) el.value = value;
}

function fillForm(p) {
  if (!p) return;
  for (const [k, id] of Object.entries(fields)) setSelect(id, p[k]);
}

// Message line under the button
const btn = $('analyzeBtn');
const msg = document.createElement('div');
msg.style.cssText = 'color:#B42318;font-size:12.5px;margin-top:10px;text-align:center;display:none';
btn?.insertAdjacentElement('afterend', msg);

requireAuth().then(async (user) => {
  currentUser = user;
  if (!user) return;
  try { fillForm(JSON.parse(sessionStorage.getItem('sx_profile'))); } catch {}
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists() && snap.data().profile) {
        const saved = snap.data().profile;
        fillForm(saved);
        // Keep the saved answers for the Schemes / Documents pages too (they read sx_profile), without the Firestore timestamp.
        try {
          const keep = {};
          for (const k of Object.keys(fields)) if (typeof saved[k] === 'string') keep[k] = saved[k];
          if (!sessionStorage.getItem('sx_profile')) sessionStorage.setItem('sx_profile', JSON.stringify(keep));
        } catch {}
      }
    } catch (e) { console.warn('[Sarthi - X] Could not load saved profile:', e); }
  }
});

btn?.addEventListener('click', async () => {
  if (!currentUser) return;
  const profile = {};
  for (const [k, id] of Object.entries(fields)) profile[k] = $(id).value.trim();

  const missing = [];
  if (!profile.education) missing.push('Education Level');
  if (!profile.purpose) missing.push('Purpose');
  if (!profile.category) missing.push('Category');
  if (missing.length) {
    // Translated word by word (every part is already in the Marathi / Hindi dictionary), so it also works offline.
    const [lead, ...names] = await tr(['Please select:', ...missing]);
    msg.textContent = lead + ' ' + names.join(', ');
    msg.style.display = 'block';
    return;
  }
  msg.style.display = 'none';
  btn.disabled = true;

  try { sessionStorage.setItem('sx_profile', JSON.stringify(profile)); } catch {}
  if (db) {
    const save = setDoc(doc(db, 'users', currentUser.uid), { profile: { ...profile, updatedAt: serverTimestamp() } }, { merge: true })
      .catch((e) => console.warn('[Sarthi - X] Could not save profile:', e));
    // Don't make the user wait on a slow network.
    await Promise.race([save, new Promise((r) => setTimeout(r, 2500))]);
  }
  // Students looking for a scholarship go straight to the schemes list; everyone else to the document search.
  location.href = profile.purpose === 'Scholarship' ? 'schemes.html' : 'dashboard.html';
});

// Hero counters: real numbers read from the data files, counted up from 0.
// data-source="services" -> number of documents guides, "schemes" -> number of student schemes.
import { SERVICES } from './data/services-index.js';

function countUp(el, to) {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => Math.round(n).toLocaleString('en-IN');
  el.dataset.count = String(to);
  if (reduce) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1200;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(to * (1 - Math.pow(1 - k, 3))); // ease-out
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
document.querySelectorAll('[data-source="services"]').forEach((el) => countUp(el, SERVICES.length));
const schemeEls = document.querySelectorAll('[data-source="schemes"]');
if (schemeEls.length) import('./data/schemes.js').then((m) => schemeEls.forEach((el) => countUp(el, m.SCHEMES.length))).catch(() => {});
