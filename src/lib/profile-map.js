// Maps the answers from the home page ("Let's Get Started") to the Schemes page filters.
// Only values that exist on BOTH sides are mapped. Anything unknown maps to '' (= no filter), never to a guess.

// Home page "Education Level" options (index.html #fEducation)  ->  Schemes page level filter values (schemes.js LEVELS).
// The mapping is "the level the student is studying at / has just completed".
export const EDUCATION_TO_LEVEL = {
  '10th / SSC': 'school',
  '12th / HSC': 'junior',
  'Undergraduate (UG)': 'ug',
  'Postgraduate (PG)': 'pg',
};

// Home page "Category" options  ->  Schemes page category filter values.
// "SC / ST" is ambiguous (two different filters), so the student picks SC or ST on the schemes page.
export const CATEGORY_TO_CAT = { OBC: 'obc', EWS: 'ews', General: 'open' };

export const levelFromEducation = (education) => EDUCATION_TO_LEVEL[String(education ?? '').trim()] || '';
export const catFromCategory = (category) => CATEGORY_TO_CAT[String(category ?? '').trim()] || '';
