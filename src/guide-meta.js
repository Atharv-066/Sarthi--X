// Which guide is open, and its trust information (official source + last verified). Shared by guide-actions.js and download.js.
// Nothing is invented: a value is returned only when the data really contains it.
import { SERVICES, GUIDE_META } from './data/services-index.js';
import { FORM_PORTALS } from './forms.js';

const slug = () => location.pathname.split('/').pop().replace(/\.html$/, '');
export const isGenericGuide = () => slug() === 'guide';

/** The service record of the page that is open (from the light index), or null. */
export function currentGuide() {
  if (isGenericGuide()) {
    const id = new URLSearchParams(location.search).get('s') || '';
    return SERVICES.find((x) => x.id === id) || null;
  }
  return SERVICES.find((x) => x.href && x.href.replace(/\.html$/, '') === slug()) || null;
}

const hrefSlug = (g) => (g?.href ? g.href.replace(/\.html$/, '') : '');
const safeUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.toString() : ''; } catch { return ''; } };

/** Official source: the guide's own `officialSource` if it has one, else the verified portal listed in forms.js. */
export function officialSourceOf(g) {
  return safeUrl(g?.officialSource) || safeUrl(FORM_PORTALS[hrefSlug(g)]?.url);
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** Accepts "2026-09-15" or "15 September 2026". Returns a Date or null. */
export function parseDate(v) {
  const t = String(v || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? d : null; }
  m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const mo = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return mo >= 0 ? new Date(+m[3], mo, +m[1]) : null;
}
export const formatDate = (d, lang = 'en') => (d ? d.toLocaleDateString(lang === 'en' ? 'en-GB' : `${lang}-IN`, { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Last verified: the guide's own `lastVerified` (YYYY-MM-DD) if it has one, else the date of the whole guide edition (GUIDE_META). */
export const lastVerifiedDate = (g) => parseDate(g?.lastVerified) || parseDate(GUIDE_META?.verified);
export const lastVerifiedOf = (g, lang = 'en') => formatDate(lastVerifiedDate(g), lang);
