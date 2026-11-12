import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('el prefetch pide primero el otro modo y no adelanta vídeos con ahorro', async () => {
  const { mod, cleanup } = await bundle(
    `export { TEMAS } from './src/temas/index.ts';
     export { colaDeFondos, urlsPrefetch, conexionAhorro, colorDeFondo } from './src/medios/assetLoader.ts';\n`,
  );
  try {
    const cola = mod.colaDeFondos(mod.TEMAS, 'lluvia', 'dark');
    assert.equal(cola[0].tipo, 'foto');
    assert.match(cola[0].src, /lluvia-claro/);
    assert.ok(cola.some((fondo) => fondo.tipo === 'video' && fondo.webm.includes('arena-oscuro')));

    const conAhorro = mod.urlsPrefetch(mod.TEMAS, 'arena', 'dark', true);
    assert.ok(conAhorro.every((url) => !url.endsWith('.webm') && !url.endsWith('.mp4')));
    assert.ok(conAhorro.some((url) => url.includes('arena-claro')));
    assert.ok(!conAhorro.some((url) => url.includes('arena-oscuro.mp4')));

    const sinAhorro = mod.urlsPrefetch(mod.TEMAS, 'clasico', 'light', false);
    assert.ok(sinAhorro.some((url) => url.endsWith('.webm')));
    assert.ok(!sinAhorro.some((url) => url.includes('clasico-claro.avif')));
    assert.equal(mod.conexionAhorro({ saveData: true }), true);
    assert.equal(mod.conexionAhorro({ effectiveType: '2g' }), true);
    assert.equal(mod.conexionAhorro({ effectiveType: '4g' }), false);
    const lluvia = mod.urlsPrefetch(mod.TEMAS, 'lluvia', 'light', false);
    assert.ok(lluvia.some((url) => url.includes('tex-sand')));
    assert.match(mod.colorDeFondo(mod.TEMAS[0].claro.fondo), /^#/);
  } finally {
    cleanup();
  }
});
