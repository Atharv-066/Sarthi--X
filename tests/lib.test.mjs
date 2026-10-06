import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, ISSUE_LABELS } from '../src/lib/report-rules.js';
import { buildShareText, whatsappLink, canonicalUrl } from '../src/lib/share.js';
import { levelFromEducation, catFromCategory } from '../src/lib/profile-map.js';
import { validateCredentials, isEmail, MIN_PASSWORD, suggestEmailFix, needsEmailVerification } from '../src/lib/auth-validate.js';
import { getLocalizedGuide, verifiedMap, isReviewed } from '../src/localize.js';

const ctx = { guideId: 'income-certificate', guideTitle: 'Income Certificate', pageUrl: 'https://x.test/guide?s=income-certificate', language: 'mr' };

test('report: valid report is trimmed and normalised', () => {
  const r = validateReport({ issueType: ISSUE_LABELS[0], description: '   The fee   is now  ₹50 at the counter.  ', contact: '  ' }, ctx);
  assert.equal(r.ok, true);
  assert.equal(r.value.description, 'The fee is now ₹50 at the counter.');
  assert.equal(r.value.contact, null);
  assert.equal(r.value.status, 'new');
  assert.equal(r.value.language, 'mr');
});
test('report: empty / whitespace / too short / too long / bad type are rejected', () => {
  assert.ok(validateReport({ issueType: ISSUE_LABELS[0], description: '   ' }, ctx).errors.description);
  assert.ok(validateReport({ issueType: ISSUE_LABELS[0], description: 'short' }, ctx).errors.description);
  assert.ok(validateReport({ issueType: ISSUE_LABELS[0], description: 'x'.repeat(2001) }, ctx).errors.description);
  assert.ok(validateReport({ issueType: 'Made up', description: 'long enough text here' }, ctx).errors.issueType);
  assert.ok(validateReport({ issueType: '', description: 'long enough text here' }, ctx).errors.issueType);
  assert.ok(validateReport({ issueType: ISSUE_LABELS[0], description: 'long enough text here' }, { ...ctx, guideId: '' }).errors.guideId);
  assert.ok(validateReport({ issueType: ISSUE_LABELS[0], description: 'long enough text here', contact: 'x'.repeat(201) }, ctx).errors.contact);
});
test('report: unknown language falls back to en', () => {
  assert.equal(validateReport({ issueType: ISSUE_LABELS[0], description: 'long enough text here' }, { ...ctx, language: 'fr' }).value.language, 'en');
});

test('share: message only contains facts that exist', () => {
  const url = 'https://x.test/guide?s=a';
  assert.equal(buildShareText({ title: 'Income Certificate', url }), 'Income Certificate\n\nView the complete guide:\nhttps://x.test/guide?s=a');
  const full = buildShareText({ title: 'T', fee: '₹23', time: '10–15 days', url });
  assert.match(full, /Fees: ₹23/); assert.match(full, /Processing time: 10–15 days/);
  assert.doesNotMatch(buildShareText({ title: 'T', fee: '', time: null, url }), /Fees|Processing/);
});
test('share: link is URL-encoded and canonical url keeps only ?s=', () => {
  const link = whatsappLink('A & B\nhttps://x.test/guide?s=a');
  assert.ok(link.startsWith('https://wa.me/?text=')); assert.ok(!link.includes(' ')); assert.ok(link.includes('%26') && link.includes('%0A'));
  assert.equal(canonicalUrl('https://x.test/guide?s=income-certificate&utm=1#top'), 'https://x.test/guide?s=income-certificate');
  assert.equal(canonicalUrl('https://x.test/doc-aadhaar-card?foo=1'), 'https://x.test/doc-aadhaar-card');
});

test('profile map: only known values map, unknown gives no filter', () => {
  assert.equal(levelFromEducation('Undergraduate (UG)'), 'ug');
  assert.equal(levelFromEducation('10th / SSC'), 'school');
  assert.equal(levelFromEducation(''), ''); assert.equal(levelFromEducation('Other'), ''); assert.equal(levelFromEducation(undefined), '');
  assert.equal(catFromCategory('EWS'), 'ews'); assert.equal(catFromCategory('SC / ST'), '');
});

