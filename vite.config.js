import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

// Every .html file in the project root becomes its own page in the build.
const input = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith('.html'))
    .map((f) => [basename(f, '.html'), resolve(root, f)])
);

export default defineConfig({
  build: { rollupOptions: { input } },
  // Dev only: lets the browser reach Bhashini without CORS errors (see src/bhashini.js).
  server: {
    proxy: {
      '/bh-auth': { target: 'https://meity-auth.ulcacontrib.org', changeOrigin: true, rewrite: (p) => p.replace(/^\/bh-auth/, '') },
      '/bh-infer': { target: 'https://dhruva-api.bhashini.gov.in', changeOrigin: true, rewrite: (p) => p.replace(/^\/bh-infer/, '') },
    },
  },
});
