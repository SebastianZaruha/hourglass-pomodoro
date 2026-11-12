/**
 * Falla si el CSS de producción no deja `backdrop-filter` sin prefijo
 * en el vidrio o en el halo. Lightning CSS, si el fuente escribe las dos,
 * se queda solo con `-webkit-backdrop-filter`, y Chrome y Firefox lo ignoran.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(raiz, 'dist', 'assets');
const archivos = readdirSync(assets).filter((nombre) => nombre.endsWith('.css'));
if (archivos.length === 0) {
  console.error('No hay CSS en dist/assets. Falta el build de producción.');
  process.exit(1);
}

const css = archivos.map((nombre) => readFileSync(path.join(assets, nombre), 'utf8')).join('\n');
const reglas = css
  .split('}')
  .map((bloque) => bloque.trim())
  .filter(Boolean)
  .map((bloque) => {
    const corte = bloque.indexOf('{');
    return {
      selector: (corte < 0 ? bloque : bloque.slice(0, corte)).trim(),
      cuerpo: corte < 0 ? '' : bloque.slice(corte + 1),
    };
  });

const deVidrio = reglas.filter((regla) => /(^|[^\w-])(\.vidrio|\.halo)(?![\w-])/.test(regla.selector));
if (deVidrio.length === 0) {
  console.error('El CSS compilado no tiene reglas .vidrio ni .halo.');
  process.exit(1);
}

let mal = false;
for (const regla of deVidrio) {
  const menciona = regla.cuerpo.includes('backdrop-filter');
  const sinPrefijo = /(?<!-)backdrop-filter\s*:/.test(regla.cuerpo);
  if (menciona && !sinPrefijo) {
    console.error(`Solo queda el prefijo -webkit- en ${regla.selector.slice(0, 160)}`);
    mal = true;
  }
}

const vidrio = deVidrio.some(
  (regla) => regla.selector.includes('.vidrio') && /(?<!-)backdrop-filter\s*:/.test(regla.cuerpo),
);
const halo = deVidrio.some(
  (regla) => regla.selector.includes('.halo') && /(?<!-)backdrop-filter\s*:/.test(regla.cuerpo),
);
if (!vidrio) {
  console.error('Ninguna regla .vidrio del CSS compilado tiene backdrop-filter sin prefijo.');
  mal = true;
}
if (!halo) {
  console.error('Ninguna regla .halo del CSS compilado tiene backdrop-filter sin prefijo.');
  mal = true;
}

if (mal) process.exit(1);
console.log(`OK: backdrop-filter sin prefijo en .vidrio y .halo (${archivos.join(', ')}).`);
