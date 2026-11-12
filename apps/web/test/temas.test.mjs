import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('el texto del menú contrasta al menos 4.5 a 1 en cada tema y modo', async () => {
  const { mod, cleanup } = await bundle(
    `export { TEMAS } from './src/temas/index.ts';
     export { contraste } from './src/temas/contraste.ts';\n`,
  );
  try {
    for (const tema of mod.TEMAS) {
      for (const modo of [tema.claro, tema.oscuro]) {
        const relacion = mod.contraste(modo.ui.tinta, modo.ui.menuSolido);
        assert.ok(relacion >= 4.5, `${tema.id} ${relacion.toFixed(2)}`);
      }
    }
    assert.deepEqual(
      mod.TEMAS.map((tema) => tema.id),
      ['lluvia', 'arena', 'clasico'],
    );
  } finally {
    cleanup();
  }
});

test('un claro guardado pasa a clásico y lo desconocido a lluvia', async () => {
  const { mod, cleanup } = await bundle("export { escenaGuardada } from './src/temas/index.ts';\n");
  try {
    assert.equal(mod.escenaGuardada('claro'), 'clasico');
    assert.equal(mod.escenaGuardada('arena'), 'arena');
    assert.equal(mod.escenaGuardada('miel'), 'lluvia');
    assert.equal(mod.escenaGuardada(null), 'lluvia');
  } finally {
    cleanup();
  }
});
