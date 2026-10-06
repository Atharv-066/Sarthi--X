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
});
