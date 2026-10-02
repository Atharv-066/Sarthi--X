# Sarthi - X 3.O (Firebase edition)

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

## 5. Languages (English / मराठी / हिंदी) with Bhashini

1. Open `.env` and fill `VITE_BHASHINI_USER_ID` and `VITE_BHASHINI_API_KEY` (both come from your Bhashini / ULCA account).
2. Restart `npm run dev`.
3. Use the language button in the header. It is also available on the login page.

The whole page is translated, including search results, and the selected language is remembered.

Translations are cached in the browser, so each sentence is requested only once.

* The menu and common labels (`src/translations.js`) are built in and work even without Bhashini keys. You can edit them.
* During `npm run dev`, calls go through Vite's proxy (`vite.config.js`) so the browser does not hit CORS errors.
* **Before a public launch:** `VITE_*` values are visible in the browser. Move the two Bhashini calls in `src/bhashini.js` to a small Cloud Function / server that keeps the key private, and point `bhashini.js` at it.

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
├── src/
│   ├── auth.js
│   ├── bhashini.js
│   ├── common.js
│   ├── dashboard.js
│   ├── docpage.js
│   ├── download.js
│   ├── firebase.js
│   ├── forms.js
│   ├── home.js
│   ├── i18n.js
│   ├── login.js
│   └── translations.js
├── .env.example
├── .gitignore
├── firebase.json
├── firestore.rules
├── index.html
├── login.html
├── dashboard.html
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