const guide = { id: 'g', title: 'Income Certificate', where: 'Tahsil office', carry: ['Aadhaar', 'Photo'], a: ['Keep copies'] };
const table = { g: { mr: { reviewedBy: 'Reviewer', reviewedOn: '2026-10-01', fields: { title: ['Income Certificate', 'T-MR'], carry: [['Aadhaar', 'A-MR'], ['Photo', 'P-MR']], a: [['Keep copies OLD', 'X']] } } } };
test('localize: English is untouched', async () => {
  const r = await getLocalizedGuide(guide, 'en', table); assert.equal(r.status, 'source'); assert.equal(r.guide.title, 'Income Certificate');
});
test('localize: verified fields replaced, stale or missing fields stay for the live translator', async () => {
  const r = await getLocalizedGuide(guide, 'mr', table);
  assert.equal(r.guide.title, 'T-MR'); assert.deepEqual(r.guide.carry, ['A-MR', 'P-MR']);
  assert.equal(r.fields.a, 'live'); assert.equal(r.guide.a[0], 'Keep copies'); // English changed since review -> not used
  assert.equal(r.fields.where, 'live'); assert.equal(r.status, 'partial');
});
test('localize: no entry for a language -> none; unreviewed entry is ignored', async () => {
  assert.equal((await getLocalizedGuide(guide, 'hi', table)).status, 'none');
  const draft = { g: { mr: { fields: table.g.mr.fields } } };
  assert.equal((await getLocalizedGuide(guide, 'mr', draft)).status, 'none');
  assert.equal(isReviewed(draft.g.mr), false);
  assert.equal((await verifiedMap('mr', draft)).size, 0);
});
test('localize: verifiedMap collects reviewed pairs only', async () => {
  const m = await verifiedMap('mr', table); assert.equal(m.get('Aadhaar'), 'A-MR'); assert.equal(m.get('Income Certificate'), 'T-MR');
  assert.equal((await verifiedMap('en', table)).size, 0);
});

/* ---- sign-up / log-in form validation ---- */
const good = { mode: 'signup', name: 'Atharv Patil', email: 'user@example.com', password: 'MyPassword123', confirm: 'MyPassword123' };
test('auth: a complete, matching sign-up is accepted', () => {
  assert.equal(validateCredentials(good).ok, true);
  assert.equal(MIN_PASSWORD, 6);
});
test('auth: sign-up rejects empty name, bad email, empty / short password, empty / mismatched confirmation', () => {
  assert.ok(validateCredentials({ ...good, name: '   ' }).errors.name);
  assert.ok(validateCredentials({ ...good, email: '' }).errors.email);
  for (const bad of ['user', 'user@', 'user@example', '@example.com', 'us er@example.com']) assert.ok(validateCredentials({ ...good, email: bad }).errors.email, bad);
  assert.ok(validateCredentials({ ...good, password: '', confirm: '' }).errors.password);
  assert.ok(validateCredentials({ ...good, password: '12345', confirm: '12345' }).errors.password);
  assert.ok(validateCredentials({ ...good, confirm: '' }).errors.confirm);
  assert.equal(validateCredentials({ ...good, confirm: 'WrongPassword' }).errors.confirm, 'Passwords do not match.');
  assert.equal(validateCredentials({ ...good, confirm: 'mypassword123' }).ok, false); // case-sensitive
  assert.equal(validateCredentials({ ...good, name: '', email: 'x', password: '1', confirm: '' }).ok, false);
});
test('auth: login needs an email and a password only (Firebase decides if it is correct); no name / confirmation required', () => {
  assert.equal(validateCredentials({ mode: 'login', email: 'user@example.com', password: 'whatever' }).ok, true);
  assert.ok(validateCredentials({ mode: 'login', email: 'user@example.com', password: '' }).errors.password);
  assert.ok(validateCredentials({ mode: 'login', email: 'nope', password: 'x' }).errors.email);
  assert.equal(isEmail(' user@example.com '), true);
});

/* ---- 9.O: email verification ---- */
const pwUser = (emailVerified) => ({ emailVerified, providerData: [{ providerId: 'password' }] });
test('verify: an unverified email + password account is NOT treated as signed in', () => {
  assert.equal(needsEmailVerification(pwUser(false)), true);
  assert.equal(needsEmailVerification(pwUser(true)), false);
});
test('verify: Google, phone and signed-out users never need the email link', () => {
  assert.equal(needsEmailVerification({ emailVerified: true, providerData: [{ providerId: 'google.com' }] }), false);
  assert.equal(needsEmailVerification({ emailVerified: false, providerData: [{ providerId: 'phone' }] }), false);
  assert.equal(needsEmailVerification(null), false);
  assert.equal(needsEmailVerification(undefined), false);
  assert.equal(needsEmailVerification({ emailVerified: false }), false); // no provider list: do not lock anyone out by accident
});
test('verify: common domain typos are caught at sign-up only', () => {
  assert.equal(suggestEmailFix('ravi@gmial.com'), 'ravi@gmail.com');
  assert.equal(suggestEmailFix(' Ravi.P@Gmail.con '), 'Ravi.P@gmail.com');
  assert.equal(suggestEmailFix('a@yahoo.con'), 'a@yahoo.com');
  assert.equal(suggestEmailFix('ravi@gmail.com'), null);
  assert.equal(suggestEmailFix('ravi@college.edu.in'), null);
  assert.equal(suggestEmailFix('nonsense'), null);
  assert.match(validateCredentials({ ...good, email: 'ravi@gmial.com' }).errors.email, /Did you mean ravi@gmail\.com\?/);
  assert.equal(validateCredentials({ mode: 'login', email: 'ravi@gmial.com', password: 'x' }).ok, true); // log-in never blocks on a guess
});
