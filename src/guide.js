// Guide page: one template that shows any of the 138 Amravati services from the official guide PDF.
// URL: guide.html?s=<service id>   (ids are in src/data/services.js)
import './common.js';
import { SERVICES, GUIDE_META } from './data/services.js';
import { mountDocExtras } from './doc-extras.js'; // star, step checklist + progress, expiry card (9.O Star version)

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = $('guideRoot');
const id = new URLSearchParams(location.search).get('s') || '';
const s = SERVICES.find((x) => x.id === id);

const linkOf = (x) => x.href || `guide.html?s=${encodeURIComponent(x.id)}`;

function steps(list) {
  return list.map((t, i) => `
    <div class="step">
      <div class="rail"><div class="num">${i + 1}</div><div class="connector"></div></div>
      <div class="card step-card"><p class="g-item">${esc(t)}</p></div>
    </div>`).join('');
}

function notFound() {
  document.title = 'Document not found — Sarthi - X';
  root.innerHTML = `<div class="wrap missing">
    <h1>We could not find that document</h1>
    <p>The link may be old or mistyped. Search all ${SERVICES.length} Amravati documents from the dashboard.</p>
    <a class="btn btn-primary btn-sm" href="dashboard.html">Search documents →</a></div>`;
}

function render() {
  document.title = `${s.title} — Sarthi - X`;
  const related = SERVICES.filter((x) => x.cat === s.cat && x.id !== s.id)
    .sort((a, b) => Math.abs(a.no - s.no) - Math.abs(b.no - s.no)).slice(0, 5);
  const kpis = [
    { ic: '👤', b: 'ib-purple', n: s.dept, l: 'Handled by' },
    { ic: '🌐', b: 'ib-blue', n: s.portal, l: 'Online route' },
  ];
  if (s.min) kpis.push({ ic: '⏱️', b: 'ib-green', n: `${s.min}–${s.max} days`, l: 'Processing time', fact: 'time' });

  root.innerHTML = `
  <div class="wrap breadcrumb"><a href="index.html">Home</a> / <a href="dashboard.html">Documents</a> / <a href="dashboard.html?cat=${encodeURIComponent(s.cat)}">${esc(s.cat)}</a> / ${esc(s.title)}</div>

  <div class="wrap doc-hero">
    <div class="icon-badge ${s.badge}">${s.icon}</div>
    <div style="flex:1; min-width:260px;">
      <h1>${esc(s.title)}</h1>
      <p class="desc">Exact route for Amravati, Maharashtra — where to go, who handles it, what to carry and what to do at each step.</p>
      <div class="kpi-row">
        ${kpis.map((k) => `<div class="card kpi"${k.fact ? ` data-fact="${k.fact}"` : ''}><div class="icon-badge ${k.b}" style="width:34px;height:34px;font-size:15px;">${k.ic}</div><div><div class="n">${esc(k.n)}</div><div class="l">${k.l}</div></div></div>`).join('')}
      </div>
    </div>
  </div>

  <div class="wrap layout">
    <div>
      <div class="card route-card">
        <div class="g-info"><div class="k">📍 Where to go</div><div class="v g-text" data-fact="office">${esc(s.where)}</div></div>
        <div class="g-info"><div class="k">👤 Who handles it</div><div class="v g-text">${esc(s.who)}</div></div>
        <div class="g-info"><div class="k">🌐 Online route</div><div class="v g-text">${esc(s.online)}</div></div>
        <div class="g-info"><div class="k">🏢 Office counter</div><div class="v g-text">${esc(s.counter)}</div></div>
      </div>

      <section class="g-section" id="secA">
        <h2 class="steps-title">Before you go</h2>
        ${steps(s.a)}
      </section>

      <div class="tabs-row" role="tablist" aria-label="Choose how to apply">
        <button type="button" class="chip-outline chip active" data-tab="B" role="tab" aria-selected="true">🏢 At the government office</button>
        <button type="button" class="chip-outline chip" data-tab="C" role="tab" aria-selected="false">💻 Online / portal route</button>
      </div>

      <section class="g-section" id="secB" data-panel="B">
        <h2 class="steps-title">At the government office / service counter</h2>
        ${steps(s.b)}
      </section>
      <section class="g-section" id="secC" data-panel="C" hidden>
        <h2 class="steps-title">Online / portal route (when available)</h2>
        ${steps(s.c)}
      </section>

      <section class="g-section" id="secD">
        <h2 class="steps-title">When you receive the document</h2>
        <div class="card g-done"><p class="g-item">${esc(s.d)}</p></div>
        ${s.important ? `<div class="g-note"><b>Important:</b> <span class="g-item">${esc(s.important)}</span></div>` : ''}
      </section>
    </div>

    <div>
      <div class="card side-card">
        <h4>📋 Documents to carry</h4>
        <ul class="checklist">${s.carry.map((c) => `<li><span class="tick">✓</span>${esc(c)}</li>`).join('')}</ul>
      </div>
      ${s.href ? `<div class="card side-card"><h4>🧭 Detailed walkthrough</h4><p>A step-by-step guide with office, officer, form and time for each step is also available.</p><a class="btn btn-outline btn-sm" href="${esc(s.href)}">Open detailed guide →</a></div>` : ''}
      ${related.length ? `<div class="card side-card"><h4>🔗 Related documents</h4><div class="related-row">${related.map((r) => `<a href="${esc(linkOf(r))}">${esc(r.title)} →</a>`).join('')}</div></div>` : ''}
      <div class="card side-card"><h4>ℹ️ Please note</h4>
        <p class="src-note">Fees, forms, officer assignments and office timings can change. This guide was verified on ${esc(GUIDE_META.verified)} against official Maharashtra government sources. The official portal or the acknowledgement you receive is always the final authority for the current fee and any extra document.</p>
      </div>
    </div>
  </div>`;

  // Office / online switch
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-tab]').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-selected', String(on)); });
    root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  }));
}

if (s) { render(); mountDocExtras(); } else notFound();
// The action buttons (PDF, checklist, WhatsApp, report) need the page to be drawn first.
if (s) import('./guide-actions.js');
