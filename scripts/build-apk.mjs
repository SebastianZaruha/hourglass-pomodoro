#!/usr/bin/env node
/**
 * APK de entrega (1.8.6): `npm run apk [-- --out ruta.apk] [-- --expect "texto"]...`
 *
 * Compila `assembleRelease` SIEMPRE igual y comprueba el resultado, para que
 * no vuelva a salir un APK distinto sin darnos cuenta:
 *
 *   - Borra antes la salida de la tarea del bundle de JS
 *     (`createBundleReleaseJsAndAssets`): Gradle la da por buena si solo
 *     cambia packages/core (ver CHANGELOG 1.8.5).
 *   - Pasa explícitas las propiedades de las entregas: solo arm64-v8a y las
 *     librerías nativas comprimidas (`expo.useLegacyPackaging=true`). Sin
 *     ellas, la plantilla de android/gradle.properties da 4 arquitecturas sin
 *     comprimir: ~140 MB en vez de ~22 MB (le pasó a la primera 1.8.6).
 *   - Comprueba el APK: solo lib/arm64-v8a, .so comprimidas, versionCode y
 *     versionName iguales que app.json, y cada `--expect` dentro del bundle
 *     de JS embebido (en UTF-8 o, si lleva caracteres no ASCII, en UTF-16).
 *
 * Necesita JAVA_HOME y ANDROID_HOME (o ANDROID_SDK_ROOT) y la carpeta
 * apps/mobile/android ya generada (`npx expo prebuild -p android`).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = path.join(root, 'apps/mobile/android');
const apk = path.join(android, 'app/build/outputs/apk/release/app-release.apk');
const ABI = 'arm64-v8a';
const PROPS = [`-PreactNativeArchitectures=${ABI}`, '-Pexpo.useLegacyPackaging=true'];

const args = process.argv.slice(2);
const expects = [];
let out = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--expect') expects.push(args[++i]);
  else if (args[i] === '--out') out = path.resolve(args[++i]);
  else fail(`argumento desconocido: ${args[i]}`);
}

function fail(msg) {
  console.error(`build-apk: ${msg}`);
  process.exit(1);
}

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) fail('falta ANDROID_HOME');
if (!fs.existsSync(path.join(android, 'gradlew')))
  fail('falta apps/mobile/android (npx expo prebuild -p android)');
const buildTools = path.join(sdk, 'build-tools');
const latest = fs.readdirSync(buildTools).sort().pop();
const aapt = path.join(buildTools, latest, 'aapt');

// 1. Bundle de JS siempre nuevo.
fs.rmSync(path.join(android, 'app/build/generated/assets/createBundleReleaseJsAndAssets'), {
  recursive: true,
  force: true,
});

// 2. Compilar.
const gradle = spawnSync(
  './gradlew',
  ['assembleRelease', ...PROPS, ...(process.env.GRADLE_ARGS?.split(' ').filter(Boolean) ?? [])],
  {
    cwd: android,
    stdio: 'inherit',
  },
);
if (gradle.status !== 0) fail(`gradle terminó con ${gradle.status}`);

// 3. Comprobar.
const listing = execFileSync('unzip', ['-lv', apk], { encoding: 'utf8', maxBuffer: 64 << 20 });
const libs = listing
  .split('\n')
  .map((l) => l.trim().split(/\s+/))
  .filter((c) => c[7]?.startsWith('lib/'));
const abis = [...new Set(libs.map((c) => c[7].split('/')[1]))];
if (abis.length !== 1 || abis[0] !== ABI)
  fail(`arquitecturas en el APK: ${abis.join(', ')} (se esperaba solo ${ABI})`);
const stored = libs.filter((c) => c[7].endsWith('.so') && c[1] !== 'Defl:N');
if (stored.length) fail(`librerías sin comprimir: ${stored.map((c) => c[7]).join(', ')}`);

const app = JSON.parse(fs.readFileSync(path.join(root, 'apps/mobile/app.json'), 'utf8')).expo;
const badging = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' });
const code = badging.match(/versionCode='(\d+)'/)?.[1];
const name = badging.match(/versionName='([^']+)'/)?.[1];
if (Number(code) !== app.android.versionCode || name !== app.version) {
  fail(`versión del APK ${name} (${code}); app.json dice ${app.version} (${app.android.versionCode})`);
}

const bundle = execFileSync('unzip', ['-p', apk, 'assets/index.android.bundle'], { maxBuffer: 64 << 20 });
// Hermes guarda en UTF-16 las cadenas con algún carácter no ASCII («·», tildes):
// se busca de las dos formas (1.8.9).
for (const text of expects) {
  if (!bundle.includes(text) && !bundle.includes(Buffer.from(text, 'utf16le')))
    fail(`el bundle de JS del APK no contiene «${text}»`);
}

const size = fs.statSync(apk).size;
if (out) fs.copyFileSync(apk, out);
console.log(
  `build-apk: ${name} (${code}), solo ${ABI}, .so comprimidas, ${(size / 1e6).toFixed(1)} MB` +
    (expects.length ? `, bundle con ${expects.length} textos esperados` : '') +
    (out ? ` → ${out}` : ''),
);
