// Reads the key facts of the guide that is on screen (text exactly as the reader sees it, in the chosen language).
// Works for guide.html and for the hand-written doc-*.html pages. Only returns what is actually on the page.
const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

export function readFacts(root = document) {
  const q = (sel) => root.querySelector(sel);
  return {
    title: txt(q('.doc-hero h1')),
    fee: txt(q('[data-fact="fee"] .n')),
    time: txt(q('[data-fact="time"] .n')),
    // guide.html marks the "Where to go" value; the hand-written pages use the office of their first step.
    office: txt(q('[data-fact="office"]')) || txt(q('.step-detail .v')),
    carry: [...root.querySelectorAll('.checklist li')].map((li) => txt(li).replace(/^\u2713\s*/, '')).filter(Boolean),
  };
}
