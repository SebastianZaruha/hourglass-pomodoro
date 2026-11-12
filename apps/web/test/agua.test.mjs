import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('la superficie sigue el mundo y el chorro para si el cuello queda en seco', async () => {
  const { mod, cleanup } = await bundle(
    `export { anguloNivel, cuelloMojado, superficieAgua } from './src/frasco/fisica/agua.ts';\n`,
  );
  try {
    assert.equal(mod.anguloNivel(0.4, 0), 0.4);
    const derecha = mod.superficieAgua('abajo', 0.4, mod.anguloNivel(0.5, 0));
    const izquierda = mod.superficieAgua('abajo', 0.4, mod.anguloNivel(-0.5, 0));
    assert.ok(derecha.gravedad.x > 0);
    assert.ok(izquierda.gravedad.x < 0);
    assert.equal(mod.cuelloMojado(0.4, 0), true);
    assert.equal(mod.cuelloMojado(0.12, Math.PI / 2), false);
  } finally {
    cleanup();
  }
});

test('el agua guarda el volumen al inclinar el frasco', async () => {
  const { mod, cleanup } = await bundle("export { volumenDibujado } from './src/frasco/fisica/agua.ts';\n");
  try {
    const angulos = [0, Math.PI / 6, Math.PI / 2, (150 * Math.PI) / 180];
    for (const bulbo of ['arriba', 'abajo']) {
      for (const volumen of [0, 0.1, 0.37, 0.5, 1]) {
        for (const angulo of angulos) {
          const medido = mod.volumenDibujado(bulbo, volumen, angulo);
          assert.ok(
            Math.abs(medido - volumen) <= 0.01,
            `${bulbo} vol ${volumen} ang ${angulo.toFixed(2)} → ${medido}`,
          );
        }
      }
    }
  } finally {
    cleanup();
  }
});
