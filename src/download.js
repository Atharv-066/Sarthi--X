// "Download" buttons on the document guide pages.
//  - Each form row: opens the official form if one is set in forms.js,
//    otherwise downloads a printable Sarthi - X application worksheet.
//  - Hero button "Download guide (PDF)": the whole step-by-step guide.
// Both open the browser's print window: choose "Save as PDF" to get a PDF file.
// Text is taken from the page as it is shown, so the PDF follows the chosen language.
import { tr, toast } from './i18n.js';
import { authReady, displayLabel } from './auth.js';
import { FORM_LINKS } from './forms.js';

const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const lead = (s) => s.replace(/^[^\p{L}\p{N}\u20B9]+/u, '').trim(); // drop leading emoji
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = () => location.pathname.split('/').pop().replace(/\.html$/, '');

function readPage() {
  return {
    title: txt(document.querySelector('.doc-hero h1')),
    desc: txt(document.querySelector('.doc-hero p.desc')),
    kpis: [...document.querySelectorAll('.kpi')].map((k) => ({ n: txt(k.querySelector('.n')), l: txt(k.querySelector('.l')) })),
    steps: [...document.querySelectorAll('.step')].map((s, i) => {
      const d = [...s.querySelectorAll('.step-detail .v')].map(txt); // office, meet, form, time
      return { n: i + 1, title: txt(s.querySelector('h3')), body: txt(s.querySelector('p')), office: d[0], meet: d[1], form: d[2], time: d[3] };
    }),
    carry: [...document.querySelectorAll('.checklist li')].map((li) => txt(li).replace(/^\u2713\s*/, '')),
    heads: {
      steps: txt(document.querySelector('.steps-title')),
      carry: lead(txt(document.querySelector('.side-card h4'))),
    },
  };
}

const LABELS = [
  'Application worksheet', 'Step-by-step guide', 'Applicant details', 'Full name', "Father's / Mother's name",
  'Date of birth', 'Address', 'Mobile number', 'Email', 'Office to visit', 'Officer to meet', 'Signature of applicant',
  'Date', 'Prepared with Sarthi - X',
  'This worksheet helps you get ready. Use the official form issued by the department when you apply.',
  'Office', 'Meet', 'Form', 'Time',
];

const CSS = `
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{font-family:'Segoe UI','Noto Sans Devanagari','Mangal',Arial,sans-serif;color:#0F1B3D;font-size:13px;line-height:1.5;margin:0}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2563EB;padding-bottom:10px;margin-bottom:16px}
.brand{font-size:20px;font-weight:700}.brand span{color:#2563EB}
.kind{font-size:12px;color:#5B6478;text-align:right}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 8px;color:#2563EB;border-bottom:1px solid #E4E9F2;padding-bottom:4px}
.desc{color:#5B6478;margin:0 0 8px}
.kpis{display:flex;gap:10px;margin:10px 0}.kpi{border:1px solid #E4E9F2;border-radius:8px;padding:6px 10px}.kpi b{display:block}.kpi small{color:#5B6478}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 18px}
.field label{font-size:11px;color:#5B6478;display:block}
.line{border-bottom:1px solid #8893A8;min-height:22px;padding:2px 0}
.full{grid-column:1/-1}.tall .line{min-height:44px}
ul.chk{list-style:none;margin:0;padding:0}ul.chk li{padding:4px 0;display:flex;gap:8px}
ul.chk li:before{content:'';width:12px;height:12px;border:1.5px solid #2563EB;border-radius:3px;flex:none;margin-top:3px}
.step{border:1px solid #E4E9F2;border-radius:8px;padding:8px 12px;margin-bottom:8px;page-break-inside:avoid}
.step h3{font-size:13.5px;margin:0 0 2px}.step p{margin:0 0 4px;color:#3C4459}
.meta{font-size:11.5px;color:#3C4459}.meta b{color:#0F1B3D}
.sign{display:flex;justify-content:space-between;gap:30px;margin-top:34px}.sign div{flex:1;border-top:1px solid #8893A8;padding-top:4px;font-size:11px;color:#5B6478}
.note{margin-top:20px;font-size:11px;color:#5B6478;border-top:1px dashed #C5CCDA;padding-top:8px}
`;

