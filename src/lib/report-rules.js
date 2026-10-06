// "Report wrong information": the ONE place that defines what a valid report is.
// Used by the form (src/report.js), by the tests, and mirrored by firestore.rules (keep the limits in sync).

export const ISSUE_TYPES = [
  ['fee', 'Fee is incorrect'],
  ['time', 'Processing time is incorrect'],
  ['documents', 'Required documents are incorrect'],
  ['office', 'Office/address is incorrect'],
  ['contact', 'Contact information is incorrect'],
  ['link', 'Website/link is not working'],
  ['procedure', 'Procedure is incorrect'],
  ['translation', 'Translation is incorrect'],
  ['other', 'Other'],
];

// Stored in Firestore as the English label, so the report is readable for whoever reviews it.
export const ISSUE_LABELS = ISSUE_TYPES.map((t) => t[1]);

export const LIMITS = {
  descMin: 10,
  descMax: 2000,
  contactMax: 200,
  guideIdMax: 100,
  titleMax: 200,
  urlMax: 500,
};
export const LANGS_ALLOWED = ['en', 'mr', 'hi'];

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
// Keep line breaks in the description but trim each line and the whole text.
const cleanMultiline = (v) => String(v ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

/**
 * Validate and normalise the form values.
 * Returns { ok, errors: { field: message }, value } where `value` holds the trimmed data to store.
 */
export function validateReport(input, ctx = {}) {
  const errors = {};
  const guideId = clean(ctx.guideId);
  const guideTitle = clean(ctx.guideTitle).slice(0, LIMITS.titleMax);
  const issueLabel = clean(input.issueType);
  const description = cleanMultiline(input.description);
  const contact = clean(input.contact);

  if (!guideId || guideId.length > LIMITS.guideIdMax || !/^[a-z0-9-]+$/.test(guideId)) errors.guideId = 'This guide could not be identified. Please reload the page and try again.';
  if (!ISSUE_LABELS.includes(issueLabel)) errors.issueType = 'Please choose what is wrong.';
  if (!description) errors.description = 'Please describe what is wrong.';
  else if (description.replace(/\s/g, '').length < LIMITS.descMin) errors.description = `Please write at least ${LIMITS.descMin} characters so we can understand the problem.`;
  else if (description.length > LIMITS.descMax) errors.description = `Please keep the description under ${LIMITS.descMax} characters.`;
  if (contact.length > LIMITS.contactMax) errors.contact = `Contact details can be at most ${LIMITS.contactMax} characters.`;

  const lang = LANGS_ALLOWED.includes(ctx.language) ? ctx.language : 'en';
  const value = {
    guideId,
    guideTitle,
    issueType: issueLabel,
    description,
    contact: contact || null,
    pageUrl: clean(ctx.pageUrl).slice(0, LIMITS.urlMax),
    language: lang,
    status: 'new',
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}
