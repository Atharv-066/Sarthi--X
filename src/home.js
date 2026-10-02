// Home page: protects the page and saves the "Let's Get Started" answers.
import './common.js';
import { requireAuth } from './auth.js';
import { db } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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
      if (snap.exists() && snap.data().profile) fillForm(snap.data().profile);
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
    msg.textContent = 'Please select: ' + missing.join(', ');
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
  location.href = 'dashboard.html';
});
