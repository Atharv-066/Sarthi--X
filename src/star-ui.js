// The Star button used on schemes, documents (dashboard cards, guide pages) and in Profile.
//   starButtonHTML('scheme' | 'doc', id, { text: true, toast: true })  -> markup (text: the word "Star" / "Starred" next to the icon; toast: say "Added to / Removed from starred" after a click)
//   syncStars(root)                                       -> makes every .sx-star under `root` match the saved state
// One click handler for the whole page; every button for the same item updates together, in every open tab.
// Unstarred = ☆   Starred = ★ (filled, amber).
import { subscribe, toggleStar, isStarred } from './userdata.js';
import { tr, getLang, toast } from './i18n.js';
import { cleanId } from './lib/user-rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* The button's own words are translated here (not by the page-wide engine) because they change when the star changes. */
const EN = { add: 'Add to starred', remove: 'Remove from starred', star: 'Star', starred: 'Starred' };
let words = { ...EN };
async function loadWords() {
  const keys = Object.keys(EN);
  const out = await tr(keys.map((k) => EN[k]), getLang());
  words = Object.fromEntries(keys.map((k, i) => [k, out[i]]));
  syncStars();
}

export function starButtonHTML(kind, id, { text = false, toast: notify = false } = {}) {
  const cid = cleanId(kind, id);
  if (!cid) return '';
  return `<button type="button" class="sx-star${text ? ' sx-star-text' : ''}"${notify ? ' data-toast' : ''} data-star="${kind}" data-id="${esc(cid)}" aria-pressed="false" aria-label="${esc(EN.add)}" title="${esc(EN.add)}" data-no-translate><span class="sx-star-ic" aria-hidden="true">☆</span>${text ? `<span class="sx-star-tx">${esc(EN.star)}</span>` : ''}</button>`;
}

export function syncStars(root = document) {
  root.querySelectorAll('.sx-star').forEach((b) => {
    const on = isStarred(b.dataset.star, b.dataset.id);
    const label = on ? words.remove : words.add;
    // Write only what changed: the page translator watches the DOM and re-scans the page after every write.
    if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
    if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
    if (b.getAttribute('aria-label') !== label) { b.setAttribute('aria-label', label); b.title = label; }
    const ic = b.querySelector('.sx-star-ic'); const icon = on ? '★' : '☆'; if (ic && ic.textContent !== icon) ic.textContent = icon;
    const tx = b.querySelector('.sx-star-tx'); const word = on ? words.starred : words.star; if (tx && tx.textContent !== word) tx.textContent = word;
  });
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest?.('.sx-star');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const on = await toggleStar(b.dataset.star, b.dataset.id); // null = nothing changed (signed out / could not save): the message is already shown
  if (on === null) return;
  if (on) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  if (b.hasAttribute('data-toast')) toast(on ? 'Added to starred' : 'Removed from starred');
});

subscribe(() => syncStars());                 // saved state changed (this tab, another tab, another device)
document.addEventListener('sx:langchange', loadWords);
if (getLang() !== 'en') loadWords();
