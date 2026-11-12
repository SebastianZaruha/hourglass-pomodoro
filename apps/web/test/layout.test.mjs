import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

const TAMAÑOS = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [360, 740],
  [480, 360],
];

test('el frasco no se mueve con el menú y el reloj no lo pisa', async () => {
  const { mod, cleanup } = await bundle(
    "export { calcularLayout, seSolapan } from './src/layout/calcularLayout.ts';\n",
  );
  try {
    for (const [ancho, alto] of TAMAÑOS) {
      const cerrado = mod.calcularLayout(ancho, alto, false);
      const abierto = mod.calcularLayout(ancho, alto, true);
      assert.deepEqual(cerrado.frasco, abierto.frasco, `${ancho}x${alto} frasco`);
      assert.deepEqual(cerrado.nube, abierto.nube, `${ancho}x${alto} nube`);
      assert.ok(!mod.seSolapan(cerrado.frasco, cerrado.reloj), `${ancho}x${alto} reloj`);
      assert.ok(cerrado.frasco.w > 40 && cerrado.frasco.h > 40);
      assert.ok(cerrado.reloj.x >= 0 && cerrado.reloj.y >= 0);
      assert.ok(cerrado.reloj.x + cerrado.reloj.w <= ancho + 1);
      const alzado = Math.abs(cerrado.reloj.y - abierto.reloj.y);
      assert.ok(alzado <= 12, `${ancho}x${alto} alzado ${alzado}`);
      if (!cerrado.ancha) {
        assert.ok(!mod.seSolapan(cerrado.reloj, cerrado.botonMenu), `${ancho}x${alto} botón`);
        assert.ok(cerrado.reloj.y + cerrado.reloj.h <= cerrado.botonMenu.y + 1);
      }
    }
    const a = mod.calcularLayout(1440, 900, false);
    const b = mod.calcularLayout(1440, 900, false);
    assert.deepEqual(a, b);
  } finally {
    cleanup();
  }
});
