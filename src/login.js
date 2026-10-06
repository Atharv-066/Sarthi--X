import './theme.js'; // light / dark mode toggle
import './i18n.js';
import './finder.js'; // logged-out document search (preview only)
import { auth, configMissing } from './firebase.js';
import { authReadyRaw, reveal, saveUserDoc, ensureUserDoc, HOME_PAGE } from './auth.js';
import { validateCredentials, isEmail, needsEmailVerification, MIN_PASSWORD } from './lib/auth-validate.js';
import {
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, sendEmailVerification, deleteUser, signOut, RecaptchaVerifier, signInWithPhoneNumber,
} from 'firebase/auth';

const $ = (id) => document.getElementById(id);
let mode = 'login';

// After login: if the visitor asked for a guide from the document search, open it; otherwise the usual home page.
const GUIDE_LINK = /^(guide\.html\?s=[a-z0-9-]+|doc-[a-z-]+\.html)$/;
const nextPage = () => {
  try {
    const n = sessionStorage.getItem('sx_next');
    sessionStorage.removeItem('sx_next');
    if (n && GUIDE_LINK.test(n)) return n;
  } catch {}
  return HOME_PAGE;
};
const done = () => location.replace(nextPage());
const show = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
const hideMsgs = () => { $('err').style.display = 'none'; $('ok').style.display = 'none'; };

/* Inline, per-field validation messages (created on demand, announced to screen readers via role=alert). */
const FIELD_INPUT = { name: 'name', email: 'email', password: 'pass', confirm: 'pass2' };
function clearFieldErrors() {
  for (const id of Object.values(FIELD_INPUT)) {
    const input = $(id); if (!input) continue;
    input.removeAttribute('aria-invalid');
    const box = document.getElementById('fe-' + id);
    if (box) box.remove();
  }
}
function showFieldErrors(errors) {
  clearFieldErrors();
  let first = null;
  for (const [field, msg] of Object.entries(errors)) {
    const input = $(FIELD_INPUT[field]); if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const box = document.createElement('div');
    box.className = 'ferr'; box.id = 'fe-' + input.id; box.setAttribute('role', 'alert'); box.textContent = msg;
    (input.closest('.pw') || input).insertAdjacentElement('afterend', box);
    input.setAttribute('aria-describedby', box.id);
    first ||= input;
  }
  first?.focus();
}

const ERRORS = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/user-not-found': 'No account found for this email. Please sign up first.',
  'auth/email-already-in-use': 'An account with this email already exists. Please log in.',
  'auth/weak-password': `Password is too weak. Use at least ${MIN_PASSWORD} characters.`,
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google pop-up. Please allow pop-ups and try again.',
  'auth/invalid-phone-number': 'Enter a valid 10-digit Indian mobile number.',
  'auth/invalid-verification-code': 'Incorrect OTP. Please try again.',
  'auth/code-expired': 'This OTP has expired. Please request a new one.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console (Authentication > Sign-in method).',
  'auth/unauthorized-domain': 'This domain is not authorised. Add it in Firebase Console > Authentication > Settings > Authorized domains.',
  'auth/billing-not-enabled': 'Phone sign-in needs billing enabled on the Firebase project (Blaze plan).',
  'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
  'auth/captcha-check-failed': 'reCAPTCHA check failed. Please try again.',
  'auth/requires-recent-login': 'For your security, please log in again and retry.',
  'auth/user-disabled': 'This account has been disabled.',
};
const explain = (e) => ERRORS[e?.code] || e?.message || 'Something went wrong. Please try again.';

/* ---------- start-up ---------- */
if (configMissing.length) {
  const cfg = $('cfg');
  cfg.style.display = 'block';
  cfg.textContent = 'Firebase is not configured yet. Copy .env.example to .env, fill in ' + configMissing.join(', ') + ', then restart "npm run dev".';
  document.querySelectorAll('.card button, .card input').forEach((el) => (el.disabled = true));
  reveal();
} else {
  // An email account that was created but never verified goes back to the "check your email" screen, not into the site.
  authReadyRaw.then((user) => {
    if (!user) return reveal();
    if (needsEmailVerification(user)) { showVerify(user); reveal(); checkVerified(); return; } // already clicked the link? continue straight away
    // Already signed in: make sure the profile exists (short wait only, then go on), then open the site.
    Promise.race([ensureUserDoc(user), new Promise((r) => setTimeout(r, 2500))]).then(done);
  });
}

