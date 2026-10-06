// npm run validate-data   -> checks guide, scheme and minority data. Exit code 1 only if there are ERRORs (warnings never fail).
// Add --strict to also fail on warnings.   Safe to run before every deploy: it only reads files.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
const load = (p) => import(pathToFileURL(resolve(p)).href);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isUrl = (v) => { try { return /^https?:$/.test(new URL(v).protocol); } catch { return false; } };
const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const isLongDate = (v) => { const m = String(v).match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/); return !!m && MONTHS.includes(m[2].toLowerCase()) && +m[1] >= 1 && +m[1] <= 31; };
const dups = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').trim();

/* ================= GUIDES ================= */
const { SERVICES, CATEGORIES, GUIDE_META } = await load('src/data/services.js');
const idx = await load('src/data/services-index.js');
const catNames = new Set(CATEGORIES.map((c) => c.name));
const ids = SERVICES.map((s) => s.id);
for (const d of new Set(dups(ids))) err(`guide ${d} has a duplicate ID`);
for (const d of new Set(dups(SERVICES.map((s) => s.no)))) err(`guide number ${d} is used more than once`);
for (const d of new Set(dups(SERVICES.map((s) => norm(s.title))))) err(`two guides share the title "${d}" (IDs should differ AND titles should be distinguishable)`);
const SCALARS = ['title', 'cat', 'dept', 'portal', 'where', 'who', 'online', 'counter', 'd'];
for (const s of SERVICES) {
  const t = s.id || `#${s.no}`;
  if (!isStr(s.id)) err(`guide #${s.no} has no ID`);
  else if (!/^[a-z0-9-]+$/.test(s.id)) err(`guide ${t} has an ID with characters other than a-z, 0-9 and "-" (the report rules need this)`);
  if (!isStr(s.title)) err(`guide ${t} has no title`);
  for (const f of SCALARS.slice(1)) if (!isStr(s[f])) err(`guide ${t} has an empty "${f}"`);
  if (isStr(s.cat) && !catNames.has(s.cat)) err(`guide ${t} has an unknown category "${s.cat}"`);
  for (const f of ['carry', 'a', 'b', 'c']) {
    if (!Array.isArray(s[f])) err(`guide ${t}: "${f}" is not a list`);
    else if (s[f].some((x) => !isStr(x))) err(`guide ${t}: "${f}" contains an empty item`);
  }
  if (Array.isArray(s.carry) && !s.carry.length) warn(`guide ${t} has no required-document information (carry)`);
  if (s.href && !/^doc-[a-z-]+\.html$/.test(s.href)) err(`guide ${t} has a malformed href "${s.href}"`);
  if ((s.min != null || s.max != null) && !(Number.isFinite(s.min) && Number.isFinite(s.max) && s.min >= 0 && s.min <= s.max)) err(`guide ${t} has an invalid processing time (min ${s.min}, max ${s.max})`);
  if (s.officialSource != null) { if (!isUrl(s.officialSource)) err(`guide ${t} has a malformed officialSource "${s.officialSource}"`); } else warn(`guide ${t} has no officialSource`);
  if (s.lastVerified != null) { if (!isIsoDate(String(s.lastVerified))) err(`guide ${t} has an invalid lastVerified "${s.lastVerified}" (use YYYY-MM-DD)`); } else warn(`guide ${t} has no lastVerified date`);
}
if (!isLongDate(GUIDE_META?.verified)) err(`GUIDE_META.verified "${GUIDE_META?.verified}" is not a date like "2 October 2026"`);
if (GUIDE_META?.count !== SERVICES.length) warn(`GUIDE_META.count is ${GUIDE_META?.count} but there are ${SERVICES.length} guides`);
// the light index must agree with the full file
if (idx.SERVICES.length !== SERVICES.length) err(`services-index.js has ${idx.SERVICES.length} guides but services.js has ${SERVICES.length}; run the data build`);
else for (const s of SERVICES) { const i = idx.SERVICES.find((x) => x.id === s.id); if (!i) err(`guide ${s.id} is missing from services-index.js`); else if (i.title !== s.title) err(`guide ${s.id}: title differs between services.js and services-index.js`); }
if (idx.GUIDE_META?.verified !== GUIDE_META.verified) err('GUIDE_META differs between services.js and services-index.js');

