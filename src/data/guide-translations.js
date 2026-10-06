// VERIFIED Marathi / Hindi translations of guide text.   (Empty on purpose: nothing has been reviewed yet.)
//
// RULES
//  * Only add text that a Marathi / Hindi speaker who knows the government terminology has REVIEWED.
//    Never paste raw machine output here and never "fill in" official-sounding wording from guesswork.
//  * Every translated string is stored next to the exact English it translates:  [ 'English text', 'अनुवाद' ].
//    The pair is used only while the English text on the page is still IDENTICAL. If someone edits the English guide,
//    the old translation is ignored automatically (the page falls back to live translation) and `npm run validate-data`
//    reports it as STALE, so an outdated translation can never be shown for changed English.
//  * An entry without reviewedBy + reviewedOn is treated as a DRAFT and is ignored.
//  * Verified strings never go to the live translation service.
//
// SHAPE
//   'guide-id': {
//     mr: {
//       reviewedBy: 'Name / office of the reviewer',
//       reviewedOn: '2026-10-15',                       // YYYY-MM-DD
//       fields: {                                       // names follow the guide schema in data/services.js
//         title:   ['Income Certificate', '...'],
//         dept:    ['Revenue (Tahsil / SDO)', '...'],   // also: portal, where, who, online, counter, d, important
//         carry:   [['Address/residence proof', '...'], ...],   // arrays: carry, a, b, c  (one pair per item, same order)
//         b:       [[...], [...]],
//       },
//       extra: [['text on a hand-written page', '...']], // optional: strings of the 5 hand-written doc-*.html pages
//     },
//     hi: { ... },
//   }
//
// To get a ready-to-fill skeleton for a guide:   npm run translation-template -- income-certificate
// To see what is still missing:                  npm run validate-data

export const GUIDE_TRANSLATIONS = {
};

// The ~25 guides to translate first. There is no usage analytics in the project, so the list is based on data that exists:
//  1-5   the five documents the dashboard already features (FEATURED in dashboard.js) = the five hand-written guides
//  6-8   the certificates the Schemes page tells students they need (docsFor in schemes.js)
//  9-26  other everyday citizen documents (identity, family, land, school, police, pension and welfare)
export const PRIORITY_GUIDES = [
  'aadhaar-card', 'age-nationality-domicile-certificate', 'caste-certificate', 'income-certificate', 'birth-certificate',
  'non-creamy-layer-certificate', 'ews-certificate', 'disability-certificate',
  'death-certificate', 'marriage-registration-certificate', 'ration-card', 'pan-card', 'voter-id-epic', 'passport',
  'driving-licence', '7-12-extract-satbara', 'property-card', 'encumbrance-certificate', 'school-leaving-certificate',
  'transfer-certificate-tc', 'bonafide-certificate', 'character-certificate', 'police-clearance-certificate',
  'senior-citizen-certificate', 'below-poverty-line-certificate', 'legal-heir-succession-related-certificate',
];
