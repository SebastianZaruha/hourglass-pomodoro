/**
 * gtag.js (Qb / NE) solo trata como comando `js`|`config`|`event`|`get`
 * un objeto Arguments. Un Array —lo que deja un rest— se ignora y no hay
 * /g/collect. Este test fija el snippet oficial y que el minify de Vite
 * (esbuild y oxc) no lo reescriba a un rest Array.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';
import { minifySync, transformSync } from 'rolldown/utils';
import vm from 'node:vm';

const webRoot = path.resolve(import.meta.dirname, '..');
const source = readFileSync(path.join(webRoot, 'src/analytics.ts'), 'utf8');
const MEASUREMENT_ID = 'G-LEKYE5VYL2';

function isGtagCommand(entry) {
  if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const argumentsObject =
    Object.prototype.toString.call(entry) === '[object Arguments]' ||
    Object.prototype.hasOwnProperty.call(entry, 'callee');
  if (!argumentsObject) return false;
  const command = entry[0];
  return command === 'config' || command === 'event' || command === 'js' || command === 'get';
}

function gtagFunction(code) {
  const match = code.match(/function(?:\s+\w+)?\([^)]*\)\{[^{}]*push\(arguments\)[^{}]*\}/);
  assert.ok(match, 'el minify tiene que conservar function…push(arguments)');
  return match[0];
}

function assertQueuedCommands(code, label) {
  assert.match(code, /push\(arguments\)/, label);
  assert.doesNotMatch(code, /function(?:\s+\w+)?\s*\([^)]*\.\.\./, label);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(
    `window.dataLayer=[]; window.gtag=${gtagFunction(code)};
     window.gtag('js', new Date(0));
     window.gtag('config', ${JSON.stringify(MEASUREMENT_ID)});`,
    context,
  );
  const layer = context.window.dataLayer;
  assert.equal(layer.length, 2, label);
  assert.equal(layer[0][0], 'js', label);
  assert.equal(layer[0][1].getTime(), 0, label);
  assert.equal(layer[1][0], 'config', label);
  assert.equal(layer[1][1], MEASUREMENT_ID, label);
  assert.equal(isGtagCommand(layer[0]), true, label);
  assert.equal(isGtagCommand(layer[1]), true, label);
}

test('el fuente empuja arguments, no un rest Array', () => {
  assert.match(source, /function gtag\(\) \{[\s\S]*?window\.dataLayer\?\.push\(arguments\);/);
  assert.doesNotMatch(source, /function gtag\(\.\.\./);
  assert.doesNotMatch(source, /\.push\(args\)/);
  assert.match(source, /cookie_domain:\s*'none'/);
  assert.equal(isGtagCommand(['config', MEASUREMENT_ID]), false);
});

test('esbuild y oxc no convierten arguments en un Array', () => {
  const esbuilt = esbuild.transformSync(source, {
    loader: 'ts',
    minify: true,
    target: 'es2022',
    format: 'esm',
  });
  const stripped = transformSync(path.join(webRoot, 'src/analytics.ts'), source, { target: 'es2022' });
  assert.equal(stripped.errors.length, 0);
  const oxc = minifySync('analytics.js', stripped.code, { compress: true, mangle: true });
  assert.equal(oxc.errors?.length ?? 0, 0);
  assertQueuedCommands(esbuilt.code, 'esbuild');
  assertQueuedCommands(oxc.code, 'oxc');
});

test('Accept encola js y config antes del script; Reject no lo deja cargado', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hourglass-ga-'));
  const previousGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
  };
  const globals = path.join(dir, 'globals.js');
  writeFileSync(
    globals,
    'export const window = globalThis.window;\nexport const document = globalThis.document;\nexport const location = globalThis.location;\n',
  );
  const outfile = path.join(dir, 'analytics.mjs');
  try {
    await esbuild.build({
      absWorkingDir: webRoot,
      stdin: {
        contents:
          "import { disableGoogleAnalytics, enableGoogleAnalytics, gaCookieClearDomains } from './src/analytics.ts';\nexport { disableGoogleAnalytics, enableGoogleAnalytics, gaCookieClearDomains };\n",
        resolveDir: webRoot,
        loader: 'ts',
        sourcefile: path.join(webRoot, 'ga-entry.ts'),
      },
      bundle: true,
      minify: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      inject: [globals],
      outfile,
    });
    const bundled = readFileSync(outfile, 'utf8');
    assert.match(bundled, /push\(arguments\)/);

    const scripts = [];
    const writes = [];
    let jar = '';
    const window = {};
    const document = {
      get cookie() {
        return jar;
      },
      set cookie(value) {
        writes.push(String(value));
      },
      head: {
        appendChild(node) {
          if (typeof node.src === 'string' && node.src.includes('/gtag/js')) {
            const layer = window.dataLayer;
            assert.ok(layer.length >= 2);
            assert.equal(layer[layer.length - 2][0], 'js');
            assert.equal(layer[layer.length - 1][0], 'config');
            assert.equal(isGtagCommand(layer.at(-2)), true);
            assert.equal(isGtagCommand(layer.at(-1)), true);
          }
          scripts.push(node);
        },
      },
      createElement() {
        const node = {
          async: false,
          src: '',
          dataset: {},
          remove() {
            const index = scripts.indexOf(node);
            if (index >= 0) scripts.splice(index, 1);
          },
        };
        return node;
      },
      querySelectorAll(selector) {
        if (selector !== 'script[data-hourglass-ga]') return [];
        return scripts.filter((node) => node.dataset.hourglassGa);
      },
    };
    globalThis.window = window;
    globalThis.document = document;
    globalThis.location = { hostname: 'hourglass.sebastianzaruha.com', protocol: 'https:' };

    const mod = await import(pathToFileURL(outfile).href);
    mod.enableGoogleAnalytics(null);
    mod.enableGoogleAnalytics('');
    assert.equal(scripts.length, 0);
    assert.equal(window.dataLayer, undefined);

    mod.enableGoogleAnalytics(MEASUREMENT_ID);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].async, true);
    assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`);
    assert.equal(scripts[0].dataset.hourglassGa, MEASUREMENT_ID);
    assert.equal(isGtagCommand(window.dataLayer[0]), true);
    assert.equal(isGtagCommand(window.dataLayer[1]), true);
    assert.equal(window.dataLayer[1][2].cookie_domain, 'none');
    assert.equal(window[`ga-disable-${MEASUREMENT_ID}`], false);

    const domains = mod.gaCookieClearDomains('hourglass.sebastianzaruha.com');
    for (const domain of [
      '',
      'hourglass.sebastianzaruha.com',
      '.hourglass.sebastianzaruha.com',
      'sebastianzaruha.com',
      '.sebastianzaruha.com',
    ]) {
      assert.equal(domains.includes(domain), true, domain);
    }
    assert.equal(domains.includes('.com'), false);

    mod.enableGoogleAnalytics(MEASUREMENT_ID);
    assert.equal(scripts.length, 1);
    assert.equal(window.dataLayer.length, 2);

    jar = '_ga=GA1.1.1.1; _gid=1; _gat_gtag_UA_1=1; theme=dark';
    writes.length = 0;
    mod.disableGoogleAnalytics(MEASUREMENT_ID);
    assert.equal(scripts.length, 0);
    assert.equal(window[`ga-disable-${MEASUREMENT_ID}`], true);
    for (const name of ['_ga', '_gid', '_gat_gtag_UA_1']) {
      assert.equal(
        writes.includes(
          `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.sebastianzaruha.com`,
        ),
        true,
        name,
      );
    }
    assert.equal(
      writes.some((line) => line.startsWith('theme=')),
      false,
    );

    mod.enableGoogleAnalytics(MEASUREMENT_ID);
    assert.equal(scripts.length, 1);
    assert.equal(window.dataLayer.length, 4);
    assert.equal(window[`ga-disable-${MEASUREMENT_ID}`], false);
  } finally {
    globalThis.window = previousGlobals.window;
    globalThis.document = previousGlobals.document;
    globalThis.location = previousGlobals.location;
    rmSync(dir, { recursive: true, force: true });
  }
});
