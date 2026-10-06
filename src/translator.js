// Keyless translation engine for Sarthi - X (English -> Marathi / Hindi / any language code).
// Replaces the old Bhashini client. NO API KEY, NO ACCOUNT, NO .env VALUES are needed.
//
// Providers, tried in this order for every batch:
//   0. YOUR OWN endpoint, only if VITE_TRANSLATE_ENDPOINT is set in .env (optional, see README).
//   1. Google Translate web endpoint (translate.googleapis.com, client=gtx)  - fast, good Marathi/Hindi.
//   2. MyMemory (api.mymemory.translated.net)                                - fallback, small free daily quota.
//
// Public API:  translateTexts(texts, target) -> Promise<string[]>   (same length as `texts`)
//              A string that could not be translated comes back unchanged (English), never as an error,
//              unless EVERY provider failed - then the promise rejects so the caller can show a notice.
//
// Notes
//  * Short strings are sent several per request (joined with a line break) and the answer is verified
//    line-by-line; if the count does not match, they are re-sent one by one. This keeps the number of
//    requests low even on a page with hundreds of scheme names / descriptions.
//  * Long texts (scheme descriptions, guide paragraphs) are split at sentence ends before sending.
//  * At most MAX_PARALLEL requests run at once, so the service is not hammered.

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const OWN_ENDPOINT = String(env.VITE_TRANSLATE_ENDPOINT || '').trim();

const GTX_URL = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

const MAX_PARALLEL = 5;
const BATCH_CHARS = 1800;   // max characters per batched request
const BATCH_ITEMS = 25;     // max strings per batched request
const PIECE_CHARS = 1200;   // longer strings are split into pieces of at most this size
const MYMEMORY_CHARS = 450; // MyMemory accepts at most ~500 bytes per query
const TIMEOUT_MS = 15000;

export const translatorInfo = { own: !!OWN_ENDPOINT };

/* ---------- tiny concurrency gate ---------- */
let running = 0;
const waiting = [];
function gate() {
  if (running < MAX_PARALLEL) { running++; return Promise.resolve(); }
  return new Promise((res) => waiting.push(res)).then(() => { running++; });
}
function release() {
  running--;
  const next = waiting.shift();
  if (next) next();
}
async function limited(fn) {
  await gate();
  try { return await fn(); } finally { release(); }
}

/* ---------- fetch helpers ---------- */
async function request(url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry once on rate-limit / server errors / network blips. */
async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    const retryable = !e.status || e.status === 429 || e.status >= 500;
    if (!retryable) throw e;
    await sleep(600 + Math.random() * 400);
    return await fn();
  }
}

/* ---------- provider 0: your own endpoint (optional) ---------- */
// Contract:  POST { texts: string[], source: 'en', target: 'mr' }  ->  { translations: string[] }
async function viaOwn(texts, target) {
  const data = await request(OWN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, source: 'en', target }),
  });
  const out = data?.translations;
  if (!Array.isArray(out) || out.length !== texts.length) throw new Error('Own endpoint returned an unexpected result');
  return out.map((o, i) => (typeof o === 'string' && o.trim() ? o : texts[i]));
}

/* ---------- provider 1: Google web endpoint (keyless) ---------- */
// POST (form-encoded, so the browser sends it as a "simple" request: no CORS preflight, no length limit of a URL).
async function gtxRaw(text, target) {
  const data = await request(`${GTX_URL}?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&dj=0`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'q=' + encodeURIComponent(text),
  });
  const segs = data?.[0];
  if (!Array.isArray(segs)) throw new Error('Unexpected Google response');
  return segs.map((s) => (s && typeof s[0] === 'string' ? s[0] : '')).join('');
}

/** Translate one string (any length) with Google. */
async function gtxOne(text, target) {
  const pieces = splitLong(text, PIECE_CHARS);
  const out = [];
  for (const p of pieces) out.push(await withRetry(() => limited(() => gtxRaw(p, target))));
  return out.join(' ').trim();
}

/** Translate several short strings in ONE request; verify the line count; fall back to one-by-one. */
async function gtxBatch(texts, target) {
  if (texts.length === 1) return [await gtxOne(texts[0], target)];
  const joined = texts.join('\n');
  try {
    const raw = await withRetry(() => limited(() => gtxRaw(joined, target)));
    const lines = raw.split('\n').map((l) => l.trim());
    // Drop empty trailing line the service sometimes adds.
    while (lines.length > texts.length && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === texts.length && lines.every((l) => l)) return lines;
  } catch (e) {
    if (e.status === 403 || e.status === 429) throw e; // blocked / throttled: do not multiply the requests
  }
  const out = [];
  for (const t of texts) out.push(await gtxOne(t, target)); // sequential per batch; batches themselves run in parallel
  return out;
}

