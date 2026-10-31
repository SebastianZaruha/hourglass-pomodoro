/**
 * En pausa, un doble clic no reinicia el reloj.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';

const webRoot = path.resolve(import.meta.dirname, '..');

async function bundle() {
  const dir = mkdtempSync(path.join(tmpdir(), 'hourglass-click-'));
  const outfile = path.join(dir, 'mod.mjs');
  await esbuild.build({
    absWorkingDir: webRoot,
    stdin: {
      contents: "export { decideStageClick, decideStageDoubleClick } from './src/stageClick.ts';\n",
      resolveDir: webRoot,
      loader: 'ts',
      sourcefile: path.join(webRoot, 'entry.ts'),
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('en pausa el segundo clic no cancela el seguir y el doble clic no reinicia', async () => {
  const { mod, cleanup } = await bundle();
  try {
    const first = mod.decideStageClick({
      status: 'paused',
      detail: 1,
      pendingToggle: false,
      resumeArmed: false,
    });
    assert.deepEqual(first, { kind: 'schedule', armResume: true });

    const second = mod.decideStageClick({
      status: 'paused',
      detail: 2,
      pendingToggle: true,
      resumeArmed: true,
    });
    assert.deepEqual(second, { kind: 'ignore-extra' });
    assert.equal(mod.decideStageDoubleClick('paused', true), 'ignore');

    // El «seguir» ya ocurrió y el estado es «en marcha», pero la pareja salió de la pausa.
    const late = mod.decideStageClick({
      status: 'running',
      detail: 2,
      pendingToggle: false,
      resumeArmed: true,
    });
    assert.deepEqual(late, { kind: 'ignore-extra' });
    assert.equal(mod.decideStageDoubleClick('running', true), 'ignore');
  } finally {
    cleanup();
  }
});

test('un clic en pausa sigue programando el reanudado', async () => {
  const { mod, cleanup } = await bundle();
  try {
    assert.deepEqual(
      mod.decideStageClick({
        status: 'paused',
        detail: 1,
        pendingToggle: false,
        resumeArmed: false,
      }),
      { kind: 'schedule', armResume: true },
    );
  } finally {
    cleanup();
  }
});

test('en marcha el doble clic sigue reiniciando', async () => {
  const { mod, cleanup } = await bundle();
  try {
    const first = mod.decideStageClick({
      status: 'running',
      detail: 1,
      pendingToggle: false,
      resumeArmed: false,
    });
    assert.deepEqual(first, { kind: 'schedule', armResume: false });
    const second = mod.decideStageClick({
      status: 'running',
      detail: 2,
      pendingToggle: true,
      resumeArmed: false,
    });
    assert.deepEqual(second, { kind: 'cancel-pending' });
    assert.equal(mod.decideStageDoubleClick('running', false), 'restart');
    assert.equal(mod.decideStageDoubleClick('idle', false), 'restart');
    assert.equal(mod.decideStageDoubleClick('finished', false), 'restart');
  } finally {
    cleanup();
  }
});
