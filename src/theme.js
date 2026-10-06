// Light / dark mode.
//  - Saved choice lives in localStorage ("sx_theme" = "light" | "dark").
//  - With no saved choice the site follows the device setting (prefers-color-scheme).
//  - Every page also runs a tiny inline script in <head> (see THEME_BOOT in README) so the
//    right theme is applied before the first paint (no white flash).
const KEY = 'sx_theme';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const saved = () => { try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch { return null; } };
export const currentTheme = () => saved() || (mq && mq.matches ? 'dark' : 'light');

const MOON = '<svg class="ic-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const SUN = '<svg class="ic-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function apply(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = theme === 'dark' ? '#0A1020' : '#ffffff';
  document.querySelectorAll('.theme-toggle').forEach((b) => {
    b.setAttribute('aria-pressed', String(theme === 'dark'));
    b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    b.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  });
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch {}
  const root = document.documentElement;
  root.classList.add('theme-anim');
  apply(theme);
  setTimeout(() => root.classList.remove('theme-anim'), 350);
}
export const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

function makeButton(extraClass = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'theme-toggle ' + extraClass;
  b.setAttribute('data-no-translate', '');
  b.innerHTML = MOON + SUN;
  b.addEventListener('click', toggleTheme);
  return b;
}

function mount() {
  if (document.querySelector('.theme-toggle')) return;
  const right = document.querySelector('.header-right, .header-right2');
  const row = document.querySelector('.nav-row, .nav-row2');
  if (right) right.insertBefore(makeButton(), right.firstChild);
  else if (row) row.appendChild(makeButton());
  else document.body.appendChild(makeButton('theme-float')); // login page has no header
}

apply(currentTheme());
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mount(); apply(currentTheme()); });
else { mount(); apply(currentTheme()); }

// Follow the device setting until the visitor picks a theme; keep tabs in sync.
mq && mq.addEventListener && mq.addEventListener('change', () => { if (!saved()) apply(currentTheme()); });
window.addEventListener('storage', (e) => { if (e.key === KEY) apply(currentTheme()); });
