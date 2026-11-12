import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const web = path.resolve(import.meta.dirname, '..');

test('tokens.css repite los números de tokens.ts y no lleva colores', () => {
  const css = readFileSync(path.join(web, 'src/estilo/tokens.css'), 'utf8');
  for (const [nombre, valor] of [
    ['--espacio-1', '4px'],
    ['--radio-panel', '28px'],
    ['--radio-control', '999px'],
    ['--texto-15', '15px'],
    ['--duracion-normal', '360ms'],
    ['--vidrio-blur', '36px'],
    ['--halo-blur', '14px'],
  ]) {
    assert.match(css, new RegExp(`${nombre}:\\s*${valor}`));
  }
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/);
});

test('el CSS de la app no recupera selectores muertos ni el prefijo a mano', () => {
  const css = leerCss(path.join(web, 'src'));
  for (const muerto of ['.stage', '.side', '.glass-frame', '.pause-screen', '.intro-play', '.chip', '.pill', '.choice']) {
    assert.equal(css.includes(muerto), false, muerto);
  }
  assert.equal(css.includes('-webkit-backdrop-filter'), false);
  assert.equal(css.includes('!important'), false);
});

function leerCss(dir) {
  let texto = '';
  for (const nombre of readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, nombre.name);
    if (nombre.isDirectory()) texto += leerCss(ruta);
    else if (nombre.name.endsWith('.css')) texto += readFileSync(ruta, 'utf8');
  }
  return texto;
}
