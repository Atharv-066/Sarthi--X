/* Sarthi - X service worker (hand-written; the project has no PWA plugin).
 *
 * WHAT IT DOES
 *   - Pages (HTML):            network first, with the last copy as a fallback when the network is slow or down.
 *   - /assets/* (hashed files): cache first. File names change whenever the content changes, so this is safe.
 *   - Icons / manifest:        stale-while-revalidate.
 * WHAT IT NEVER TOUCHES
 *   - Anything on another origin: Firebase (Auth, Firestore), Google translate, MyMemory, Google Fonts.
 *   - Non-GET requests and /__/ (Firebase auth handler).
 *   So user data, sign-in and live translation are never stored by this file.
 *
 * Guide content is bundled in the JavaScript, so a guide opened once while online can be opened again on a weak or lost
 * connection. Sign-in, saving the profile, reports and live translation of new text still need internet.
 */
const VERSION = 'sx-v10'; // bumped in 10.0 so the Linguistic Minority view and the corrected translations replace the saved copies
const PAGES = `${VERSION}-pages`;
const FILES = `${VERSION}-files`;
const MAX_PAGES = 40;
const MAX_FILES = 120;
const NET_TIMEOUT = 4000; // ms before a slow network gives way to the saved page

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([PAGES, FILES]);
    for (const k of await caches.keys()) if (k.startsWith('sx-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function pageStrategy(req) {
  const cache = await caches.open(PAGES);
  const net = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic' && !res.redirected) { cache.put(req, res.clone()).then(() => trim(PAGES, MAX_PAGES)); }
    return res;
  });
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), NET_TIMEOUT))]);
  } catch {
    const hit = await cache.match(req, { ignoreSearch: false }) || await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await net; } catch {
      return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;padding:24px;max-width:560px;margin:auto"><h1>No internet connection</h1><p>This page was not opened before, so it is not saved on your phone. Please connect to the internet and try again.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') { cache.put(req, res.clone()).then(() => trim(FILES, MAX_FILES)); }
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Firebase, translation services, fonts: not ours to cache
  if (url.pathname.startsWith('/__/')) return;            // Firebase auth handler
  if (url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') { e.respondWith(pageStrategy(req)); return; }
  if (url.pathname.startsWith('/assets/')) { e.respondWith(cacheFirst(req)); return; }
  if (/\.(?:png|svg|webmanifest|ico)$/.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req)); }
});
