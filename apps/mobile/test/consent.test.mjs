/**
 * Consentimiento de Firebase: prueba local, caducidad y cubos de duración.
 * El SDK nativo no entra aquí.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';

const mobileRoot = path.resolve(import.meta.dirname, '..');

async function bundle(source) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hourglass-firebase-consent-'));
  const outfile = path.join(dir, 'mod.mjs');
  await esbuild.build({
    absWorkingDir: mobileRoot,
    stdin: {
      contents: source,
      resolveDir: mobileRoot,
      loader: 'ts',
      sourcefile: path.join(mobileRoot, 'entry.ts'),
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const entry = `
  export {
    BANNER_VERSION,
    CONSENT_MAX_AGE_MS,
    collectionAction,
    loadConsent,
    parseConsent,
    serializeConsent,
    writeConsent,
  } from './src/consent/consent.ts';
  export { bannerCopy } from './src/consent/bannerCopy.ts';
  export { durationBucket, timerStartParams, timerCompleteParams } from './src/consent/events.ts';
  export { PRIVACY_APP_URL } from './src/consent/privacy.ts';
`;

test('la prueba guarda elección, momento, texto, flags y versión', async () => {
  const { mod, cleanup } = await bundle(entry);
  try {
    const now = 1_700_000_000_000;
    assert.match(mod.BANNER_VERSION, /^[0-9a-f]{8}$/);

    const saved = mod.serializeConsent('accepted', now, '1.8.13');
    const record = mod.parseConsent(saved, now);
    assert.equal(record.choice, 'accepted');
    assert.equal(record.at, now);
    assert.equal(record.bannerVersion, mod.BANNER_VERSION);
    assert.equal(record.analytics, true);
    assert.equal(record.crashlytics, true);
    assert.equal(record.appVersion, '1.8.13');

    const rejected = JSON.parse(mod.serializeConsent('rejected', now, '1.8.13'));
    assert.equal(rejected.analytics, false);
    assert.equal(rejected.crashlytics, false);
    assert.equal(mod.parseConsent(JSON.stringify(rejected), now).choice, 'rejected');

    const store = {
      value: null,
      async getItem() {
        return this.value;
      },
      async setItem(_key, value) {
        this.value = value;
      },
    };
    await mod.writeConsent('rejected', store, now, '1.8.13');
    const loaded = await mod.loadConsent(store, now);
    assert.equal(loaded.record.choice, 'rejected');
    assert.equal(loaded.hadStoredValue, true);
    assert.deepEqual(mod.collectionAction(loaded), { type: 'deny', reset: false });
  } finally {
    cleanup();
  }
});

test('sin prueba vigente no se concede: caduca, cambia el texto o no cuadra', async () => {
  const { mod, cleanup } = await bundle(entry);
  try {
    const now = 1_700_000_000_000;
    const saved = mod.serializeConsent('accepted', now, '1.8.13');
    assert.equal(mod.parseConsent(null, now), null);
    assert.equal(mod.parseConsent('  ', now), null);
    assert.equal(mod.parseConsent('{', now), null);
    assert.equal(mod.parseConsent(JSON.stringify({ choice: 'accepted', at: now }), now), null);
    assert.equal(
      mod.parseConsent(
        JSON.stringify({
          choice: 'accepted',
          at: now,
          bannerVersion: 'otra',
          analytics: true,
          crashlytics: true,
          appVersion: '1.8.13',
        }),
        now,
      ),
      null,
    );
    assert.equal(mod.parseConsent(saved, now + mod.CONSENT_MAX_AGE_MS + 1), null);
    assert.equal(mod.parseConsent(saved, now + 61_000).choice, 'accepted');
    assert.equal(mod.parseConsent(saved, now - 60_000).choice, 'accepted');
    assert.equal(mod.parseConsent(saved, now - 60_001), null);

    const mismatched = JSON.parse(saved);
    mismatched.analytics = false;
    assert.equal(mod.parseConsent(JSON.stringify(mismatched), now), null);

    const empty = await mod.loadConsent({
      getItem() {
        return null;
      },
      setItem() {},
    });
    assert.deepEqual(mod.collectionAction(empty), { type: 'leave-default' });

    const stale = await mod.loadConsent(
      {
        getItem() {
          return JSON.stringify({ choice: 'accepted', at: now, bannerVersion: 'vieja' });
        },
        setItem() {},
      },
      now,
    );
    assert.equal(stale.record, null);
    assert.equal(stale.hadStoredValue, true);
    assert.deepEqual(mod.collectionAction(stale), { type: 'deny', reset: true });
    assert.deepEqual(mod.collectionAction({ record: null, hadStoredValue: false, unreadable: true }), {
      type: 'deny',
      reset: false,
    });

    const accepted = await mod.loadConsent(
      {
        getItem() {
          return saved;
        },
        setItem() {},
      },
      now,
    );
    assert.deepEqual(mod.collectionAction(accepted), { type: 'grant' });
  } finally {
    cleanup();
  }
});

test('el texto del diálogo es el borrador y los eventos no llevan la duración exacta', async () => {
  const { mod, cleanup } = await bundle(entry);
  try {
    const es = mod.bannerCopy('es');
    const en = mod.bannerCopy('en');
    assert.equal(es.title, 'Ayúdanos a mejorar Hourglass');
    assert.equal(en.title, 'Help us improve Hourglass');
    assert.match(es.body, /Firebase \(Google\)/);
    assert.match(es.body, /Data Privacy Framework/);
    assert.match(en.body, /Data Privacy Framework/);
    assert.equal(es.accept, 'Aceptar');
    assert.equal(es.reject, 'Rechazar');
    assert.equal(en.accept, 'Accept');
    assert.equal(en.reject, 'Decline');
    assert.equal(mod.PRIVACY_APP_URL.es, 'https://hourglass.sebastianzaruha.com/privacidad-app.html');
    assert.equal(mod.PRIVACY_APP_URL.en, 'https://hourglass.sebastianzaruha.com/privacy-app.html');

    assert.equal(mod.durationBucket(5 * 60_000), '5');
    assert.equal(mod.durationBucket(6 * 60_000), '10');
    assert.equal(mod.durationBucket(25 * 60_000), '25');
    assert.equal(mod.durationBucket(26 * 60_000), '45');
    assert.equal(mod.durationBucket(61 * 60_000), '90');
    assert.equal(mod.durationBucket(121 * 60_000), '120plus');

    const params = mod.timerStartParams({
      mode: 'cycles',
      durationMs: 25 * 60_000 + 20_000,
      language: 'es',
      theme: 'system',
    });
    assert.deepEqual(params, { mode: 'cycles', duration_bucket: '25', language: 'es', theme: 'system' });
    assert.equal(JSON.stringify(params).includes('1520000'), false);
    assert.deepEqual(mod.timerCompleteParams({ mode: 'single', durationMs: 90 * 60_000 }), {
      mode: 'single',
      duration_bucket: '90',
    });
  } finally {
    cleanup();
  }
});

test('el almacenamiento que falla no se trata como un primer arranque', async () => {
  const { mod, cleanup } = await bundle(entry);
  try {
    const loaded = await mod.loadConsent({
      getItem() {
        throw new Error('lleno');
      },
      setItem() {},
    });
    assert.equal(loaded.unreadable, true);
    assert.equal(loaded.record, null);
  } finally {
    cleanup();
  }
});
