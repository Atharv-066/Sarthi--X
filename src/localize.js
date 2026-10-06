// Verified-translation layer for guides.
//
//   English            -> source text (always)
//   Marathi / Hindi    -> VERIFIED text if a reviewed pair exists and the English is unchanged
//                      -> otherwise the existing live translator (src/i18n.js + src/translator.js)
//
// Verified strings are looked up by i18n.js `tr()` BEFORE the cache and the live translator, so they never reach the
// translation API. getLocalizedGuide() tells a page how much of a guide is verified so it can say so honestly.
// No DOM and no Firebase in this file, so it can be unit-tested.

export const SCALAR_FIELDS = ['title', 'dept', 'portal', 'where', 'who', 'online', 'counter', 'd', 'important'];
export const LIST_FIELDS = ['carry', 'a', 'b', 'c'];
export const GUIDE_FIELDS = [...SCALAR_FIELDS, ...LIST_FIELDS];

const isPair = (p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string' && p[1].trim() !== '';
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));

/** A translation block counts as VERIFIED only when a reviewer and a review date are recorded. */
export const isReviewed = (block) => !!block && String(block.reviewedBy || '').trim() !== '' && isDate(block.reviewedOn);

let tablePromise;
async function loadTable() {
  tablePromise ||= import('./data/guide-translations.js').then((m) => m.GUIDE_TRANSLATIONS || {}).catch(() => ({}));
  return tablePromise;
}

/** All [English, translation] pairs of one reviewed block (fields + extra). */
export function pairsOf(block) {
  if (!isReviewed(block)) return [];
  const out = [];
  for (const v of Object.values(block.fields || {})) {
    if (isPair(v)) out.push(v);
    else if (Array.isArray(v)) v.forEach((p) => { if (isPair(p)) out.push(p); });
  }
  (block.extra || []).forEach((p) => { if (isPair(p)) out.push(p); });
  return out;
}

const mapCache = {};
/** Map English text -> verified translation for one language (all guides). Empty for English. */
export async function verifiedMap(lang, table) {
  if (lang === 'en') return new Map();
  if (!table && mapCache[lang]) return mapCache[lang];
  const t = table || (await loadTable());
  const map = new Map();
  for (const entry of Object.values(t)) for (const [en, tx] of pairsOf(entry?.[lang])) if (!map.has(en)) map.set(en, tx);
  if (!table) mapCache[lang] = map;
  return map;
}

/**
 * getLocalizedGuide(guide, 'mr')  ->  { guide, status, fields }
 *   guide  - a copy of the guide where every field with a verified, still-matching translation is replaced by it
 *   fields - { fieldName: 'verified' | 'live' }   ('live' = will be handled by the existing live translator)
 *   status - 'source' (English) | 'verified' (every field) | 'partial' | 'none'
 */
export async function getLocalizedGuide(guide, lang, table) {
  if (!guide || lang === 'en') return { guide, status: 'source', fields: {} };
  const t = table || (await loadTable());
  const block = t?.[guide.id]?.[lang];
  const out = { ...guide };
  const fields = {};
  const reviewed = isReviewed(block);

  for (const f of SCALAR_FIELDS) {
    if (guide[f] == null || guide[f] === '') continue;
    const pair = reviewed ? block.fields?.[f] : null;
    if (isPair(pair) && pair[0] === guide[f]) { out[f] = pair[1]; fields[f] = 'verified'; } else fields[f] = 'live';
  }
  for (const f of LIST_FIELDS) {
    const list = guide[f];
    if (!Array.isArray(list) || !list.length) continue;
    const pairs = reviewed ? block.fields?.[f] : null;
    const ok = Array.isArray(pairs) && pairs.length === list.length && pairs.every((p, i) => isPair(p) && p[0] === list[i]);
    if (ok) { out[f] = pairs.map((p) => p[1]); fields[f] = 'verified'; } else fields[f] = 'live';
  }
  const vals = Object.values(fields);
  const n = vals.filter((v) => v === 'verified').length;
  const status = !n ? 'none' : n === vals.length ? 'verified' : 'partial';
  return { guide: out, status, fields };
}

/** The reviewed translation block of one guide + language, or null (used to show an honest note on the page). */
export async function reviewedBlock(id, lang, table) {
  if (lang === 'en') return null;
  const t = table || (await loadTable());
  const block = t?.[id]?.[lang];
  return isReviewed(block) ? block : null;
}
