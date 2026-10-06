# Sarthi - X 10.2 (Firebase edition, deploy ready)

**After unzipping: `npm install`, `npm run check`, then `firebase deploy --only hosting`** (no Firestore rule changed).

## What is new in 10.2 (from a user's suggestion)

**The whole document card opens its guide.** Before, only the small "View Step-by-Step Guide" button was tappable, so tapping the title (for example "Age, Nationality & Domicile Certificate") did nothing. Now the title is a real link that stretches over the whole card: tapping the title, the description, the icon or any empty part of the card opens the guide. The Star button still stars, and the guide button still works. Same on the Documentation page and on the logged-out search on the login page (it still asks for login first). Keyboard: Tab goes to the title, Enter opens it. Looks the same as before.

Files changed: `src/doccard.js` (title link), `assets/style.css` (7 lines), `package.json` / `package-lock.json` (10.2.0), this README.

---

## What is new in 10.1 (home page only)

1. **Novel point highlighted.** A new blue band under the hero, "What makes Sarthi - X different": *Not just a list of documents. Your exact Amravati roadmap.* It shows the three things a visitor gets (1 right office, 2 right officer, 3 right form), three small chips (step-by-step guides, schemes linked to the papers they need, printable checklist and WhatsApp share) and a **Find my document** button to the Documentation page. Works in light and dark mode. Marathi and Hindi wording is in `src/data/translations-100.js` (ADD, "10.1 home page"), written by the developer, not a certified translator.
2. **Phone / tablet order swapped.** Where the home page is one column (1080 px and narrower) the order is now: **Let's Get Started** card, headline and numbers, then the illustration (before: illustration, headline, card). The wide-screen layout (three columns) is unchanged.

3. **Bug fix (found in the 10.1 audit).** On the home page, the red message under *Analyze my requirements* ("Please select: Education Level, Purpose, Category") stayed in English when the site was in Marathi or Hindi. It is now translated from the existing dictionary (`src/home.js`, 3 lines). Every page, all 138 guides and every width from 320 to 1440 px were also loaded in a browser with no other errors found.

Files changed: `index.html` (band and the one-column order), `src/home.js` (the message fix), `src/data/translations-100.js` (12 new lines per language), `package.json` / `package-lock.json` (10.1.0), this README. Nothing else was touched. `npm test`: 55 passing. Checked in headless Chromium at 390 and 1280 px, light and dark: no sideways scroll. `vite build` was not run here (no `npm install`); run `npm run check` once.

---

# Sarthi - X 10.0 (Firebase edition, deploy ready)

**After unzipping: `npm install`, `npm run check`, then `firebase deploy --only hosting`** (no Firestore rule changed in 10.0).

## What is new in 10.0

### 1. Linguistic Minority schemes (Minority Schemes page)
The page `minority.html` now has two tabs, **Religious minority** and **Linguistic minority**. Both views are the same page, the same components (`src/minority.js`) and the same design: group picker, "Show" filter, certificate chips, search across all groups, result cards with the **↗** official-details link, the "Verify / Only with official ... certificate" tags, the eligibility notes and the share-by-address behaviour (`?m=language&r=warli&type=loan&cert=st&q=hostel`). The religious view keeps its old addresses (`?r=muslim`) and was not changed.
* Source: `data-source/Maharashtra_Linguistic_Minority_wise_Schemes.docx` (17 languages). `python3 tools/build-linguistic-data.py` rebuilds `src/data/linguistic.js` from it and **stops with a message if the Word file differs from `tools/linguistic-names.json`** (a missing language, scheme or a changed order), so nothing is dropped silently.
* 12 languages list the same **31** schemes; Bhili / Bhilori, Gondi, Korku, Kolami and Warli list **47** (31 + 16 Tribal Development Department schemes, shown with the "Only with official ST certificate" tag). Scheme names are stored once, not 17 times.
* Like the religious list, the Word file has **names only**: no amounts, dates, income limits, documents, eligibility text or links were invented. The note from the Word file is shown on the page: the language only prioritises; every scheme keeps its own rules.
* Marathi, Hindi and English names exist for all 47 schemes. Search finds a scheme by its English, Marathi or Hindi name.
* `npm run validate-data` and `tests/linguistic.test.mjs` check the list (17 languages, 31/47 counts, no duplicate scheme, Marathi + Hindi text for every name).

