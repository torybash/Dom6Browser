import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // the ported upstream data layer is ~350 KB of source on its own
  build: { chunkSizeWarningLimit: 900 },
  // the ported upstream code has harmless duplicate keys in big object literals
  esbuild: { logOverride: { 'duplicate-object-key': 'silent' } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
