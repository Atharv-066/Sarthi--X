// WhatsApp sharing: builds the message and the wa.me link. No network, no login, no custom integration.
// wa.me is WhatsApp's own share link: it opens the app on Android / iOS and WhatsApp Web / Desktop on a computer.

/** Canonical public address of a guide: origin + path + the ?s= guide id only (no tracking, no hash). */
export function canonicalUrl(href) {
  const u = new URL(href);
  const s = u.searchParams.get('s');
  u.search = '';
  u.hash = '';
  if (s) u.searchParams.set('s', s);
  return u.toString();
}

/**
 * Message text. Fee / processing time are included ONLY when the guide actually has them.
 * labels = { fee, time, view } (already in the reader's language).
 */
export function buildShareText({ title, fee, time, url }, labels = {}) {
  const L = { fee: 'Fees', time: 'Processing time', view: 'View the complete guide', ...labels };
  const lines = [String(title || '').trim()];
  const facts = [];
  if (fee && String(fee).trim()) facts.push(`${L.fee}: ${String(fee).trim()}`);
  if (time && String(time).trim()) facts.push(`${L.time}: ${String(time).trim()}`);
  if (facts.length) lines.push('', ...facts);
  lines.push('', `${L.view}:`, url);
  return lines.join('\n');
}

export const whatsappLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