### 2. The tagline translation (Home / Login)
"Your Document Friend in the Government Maze" means: a companion that helps you through confusing government paperwork. The old Marathi / Hindi came from two faults: (a) the dictionary text itself ("सरकारी झंझट में आपका दस्तावेज़ मित्र") and (b) the headline `<h1>` is split by `<br>` and a `<span>`, so the translator received three pieces ("Your Document Friend", "in the", "Government Maze") and translated each alone ("... मध्य सरकारी चक्रव्यूह").
* English: unchanged.  Marathi: **सरकारी कागदपत्रांच्या गुंतागुंतीत तुमचा विश्वासू साथीदार**.  Hindi: **सरकारी दस्तावेज़ों की उलझन में आपका भरोसेमंद साथी**.
* `src/i18n.js` now supports **whole-sentence elements**: mark an element `data-tr-unit` and give its whole HTML ONE entry in `src/translations.js` (key = the HTML without attributes, value = translated HTML with the same tags). Used for the two headlines, the notices on the Minority and Schemes pages and the "New to Sarthi - X? Create an account" line. `tests/linguistic.test.mjs` checks that every such element has an entry with the same tags.
* To keep the login toggle working when its line is re-written for a language, `login.js` now catches the click on the line (`#alt`) instead of on the link. Nothing else in Login / Sign up changed (fields, CAPTCHA, validation, password show/hide, verification screen).

### 3. Translation audit
* **Sentences with numbers** ("23 schemes in 6 groups", "Show more (114 remaining)", "5 results for ...") are now translated as a whole through `{placeholder}` entries (digits become Devanagari in Marathi). Placeholder names: `n a b m` = a number, `x` = a name the dictionary knows (else left to the live translator), anything else = free text.
* **Dictionary keys with an arrow or emoji at the edge never matched** ("View schemes →", "← All religions"): they now also register without the edge characters.
* **About 270 UI texts that had no entry** (home form, login messages and validation, documentation filters, schemes page labels, guide page, minority page hints, rules) now have hand-written Marathi and Hindi, so they no longer go word by word to the live translator.
* **Wording fixed:** Hindi "समाप्त" (expired) -> "अवधि समाप्त"; "आय सीमा संभव" -> "आय सीमा हो सकती है"; "ज़रूरी हो सकने वाले दस्तावेज़" -> "आपको ये दस्तावेज़ लग सकते हैं"; "Water & Utilities" in both languages; Marathi "उत्पन्न मर्यादा शक्य" and "कागदपत्र अर्ज प्रगती".
* All new wording is in `src/data/translations-100.js` (FIX = replaces, ADD = fills gaps). It was written by the developer, **not by a certified translator: please have a native speaker read it once.**
* **Not covered by hand-written text (still translated by the live service, and cannot be checked offline):** the 138 guides (`src/data/services.js`), the 239 scheme names and the 72 religious-minority scheme names, the five `doc-*.html` pages. The existing verified-translation file `src/data/guide-translations.js` is still the right place for reviewed guide text.

### 4. Other
* Home page card text for Minority Schemes now also names linguistic minorities; the Schemes page note points to "religious or linguistic minority".
* Service worker cache name is `sx-v10`; `package.json` is 10.0.0.
* `npm test`: 55 tests (7 new). `npm run validate-data`: 0 errors, same 278 content warnings as 9.0.
* `vite build` could not be run where 10.0 was prepared (no internet for `npm install`). Run `npm run check` once after unzipping. Instead, every page and module was loaded in headless Chromium against a stubbed Firebase (no page error; no sideways scroll at 390 / 820 / 1280 px; English, Marathi and Hindi checked).

---

# Sarthi - X 9.0 (Firebase edition)

## What is new in 9.O

**After unzipping: `npm install`, `npm run check`, then deploy the new rules: `firebase deploy --only firestore:rules,hosting`.**

### 1. Email verification (fixes: any random email could create an account)
Firebase `createUserWithEmailAndPassword` accepts **any well-formed address** (for example `sddhewuy@gmail.com`); it never checks that the inbox exists. 9.O adds the missing step:

* **Sign-up** sends a verification link (`sendEmailVerification`) and shows a *Check your email* screen in the same card. The account is **not** usable and **no Firestore profile is written** until the link is opened.
* **Log-in** with an unverified email shows the same screen (with *Resend email*) instead of entering the site.
* **Every protected page** treats an unverified email account as signed out (`authReady` in `src/auth.js` returns `null` for it; `login.js` uses `authReadyRaw`). Google and phone-OTP users are unaffected (their provider already verified them): see `needsEmailVerification()` in `src/lib/auth-validate.js`.
* The screen checks automatically every few seconds and when the tab comes back to the front, plus an **I have verified my email** button. *Resend email* has a 45 second pause. **Wrong email? Sign up again** deletes the unverified account so the right address can register.
* `firestore.rules`: `users/{uid}` now also requires `email_verified == true` for email + password sign-in (`emailOk()`), so the rule holds even if someone bypasses the page.
* Sign-up also catches common typos (`gmial.com`, `gmail.con`, `yahoo.con` ...) with a "Did you mean ...?" message (`suggestEmailFix`).

