// Shared behaviour for every protected page.
import { requireAuth, openPage } from './auth.js';
import './pwa.js'; // installable app + static-file caching (production only)
import './theme.js'; // light / dark mode toggle
import './i18n.js'; // language switcher (English / मराठी / हिंदी) + keyless page translation

// Citizen guides are public information: a page marked <body data-public> is shown without login.
// Account pages (home profile, dashboard, schemes, ...) keep the login requirement.
if (document.body.hasAttribute('data-public')) openPage(); else requireAuth();

const header = document.getElementById('siteHeader');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// On phones the menu scrolls sideways: bring the current page's tab into view.
document.querySelector('nav.main a.active, nav.main2 a.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