/* ---------- tabs ---------- */
function setMode(m) {
  mode = m; hideMsgs(); clearFieldErrors();
  const signup = m === 'signup';
  $('tabLogin').classList.toggle('on', !signup);
  $('tabSignup').classList.toggle('on', signup);
  $('nameRow').classList.toggle('hide', !signup);
  $('confirmRow').classList.toggle('hide', !signup);
  $('forgotRow').classList.toggle('hide', signup);
  if (!signup) $('pass2').value = ''; // never keep a stale confirmation around
  $('title').textContent = signup ? 'Create your account' : 'Welcome back';
  $('sub').textContent = signup ? 'Sign up free to get your personalised document roadmap.' : 'Log in to continue to Sarthi - X.';
  $('go').textContent = signup ? 'Create Account' : 'Log In';
  $('pass').autocomplete = signup ? 'new-password' : 'current-password';
  $('alt').innerHTML = signup ? 'Already have an account? <a id="swap">Log in</a>' : 'New to Sarthi - X? <a id="swap">Create an account</a>';
}
// The line under the button is re-written when the language changes, so the click is caught on the line itself (not on the link).
$('alt').addEventListener('click', (e) => { if (e.target.closest('#swap')) setMode(mode === 'signup' ? 'login' : 'signup'); });
$('tabLogin').onclick = () => setMode('login');
$('tabSignup').onclick = () => setMode('signup');
setMode('login');
function wireShow(btnId, inputId) {
  $(btnId).onclick = function () {
    const p = $(inputId), hidden = p.type === 'password';
    p.type = hidden ? 'text' : 'password';
    this.textContent = hidden ? 'Hide' : 'Show';
  };
}
wireShow('show', 'pass');
wireShow('show2', 'pass2');
// clear a field's message as soon as the visitor starts fixing it
for (const id of Object.values(FIELD_INPUT)) {
  $(id)?.addEventListener('input', () => { $(id).removeAttribute('aria-invalid'); document.getElementById('fe-' + id)?.remove(); });
}

/* ---------- email + password ---------- */
$('form').onsubmit = async (ev) => {
  ev.preventDefault(); hideMsgs();
  const name = $('name').value.trim(), email = $('email').value.trim(), pass = $('pass').value, confirm = $('pass2').value;
  const check = validateCredentials({ mode, name, email, password: pass, confirm });
  if (!check.ok) return showFieldErrors(check.errors); // nothing is sent to Firebase
  clearFieldErrors();
  $('go').disabled = true;
  try {
    let cred;
    if (mode === 'signup') {
      // Firebase Authentication stores a salted hash of the password server-side; it is never kept in the page, URL, storage or Firestore.
      cred = await createUserWithEmailAndPassword(auth, email, pass);
      try { await updateProfile(cred.user, { displayName: name }); } catch (e) { console.warn('[Sarthi - X] Could not set display name:', e?.code); }
      // Firebase accepts ANY well-formed address, so the account is only usable after the owner clicks the link we email.
      let sendError = null;
      try { await sendVerification(cred.user); } catch (e) { sendError = e; }
      $('go').disabled = false;
      showVerify(cred.user, { sent: !sendError });
      if (sendError) show($('vErr'), 'Your account was created, but we could not send the verification email: ' + explain(sendError) + ' Tap "Resend email" to try again.');
      return;
    }
    cred = await signInWithEmailAndPassword(auth, email, pass);
    if (needsEmailVerification(cred.user)) {
      $('go').disabled = false;
      showVerify(cred.user);
      show($('vErr'), 'This email address is not verified yet. Open the link we sent you, or tap "Resend email" to get a new one.');
      return;
    }
    await saveUserDoc(cred.user);
    done();
  } catch (e) {
    $('go').disabled = false;
    show($('err'), explain(e));
  }
};

/* ---------- email verification screen ---------- */
const card = $('card');
let pendingUser = null, pollTimer = null, cooldownTimer = null, checking = false;

const hideV = () => { $('vErr').style.display = 'none'; $('vOk').style.display = 'none'; };

async function sendVerification(user) {
  // Bring the person back to this page after the link; fall back to Firebase's own page if the domain is not authorised yet.
  try { await sendEmailVerification(user, { url: location.origin + '/login.html' }); }
  catch (e) {
    if (e?.code === 'auth/unauthorized-continue-uri' || e?.code === 'auth/invalid-continue-uri' || e?.code === 'auth/missing-continue-uri') await sendEmailVerification(user);
    else throw e;
  }
}

function startCooldown(seconds) {
  clearInterval(cooldownTimer);
  const btn = $('vResend'), wait = $('vWait');
  let left = seconds;
  btn.disabled = true; wait.textContent = ' (' + left + 's)';
  cooldownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) { clearInterval(cooldownTimer); btn.disabled = false; wait.textContent = ''; }
    else wait.textContent = ' (' + left + 's)';
  }, 1000);
}

function showVerify(user, { sent = false } = {}) {
  pendingUser = user;
  hideMsgs(); hideV();
  $('vEmail').textContent = user.email || '';
  card.classList.add('verifying');
  if (sent) startCooldown(45);
  clearInterval(pollTimer);
  pollTimer = setInterval(() => checkVerified(), 6000); // pick up the click from the email without a button press
}

function hideVerify() {
  clearInterval(pollTimer); clearInterval(cooldownTimer);
  pendingUser = null;
  $('vResend').disabled = false; $('vWait').textContent = '';
  card.classList.remove('verifying');
  hideV();
}

