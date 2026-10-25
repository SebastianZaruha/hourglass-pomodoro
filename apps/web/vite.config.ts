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
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