Firebase Console checks: **Authentication > Templates > Email address verification** (edit the sender name / message, optional). **Authentication > Settings > Authorized domains** must include your live domain (the link returns to `/login.html`; if the domain is missing the email is still sent, using Firebase's own page).
Accounts created before 9.O with made-up emails stay in **Authentication > Users** as *unverified*; they can no longer get in, and you can delete them from the Console.
Limits: a real inbox is proven, not a real person (a throw-away mailbox still passes), and a verified Google or phone account is as trustworthy as that provider.

### 2. New login page
* **Search beside the logo** (header row) instead of below it; results still open full width under the header (`src/finder.js` unchanged apart from the card lookup).
* Left side: headline, an illustration (`public/art/login-hero.svg`: phone checklist, certificate with seal, ID card, route to the office), a three-step strip (right office / officer / form) and the trust points as chips.
* On wide screens (1760px and up) two illustrations fill the page margins (`login-side-left.svg`, `login-side-right.svg`); soft colour glows and a dot grid sit behind everything. Light and dark mode both work; on phones the login card comes first and the illustration follows.
* The illustrations are plain SVG files in `public/art/`. To use photos instead, replace the files (keep the names) or change the `<img>` tags in `login.html`.
* Marathi / Hindi text for the new labels is in `src/translations.js` (section "9.O").
* Service worker cache name changed to `sx-v9` so installed copies pick up the new page.

### 3. Full audit of the project (9.O)
Everything was checked: all 12 pages, all 138 guides (each one opened and rendered on a phone-size screen), the 239 schemes, the minority data, the Firestore rules, the service worker, the translation engine and the sign-in flow (run end to end against a fake Firebase).

**Fixed**
* **Verified-elsewhere users never got a profile.** Someone who clicked the email link on another device and then opened the site directly skipped the step that saves `users/{uid}`. `ensureUserDoc()` (src/auth.js) now creates it when missing (one read, no write otherwise), and a stale "unverified" session is refreshed once (`reload()` + new token) instead of bouncing the person back to the log-in page.
* **Privacy: the visitor's name and email could be sent to the translation service.** In Marathi / Hindi mode the page translator treats every text node as translatable, including the user menu. The menu button and the name/email block now carry `data-no-translate`.
* **Scroll shadow missing on 8 pages** (`about`, `dashboard`, `guide`, 5 `doc-*` pages): their header had no `id="siteHeader"`, so `common.js` could not find it.
* **Phones around 360 px wide:** the logo ran under the fixed theme / language buttons on the log-in page.
* **No meta description on any page**, and the 404 page had no icon or manifest. Added (404 is `noindex`).
* `package-lock.json` still said version 6.0.0.
* A profile document without `createdAt` (created by the home page before the first log-in save) now gets it.

**Checked and fine:** every import and export resolves; no page error, failed request or sideways scroll at 1280 and 390 px; no duplicate ids; all `$('id')` lookups exist; guide ids match the report rule in `firestore.rules`; index and full guide data agree; every scheme / minority label used by the filters exists; rules and `report-rules.js` limits are identical (now enforced by a test).

**Not changed, for you to decide**
* Content gaps from `npm run validate-data` (0 errors, 278 warnings): 138 guides have no `officialSource` / `lastVerified`, and none of the 26 priority guides has a person-verified Marathi or Hindi text yet. These need real sources, so nothing was invented.
* The translator sends the text on screen to Google / MyMemory (see `src/translator.js`). Search words typed into the dashboard and schemes pages appear in a result title and are sent too. Consider wording on the privacy line, or run your own endpoint (`VITE_TRANSLATE_ENDPOINT`).
* `firebase.json` sets no Content-Security-Policy; add one after testing sign-in, Google and reCAPTCHA. There is no `robots.txt` / `sitemap.xml` (needs your live domain). Turn on Firebase App Check to slow down bots on sign-up and on `information_reports`.
* `.env` (your Firebase web config, not a secret) is inside the zip because the project needs it to run. It is in `.gitignore`: do not commit it or post the zip publicly.
* `vite build` could not be run where this audit was done (no internet for `npm install`). Run `npm run check` once after unzipping.

### Tests
`npm test` now has 23 tests: 3 for verification and typo detection, 7 audit tests (section 3 above).

## What is new in 8.0

**Run `npm install`, then `npm run check` (validate data + unit tests + build) before deploying.** Then deploy the new rules: `firebase deploy --only firestore:rules,hosting`.

### 1. Report wrong information
Every guide page (`guide.html` and the five `doc-*.html` pages) has a **Report wrong information** button under the key facts and a second one at the end of the steps. It opens a dialog (`src/report.js`) with: what is wrong (9 choices), a required description (10 to 2000 characters), optional phone/email. Reports are stored in Firestore collection **`information_reports`**:
`guideId, guideTitle, issueType, description, contact|null, pageUrl, language, createdAt (serverTimestamp), status:"new"`.
Visitors do not need to log in. Double clicks are blocked, a timeout shows a clear error, a hidden trap field catches simple bots. **Read the reports in Firebase Console > Firestore > information_reports** (set `status` there by hand, for example to `fixed`).
Rules (`firestore.rules`): anyone may *create* a report with exactly those fields and valid values; nobody can read, update or delete from the website. Limits in the rules and in `src/lib/report-rules.js` must stay equal.

### 2. Filters
* **Education level** on the home page now pre-selects the Schemes *level* filter (`src/lib/profile-map.js`): 10th / SSC -> School, 12th / HSC -> Class 11-12, Undergraduate -> UG, Postgraduate -> PG. Category (OBC / EWS / General) was already passed on. "SC / ST" stays unselected because it is two different filters. A blue note tells the student what was pre-selected. Opening Schemes with filters in the address, or with nothing chosen, behaves as before. Saved answers from Firestore are now also kept for the Schemes page.
* **Level filter** got a **Professional courses** option, because 55 schemes in the data were already tagged `prof` but could not be filtered.
* **Financial background:** the home form does not ask for income, and the scheme data only knows `need / merit / open` (no income amounts). So nothing could honestly be passed through, and no income rules were invented. The existing income filter is unchanged. Adding an income question to the home form would need real income limits per scheme first.
* The Linguistic Minority filter is **not** implemented (later stage).

### 3. Verified Marathi / Hindi translations
`src/data/guide-translations.js` holds reviewed translations as `[English, translation]` pairs. Lookup order for every text on the page: **verified -> hand-written dictionary -> saved cache -> live translator**. Verified text never goes to the live service, and a pair is used only while the English is unchanged and `reviewedBy` + `reviewedOn` are filled in. The file is **empty on purpose**: no Marathi or Hindi government wording was written by the developer. `PRIORITY_GUIDES` lists the first 26 guides to translate (no usage analytics exist, so it follows the dashboard's featured five, the certificates the Schemes page points students to, and common citizen documents).
* Skeleton for one guide: `npm run translation-template -- income-certificate`
* Progress: `npm run validate-data`
* Each guide page shows a short note in Marathi/Hindi saying whether the text is verified or machine translated. `getLocalizedGuide(guide, lang)` is in `src/localize.js`.

### 4. Share on WhatsApp
Button on every guide (`wa.me` link, no login, no API). Message: title, then Fees / Processing time **only if the page has them**, then the guide link (`?s=` only, no tracking).

### 5. Printable checklist
**Printable checklist** button: one A4 page, black and white, 15-16px text, checkboxes for the documents to carry, then fee / processing time / office / official website if present, official source, last verified date and print date. More than 8 documents use two columns instead of smaller text. The old "Download guide (PDF)" is unchanged.

### 6. Installable app / weak network
`public/manifest.webmanifest`, icons (`public/icon-*.png`, maskable, apple-touch), `<link>` tags on every page, and a small hand-written service worker `public/sw.js` registered by `src/pwa.js` **in production only**. Pages: network first with the last copy as fallback; `/assets/*`: cache first (hashed names); Firebase, translation services and fonts are never cached. A guide opened once can be opened again on a weak connection; **the site is not fully offline** (login, reports and translation of new text need internet). To update the cache after a deploy nothing is needed; bump `VERSION` in `sw.js` only to force a clean start. The Google Fonts stylesheet in `style.css` is not cached by the service worker.

### 7. Trust information
Guides can carry `officialSource` (https URL) and `lastVerified` ("YYYY-MM-DD"). The page shows **Last verified** (the guide's own date, else the edition date "2 October 2026") and **Official source** (the guide's own URL, else the verified portal in `forms.js`; hidden if neither exists). No values were invented: 0 of 138 guides have their own yet.

### 8. Data validation
`npm run validate-data` (`--verbose` lists every guide, `--strict` also fails on warnings). Checks guides, schemes, minority data and translations; separates ERROR (exit 1) from WARNING. `npm test` runs the unit tests in `tests/`.

### 9. Login wall
Guide pages (`<body data-public>`) are now visible **without login**, so a link shared on WhatsApp opens. A signed-out visitor sees a Login button that returns to the same guide after login. Home, Documents list, Schemes, Minority and About still require login (account-specific / personalised). The login page's document search still asks for login before opening a guide; change `finder.js` if you want that open too.

### 10. App Check (not enabled; exact integration point)
Not configured in the project. To add it: Firebase Console > App Check > register the web app with **reCAPTCHA Enterprise** (or v3), then in `src/firebase.js` after `initializeApp(config)`:
```js
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
```
Test in "monitor" mode first, then **enforce** for Firestore and Authentication. For phone OTP also: Authentication > Settings > SMS region policy (allow India only), set a billing budget alert, keep the reCAPTCHA verifier in `login.js`. Do not enforce before the site key is live, or all reads will fail.

### Not done in 8.0
Linguistic Minority filter; verified Marathi/Hindi text for any guide (needs a human reviewer); per-guide official URLs and dates (need real sources); income-based scheme eligibility; automated browser tests.

## What is new in 7.1

### Document search on the Log in / Sign up page

* A new **Find a document or scheme** box sits under the pitch text on wide screens and below the login card on phones. The Log in / Sign up card itself is unchanged.
* It searches the same 138 documents as the dashboard, with the same search code and the **same document card** (`src/doccard.js` now holds both; `src/dashboard.js` uses it too, with identical results).
* Visitors see the card only (name, category, short description, office, time). **View Step-by-Step Guide** asks them to log in or sign up first; after login they land on the guide they asked for (`sessionStorage` key `sx_next`, checked in `src/login.js`). Signed-in visitors open the guide directly.
* Works in English, मराठी and हिंदी: card text and messages go through the existing page translator; translated document names are also searchable. Small spelling slips ("adhaar", "certifcate") are corrected when nothing matches.
* Files: `src/finder.js` (new), `src/doccard.js` (new), `login.html` (search section + styles added, nothing removed), `src/login.js` (opens the requested guide after login), `src/translations.js` (Marathi / Hindi wording).
* Not covered: the 239 student schemes and the minority schemes have their own cards and no step-by-step guide, so they are not in this search.

---

## What is new in 6.0

### Minority Schemes (replaces Live Updates)

* New page `minority.html` (menu: **Minority Schemes**) built from *Merged Religious Minority Scheme List*: **210 scheme lines** for Muslim, Christian, Buddhist, Jain, Sikh and Parsi / Irani communities, plus a **For everyone** group (OBC / VJNT / SBC / SC category lists, general agriculture, general business).
* Landing view: one card per religion. Opening a religion shows its groups in the order of the source list: Minority Schemes, then OBC / SBC / VJNT / SC groups, then Central (PM VIKAS), Business, Education Loans, Agriculture.
* Groups that need an official category certificate carry **Only with official OBC / SBC / VJNT / SC certificate**. The **I hold an official certificate** chips hide the groups you cannot use. Items that say "verify" in the source show **Verify status**.
* **Show** filter: scholarships and fees, central schemes, business, education loans, agriculture. The search box searches every religion at once and shows a scheme that appears under several religions only once ("Listed for: Muslim, Christian, ...").
* Pointers in the source ("General agriculture schemes apply, see Section 8") became a button to the agriculture list. The 8 eligibility rules from section 10 are on the page ("Read this first" and a rules box).
* The view is saved in the address (`minority.html?r=muslim&cert=obc&type=scholarship`), and the browser Back button works.
* The old address `/updates` redirects to `/minority` (see `firebase.json`).

### Menu changes

* **Quick Access** is now **Documentation** (same page, `dashboard.html`).
* **Live Updates** is removed (page deleted). Home-page cards changed to match: Documentation, Minority Schemes, Student Schemes.
* Five menu items now fit on one line on laptop screens (small CSS rule at the end of `assets/style.css`).

### Editing the minority list

Change an item in `src/data/minority.js`, or replace `data-source/Merged_Religious_Minority_Scheme_List.docx` and run `python3 tools/build-minority-data.py` (needs `pip install python-docx`). Fields: `kind` (scholarship, central, business, loan, agri), `certs` (certificate a group needs), item flag `v` (verify) and `r` (pointer / none listed / remark).

**Important about the data.** The list has scheme names only: no amounts, income limits or last dates, so the page sends students to the official notice. It repeats the source's rule: being a minority does not by itself give OBC, SBC, VJNT or SC status.

---

# What was new in 5.O (fully audited)

## What is new in 5.O

### Student Schemes (replaces "Popular Documents")

* New page `schemes.html` (menu: **Schemes**) lists all **239 student schemes** from *Categorized Student Schemes Directory* in 13 groups (SC, ST, VJNT, OBC, SBC, Maratha/Kunbi, EWS/Open, Minority, Disability, Girls, Wards/Workers, Open merit/research, Multi-category).
* Search box (word-start matching, English plus a few Marathi/Hindi words) and filters: **caste / category**, **family yearly income**, **education level**, **what you are looking for** (scholarship, hostel, fellowship, coaching, skill training, study abroad, loan, grant), **run by** (Maharashtra Govt., Govt. of India, universities, municipal corporations, trusts/CSR), and "also applies to me" chips (girl, disability, ward of ex-serviceman/police, workers' family, orphan, religious minority).
* Girls-only, disability-only, wards-only, workers-only and orphan-only schemes stay hidden once a category or chip is chosen, until the matching chip is tapped.
* Income filter: choosing **Above Rs 8 lakh** hides schemes whose names point to an income test (shown as **Income limit likely**) with a one-tap "Show them anyway".
* Each card shows the scheme group, who it is for, a **Papers you may need** line that links to the matching Sarthi - X guides (income certificate, caste certificate, non-creamy layer, EWS, disability, domicile), and a **Find official details** search link.
* Filters are saved in the page address (`schemes.html?cat=obc&lvl=ug&sp=girls`), so a filtered list can be shared.
* From the home page, choosing the purpose **Scholarship** opens the Schemes page directly, with the category pre-selected (OBC / EWS / General; "SC / ST" is left for the student to pick).
* The home page card "Popular Documents" is now **Student Schemes**. Document search stays under **Documentation** (called Quick Access before 6.0).

**Important about the data.** The source list contains scheme *names only*. The filter tags (category, level, benefit type, income test, who runs it) are worked out from each name by `tools/build-schemes-data.py`. They are a guide, not an eligibility ruling. Income limits, amounts and last dates are not in the list, so the site sends students to the official notice. To add real limits, add fields to a scheme in `src/data/schemes.js`.

**Editing the list.** Change an object in `src/data/schemes.js`, or replace `data-source/Categorized_Student_Schemes_Directory.docx` and run `python3 tools/build-schemes-data.py` (needs `pip install python-docx`). Field meaning: `cats` who it is for, `sp` special situation, `lv` levels, `kind` benefit type, `by` provider, `need` income-tested / merit / open, `g` group number (1 to 13).

### Fixes found during the 5.O scan

* Removed `sarthi-x-documents.html`, an unlinked page left over from the first design (different look, no menu, loaded Google Fonts).
* The menu on phones scrolls sideways; the current page's tab now scrolls into view.
* Menu: "Quick Access" and "Popular Documents" both opened the same page; that duplicate is gone.
* Home page counters showed 0 forever and used invented figures (500 students, 2000 hours). They now show real numbers read from the data files: **138 documents covered** and **239 student schemes**.
* Audit pass on 5.O (second scan): the print frame in `src/download.js` fired twice (a blank page could print first); fixed. The home-page badge no longer claims "AI-Powered • 100% Accurate" (it is rule-based, and fees change), now "Personalised • Step-by-step • Amravati Verified". Scheme tags corrected: beedi / cine / mine workers' children were also tagged as service wards, UGC schemes were counted as "Universities", "State Government Hindi Language Scholarship" was counted as central, and #234 (Free Coaching for SC / OBC) was hidden from SC students. Light-mode contrast of the green scheme tags raised above the 4.5:1 minimum. Document cards no longer overflow a 320px phone. Search box and home-form selects have accessible names. The dashboard time card says how many documents its range is based on.

* Forms: every "Download" button makes a Sarthi - X worksheet (no official PDF address is set), so the button now says **Download worksheet**. Under the forms box, pages show the official portal whose address was checked: UIDAI for Aadhaar, Aaple Sarkar for caste, domicile and income certificates. No portal is shown for the birth certificate (no verified address). To open an official PDF directly, paste its address into `FORM_LINKS` in `src/forms.js`.
* Live Updates no longer says "coming soon" with nothing behind it. It explains that live deadlines are not built, and lists the official portals to check (Aaple Sarkar, MahaDBT, National Scholarship Portal, UIDAI).
* `firebase.json` now sends basic security headers (nosniff, frame, referrer, permissions). A `404.html` page was added. A Content-Security-Policy was NOT added: it could not be tested against real Firebase login and a wrong policy would block sign-in.
* Scheme tags such as "Income limit likely" and "Run by" are worked out from scheme names. The Schemes page now says so.

### Known limits (5.O)

* Only 5 of 138 documents have fees and processing times (the five hand-written pages). The source guide has no numbers for the rest, so none were invented.
* Translation: menus and labels are translated offline from a built-in dictionary; everything else (scheme names, guide text, messages) is translated live with a keyless service and cached in the browser. No API key is needed. See section 5.
* Scheme data has names only: no amounts, income limits or dates.
* Not verified here: real Firebase login / OTP, `vite build`, live translation.

---

# What was new in 4.O

## What is new in 4.O

### 138 Amravati documents (from the official guide PDF)

* `src/data/services.js` holds all 138 services from *SARTHI-X Amravati Government Document Guide (Corrected Integration Edition, verified 2 October 2026)*: where to go, who handles it, online route, office counter, documents to carry, and the Before you go / At the office / Online / When you receive steps.
* `src/data/services-index.js` is a light copy used by the dashboard search (keeps the dashboard fast).
* `guide.html?s=<id>` is one page template that shows any service. Example: `guide.html?s=ration-card`.
* The five hand-written pages (Aadhaar, Birth, Caste, Domicile, Income) are kept. They keep their fee and timing details and now link to the full route guide.
* Dashboard search works across all 138 documents (English words, Marathi/Hindi keywords such as आधार or सातबारा), with 14 category filters and a **Show more** button.
* To edit a service, change its object in `src/data/services.js` (and the matching entry in `services-index.js` if you change the title, category or keywords).
* Official fees and processing times are not in the PDF, so they are shown only for the five hand-written pages. Add `min` / `max` (days) to a service in both data files to show a timeline.

### Dark mode

* Use the sun / moon button in the header (and at the top of the login page).
* The choice is remembered in the browser. Until a choice is made, the site follows the device's light / dark setting.
* Colours come from CSS variables in `assets/style.css` (section "Dark mode (v4)"). New components should use `var(--surface)`, `var(--line)`, `var(--ink)` instead of fixed colours.
* Every page has a small script in `<head>` that sets the theme before the first paint, so there is no white flash. Copy it into any new page you add.

### Running 5.O

Your `node_modules` folder is not included in the zip. Run `npm install` once, then `npm run dev`.

## 1. Firebase Console (one time)

1. Authentication -> Sign-in method: enable **Google**, **Phone**, **Email/Password**.
2. Authentication -> Settings -> Authorized domains: make sure `localhost` and your hosting domain are listed.
3. Firestore Database -> Create database, then paste `firestore.rules` into the Rules tab and Publish.
4. Project settings -> Your apps -> add a **Web app** and copy its config values.

   > Phone sign-in may require the Blaze plan. For free testing, add fixed test numbers under Authentication -> Sign-in method -> Phone.

## 2. Add your keys

Open `.env` and fill the six `VITE_FIREBASE_*` values (see `.env.example`).

Use only the **web app config**. Never put a service-account JSON (`private_key`) in this project.

## 3. Run

```bash
npm install
npm run dev
```

The development server runs at:

```text
http://localhost:5173
```

The login page opens first.

## 4. Deploy (optional)

```bash
npm run build
npx firebase-tools login
npx firebase-tools init hosting
npx firebase-tools deploy
```

For Firebase Hosting initialization:

* Public directory: `dist`
* Multi-page application: **Yes**
* SPA rewrite: **No**

Restart `npm run dev` after any change to `.env`.

## 5. Languages (English / मराठी / हिंदी), no API key needed

Pick a language with the button in the header (also on the login page). The **whole page** is translated: menus, headings, buttons, labels, placeholders, filters, scheme names, guide steps, error and success messages, and the browser tab title. Your choice is remembered.

How it works (`src/i18n.js` + `src/translator.js`):

1. Text found in the built-in dictionary (`src/translations.js`) is used first. You can edit it to correct any wording.
2. Otherwise the saved copy in the browser (IndexedDB) is used.
3. Otherwise the text is translated live and then saved, so each sentence is requested only once per browser.

Live translation uses, in order: **Google's web translation endpoint** (keyless), then **MyMemory** (keyless fallback). Nothing to configure.

A watcher translates anything the app draws later (search results, "Show more", filters, validation messages), so new content is covered automatically. If translation cannot be reached, the page stays in English, a notice appears in the chosen language, and it retries by itself.

* **Add a language:** add one line to `LANGS` in `src/i18n.js`, for example `{ code: 'gu', label: 'ગુજરાતી' }`. No other change is needed.
* **New scheme / guide data** is translated automatically; you never have to write translations for it.
* **Before a public launch (recommended):** the free endpoints have no guarantee and may throttle heavy traffic. Put your own small proxy in front and set `VITE_TRANSLATE_ENDPOINT` in `.env`. The app will call it first and use the free endpoints only as a fallback. Contract:

  `POST { "texts": ["..."], "source": "en", "target": "mr" }` returns `{ "translations": ["..."] }` (same length and order).

  A Firebase Cloud Function that calls Google Cloud Translation or LibreTranslate behind this contract keeps any key private.

## 6. Download buttons

* **Download guide (PDF)** under the key facts on every document page opens the print window with the whole step-by-step guide.
* **Download** next to a form: if you set its official link in `src/forms.js`, it opens that link.
* If the official link is empty, it downloads a printable Sarthi - X *application worksheet* containing:

  * Checklist
  * Office
  * Officer
  * Blank fields
  * Your name
  * Your email

In the print window, choose **Save as PDF**.

The PDF follows the language selected on the page.

## 7. Project Structure

```text
sarthi-x/
├── assets/
│   └── style.css
├── public/
│   ├── art/ (login-hero.svg, login-side-left.svg, login-side-right.svg)
│   └── sw.js, manifest, icons
├── src/
│   ├── auth.js
│   ├── common.js
│   ├── data/
│   │   ├── schemes.js
│   │   ├── services.js
│   │   └── services-index.js
│   ├── dashboard.js
│   ├── docpage.js
│   ├── download.js
│   ├── firebase.js
│   ├── forms.js
│   ├── guide.js
│   ├── home.js
│   ├── schemes.js
│   ├── i18n.js
│   ├── translator.js
│   ├── login.js
│   ├── theme.js
│   └── translations.js
├── .env.example
├── .gitignore
├── firebase.json
├── firestore.rules
├── index.html
├── login.html
├── dashboard.html
├── guide.html
├── schemes.html
├── tools/build-schemes-data.py
├── data-source/Categorized_Student_Schemes_Directory.docx
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

## 8. GitHub

After resolving the README conflict, commit the changes:

```bash
git add README.md
git commit -m "Resolve README merge conflict"
git push -u origin main
```

## 9. Security

Never commit sensitive credentials or private service-account files.

Do **not** upload:

```text
.env
serviceAccountKey.json
firebase-adminsdk-*.json
```

Firebase Web configuration values can be present in frontend applications, but server-side secrets and private keys must never be exposed in client-side code.

---

## 9.O Star version: Star / Save, step checklist, Expired Documents, Profile

**What was added (nothing existing was removed or redesigned)**

| Feature | Where |
|---|---|
| ☆ / ★ Star on every scheme card, every document card and every document page | `src/star-ui.js`, used by `schemes.js`, `dashboard.js`, `doc-extras.js` |
| Profile page: Starred Schemes, Starred Documents, Expired Documents (+ documents being tracked) | `profile.html`, `src/profile.js`; reached from the user menu ("Profile") |
| ☐ / ☑ on every step + "3 / 5 steps completed" progress bar | `src/doc-extras.js` (reads the steps already on the page, so all 138 guides and the 5 hand-written pages get it) |
| Expiry date of the user's own copy of a document (feeds Expired Documents) | card on every document page, `src/doc-extras.js` |
| Marathi + Hindi wording | `src/data/star-translations.js` (merged by `src/translations.js`, never overrides an existing entry) |

**Where the data lives.** In the user's existing Firestore document `users/{uid}` (same document as the home-page profile), so the
existing security rule already restricts it to that user and `firestore.rules` needs **no change**. Fields: `starredSchemes`,
`starredDocs`, `steps` (`{guideId: ["a1","b2"]}`), `docExpiry` (`{guideId: "YYYY-MM-DD"}`). Writes use `arrayUnion` / `arrayRemove`, so
double clicks and two devices can never duplicate or wipe each other's data. A live listener keeps all pages and tabs in sync.
`src/lib/user-rules.js` holds the validation and date rules (unit-tested in `tests/star.test.mjs`).

**Expired Documents.** SarathiX had no per-user document records or expiry dates (the 138 guides describe *how to get* a document), so
there was nothing to reuse. The expiry card on each document page is the minimal addition: a document is valid through its expiry
day and listed as expired from the next day. The existing `parseDate` / `formatDate` helpers are reused.

**Step progress on guide.html.** "Before you go" plus the route that is open (office or online) are counted; the other route is not,
because they are alternatives. Ticks on the hidden route are kept.

**Note:** `npm install` + `npm run check` still apply. Star data is local-cache-only for speed and is removed on log out.