/* ---------- provider 2: MyMemory (keyless fallback) ---------- */
async function myMemoryOne(text, target) {
  const pieces = splitLong(text, MYMEMORY_CHARS);
  const out = [];
  for (const p of pieces) {
    const data = await withRetry(() => limited(() => request(`${MYMEMORY_URL}?q=${encodeURIComponent(p)}&langpair=${encodeURIComponent('en|' + target)}`)));
    const t = data?.responseData?.translatedText;
    const ok = String(data?.responseStatus) === '200' && typeof t === 'string' && t.trim() && !/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t);
    if (!ok) throw new Error('MyMemory refused: ' + (data?.responseDetails || data?.responseStatus));
    out.push(t);
  }
  return out.join(' ').trim();
}

/* ---------- splitting ---------- */
/** Split at sentence ends (. ! ? ।), then at spaces, so no piece is longer than `max`. */
function splitLong(text, max) {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?।]+[.!?।]+["')\]]*\s*|[^.!?।]+$/g) || [text];
  const pieces = [];
  let cur = '';
  const push = () => { if (cur.trim()) pieces.push(cur.trim()); cur = ''; };
  for (const s of sentences) {
    if ((cur + s).length <= max) { cur += s; continue; }
    push();
    if (s.length <= max) { cur = s; continue; }
    // one huge sentence: cut at spaces
    for (const w of s.split(/(\s+)/)) {
      if ((cur + w).length > max) push();
      if (w.length > max) { // an unbroken run (e.g. a long URL): hard cut
        for (let i = 0; i < w.length; i += max) pieces.push(w.slice(i, i + max));
        continue;
      }
      cur += w;
    }
  }
  push();
  return pieces;
}

/** Group strings into batches that respect BATCH_CHARS / BATCH_ITEMS. Long strings travel alone. */
function makeBatches(texts) {
  const batches = [];
  let cur = [];
  let size = 0;
  for (const t of texts) {
    if (t.length > 600) { if (cur.length) batches.push(cur); batches.push([t]); cur = []; size = 0; continue; }
    if (cur.length >= BATCH_ITEMS || size + t.length > BATCH_CHARS) { batches.push(cur); cur = []; size = 0; }
    cur.push(t); size += t.length + 1;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/* ---------- public ---------- */
async function translateBatch(batch, target) {
  const errors = [];
  if (OWN_ENDPOINT) {
    try { return await viaOwn(batch, target); } catch (e) { errors.push(e); }
  }
  try {
    return await gtxBatch(batch, target);
  } catch (e) { errors.push(e); }
  try {
    const out = [];
    for (const t of batch) out.push(await myMemoryOne(t, target));
    return out;
  } catch (e) { errors.push(e); }
  throw Object.assign(new Error('All translation providers failed'), { errors });
}

/**
 * Translate an array of English strings into `target` (e.g. 'mr', 'hi').
 * Returns an array of the same length. Strings a provider leaves empty stay English.
 * Rejects only when EVERY provider failed for ALL batches. On a partial failure the returned array has a
 * non-enumerable `failedTexts` Set listing the strings that stayed English.
 */
export async function translateTexts(texts, target) {
  const unique = [...new Set(texts)];
  const batches = makeBatches(unique);
  const results = await Promise.allSettled(batches.map((b) => translateBatch(b, target)));
  const map = new Map();
  const failedTexts = new Set();
  results.forEach((r, bi) => {
    if (r.status === 'fulfilled') batches[bi].forEach((t, i) => map.set(t, r.value[i] && r.value[i].trim() ? r.value[i] : t));
    else batches[bi].forEach((t) => failedTexts.add(t));
  });
  if (batches.length && failedTexts.size === unique.length) throw results.find((r) => r.status === 'rejected').reason;
  const out = texts.map((t) => (map.has(t) ? map.get(t) : t));
  // Strings of a failed batch stay English; `failedTexts` lets the caller skip caching them and retry later.
  Object.defineProperty(out, 'failedTexts', { value: failedTexts, enumerable: false });
  return out;
}

// Exposed for tests.
export const _internals = { splitLong, makeBatches };
