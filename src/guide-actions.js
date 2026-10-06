// Extra actions on every guide page (guide.html and the hand-written doc-*.html pages):
//   * "Last verified" + "Official source" (only when the data exists)
//   * Printable checklist, Share on WhatsApp, Report wrong information
//   * an honest note about the translation (verified by a person / machine translated)
// The existing "Download guide (PDF)" button is added by download.js, which this file loads.
import { currentGuide, officialSourceOf, lastVerifiedOf, isGenericGuide } from './guide-meta.js';
import { getLang, tr } from './i18n.js';
import { readFacts } from './lib/facts.js';
import { buildShareText, whatsappLink, canonicalUrl } from './lib/share.js';
import { getLocalizedGuide, reviewedBlock } from './localize.js';
import { openReport } from './report.js';
import { mountChecklistButton } from './download.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* ---------- words used in the shared message (translated once per language, so the click handler stays instant) ---------- */
const SHARE_WORDS = ['Fees', 'Processing time', 'View the complete guide'];
let shareLabels = { fee: 'Fees', time: 'Processing time', view: 'View the complete guide' };
async function loadShareLabels() {
  const out = await tr(SHARE_WORDS, getLang());
  shareLabels = { fee: out[0], time: out[1], view: out[2] };
}

/* ---------- translation note (hand-written, so it is never sent to the live translator) ---------- */
const NOTE = {
  mr: {
    verified: 'या मार्गदर्शकाचे मराठी भाषांतर तपासलेले आहे.',
    partial: 'या मार्गदर्शकाचा काही भाग तपासलेल्या मराठी भाषांतरात आहे. बाकीचा भाग स्वयंचलित भाषांतर आहे आणि त्यात चुका असू शकतात.',
    none: 'हे भाषांतर संगणकाद्वारे (स्वयंचलित) केलेले आहे आणि त्यात चुका असू शकतात. खात्रीसाठी इंग्रजी मजकूर पाहा.',
  },
  hi: {
    verified: 'इस मार्गदर्शिका का हिन्दी अनुवाद जाँचा गया है।',
    partial: 'इस मार्गदर्शिका का कुछ भाग जाँचे गए हिन्दी अनुवाद में है। बाकी स्वचालित (मशीन) अनुवाद है और उसमें गलतियाँ हो सकती हैं।',
    none: 'यह अनुवाद कंप्यूटर द्वारा (स्वचालित) किया गया है और इसमें गलतियाँ हो सकती हैं। पक्का करने के लिए अंग्रेज़ी पाठ देखें।',
  },
};

async function translationStatus(g, full) {
  const lang = getLang();
  if (lang === 'en' || !g) return '';
  if (full) return (await getLocalizedGuide(full, lang)).status;
  // Hand-written doc pages: strings are matched one by one, so we can only say whether a reviewed translation exists.
  return (await reviewedBlock(g.id, lang)) ? 'partial' : 'none';
}

async function refreshNote(g, full) {
  const el = document.getElementById('gaNote');
  if (!el) return;
  const lang = getLang();
  const status = await translationStatus(g, full);
  if (getLang() !== lang) return; // language changed meanwhile
  const text = status && NOTE[lang]?.[status];
  el.textContent = text || '';
  el.hidden = !text;
  el.setAttribute('lang', lang);
  el.dataset.status = status || '';
}

/* ---------- build the bar ---------- */
function build(g) {
  const src = officialSourceOf(g);
  const when = lastVerifiedOf(g, getLang());
  const trust = [
    when ? `<span class="ga-trust-item"><span>Last verified:</span> <span class="ga-date" data-no-translate>${esc(when)}</span></span>` : '',
    src ? `<a class="ga-trust-item ga-src" href="${esc(src)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>` : '',
  ].filter(Boolean).join('');

  const bar = document.createElement('div');
  bar.className = 'guide-actions';
  bar.id = 'guideActions';
  bar.innerHTML = `
    ${trust ? `<p class="ga-trust">${trust}</p>` : ''}
    <div class="ga-buttons" role="group" aria-label="Guide actions" data-slot></div>
    <div class="ga-report-row">
      <button type="button" class="ga-report" data-report aria-label="Report wrong information about this document">⚑ Report wrong information</button>
      <span class="ga-sub">Found outdated or incorrect information? Let us know.</span>
    </div>
    <p class="ga-note" id="gaNote" hidden></p>`;

  const wa = document.createElement('a');
  wa.className = 'btn btn-outline btn-sm ga-wa';
  wa.target = '_blank';
  wa.rel = 'noopener noreferrer';
  wa.setAttribute('aria-label', 'Share this guide on WhatsApp');
  wa.textContent = '💬 Share on WhatsApp';
  const refreshHref = () => {
    const f = readFacts();
    const text = buildShareText({ title: f.title || g.title, fee: f.fee, time: f.time, url: canonicalUrl(location.href) }, shareLabels);
    wa.href = whatsappLink(text);
  };
  refreshHref();
  wa.addEventListener('click', refreshHref); // rebuild from what is on screen right now; the browser then follows the link
  bar.querySelector('[data-slot]').appendChild(wa);
  return { bar, refreshHref, wa };
}

function mount() {
  const g = currentGuide();
  if (!g || document.getElementById('guideActions')) return;
  const host = document.querySelector('.doc-hero .kpi-row');
  if (!host) return;
  const { bar, refreshHref } = build(g);
  host.insertAdjacentElement('afterend', bar);
  const slot = bar.querySelector('[data-slot]');
  mountChecklistButton(slot);          // "Printable checklist" (download.js)
  slot.appendChild(slot.querySelector('.ga-wa')); // keep WhatsApp last

  const open = (btn) => openReport({ guideId: g.id, guideTitle: g.title }, btn);
  bar.querySelector('[data-report]').addEventListener('click', (e) => open(e.currentTarget));

  // Second entry at the end of the page: a reader who finds a mistake while reading the last step should not have to scroll back up.
  const main = document.querySelector('.layout > div');
  if (main) {
    const end = document.createElement('div');
    end.className = 'ga-report-row ga-end';
    end.innerHTML = '<button type="button" class="ga-report" aria-label="Report wrong information about this document">⚑ Report wrong information</button><span class="ga-sub">Found outdated or incorrect information? Let us know.</span>';
    end.querySelector('button').addEventListener('click', (e) => open(e.currentTarget));
    main.appendChild(end);
  }

  // Full record only exists on guide.html (the hand-written pages use the light index).
  const loadFull = isGenericGuide() ? import('./data/services.js').then((m) => m.SERVICES.find((x) => x.id === g.id)) : Promise.resolve(null);
  loadFull.then((rec) => {
    const update = () => {
      refreshNote(g, rec); loadShareLabels().then(refreshHref);
      const d = document.querySelector('.ga-date'); if (d) d.textContent = lastVerifiedOf(g, getLang());
    };
    update();
    document.addEventListener('sx:langchange', update);
  });
}

mount();
