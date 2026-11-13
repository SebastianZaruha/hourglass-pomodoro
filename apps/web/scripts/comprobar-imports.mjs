import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const carpetas = [
  'app',
  'comun/tiempo',
  'comun/giro',
  'comun/frasco',
  'comun/reloj',
  'comun/menu',
  'comun/estilo',
  'comun/fondo',
  'comun/paneles/pausa',
  'comun/paneles/cookies',
  'comun/paneles/android',
  'comun/paneles/legal',
  'comun/paneles/pie',
  'escenas/arena-modelo',
  'escenas/arena',
  'escenas/clasico',
  'escenas/lluvia/agua',
  'escenas/lluvia/nube',
  'escenas/lluvia',
].sort((a, b) => b.length - a.length);

const carpeta = (rel) => carpetas.find((c) => rel === c || rel.startsWith(`${c}/`)) ?? '';
const archivos = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) archivos(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
};
const resolver = (desde, spec) => {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(desde), spec);
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    try {
      if (statSync(base + suffix).isFile()) return base + suffix;
    } catch {
      /* el siguiente sufijo */
    }
  }
  return base;
};

const errores = [];
for (const file of archivos(src)) {
  const rel = relative(src, file).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8');
  const propia = carpeta(rel);
  if (!/^escenas\/[^/]+\/index\.tsx?$/.test(rel)) {
    if (/\bdark\s*\?/.test(text)) errores.push(`${rel}: dark ?`);
    if (/if\s*\(\s*escena\s*===/.test(text)) errores.push(`${rel}: if (escena ===)`);
  }
  for (const spec of [...text.matchAll(/(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g)].map((m) => m[1])) {
    if (spec.endsWith('.css')) continue;
    const dest = resolver(file, spec);
    const drel = dest && dest.startsWith(src) ? relative(src, dest).replaceAll('\\', '/') : spec;
    const ajena = carpeta(drel);
    if (propia.startsWith('comun/') && (drel.startsWith('escenas/') || drel.startsWith('app/')))
      errores.push(`${rel} → ${spec} (comun)`);
    if (propia.startsWith('escenas/')) {
      const escena = propia.split('/').slice(0, 2).join('/');
      const interno = drel === propia || drel.startsWith(`${propia}/`);
      const modelo =
        (escena === 'escenas/arena' || escena === 'escenas/clasico') &&
        drel.startsWith('escenas/arena-modelo/');
      const ok =
        interno ||
        modelo ||
        drel.startsWith('comun/') ||
        spec === '@reloj/core' ||
        spec.startsWith('@reloj/core/');
      if (!ok) errores.push(`${rel} → ${spec} (escena)`);
      if (
        propia.startsWith('escenas/lluvia') &&
        (drel.includes('arena-modelo') ||
          /\b(SandSimulation|StreamParticles|sandLevelForDuration)\b/.test(text))
      )
        errores.push(`${rel} (lluvia)`);
    }
    if (drel.startsWith('escenas/') && !propia.startsWith('app') && !propia.startsWith('escenas/'))
      errores.push(`${rel} → ${spec} (solo app)`);
    if (ajena && ajena !== propia && !drel.endsWith('/index.ts') && !drel.endsWith('/index.tsx'))
      errores.push(`${rel} → ${spec} (index)`);
  }
}
if (errores.length) {
  console.error(errores.join('\n'));
  process.exit(1);
}
