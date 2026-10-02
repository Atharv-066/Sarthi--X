// Dashboard: working document search, category filter and profile-based ordering.
import './common.js';

const DOCS = [
  { icon: '🪪', badge: 'ib-blue', title: 'Aadhaar Card (New / Correction)', cat: 'Identity', desc: 'Update your address, name, or enrol for the first time.', office: 'UIDAI Seva Kendra', place: 'Camp Road', min: 7, max: 10, href: 'doc-aadhaar-card.html', keys: 'aadhaar aadhar adhar uid id proof आधार', rec: () => true },
  { icon: '🏛️', badge: 'ib-purple', title: 'Domicile Certificate', cat: 'Category & Status', desc: 'Proof of residence for state-quota admissions.', office: 'Tehsil Office', place: 'Amravati', min: 15, max: 21, href: 'doc-domicile-certificate.html', keys: 'domicile residence resident nivas अधिवास निवास रहिवासी', rec: (p) => /admission|scholarship/i.test(p.purpose) },
  { icon: '📜', badge: 'ib-amber', title: 'Caste Certificate', cat: 'Category & Status', desc: 'Required for reserved-category admission & scholarships.', office: 'SDO Office', place: 'Amravati', min: 21, max: 30, href: 'doc-caste-certificate.html', keys: 'caste jati reservation obc sc st category जात जाति जात प्रमाणपत्र', rec: (p) => /obc|sc|st/i.test(p.category) },
  { icon: '💰', badge: 'ib-green', title: 'Income Certificate', cat: 'Financial', desc: 'Needed for scholarships, EWS, and fee concessions.', office: 'Tehsil Office', place: 'Amravati', min: 10, max: 15, href: 'doc-income-certificate.html', keys: 'income salary ews fee concession tehsil उत्पन्न आय उत्पन्नाचा', rec: (p) => /ews|obc/i.test(p.category) || /scholarship|loan/i.test(p.purpose) },
  { icon: '👶', badge: 'ib-red', title: 'Birth Certificate', cat: 'Identity', desc: 'Original or duplicate copy from municipal records.', office: 'Amravati Municipal Corp.', place: '', min: 3, max: 7, href: 'doc-birth-certificate.html', keys: 'birth janm dob date of birth duplicate जन्म', rec: () => true },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]+/g, ' ').trim();

let profile = null;
try { profile = JSON.parse(sessionStorage.getItem('sx_profile')); } catch {}
let query = new URLSearchParams(location.search).get('q') || '';
let cat = 'All';

function matches(d, q) {
  const hay = norm([d.title, d.cat, d.desc, d.office, d.place, d.keys].join(' '));
  return norm(q).split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

function render() {
  const q = query.trim();
  let list = DOCS.filter((d) => (!q || matches(d, q)) && (cat === 'All' || d.cat === cat));
  if (profile) list = [...list].sort((a, b) => b.rec(profile) - a.rec(profile));

  $('resTitle').textContent = q
    ? `${list.length} result${list.length === 1 ? '' : 's'} for "${q}" in Amravati`
    : `${list.length} document${list.length === 1 ? '' : 's'} in Amravati`;
  $('resSub').textContent = profile && profile.purpose
    ? `Recommended first for: ${[profile.education, profile.purpose, profile.category].filter(Boolean).join(' • ')}. Tap a document to see the exact office, officer, and form.`
    : 'Tap a document to see the exact office, officer, and form you need.';

  const offices = new Set(list.map((d) => d.office));
  $('stOffices').textContent = list.length ? offices.size : 0;
  $('stForms').textContent = list.length;
  $('stTime').textContent = list.length ? `${Math.min(...list.map((d) => d.min))}–${Math.max(...list.map((d) => d.max))} days` : '—';

  document.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));

  $('resGrid').innerHTML = list.length ? list.map((d) => `
    <div class="card doc-card">
      <div class="icon-badge ${d.badge}" style="font-size:24px;">${d.icon}</div>
      <div class="body">
        <div class="top-row"><h3>${esc(d.title)}</h3><span class="cat-tag">${esc(d.cat)}</span></div>
        <p class="desc">${esc(d.desc)}${profile && d.rec(profile) && profile.purpose ? ' <b style="color:#16A34A">★ Recommended for you</b>' : ''}</p>
        <div class="meta-row">
          <div class="meta-item">🏢 <b>${esc(d.office)}</b>${d.place ? ', ' + esc(d.place) : ''}</div>
          <div class="meta-item">⏱️ <b>${d.min}–${d.max} days</b></div>
        </div>
        <a href="${d.href}" class="btn btn-outline btn-sm">View Step-by-Step Guide →</a>
      </div>
    </div>`).join('')
    : `<div class="card" style="grid-column:1/-1;padding:28px;text-align:center">
        <h3>No documents found for "${esc(q)}"</h3>
        <p class="desc" style="margin:8px 0 14px">Try another word such as Aadhaar, income, caste, domicile or birth.</p>
        <button type="button" class="btn btn-primary btn-sm" id="showAll">Show all documents</button></div>`;
  $('showAll')?.addEventListener('click', () => { query = ''; cat = 'All'; $('q').value = ''; history.replaceState(null, '', 'dashboard.html'); render(); });
}

$('q').value = query;
$('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  query = $('q').value;
  history.replaceState(null, '', query.trim() ? '?q=' + encodeURIComponent(query.trim()) : 'dashboard.html');
  render();
});
document.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; render(); }));
render();
