// Registers the service worker (public/sw.js) so the app is installable and repeat visits load faster.
// Production only: during `npm run dev` a service worker would serve stale files and confuse development.
if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('[Sarthi - X] Service worker not registered:', e));
  });
}
