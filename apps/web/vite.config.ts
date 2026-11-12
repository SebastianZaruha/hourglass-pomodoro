import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@reloj/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  preview: { port: 4173 },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      // Chrome ≥ 111, Safari ≥ 16, Firefox ≥ 115. Así el compilador
      // deja `backdrop-filter` y añade el prefijo, en vez de quedarse solo con él.
      targets: {
        chrome: 111 << 16,
        safari: 16 << 16,
        firefox: 115 << 16,
      },
    },
  },
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
    sourcemap: true,
  },
});
