import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { needsEmailVerification } from './lib/auth-validate.js';

export const LOGIN_PAGE = 'login.html';
export const HOME_PAGE = 'index.html';
export const PROFILE_PAGE = 'profile.html';

export const reveal = () => document.documentElement.classList.remove('auth-pending');

/** Resolves once with the signed-in user EXACTLY as Firebase restored it (even an unverified email account). Only login.js needs this. */
export const authReadyRaw = new Promise((resolve) => {
  if (!auth) return resolve(null);
  onAuthStateChanged(auth, (u) => resolve(u), () => resolve(null));
});

/**
 * Resolves once with the current user, or null. An email + password account whose email is not verified yet counts as
 * signed out everywhere (protected pages, public pages, search, downloads), so a made-up address can not get in.
 */
export const authReady = authReadyRaw.then(async (u) => {
  // Firebase restores the user as it was last saved: someone who verified in another tab or on their phone still shows
  // "unverified" until we ask the server once. Refresh the user and the sign-in token (Firestore reads the token) before deciding.
  if (needsEmailVerification(u)) {
    try { await u.reload(); if (u.emailVerified) await u.getIdToken(true); } catch (e) { console.warn('[Sarthi - X] Could not refresh the user:', e?.code); }
    if (!needsEmailVerification(u)) ensureUserDoc(u); // verified elsewhere: save the profile now (function below; runs after start-up)
  }
  return needsEmailVerification(u) ? null : u;
});

export const displayLabel = (u) => u?.displayName || u?.email || u?.phoneNumber || 'User';

/** Create/update users/{uid}. Never blocks login if Firestore is unavailable. */
export async function saveUserDoc(user, extra = {}) {
  if (!db || !user || needsEmailVerification(user)) return; // never create a profile for an unverified email
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    const data = {
      name: user.displayName || '',
      email: user.email || '',
      phone: user.phoneNumber || '',
      provider: user.providerData?.[0]?.providerId || 'phone',
      lastLoginAt: serverTimestamp(),
    };
    if (!snap.exists() || !snap.data()?.createdAt) data.createdAt = serverTimestamp();
    await setDoc(ref, { ...data, ...extra }, { merge: true });
  } catch (e) {
    console.warn('[Sarthi - X] Could not save user profile (check Firestore rules/database):', e);
  }
}

/**
 * Creates users/{uid} only when it is missing (one read, no write otherwise). For people who confirmed their email on another
 * device or tab and came back straight to the site, so they never passed through the log-in button that normally saves it.
 */
export async function ensureUserDoc(user) {
  if (!db || !user || needsEmailVerification(user)) return;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists() && snap.data()?.createdAt) return;
    await saveUserDoc(user);
  } catch (e) {
    console.warn('[Sarthi - X] Could not check the user profile:', e?.code || e);
  }
}

export function logout() {
  // The faster-loading copy of this user's stars / progress (src/userdata.js) must not stay on a shared device.
  try { Object.keys(localStorage).filter((k) => k.startsWith('sx_ud_')).forEach((k) => localStorage.removeItem(k)); } catch {}
  return signOut(auth).finally(() => location.replace(LOGIN_PAGE));
}

