import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const REQUIRED = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
};

/** Names of required .env values that are empty (or still placeholders). */
export const configMissing = Object.entries(REQUIRED)
  .filter(([, v]) => !v || /^(your|xxx|changeme)/i.test(String(v).trim()))
  .map(([k]) => k);

let app = null, auth = null, db = null;
if (configMissing.length === 0) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.error('[Sarthi - X] Firebase is not configured. Missing in .env:', configMissing.join(', '));
}

export { app, auth, db };
