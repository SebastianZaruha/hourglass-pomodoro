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

test('la nube se levanta al inclinar y se queda en el cuello si el frasco está derecho', async () => {
  const { mod, cleanup } = await bundle(`export { despegueNube } from './src/frasco/nube.ts';\n`);
  try {
    assert.equal(mod.despegueNube(0, 200), 0);
    assert.ok(mod.despegueNube(Math.PI / 4, 200) > 100);
    assert.ok(mod.despegueNube((3 * Math.PI) / 4, 200) > 100);
  } finally {
    cleanup();
  }
});