function mountUserMenu(user) {
  const label = displayLabel(user);
  const btn = document.querySelector('.btn-login2, .btn-login');

  if (!btn) {
    // Pages with a different header (e.g. documents list): add a Log out tab.
    const tabs = document.querySelector('nav.tabs');
    if (tabs) {
      const p = document.createElement('a');
      p.href = PROFILE_PAGE;
      p.textContent = 'Profile';
      tabs.appendChild(p);
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = 'Log out';
      a.addEventListener('click', (e) => { e.preventDefault(); logout(); });
      tabs.appendChild(a);
    }
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:inline-block';
  btn.parentNode.insertBefore(wrap, btn);
  wrap.appendChild(btn);
  btn.removeAttribute('href');
  btn.style.cursor = 'pointer';
  btn.textContent = '\uD83D\uDC64 ' + label.split(' ')[0].slice(0, 18);
  btn.setAttribute('data-no-translate', ''); // the visitor's name must never be sent to the translation service

  const menu = document.createElement('div');
  menu.style.cssText = 'position:absolute;right:0;top:46px;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(15,27,61,.18);padding:8px;min-width:210px;display:none;z-index:300;font-size:13px;color:var(--navy)';
  const info = document.createElement('div');
  info.style.cssText = 'padding:8px 10px;border-bottom:1px solid var(--line);margin-bottom:6px';
  info.setAttribute('data-no-translate', ''); // name + email/phone: never translated, so never sent to Google / MyMemory
  const n = document.createElement('div'); n.style.fontWeight = '700'; n.textContent = user.displayName || label;
  const e = document.createElement('div'); e.style.cssText = 'color:var(--ink-soft);font-size:12px;word-break:break-all'; e.textContent = user.email || user.phoneNumber || '';
  info.append(n, e);
  const prof = document.createElement('a'); // Profile: starred schemes / documents, expired documents (9.O Star version)
  prof.href = PROFILE_PAGE;
  prof.textContent = '\u2B50 Profile';
  prof.style.cssText = 'display:block;width:100%;text-align:left;padding:9px 10px;border-radius:8px;font:inherit;color:var(--navy);font-weight:600;text-decoration:none;box-sizing:border-box';
  prof.onmouseover = () => (prof.style.background = 'var(--blue-light)');
  prof.onmouseout = () => (prof.style.background = 'none');
  const out = document.createElement('button');
  out.type = 'button';
  out.textContent = 'Log out';
  out.style.cssText = 'width:100%;text-align:left;padding:9px 10px;border:0;background:none;border-radius:8px;cursor:pointer;font:inherit;color:var(--red);font-weight:600';
  out.onmouseover = () => (out.style.background = 'var(--red-bg)');
  out.onmouseout = () => (out.style.background = 'none');
  out.onclick = logout;
  menu.append(info, prof, out);
  wrap.appendChild(menu);
  btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; });
  document.addEventListener('click', () => (menu.style.display = 'none'));
}

let guard;
/** Protects a page: redirects to login if signed out, otherwise reveals the page. */
export function requireAuth() {
  guard ||= (async () => {
    const user = await authReady;
    if (!user) { location.replace(LOGIN_PAGE); return null; }
    reveal();
    mountUserMenu(user);
    // If the user signs out in another tab, send them to login.
    onAuthStateChanged(auth, (u) => { if (!u || needsEmailVerification(u)) location.replace(LOGIN_PAGE); });
    return user;
  })();
  return guard;
}

/**
 * Public pages (citizen guides): the page is shown to everyone. If the visitor happens to be signed in, the usual
 * user menu is mounted; if not, the Login button simply leads to the login page and, after login, back to this guide.
 * Nothing here redirects, so a guide link shared on WhatsApp opens straight away.
 */
const GUIDE_LINK = /^(guide\.html\?s=[a-z0-9-]+|doc-[a-z-]+\.html)$/; // same rule login.js applies to sx_next
let openGuard;
export function openPage() {
  openGuard ||= (async () => {
    const safety = setTimeout(reveal, 3000); // slow network: public information must not stay hidden waiting for the sign-in check
    const user = await authReady;
    clearTimeout(safety);
    reveal();
    if (user) { mountUserMenu(user); return user; }
    const btn = document.querySelector('.btn-login2, .btn-login');
    if (btn) {
      btn.setAttribute('href', LOGIN_PAGE);
      btn.addEventListener('click', () => {
        const page = location.pathname.split('/').pop().replace(/\.html$/, '') + '.html';
        const target = page === 'guide.html' ? page + location.search : page;
        try { if (GUIDE_LINK.test(target)) sessionStorage.setItem('sx_next', target); } catch {}
      });
    }
    return null;
  })();
  return openGuard;
}
