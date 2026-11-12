import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

/**
 * Paleta de la sección 3.2. El contraste sobre el píxel real lo mide Playwright.
 */
const PALETA = {
  'lluvia light': { digitos: '#151515', pista: '#0A0A0A' },
  'lluvia dark': { digitos: '#8B8B8B', pista: '#9C9C9C' },
  'arena light': { digitos: '#5D5D5D', pista: '#505050' },
  'arena dark': { digitos: '#737373', pista: '#828282' },
  'clasico light': { digitos: '#727272', pista: '#626262' },
  'clasico dark': { digitos: '#787878', pista: '#888888' },
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
