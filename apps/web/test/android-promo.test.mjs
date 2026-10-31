/**
 * Aviso de la app Android: URL de la release, cierre en localStorage y cuándo se muestra.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';

const webRoot = path.resolve(import.meta.dirname, '..');

async function bundle(source) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hourglass-android-'));
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
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('el APK apunta a la release v1.8.12, no a un binario inventado', async () => {
  const { mod, cleanup } = await bundle(
    `export {
      ANDROID_APP,
      ANDROID_RELEASE,
      githubLatestApkUrl,
      githubReleaseApkUrl,
    } from './src/androidApp.ts';\n`,
  );
  try {
    assert.equal(mod.ANDROID_APP.distribution, 'github-release');
    assert.equal(mod.ANDROID_RELEASE.repo, 'SebastianZaruha/hourglass-pomodoro');
    assert.equal(mod.ANDROID_RELEASE.tag, 'v1.8.12');
    assert.equal(mod.ANDROID_RELEASE.asset, 'hourglass-pomodoro-1.8.12.apk');
    assert.equal(mod.ANDROID_APP.url, mod.githubReleaseApkUrl(mod.ANDROID_RELEASE));
    assert.equal(
      mod.ANDROID_APP.url,
      'https://github.com/SebastianZaruha/hourglass-pomodoro/releases/download/v1.8.12/hourglass-pomodoro-1.8.12.apk',
    );
    assert.equal(
      mod.githubLatestApkUrl(mod.ANDROID_RELEASE.repo),
      'https://github.com/SebastianZaruha/hourglass-pomodoro/releases/latest/download/hourglass-pomodoro.apk',
    );
  } finally {
    cleanup();
  }
});

test('cerrar el aviso queda guardado y no es la clave de cookies', async () => {
  const { mod, cleanup } = await bundle(
    `export {
      ANDROID_PROMO_KEY,
      readAndroidPromoDismissed,
      writeAndroidPromoDismissed,
    } from './src/androidApp.ts';\n`,
  );
  try {
    assert.equal(mod.ANDROID_PROMO_KEY, 'hourglass-web/android-promo');
    assert.notEqual(mod.ANDROID_PROMO_KEY, 'hourglass-web/cookies');
    const store = {
      value: null,
      getItem() {
        return this.value;
      },
      setItem(_key, value) {
        this.value = value;
      },
    };
    assert.equal(mod.readAndroidPromoDismissed(store), false);
    mod.writeAndroidPromoDismissed(store);
    assert.equal(store.value, '1');
    assert.equal(mod.readAndroidPromoDismissed(store), true);
    assert.equal(
      mod.readAndroidPromoDismissed({
        getItem() {
          throw new Error('blocked');
        },
      }),
      false,
    );
    assert.doesNotThrow(() =>
      mod.writeAndroidPromoDismissed({
        setItem() {
          throw new Error('blocked');
        },
      }),
    );
  } finally {
    cleanup();
  }
});

test('la tira espera a la intro y no tapa cookies, menú ni legales', async () => {
  const { mod, cleanup } = await bundle("export { androidPromoOpen } from './src/androidApp.ts';\n");
  try {
    const open = mod.androidPromoOpen;
    const ready = {
      settled: true,
      dismissed: false,
      bannerOpen: false,
      menuOpen: false,
      legalOpen: false,
    };
    assert.equal(open(ready), true);
    assert.equal(open({ ...ready, settled: false }), false);
    assert.equal(open({ ...ready, dismissed: true }), false);
    assert.equal(open({ ...ready, bannerOpen: true }), false);
    assert.equal(open({ ...ready, menuOpen: true }), false);
    assert.equal(open({ ...ready, legalOpen: true }), false);
  } finally {
    cleanup();
  }
});

test('el texto habla de la mano y de inclinar, en español y en inglés', async () => {
  const { mod, cleanup } = await bundle("export { androidPromoCopy } from './src/copy.ts';\n");
  try {
    const es = mod.androidPromoCopy('es', 'github-release');
    assert.equal(es.title, 'App Android');
    assert.match(es.pitch, /mano/);
    assert.match(es.pitch, /inclinar/);
    assert.equal(es.action, 'Descargar');
    assert.match(es.actionHint, /GitHub Releases/);

    const en = mod.androidPromoCopy('en', 'github-release');
    assert.equal(en.title, 'Android app');
    assert.match(en.pitch, /hand/);
    assert.match(en.pitch, /tilt/i);
    assert.equal(en.action, 'Download');

    const play = mod.androidPromoCopy('es', 'play-store');
    assert.equal(play.action, 'Play Store');
    assert.equal(play.pitch, es.pitch);
    assert.equal(mod.androidPromoCopy('en', 'play-store').action, 'Google Play');
  } finally {
    cleanup();
  }
});