function shell(title, body, lang) {
  return `<!DOCTYPE html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function header(kindLabel) {
  return `<div class="top"><div class="brand">Sarthi <span>- X</span></div><div class="kind">${esc(kindLabel)}<br>${esc(new Date().toLocaleDateString())}</div></div>`;
}

function stepsHtml(page, L) {
  return page.steps.map((s) => {
    const m = [
      s.office && s.office !== '\u2014' ? `<b>${esc(L.Office)}:</b> ${esc(s.office)}` : '',
      s.meet && s.meet !== '\u2014' ? `<b>${esc(L.Meet)}:</b> ${esc(s.meet)}` : '',
      s.form && s.form !== '\u2014' ? `<b>${esc(L.Form)}:</b> ${esc(s.form)}` : '',
      s.time ? `<b>${esc(L.Time)}:</b> ${esc(s.time)}` : '',
    ].filter(Boolean).join(' &nbsp;|&nbsp; ');
    return `<div class="step"><h3>${s.n}. ${esc(s.title)}</h3><p>${esc(s.body)}</p><div class="meta">${m}</div></div>`;
  }).join('');
}

function carryHtml(page) {
  return `<ul class="chk">${page.carry.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`;
}

async function labels(lang) {
  const out = await tr(LABELS, lang);
  return Object.fromEntries(LABELS.map((k, i) => [k, out[i]]));
}

async function buildGuide(page, lang) {
  const L = await labels(lang);
  const kp = page.kpis.map((k) => `<div class="kpi"><b>${esc(k.n)}</b><small>${esc(k.l)}</small></div>`).join('');
  return shell(page.title + ' - Sarthi - X', `${header(L['Step-by-step guide'])}
    <h1>${esc(page.title)}</h1><p class="desc">${esc(page.desc)}</p><div class="kpis">${kp}</div>
    <h2>${esc(page.heads.steps || L['Step-by-step guide'])}</h2>${stepsHtml(page, L)}
    <h2>${esc(page.heads.carry)}</h2>${carryHtml(page)}
    <div class="note">${esc(L['Prepared with Sarthi - X'])}</div>`, lang);
}

async function buildWorksheet(page, formName, user, lang) {
  const L = await labels(lang);
  const office = page.steps.map((s) => s.office).find((o) => o && o !== '\u2014' && !/online/i.test(o)) || page.steps[0]?.office || '';
  const officer = page.steps.map((s) => s.meet).find((o) => o && o !== '\u2014') || '';
  const f = (label, value = '', cls = '') => `<div class="field ${cls}"><label>${esc(label)}</label><div class="line">${esc(value)}</div></div>`;
  return shell(formName + ' - Sarthi - X', `${header(L['Application worksheet'])}
    <h1>${esc(formName)}</h1><p class="desc">${esc(page.title)}</p>
    <h2>${esc(L['Applicant details'])}</h2>
    <div class="grid">
      ${f(L['Full name'], user.name)}${f(L["Father's / Mother's name"])}
      ${f(L['Date of birth'])}${f(L['Mobile number'], user.phone)}
      ${f(L['Email'], user.email, 'full')}${f(L['Address'], '', 'full tall')}
    </div>
    <h2>${esc(L['Office to visit'])}</h2>
    <div class="grid">${f(L['Office'], office)}${f(L['Officer to meet'], officer)}</div>
    <h2>${esc(page.heads.carry)}</h2>${carryHtml(page)}
    <div class="sign"><div>${esc(L['Signature of applicant'])}</div><div>${esc(L['Date'])}</div></div>
    <div class="note">${esc(L['This worksheet helps you get ready. Use the official form issued by the department when you apply.'])}<br>${esc(L['Prepared with Sarthi - X'])}</div>`, lang);
}

function printHtml(html, title) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        // Printing blocked: fall back to saving the page as an HTML file.
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        a.download = title.replace(/[^\w\u0900-\u097f]+/g, '-') + '.html';
        a.click();
      }
      resolve();
      setTimeout(() => frame.remove(), 120000);
    };
    document.body.appendChild(frame);
    frame.srcdoc = html;
  });
}

async function currentUser() {
  const u = await authReady;
  return { name: u?.displayName || '', email: u?.email || '', phone: u?.phoneNumber || '', label: displayLabel(u) };
}

async function run(btn, task) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const old = btn.textContent;
  btn.style.opacity = '.6';
  try {
    await task();
    toast('Choose "Save as PDF" in the print window to keep the file.');
  } catch (e) {
    console.warn('[Sarthi - X] Download failed:', e);
    toast('Could not prepare the download. Please try again.');
  } finally {
    delete btn.dataset.busy;
    btn.style.opacity = '';
    btn.textContent = old;
  }
}

function init() {
  const lang = () => document.documentElement.lang || 'en';

  // Form rows
  document.querySelectorAll('.form-item').forEach((row, i) => {
    const link = row.querySelector('a.chip');
    if (!link) return;
    const key = `${slug()}#${i}`;
    link.setAttribute('role', 'button');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const official = (FORM_LINKS[key] || '').trim();
      if (official) { window.open(official, '_blank', 'noopener'); return; }
      const name = lead(txt(row.querySelector('span')));
      run(link, async () => {
        const [page, user] = [readPage(), await currentUser()];
        await printHtml(await buildWorksheet(page, name, user, lang()), name);
      });
    });
  });

  // Whole-guide button under the key facts
  const host = document.querySelector('.kpi-row');
  if (host) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-outline btn-sm';
    b.style.cssText = 'align-self:center;cursor:pointer';
    b.textContent = '\u2B07 Download guide (PDF)';
    b.addEventListener('click', () => run(b, async () => {
      const page = readPage();
      await printHtml(await buildGuide(page, lang()), page.title);
    }));
    host.appendChild(b);
  }
}

init();
