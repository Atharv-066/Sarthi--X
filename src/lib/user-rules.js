// Pure rules for the Star / Save, Step checklist and Expiry features (9.O Star version).
// No Firebase, no DOM: src/userdata.js stores the data, this file decides what is valid and what it means.
//
// Everything lives in the user's EXISTING document users/{uid} (same document the home-page profile uses):
//   starredSchemes : ["12", "40"]                      scheme numbers (SCHEMES[].no) as strings
//   starredDocs    : ["income-certificate", ...]       service ids (SERVICES[].id)
//   steps          : { "income-certificate": ["a1", "b2"] }   completed step keys per guide
//   docExpiry      : { "aadhaar-card": "2027-03-31" }   expiry date (YYYY-MM-DD) of the user's own copy
import { parseDate } from '../guide-meta.js'; // the app's existing date parser (ISO or "15 September 2026")

export const FIELDS = { scheme: 'starredSchemes', doc: 'starredDocs', steps: 'steps', expiry: 'docExpiry' };
export const EMPTY = Object.freeze({ schemes: [], docs: [], steps: {}, expiry: {} });
export const SOON_DAYS = 30;

const DOC_ID = /^[a-z0-9-]{1,100}$/;      // same rule as firestore.rules uses for guide ids
const SCHEME_ID = /^[1-9]\d{0,3}$/;
const STEP_KEY = /^[a-z]\d{1,3}$/;

/** A valid id for this kind, or '' (never throws, never trusts stored data). */
export function cleanId(kind, id) {
  const s = String(id ?? '').trim();
  if (kind === 'scheme') return SCHEME_ID.test(s) ? s : '';
  if (kind === 'doc') return DOC_ID.test(s) ? s : '';
  return '';
}
export const cleanStep = (k) => (STEP_KEY.test(String(k ?? '')) ? String(k) : '');
export const stepKey = (group, index) => `${group}${index + 1}`; // ("b", 0) -> "b1"

const uniq = (a) => [...new Set(a)];
const list = (v, fn) => (Array.isArray(v) ? uniq(v.map(fn).filter(Boolean)) : []);

/** Turn whatever Firestore returned into a clean, predictable object. Bad entries are dropped, never thrown. */
export function readUserData(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const steps = {};
  if (r.steps && typeof r.steps === 'object') {
    for (const [gid, keys] of Object.entries(r.steps)) {
      const id = cleanId('doc', gid);
      const ks = list(keys, cleanStep);
      if (id && ks.length) steps[id] = ks;
    }
  }
  const expiry = {};
  if (r.docExpiry && typeof r.docExpiry === 'object') {
    for (const [gid, iso] of Object.entries(r.docExpiry)) {
      const id = cleanId('doc', gid);
      if (id && toIso(iso)) expiry[id] = toIso(iso);
    }
  }
  return {
    schemes: list(r[FIELDS.scheme], (x) => cleanId('scheme', x)),
    docs: list(r[FIELDS.doc], (x) => cleanId('doc', x)),
    steps,
    expiry,
  };
}

/** Apply one change to a data object and return a NEW object (used for instant on-screen updates and for undoing a failed save). */
export function applyOp(data, op) {
  const d = readUserData({ starredSchemes: data.schemes, starredDocs: data.docs, steps: data.steps, docExpiry: data.expiry });
  if (op.type === 'star') {
    const id = cleanId(op.kind, op.id);
    if (!id) return d;
    const key = op.kind === 'scheme' ? 'schemes' : 'docs';
    const has = d[key].includes(id);
    if (op.on && !has) d[key].push(id);            // starring twice changes nothing
    if (!op.on && has) d[key] = d[key].filter((x) => x !== id);
  } else if (op.type === 'step') {
    const id = cleanId('doc', op.id), k = cleanStep(op.key);
    if (!id || !k) return d;
    const cur = new Set(d.steps[id] || []);
    op.on ? cur.add(k) : cur.delete(k);
    if (cur.size) d.steps[id] = [...cur]; else delete d.steps[id];
  } else if (op.type === 'expiry') {
    const id = cleanId('doc', op.id);
    if (!id) return d;
    const iso = op.iso ? toIso(op.iso) : '';
    if (iso) d.expiry[id] = iso; else delete d.expiry[id];
  }
  return d;
}

/* ---------- progress ---------- */
/** { done, total, pct } for a list of step keys the page currently shows. Keys that are not on screen are never counted. */
export function progress(visibleKeys, doneKeys) {
  const keys = uniq(visibleKeys);
  const done = new Set(doneKeys || []);
  const n = keys.filter((k) => done.has(k)).length;
  return { done: n, total: keys.length, pct: keys.length ? Math.round((n / keys.length) * 100) : 0 };
}

/* ---------- expiry ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Normalise a date to "YYYY-MM-DD" (or '' when it is not a real date between 1990 and 2100). */
export function toIso(v) {
  const d = parseDate(v);
  return d && d.getFullYear() >= 1990 && d.getFullYear() <= 2100 ? isoOf(d) : '';
}

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Status of a document by its expiry date. A document is valid THROUGH its expiry day and expired from the next day.
 *   state: 'expired' | 'soon' (within SOON_DAYS) | 'valid' | 'invalid'
 *   days : whole days until expiry (negative = days since it expired)
 */
export function expiryStatus(iso, now = new Date()) {
  const d = parseDate(iso);
  if (!d) return { state: 'invalid', days: 0 };
  const days = Math.round((dayStart(d) - dayStart(now)) / 86400000);
  return { state: days < 0 ? 'expired' : days <= SOON_DAYS ? 'soon' : 'valid', days };
}

/** Split tracked documents into expired and still-valid lists, soonest first. `expiry` is { docId: iso }. */
export function groupExpiry(expiry, now = new Date()) {
  const rows = Object.entries(expiry || {}).map(([id, iso]) => ({ id, iso, ...expiryStatus(iso, now) })).filter((r) => r.state !== 'invalid');
  const byDate = (a, b) => a.days - b.days;
  return {
    expired: rows.filter((r) => r.state === 'expired').sort((a, b) => b.days - a.days), // most recently expired first
    active: rows.filter((r) => r.state !== 'expired').sort(byDate),
  };
}
