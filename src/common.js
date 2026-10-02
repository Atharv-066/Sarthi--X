// Shared behaviour for every protected page.
import { requireAuth } from './auth.js';
import './i18n.js'; // language switcher (English / मराठी / हिंदी) + Bhashini translation

requireAuth();

const header = document.getElementById('siteHeader');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
