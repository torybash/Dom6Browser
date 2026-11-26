import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const ART_DIRS = ['gameicons', 'images/magicicons', 'images/items', 'images/sprites', 'images/sites'];

/** Dev only: lists the art folders under public/ for the contact sheet (contact-sheet.html). */
function artManifest(): Plugin {
  return {
    name: 'art-manifest',
    apply: 'serve',
    configureServer(server) {
      // ?dir=d lists the pngs; ?dir=d&files=a,b returns them base64-encoded, so scoring thousands of
      // sprites takes a few requests instead of thousands
      server.middlewares.use('/__art', (req, res) => {
        const q = new URL(req.url ?? '', 'http://x').searchParams;
        const dir = q.get('dir') ?? '';
        if (!ART_DIRS.includes(dir)) {
          res.statusCode = 404;
          return res.end();
        }
        const path = fileURLToPath(new URL(`./public/${dir}/`, import.meta.url));
        const pngs = readdirSync(path).filter((f) => f.endsWith('.png'));
        const wanted = q.get('files')?.split(',');
        const body = wanted
          ? Object.fromEntries(wanted.filter((f) => pngs.includes(f)).map((f) => [f, readFileSync(path + f).toString('base64')]))
          : pngs;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), artManifest()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // the ported upstream data layer is ~350 KB of source on its own
  build: { chunkSizeWarningLimit: 900 },
  // the ported upstream code has harmless duplicate keys in big object literals
  esbuild: { logOverride: { 'duplicate-object-key': 'silent' } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
