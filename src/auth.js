import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export const LOGIN_PAGE = 'login.html';
export const HOME_PAGE = 'index.html';

export const reveal = () => document.documentElement.classList.remove('auth-pending');

/** Resolves once with the current user (or null) after Firebase restores the session. */
export const authReady = new Promise((resolve) => {
  if (!auth) return resolve(null);
  onAuthStateChanged(auth, (u) => resolve(u), () => resolve(null));
});

export const displayLabel = (u) => u?.displayName || u?.email || u?.phoneNumber || 'User';

/** Create/update users/{uid}. Never blocks login if Firestore is unavailable. */
export async function saveUserDoc(user, extra = {}) {
  if (!db || !user) return;
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
    if (!snap.exists()) data.createdAt = serverTimestamp();
    await setDoc(ref, { ...data, ...extra }, { merge: true });
  } catch (e) {
    console.warn('[Sarthi - X] Could not save user profile (check Firestore rules/database):', e);
  }
}

export function logout() {
  return signOut(auth).finally(() => location.replace(LOGIN_PAGE));
}

function mountUserMenu(user) {
  const label = displayLabel(user);
  const btn = document.querySelector('.btn-login2, .btn-login');

  if (!btn) {
    // Pages with a different header (e.g. documents list): add a Log out tab.
    const tabs = document.querySelector('nav.tabs');
    if (tabs) {
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

  const menu = document.createElement('div');
  menu.style.cssText = 'position:absolute;right:0;top:46px;background:#fff;border:1px solid #E4E9F2;border-radius:12px;box-shadow:0 8px 24px rgba(15,27,61,.12);padding:8px;min-width:210px;display:none;z-index:300;font-size:13px;color:#0F1B3D';
  const info = document.createElement('div');
  info.style.cssText = 'padding:8px 10px;border-bottom:1px solid #EEF1F7;margin-bottom:6px';
  const n = document.createElement('div'); n.style.fontWeight = '700'; n.textContent = user.displayName || label;
  const e = document.createElement('div'); e.style.cssText = 'color:#5B6478;font-size:12px;word-break:break-all'; e.textContent = user.email || user.phoneNumber || '';
  info.append(n, e);
  const out = document.createElement('button');
  out.type = 'button';
  out.textContent = 'Log out';
  out.style.cssText = 'width:100%;text-align:left;padding:9px 10px;border:0;background:none;border-radius:8px;cursor:pointer;font:inherit;color:#EF4444;font-weight:600';
  out.onmouseover = () => (out.style.background = '#FFF0F0');
  out.onmouseout = () => (out.style.background = 'none');
  out.onclick = logout;
  menu.append(info, out);
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
    onAuthStateChanged(auth, (u) => { if (!u) location.replace(LOGIN_PAGE); });
    return user;
  })();
  return guard;
}
