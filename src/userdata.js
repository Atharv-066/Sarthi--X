// Per-user saved data (Star / Save, step checklist, document expiry) - 9.O Star version.
//
// ONE store for every page. It lives in the user's existing Firestore document users/{uid} (the same document the home-page
// profile uses, protected by the existing rules), so there is no second database, model or login:
//   starredSchemes, starredDocs, steps, docExpiry   (shape + validation: src/lib/user-rules.js)
//
// How it behaves
//  * onSnapshot keeps every open page and tab in sync: star on Search, see it in Profile at once; unstar in Profile, it is
//    unstarred everywhere.
//  * A change shows on screen immediately (optimistic) and is saved with arrayUnion / arrayRemove, so saving the same item twice,
//    rapid clicks, and two devices working at the same time can never duplicate or erase each other's data.
//  * If saving fails the screen goes back to the saved state and a message is shown. A slow network gets a "taking longer" note.
//  * A copy of the data is kept in localStorage under sx_ud_<uid> only to paint the page faster. Logging out removes it
//    (src/auth.js), and it is never read for any other uid.
import { db } from './firebase.js';
import { authReady } from './auth.js';
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { toast } from './i18n.js';
import { readUserData, applyOp, EMPTY, FIELDS, cleanId, cleanStep, toIso } from './lib/user-rules.js';

export const CACHE_PREFIX = 'sx_ud_';
const SLOW_MS = 8000;

const state = { status: 'loading', user: null, data: EMPTY }; // status: loading | ready | signedout | error
const subs = new Set();
let ref = null;
let unsub = null;
let settle;
export const ready = new Promise((r) => { settle = r; });

const cacheKey = () => CACHE_PREFIX + state.user.uid;
function saveCache() {
  try { if (state.user) localStorage.setItem(cacheKey(), JSON.stringify(state.data)); } catch {}
}
function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey());
    return raw ? readUserData(JSON.parse(raw)) : null; // nothing stored = null, so the page waits for the real data instead of showing "empty"
  } catch { return null; }
}

function emit() {
  for (const fn of [...subs]) { try { fn(state); } catch (e) { console.warn('[Sarthi - X] userdata listener failed:', e); } }
  document.dispatchEvent(new CustomEvent('sx:userdata', { detail: { status: state.status } }));
}
function set(status, data) {
  state.status = status;
  if (data) state.data = data;
  if (status !== 'loading') settle(state);
  emit();
}

/** Listen for changes. The function is called once straight away with the current state. Returns an "unsubscribe" function. */
export function subscribe(fn) {
  subs.add(fn);
  try { fn(state); } catch (e) { console.warn(e); }
  return () => subs.delete(fn);
}

function listen() {
  unsub?.();
  unsub = onSnapshot(ref, (snap) => {
    // Opened offline for the first time: "no document" from the cache does not mean "no stars". Keep what we painted from the cache.
    if (!snap.exists() && snap.metadata.fromCache && state.status !== 'loading') return;
    const data = readUserData(snap.data());
    state.data = data; saveCache();
    set('ready');
  }, (err) => {
    console.warn('[Sarthi - X] Could not load saved items:', err?.code || err);
    // Keep showing the cached copy if we have one; only report an error when there is nothing to show.
    set(state.status === 'ready' ? 'ready' : 'error');
  });
}

/** Try again after an error (Profile "Try again" button). */
export function retry() {
  if (!ref) return;
  set('loading');
  listen();
}

(async () => {
  let user = null;
  try { user = await authReady; } catch {}
  state.user = user;
  if (!user || !db) { set('signedout', EMPTY); return; }
  ref = doc(db, 'users', user.uid);
  const cached = loadCache();
  if (cached) { state.data = cached; set('ready'); } // instant paint; the live data replaces it a moment later
  listen();
})();

/* ---------- reading ---------- */
export const getState = () => state;
export const isStarred = (kind, id) => (kind === 'scheme' ? state.data.schemes : state.data.docs).includes(cleanId(kind, id));
export const stepsDone = (gid) => new Set(state.data.steps[cleanId('doc', gid)] || []);
export const expiryOf = (id) => state.data.expiry[cleanId('doc', id)] || '';
export const isSignedIn = () => !!state.user;

/* ---------- saving ---------- */
/** After login the visitor should come back to the guide they were on (same rule login.js applies to sx_next). */
export function rememberReturnPage() {
  try {
    const page = location.pathname.split('/').pop().replace(/\.html$/, '') + '.html';
    const target = page === 'guide.html' ? page + location.search : page;
    if (/^(guide\.html\?s=[a-z0-9-]+|doc-[a-z-]+\.html)$/.test(target)) sessionStorage.setItem('sx_next', target);
  } catch {}
}
function needLogin() {
  toast('Log in to star items, tick steps and save your progress.');
  rememberReturnPage();
}

/** Apply `op` on screen now, save `payload`, and undo the on-screen change with `undo` if saving fails. */
async function write(payload, op, undo) {
  state.data = applyOp(state.data, op);
  saveCache();
  emit();
  let slow = setTimeout(() => toast('Saving is taking longer than usual. Your change will be saved when the connection is back.'), SLOW_MS);
  try {
    await setDoc(ref, payload, { merge: true });
    return true;
  } catch (e) {
    console.warn('[Sarthi - X] Could not save:', e?.code || e);
    state.data = applyOp(state.data, undo);
    saveCache();
    emit();
    toast('Could not save your change. Please check your connection and try again.');
    return false;
  } finally { clearTimeout(slow); }
}

/** Common checks before any save. Returns false (and tells the user why) when saving is not possible right now. */
async function canSave() {
  await ready;
  if (!state.user) { needLogin(); return false; }
  if (state.status === 'error') { toast('Your saved items could not be loaded. Please check your connection and reload the page.'); return false; }
  return true;
}

/** Star or unstar. Resolves to the new state (true = starred), or null when nothing was changed. */
export async function toggleStar(kind, id) {
  const cid = cleanId(kind, id);
  if (!cid || !(await canSave())) return null;
  const on = !isStarred(kind, cid);
  const op = { type: 'star', kind, id: cid, on };
  const ok = await write({ [FIELDS[kind]]: on ? arrayUnion(cid) : arrayRemove(cid) }, op, { ...op, on: !on });
  return ok ? on : null;
}

/** Tick or untick one step of one guide. Resolves to the new state, or null when nothing was changed. */
export async function toggleStep(gid, key) {
  const id = cleanId('doc', gid), k = cleanStep(key);
  if (!id || !k || !(await canSave())) return null;
  const on = !stepsDone(id).has(k);
  const op = { type: 'step', id, key: k, on };
  const ok = await write({ [FIELDS.steps]: { [id]: on ? arrayUnion(k) : arrayRemove(k) } }, op, { ...op, on: !on });
  return ok ? on : null;
}

/** Save (iso = a date) or clear (iso = '') the expiry date of the user's own copy of a document. Resolves to true / false. */
export async function setExpiry(gid, iso) {
  const id = cleanId('doc', gid);
  const clean = iso ? toIso(iso) : '';
  if (!id || (iso && !clean) || !(await canSave())) return false;
  const before = expiryOf(id);
  return write(
    { [FIELDS.expiry]: { [id]: clean || deleteField() } },
    { type: 'expiry', id, iso: clean },
    { type: 'expiry', id, iso: before },
  );
}
