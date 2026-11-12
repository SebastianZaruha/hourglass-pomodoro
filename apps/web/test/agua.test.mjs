import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

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
