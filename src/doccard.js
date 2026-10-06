// Shared by the dashboard (dashboard.js) and the Log in / Sign up page (finder.js):
//  * docCardHTML()  - the ONE document card (same markup the dashboard has always used)
//  * makeSearch()   - the ONE document search (word-start matching over title, category, department, keywords)
// Moved out of dashboard.js without changing behaviour, so the two pages can never drift apart.

// Friendly one-liners for the five documents that have a hand-written detail page.
export const DESC = {
  'aadhaar-card': 'Update your address, name, or enrol for the first time.',
  'age-nationality-domicile-certificate': 'Proof of residence for state-quota admissions.',
  'caste-certificate': 'Required for reserved-category admission & scholarships.',
  'income-certificate': 'Needed for scholarships, EWS, and fee concessions.',
  'birth-certificate': 'Original or duplicate copy from municipal records.',
};

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const linkOf = (d) => d.href || `guide.html?s=${encodeURIComponent(d.id)}`;

/**
 * One document card.
 * opts.recommended - show the "Recommended for you" star (dashboard only)
 * opts.guideAttr   - extra attribute(s) for the guide link, e.g. 'data-guide' (used by the login page to ask for login first)
 * The whole card opens the guide (10.1): the title is the real link and stretches over the card; the Star button and the
 *   "View Step-by-Step Guide" button stay on top. The button is skipped by Tab (same link as the title).
 * opts.star        - HTML of a Star button (the dashboard passes one; the login page does not, because nobody is signed in there)
 */
export function docCardHTML(d, opts = {}) {
  return `
    <div class="card doc-card">
      <div class="icon-badge ${d.badge}" style="font-size:24px;">${d.icon}</div>
      <div class="body">
        <div class="top-row"><h3><a href="${esc(linkOf(d))}" class="doc-link"${opts.guideAttr ? ' ' + opts.guideAttr : ''}>${esc(d.title)}</a></h3><span class="top-tags"><span class="cat-tag">${esc(d.cat)}</span>${opts.star || ''}</span></div>
        <p class="desc">${esc(d.desc || DESC[d.id] || 'Online route: ' + d.portal)}${opts.recommended ? ' <b style="color:var(--green)">★ Recommended for you</b>' : ''}</p>
        <div class="meta-row">
          <div class="meta-item">🏢 <b>${esc(d.dept)}</b>&nbsp;· Amravati</div>
          ${d.min ? `<div class="meta-item">⏱️ <b>${d.min}–${d.max} days</b></div>` : ''}
        </div>
        <a href="${esc(linkOf(d))}" class="btn btn-outline btn-sm" tabindex="-1"${opts.guideAttr ? ' ' + opts.guideAttr : ''}>View Step-by-Step Guide →</a>
      </div>
    </div>`;
}

/**
 * Builds the search over a list of services.
 *  baseOrder(d) - tie-break order (dashboard puts the five featured documents first)
 *  extraHay(d)  - optional extra searchable text per document (the login page adds the translated title here)
 * Returns { search(q) -> { list, loose }, vocab() -> Set of searchable words }.
 */
export function makeSearch(services, baseOrder = (d) => d.no, extraHay = () => '') {
  const baseHay = new Map(services.map((d) => [d.id, ' ' + norm([d.title, d.cat, d.dept, d.portal, d.keys, d.desc || DESC[d.id] || ''].join(' '))]));
  const hayOf = (d) => baseHay.get(d.id) + (extraHay(d) ? ' ' + norm(extraHay(d)) : '');
  // Word-start matching: "ration" finds Ration Card, but not Regist-ration.
  const has = (hay, k) => hay.includes(' ' + k);

  function search(q) {
    const toks = norm(q).split(' ').filter(Boolean);
    if (!toks.length) return { list: services.slice(), loose: false };
    const score = (d, all) => {
      const h = hayOf(d);
      const t = ' ' + norm([d.title, extraHay(d)].join(' '));
      const hits = toks.filter((k) => has(h, k));
      if (all && hits.length !== toks.length) return 0;
      if (!hits.length) return 0;
      return hits.length + toks.filter((k) => has(t, k)).length * 2 + (norm(d.title).startsWith(toks[0]) ? 2 : 0);
    };
    let list = services.map((d) => [d, score(d, true)]).filter((x) => x[1] > 0);
    let loose = false;
    if (!list.length && toks.length > 1) { list = services.map((d) => [d, score(d, false)]).filter((x) => x[1] > 0); loose = true; }
    return { list: list.sort((a, b) => b[1] - a[1] || baseOrder(a[0]) - baseOrder(b[0])).map((x) => x[0]), loose };
  }

  const vocab = () => {
    const w = new Set();
    services.forEach((d) => hayOf(d).split(' ').forEach((x) => x.length > 2 && w.add(x)));
    return w;
  };
  return { search, vocab };
}