/* ================= VERIFIED TRANSLATIONS ================= */
const gt = await load('src/data/guide-translations.js');
const loc = await load('src/localize.js');
const byId = new Map(SERVICES.map((s) => [s.id, s]));
for (const id of gt.PRIORITY_GUIDES) if (!byId.has(id)) err(`PRIORITY_GUIDES lists unknown guide "${id}"`);
for (const d of new Set(dups(gt.PRIORITY_GUIDES))) err(`PRIORITY_GUIDES lists "${d}" twice`);
for (const [id, entry] of Object.entries(gt.GUIDE_TRANSLATIONS)) {
  const g = byId.get(id);
  if (!g) { err(`verified translation for unknown guide "${id}"`); continue; }
  for (const lang of Object.keys(entry)) {
    const b = entry[lang];
    if (!['mr', 'hi'].includes(lang)) { err(`translation of ${id}: unknown language "${lang}"`); continue; }
    if (!loc.isReviewed(b)) { warn(`translation ${id}/${lang} is a DRAFT (no reviewedBy / reviewedOn) and is ignored`); continue; }
    for (const [f, v] of Object.entries(b.fields || {})) {
      if (!loc.GUIDE_FIELDS.includes(f)) { err(`translation ${id}/${lang}: unknown field "${f}"`); continue; }
      if (loc.LIST_FIELDS.includes(f)) {
        if (!Array.isArray(g[f]) || !Array.isArray(v) || v.length !== g[f].length) err(`translation ${id}/${lang}/${f}: needs exactly ${g[f]?.length} pairs, has ${Array.isArray(v) ? v.length : 'none'}`);
        else v.forEach((p, i) => { if (!Array.isArray(p) || typeof p[1] !== 'string' || !p[1].trim()) err(`translation ${id}/${lang}/${f}[${i}] is empty`); else if (p[0] !== g[f][i]) warn(`translation ${id}/${lang}/${f}[${i}] is STALE (the English changed since it was reviewed) and is ignored`); });
      } else if (!Array.isArray(v) || typeof v[1] !== 'string' || !v[1].trim()) err(`translation ${id}/${lang}/${f} is empty`);
      else if (v[0] !== g[f]) warn(`translation ${id}/${lang}/${f} is STALE (the English changed since it was reviewed) and is ignored`);
    }
  }
}
for (const lang of ['mr', 'hi']) {
  const done = gt.PRIORITY_GUIDES.filter((id) => loc.isReviewed(gt.GUIDE_TRANSLATIONS[id]?.[lang]));
  warn(`verified ${lang === 'mr' ? 'Marathi' : 'Hindi'} translations: ${done.length} of ${gt.PRIORITY_GUIDES.length} priority guides`);
}

/* ================= SCHEMES ================= */
const { SCHEMES, SCHEME_GROUPS } = await load('src/data/schemes.js');
const OK = {
  cats: ['all', 'sc', 'st', 'vjnt', 'obc', 'sbc', 'maratha', 'ews', 'open', 'minority'],
  sp: ['girls', 'pwd', 'wards', 'workers', 'orphan'],
  lv: ['school', 'junior', 'diploma', 'ug', 'pg', 'phd', 'prof', 'exam', 'skill', 'abroad'],
  kind: ['scholarship', 'fee', 'fellowship', 'hostel', 'coaching', 'loan', 'grant'],
  by: ['state', 'central', 'uni', 'civic', 'private'],
  need: ['need', 'merit', 'open'],
};
for (const d of new Set(dups(SCHEMES.map((s) => s.no)))) err(`scheme number ${d} is used more than once`);
for (const d of new Set(dups(SCHEMES.map((s) => norm(s.title))))) warn(`scheme title "${d}" appears more than once (check that these are really different schemes)`);
for (const s of SCHEMES) {
  const t = `scheme #${s.no}`;
  if (!Number.isInteger(s.no)) err(`${t} has no valid number`);
  if (!isStr(s.title)) err(`${t} has no title`);
  if (!Number.isInteger(s.g) || s.g < 1 || s.g > SCHEME_GROUPS.length) err(`${t} has an invalid group "${s.g}"`);
  for (const f of ['cats', 'sp', 'lv', 'kind']) {
    if (!Array.isArray(s[f])) { err(`${t}: "${f}" is not a list`); continue; }
    for (const v of s[f]) if (!OK[f].includes(v)) err(`${t} has an invalid ${f} value "${v}"`);
  }
  if (Array.isArray(s.cats) && !s.cats.length) err(`${t} has no category (cats)`);
  if (!OK.by.includes(s.by)) err(`${t} has an invalid "by" value "${s.by}"`);
  if (!OK.need.includes(s.need)) err(`${t} has an invalid "need" value "${s.need}"`);
}