async function checkVerified({ manual = false } = {}) {
  const user = pendingUser;
  if (!user || checking) return;
  checking = true;
  if (manual) { hideV(); $('vDone').disabled = true; }
  try {
    await user.reload();
    if (user.emailVerified) {
      await user.getIdToken(true); // refresh the token so Firestore sees email_verified = true
      clearInterval(pollTimer);
      await saveUserDoc(user);
      done();
      return;
    }
    if (manual) show($('vErr'), 'Not verified yet. Open the link in the email we sent you (check Spam / Promotions too), then tap this button again.');
  } catch (e) {
    if (manual) show($('vErr'), explain(e));
  } finally {
    checking = false;
    $('vDone').disabled = false;
  }
}

$('vDone').onclick = () => checkVerified({ manual: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVerified(); }); // back from the mail app / tab

$('vResend').onclick = async () => {
  if (!pendingUser) return;
  hideV();
  $('vResend').disabled = true;
  try {
    await sendVerification(pendingUser);
    show($('vOk'), 'A new verification link was sent to ' + pendingUser.email + '.');
    startCooldown(45);
  } catch (e) {
    $('vResend').disabled = false;
    show($('vErr'), explain(e));
  }
};

// Typed the wrong address? Remove the unverified account so the right address can sign up, then return to the form.
$('vChange').onclick = async () => {
  const u = pendingUser;
  hideVerify();
  try { if (u && needsEmailVerification(u)) await deleteUser(u); } catch (e) { console.warn('[Sarthi - X] Could not remove the unverified account:', e?.code); }
  try { await signOut(auth); } catch {}
  setMode('signup');
  $('email').value = ''; $('pass').value = ''; $('pass2').value = '';
  $('email').focus();
};

$('vBack').onclick = async () => {
  hideVerify();
  try { await signOut(auth); } catch {}
  setMode('login');
};

$('forgot').onclick = async () => {
  hideMsgs();
  const email = $('email').value.trim();
  if (!isEmail(email)) return show($('err'), 'Enter your email above first, then click "Forgot password?".');
  try {
    await sendPasswordResetEmail(auth, email);
    show($('ok'), 'If an account exists for ' + email + ', a password reset link has been sent. Check your inbox and spam folder.');
  } catch (e) { show($('err'), explain(e)); }
};

/* ---------- Google ---------- */
$('gBtn').onclick = async () => {
  hideMsgs();
  $('gBtn').disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    await saveUserDoc(cred.user);
    done();
  } catch (e) {
    $('gBtn').disabled = false;
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') show($('err'), explain(e));
  }
};

/* ---------- Mobile OTP ---------- */
let verifier = null, confirmation = null, phone = '';
const pErr = $('pErr');

function resetVerifier() {
  try { verifier?.clear(); } catch {}
  verifier = null;
  $('recaptcha-container').innerHTML = '';
}
function getVerifier() {
  verifier ||= new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  return verifier;
}
function openPhoneModal() {
  pErr.style.display = 'none';
  $('pStep1').classList.remove('hide');
  $('pStep2').classList.add('hide');
  $('otp').value = '';
  $('pModal').classList.add('open');
}
async function sendOtp() {
  pErr.style.display = 'none';
  phone = $('phone').value.replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(phone)) return show(pErr, 'Enter a valid 10-digit Indian mobile number.');
  $('sendOtp').disabled = true; $('resendOtp').disabled = true;
  try {
    confirmation = await signInWithPhoneNumber(auth, '+91' + phone, getVerifier());
    $('otpHint').textContent = 'We sent a 6-digit OTP to +91 ' + phone + '.';
    $('pStep1').classList.add('hide');
    $('pStep2').classList.remove('hide');
    $('otp').focus();
  } catch (e) {
    resetVerifier();
    show(pErr, explain(e));
  } finally {
    $('sendOtp').disabled = false; $('resendOtp').disabled = false;
  }
}
$('pBtn').onclick = openPhoneModal;
$('sendOtp').onclick = sendOtp;
$('resendOtp').onclick = () => { resetVerifier(); sendOtp(); };
$('changeNum').onclick = () => { resetVerifier(); openPhoneModal(); };
$('verifyOtp').onclick = async () => {
  pErr.style.display = 'none';
  const code = $('otp').value.replace(/\D/g, '');
  if (code.length !== 6) return show(pErr, 'Enter the 6-digit OTP.');
  $('verifyOtp').disabled = true;
  try {
    const cred = await confirmation.confirm(code);
    await saveUserDoc(cred.user, { phone: '+91' + phone });
    done();
  } catch (e) {
    $('verifyOtp').disabled = false;
    show(pErr, explain(e));
  }
};
document.querySelectorAll('[data-close]').forEach((b) => {
  b.onclick = () => { $(b.getAttribute('data-close')).classList.remove('open'); resetVerifier(); };
});
