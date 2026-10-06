// Client-side checks for the email + password form on login.html (pure functions, unit-tested in tests/lib.test.mjs).
// These only decide whether a request is worth sending. Whether the email really belongs to the person is proven by the
// verification link (sendEmailVerification) - see login.js and needsEmailVerification below. The password itself is verified by Firebase Authentication
// (createUserWithEmailAndPassword / signInWithEmailAndPassword) - nothing here stores or compares real credentials.

export const MIN_PASSWORD = 6; // Firebase Authentication's own minimum

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s) => EMAIL_RE.test(String(s ?? '').trim());

// Domains people commonly mistype -> the domain they almost certainly meant (sign-up only asks them to double-check).
const DOMAIN_FIXES = {
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com',
  'yahho.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'outllok.com': 'outlook.com',
};

/** 'ravi@gmial.com' -> 'ravi@gmail.com'. Returns null when the domain is not a known misspelling. */
export function suggestEmailFix(email) {
  const e = String(email ?? '').trim();
  const at = e.lastIndexOf('@');
  if (at < 1) return null;
  const fixed = DOMAIN_FIXES[e.slice(at + 1).toLowerCase()];
  return fixed ? e.slice(0, at + 1) + fixed : null;
}

/**
 * True for an email + password account whose inbox has not been confirmed yet.
 * Firebase creates such an account for ANY well-formed address, so the site must not treat it as signed in.
 * Google accounts arrive already verified and phone (OTP) accounts have no email, so both return false.
 */
export function needsEmailVerification(user) {
  if (!user || user.emailVerified) return false;
  return Array.isArray(user.providerData) && user.providerData.some((p) => p && p.providerId === 'password');
}

/**
 * mode: 'login' | 'signup'. Returns { ok, errors } where errors maps a field (name, email, password, confirm) to a message.
 * Login only requires an email and a non-empty password (Firebase decides whether it is correct);
 * sign-up also needs a name, a password of at least MIN_PASSWORD characters, and a matching confirmation.
 */
export function validateCredentials({ mode, name = '', email = '', password = '', confirm = '' }) {
  const errors = {};
  const signup = mode === 'signup';
  const e = String(email ?? '').trim();

  if (signup && String(name ?? '').trim().length < 2) errors.name = 'Please enter your full name.';

  if (!e) errors.email = 'Please enter your email address.';
  else if (!isEmail(e)) errors.email = 'Please enter a valid email address, e.g. you@example.com.';
  else if (signup && suggestEmailFix(e)) errors.email = `Did you mean ${suggestEmailFix(e)}? Please check the spelling of your email.`;

  if (!password) errors.password = signup ? 'Please create a password.' : 'Please enter your password.';
  else if (signup && password.length < MIN_PASSWORD) errors.password = `Password must be at least ${MIN_PASSWORD} characters.`;

  if (signup) {
    if (!confirm) errors.confirm = 'Please confirm your password.';
    else if (password && confirm !== password) errors.confirm = 'Passwords do not match.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