/* ================= MINORITY ================= */
const { RELIGIONS } = await load('src/data/minority.js');
for (const d of new Set(dups(RELIGIONS.map((r) => r.id)))) err(`religion ${d} has a duplicate ID`);
for (const r of RELIGIONS) {
  if (!isStr(r.id) || !isStr(r.name)) err(`a religion entry has no id or name`);
  if (!Array.isArray(r.sections) || !r.sections.length) { err(`religion ${r.id} has no sections`); continue; }
  for (const sec of r.sections) {
    if (!isStr(sec.title)) err(`religion ${r.id} has a section without a title`);
    if (!Array.isArray(sec.items) || !sec.items.length) warn(`religion ${r.id}, section "${sec.title}" has no items`);
    else for (const it of sec.items) if (!isStr(it.t)) err(`religion ${r.id}, section "${sec.title}" has an item without a name`);
  }
}

/* ================= LINGUISTIC MINORITY (10.0) ================= */
const LING = await load('src/data/linguistic.js');
const { LINGUISTIC, LING_COMMON, LING_TRIBAL, LING_DICT } = LING;
for (const d of new Set(dups(LINGUISTIC.map((l) => l.id)))) err(`language ${d} has a duplicate ID`);
const lingNames = [];
for (const sec of [...LING_COMMON, ...LING_TRIBAL]) {
  if (!isStr(sec.title) || !isStr(sec.kind)) err('a linguistic section has no title or kind');
  if (!Array.isArray(sec.items) || !sec.items.length) warn(`linguistic section "${sec.title}" has no items`);
  else for (const it of sec.items) { if (!isStr(it.t)) err(`linguistic section "${sec.title}" has an item without a name`); else lingNames.push(it.t); }
}
for (const d of new Set(dups(lingNames))) err(`linguistic scheme "${d}" is listed twice`);
for (const l of LINGUISTIC) if (!l.sections.length) err(`language ${l.id} has no schemes`);
for (const lang of ['mr', 'hi']) {
  const missing = lingNames.filter((n) => !LING_DICT[lang][n] && !LING_DICT[lang][n.replace(/ \(.*\)$/, '')]);
  if (missing.length) warn(`${missing.length} linguistic scheme names have no ${lang} text (they are shown in English)`);
}

/* ================= REPORT ================= */
const sum = (a) => a.length;
const strict = process.argv.includes('--strict');
const GUIDE_WARN = /^guide .* has no (officialSource|lastVerified)/;
const guideMeta = warnings.filter((w) => GUIDE_WARN.test(w));
const others = warnings.filter((w) => !GUIDE_WARN.test(w));
for (const e of errors) console.log('ERROR:   ' + e);
for (const w of others) console.log('WARNING: ' + w);
if (guideMeta.length) {
  const verbose = process.argv.includes('--verbose');
  const src = guideMeta.filter((w) => /officialSource/.test(w)).length, ver = guideMeta.filter((w) => /lastVerified/.test(w)).length;
  if (verbose) guideMeta.forEach((w) => console.log('WARNING: ' + w));
  else console.log(`WARNING: ${src} guides have no officialSource and ${ver} have no lastVerified date (the page then shows the edition date, or nothing). Use --verbose to list them.`);
}
console.log(`\nChecked ${SERVICES.length} guides, ${SCHEMES.length} schemes, ${RELIGIONS.length} religious minority groups, ${LINGUISTIC.length} languages (${lingNames.length} linguistic scheme names).`);
console.log(`${sum(errors)} error(s), ${sum(warnings)} warning(s).`);
process.exit(errors.length || (strict && warnings.length) ? 1 : 0);
