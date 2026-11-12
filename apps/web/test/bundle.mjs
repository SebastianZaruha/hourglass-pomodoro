/**
 * Empaqueta un módulo de la web para los tests de Node.
 * `esbuild` está en las devDependencies: clonar y `npm test` basta.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';

const webRoot = path.resolve(import.meta.dirname, '..');

export async function bundle(source) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hourglass-web-'));
  const outfile = path.join(dir, 'mod.mjs');
  await esbuild.build({
    absWorkingDir: webRoot,
    stdin: {
      contents: source,
      resolveDir: webRoot,
      loader: 'ts',
      sourcefile: path.join(webRoot, 'entry.ts'),
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    alias: {
      '@reloj/core': path.resolve(webRoot, '../../packages/core/src/index.ts'),
    },
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
