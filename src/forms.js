// Official form links for the "Download" buttons.
//
// Paste the real URL of each official form PDF / portal page between the quotes.
//  - If a URL is set, the Download button opens it in a new tab.
//  - If it is empty, the button downloads a Sarthi - X "application worksheet"
//    (a printable PDF with the checklist, the office and blank fields).
//
// Key = page file name + "#" + position of the form in the "Forms to download" box (starts at 0).
export const FORM_LINKS = {
  'doc-aadhaar-card#0': '',        // Aadhaar Enrolment/Correction Form (Annexure-A)
  'doc-birth-certificate#0': '',   // Birth Certificate Application Form
  'doc-caste-certificate#0': '',   // Caste Certificate Application Form
  'doc-caste-certificate#1': '',   // Family Lineage Declaration
  'doc-domicile-certificate#0': '',// Domicile Certificate Application (Form 16)
  'doc-domicile-certificate#1': '',// Residence Self-Declaration Affidavit
  'doc-income-certificate#0': '',  // Income Certificate Application (Form 17)
};

// Official portals shown under "Forms to download". Only portals whose address was checked are listed.
//  - UIDAI keeps the Aadhaar Enrolment & Update forms under My Aadhaar > Downloads.
//  - Caste, domicile and income certificates are applied for online on Aaple Sarkar (no paper form to download).
// No portal is listed for the birth certificate because no official address was verified.
export const FORM_PORTALS = {
  'doc-aadhaar-card': { name: 'UIDAI (forms under My Aadhaar > Downloads)', url: 'https://uidai.gov.in/' },
  'doc-caste-certificate': { name: 'Aaple Sarkar (apply online)', url: 'https://aaplesarkar.mahaonline.gov.in/' },
  'doc-domicile-certificate': { name: 'Aaple Sarkar (apply online)', url: 'https://aaplesarkar.mahaonline.gov.in/' },
  'doc-income-certificate': { name: 'Aaple Sarkar (apply online)', url: 'https://aaplesarkar.mahaonline.gov.in/' },
};
