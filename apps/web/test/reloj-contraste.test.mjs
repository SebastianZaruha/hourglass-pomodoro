import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

/**
 * Paleta de la sección 3.2, cerrada en la sección 7.
 * El contraste sobre el píxel real (con el halo desenfocado) lo mide Playwright.
 */
const PALETA = {
  'lluvia light': { digitos: '#F5F4F0', pista: '#FFFFFF', halo: '#141615', haloOpacidad: 0.3 },
  'lluvia dark': { digitos: '#ECEAE6', pista: '#F6F5F2', halo: '#0C0D0C', haloOpacidad: 0.25 },
  'arena light': { digitos: '#2A2623', pista: '#1C1A18', halo: '#FFF8EE', haloOpacidad: 0.22 },
  'arena dark': { digitos: '#EDEAE5', pista: '#F6F4F0', halo: '#0C0A09', haloOpacidad: 0.25 },
  'clasico light': { digitos: '#36322F', pista: '#24211F', halo: '#FFFCF7', haloOpacidad: 0.2 },
  'clasico dark': { digitos: '#E4E0DA', pista: '#F2EFEA', halo: '#0C0B0A', haloOpacidad: 0.25 },
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
        assert.equal(modo.reloj.halo.toUpperCase(), esperada.halo);
        assert.equal(modo.reloj.haloOpacidad, esperada.haloOpacidad);
      }
    }
  } finally {
    cleanup();
  }
});
