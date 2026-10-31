/**
 * Prueba del consentimiento: la versión del banner y el corte de Vercel Analytics.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';

const webRoot = path.resolve(import.meta.dirname, '..');

async function bundle(source, { injectGlobals = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hourglass-consent-'));
  const outfile = path.join(dir, 'mod.mjs');
  const inject = [];
  if (injectGlobals) {
    const globals = path.join(dir, 'globals.js');
    writeFileSync(
      globals,
      'export const window = globalThis.window;\nexport const document = globalThis.document;\n',
    );
    inject.push(globals);
  }
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
    ...(inject.length > 0 ? { inject } : {}),
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('un consentimiento sin bannerVersion, o con otra, vuelve a preguntar', async () => {
  const { mod, cleanup } = await bundle(
    "export { BANNER_VERSION, parseConsent, serializeConsent, writeConsent } from './src/cookies.ts';\n",
  );
  try {
    const now = 1_700_000_000_000;
    const saved = mod.serializeConsent('accepted', now);
    const record = mod.parseConsent(saved, now);
    assert.equal(record.choice, 'accepted');
    assert.equal(record.at, now);
    assert.equal(record.bannerVersion, mod.BANNER_VERSION);
    assert.match(mod.BANNER_VERSION, /^[0-9a-f]{8}$/);

    const legacy = JSON.stringify({ choice: 'accepted', at: now });
    assert.equal(mod.parseConsent(legacy, now), null);
    assert.equal(
      mod.parseConsent(JSON.stringify({ choice: 'rejected', at: now, bannerVersion: 'otra' }), now),
      null,
    );
    assert.equal(mod.parseConsent(saved, now + 366 * 24 * 60 * 60 * 1000), null);

    const store = {
      value: null,
      setItem(_key, value) {
        this.value = value;
      },
    };
    mod.writeConsent('rejected', store, now);
    assert.equal(JSON.parse(store.value).bannerVersion, mod.BANNER_VERSION);
  } finally {
    cleanup();
  }
});

test('Rechazar quita el script de Vercel y anula beforeSend', async () => {
  const removed = [];
  const calls = [];
  const script = {
    remove() {
      removed.push(script);
    },
  };
  globalThis.document = {
    querySelectorAll(selector) {
      assert.match(selector, /_vercel\/insights/);
      return [script];
    },
  };
  globalThis.window = {
    va(event, data) {
      calls.push([event, data]);
    },
  };
  const { mod, cleanup } = await bundle(
    "export { stopVercelWebAnalytics } from './src/vercelAnalytics.ts';\n",
    { injectGlobals: true },
  );
  try {
    mod.stopVercelWebAnalytics();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'beforeSend');
    assert.equal(calls[0][1](), null);
    assert.deepEqual(removed, [script]);
  } finally {
    cleanup();
    delete globalThis.document;
    delete globalThis.window;
  }
});
