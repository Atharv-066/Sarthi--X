import './i18n.js';
import { auth, configMissing } from './firebase.js';
import { authReady, reveal, saveUserDoc, HOME_PAGE } from './auth.js';
import {
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, RecaptchaVerifier, signInWithPhoneNumber,
} from 'firebase/auth';

const $ = (id) => document.getElementById(id);
let mode = 'login';

const done = () => location.replace(HOME_PAGE);
const show = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
const hideMsgs = () => { $('err').style.display = 'none'; $('ok').style.display = 'none'; };

const ERRORS = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/user-not-found': 'No account found for this email. Please sign up first.',
  'auth/email-already-in-use': 'An account with this email already exists. Please log in.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
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
  authReady.then((user) => (user ? done() : reveal()));
}

/* ---------- tabs ---------- */
function setMode(m) {
  mode = m; hideMsgs();
  const signup = m === 'signup';
  $('tabLogin').classList.toggle('on', !signup);
  $('tabSignup').classList.toggle('on', signup);
  $('nameRow').classList.toggle('hide', !signup);
  $('forgotRow').classList.toggle('hide', signup);
  $('title').textContent = signup ? 'Create your account' : 'Welcome back';
  $('sub').textContent = signup ? 'Sign up free to get your personalised document roadmap.' : 'Log in to continue to Sarthi - X.';
  $('go').textContent = signup ? 'Create Account' : 'Log In';
  $('pass').autocomplete = signup ? 'new-password' : 'current-password';
  $('alt').innerHTML = signup ? 'Already have an account? <a id="swap">Log in</a>' : 'New to Sarthi - X? <a id="swap">Create an account</a>';
  $('swap').onclick = () => setMode(signup ? 'login' : 'signup');
}
$('tabLogin').onclick = () => setMode('login');
$('tabSignup').onclick = () => setMode('signup');
setMode('login');
$('show').onclick = function () {
  const p = $('pass'), hidden = p.type === 'password';
  p.type = hidden ? 'text' : 'password';
  this.textContent = hidden ? 'Hide' : 'Show';
};

/* ---------- email + password ---------- */
$('form').onsubmit = async (ev) => {
  ev.preventDefault(); hideMsgs();
  const name = $('name').value.trim(), email = $('email').value.trim(), pass = $('pass').value;
  if (mode === 'signup' && name.length < 2) return show($('err'), 'Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show($('err'), 'Please enter a valid email address.');
  if (pass.length < 6) return show($('err'), 'Password must be at least 6 characters.');
  $('go').disabled = true;
  try {
    let cred;
    if (mode === 'signup') {
      cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await saveUserDoc(cred.user, { name });
    } else {
      cred = await signInWithEmailAndPassword(auth, email, pass);
      await saveUserDoc(cred.user);
    }
    done();
  } catch (e) {
    $('go').disabled = false;
    show($('err'), explain(e));
  }
};

$('forgot').onclick = async () => {
  hideMsgs();
  const email = $('email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show($('err'), 'Enter your email above first, then click "Forgot password?".');
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
