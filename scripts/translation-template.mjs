// npm run translation-template -- <guide-id>   prints a ready-to-fill skeleton for src/data/guide-translations.js.
// It contains the English text only. The translation slots are left EMPTY on purpose: fill them in only with reviewed wording.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const id = process.argv[2];
const { SERVICES } = await import(pathToFileURL(resolve('src/data/services.js')).href);
const g = SERVICES.find((s) => s.id === id);
if (!g) { console.error(`Unknown guide "${id}". Example: npm run translation-template -- income-certificate`); process.exit(1); }
const q = (s) => JSON.stringify(s);
const lang = (l) => `    ${l}: {
      reviewedBy: '',   // fill in when a reviewer has checked EVERY translation below
      reviewedOn: '',   // YYYY-MM-DD
      fields: {
${['title', 'dept', 'portal', 'where', 'who', 'online', 'counter', 'd', 'important'].filter((f) => g[f]).map((f) => `        ${f}: [${q(g[f])}, ''],`).join('\n')}
${['carry', 'a', 'b', 'c'].filter((f) => g[f]?.length).map((f) => `        ${f}: [\n${g[f].map((x) => `          [${q(x)}, ''],`).join('\n')}\n        ],`).join('\n')}
      },
    },`;
console.log(`  ${q(g.id)}: {\n${lang('mr')}\n${lang('hi')}\n  },`);
