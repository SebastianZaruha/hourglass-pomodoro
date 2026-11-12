import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

/** Valores de partida de la sección 3.2. Dígitos y pista son el mismo gris. */
const PALETA = {
  'lluvia light': { digitos: '#2E302F', pista: '#2E302F' },
  'lluvia dark': { digitos: '#8F8B86', pista: '#8F8B86' },
  'arena light': { digitos: '#4A4541', pista: '#4A4541' },
  'arena dark': { digitos: '#7E7A75', pista: '#7E7A75' },
  'clasico light': { digitos: '#5A5550', pista: '#5A5550' },
  'clasico dark': { digitos: '#86817B', pista: '#86817B' },
};

test('la paleta del reloj es la de la sección 3.2', async () => {
  const { mod, cleanup } = await bundle("export { TEMAS } from './src/temas/index.ts';\n");
  try {
    for (const tema of mod.TEMAS) {
      for (const scheme of ['light', 'dark']) {
        const modo = scheme === 'light' ? tema.claro : tema.oscuro;
        const esperada = PALETA[`${tema.id} ${scheme}`];
        assert.equal(modo.reloj.digitos.toUpperCase(), esperada.digitos);
        assert.equal(modo.reloj.pista.toUpperCase(), esperada.pista);
        assert.equal('halo' in modo.reloj, false);
      }
    }
  } finally {
    cleanup();
  }
});
