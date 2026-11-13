import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('el medidor de la superficie lee el píxel y no la fórmula del frasco', async () => {
  const { mod, cleanup } = await bundle(
    `export { huecoAguaMascara, pendienteSuperficie } from './e2e/soporte/pendiente.ts';\n`,
  );
  try {
    const horizontal = imagenInclinada(0);
    const recta = mod.pendienteSuperficie(horizontal.data, horizontal.w, horizontal.h, {
      x: 10,
      y: 10,
      w: horizontal.w - 20,
      h: horizontal.h - 20,
    });
    assert.ok(Math.abs(recta.grados) < 1, `horizontal ${recta.grados}`);

    const inclinada = imagenInclinada(22);
    const medida = mod.pendienteSuperficie(inclinada.data, inclinada.w, inclinada.h, {
      x: 10,
      y: 10,
      w: inclinada.w - 20,
      h: inclinada.h - 20,
    });
    assert.ok(Math.abs(Math.abs(medida.grados) - 22) < 1.5, `22° medidos ${medida.grados}`);

    const estrecha = frascoSintetico(true);
    const hueco = mod.huecoAguaMascara(estrecha.jar, estrecha.mask, estrecha.w, estrecha.h);
    assert.ok(hueco.hueco > 2, `hueco estrecho ${hueco.hueco}`);
    const llena = frascoSintetico(false);
    const justo = mod.huecoAguaMascara(llena.jar, llena.mask, llena.w, llena.h);
    assert.ok(justo.hueco < 2, `hueco lleno ${justo.hueco}`);
  } finally {
    cleanup();
  }
});

function imagenInclinada(grados) {
  const w = 180;
  const h = 140;
  const data = new Uint8ClampedArray(w * h * 4);
  const rad = (grados * Math.PI) / 180;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const corte = 70 + (x - 90) * Math.tan(rad);
      const agua = y >= corte;
      const i = (y * w + x) * 4;
      data[i] = agua ? 30 : 210;
      data[i + 1] = agua ? 50 : 210;
      data[i + 2] = agua ? 90 : 210;
      data[i + 3] = 255;
    }
  }
  return { data, w, h };
}

function frascoSintetico(estrecha) {
  const w = 200;
  const h = 120;
  const jar = new Uint8ClampedArray(w * h * 4);
  const mask = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const dentro = x >= 30 && x <= 170;
      mask[i] = dentro ? 255 : 0;
      mask[i + 3] = 255;
      const agua = estrecha ? x >= 70 && x <= 130 : dentro;
      jar[i] = agua ? 40 : 180;
      jar[i + 1] = agua ? 70 : 170;
      jar[i + 2] = agua ? 110 : 160;
      jar[i + 3] = 255;
    }
  }
  return { jar, mask, w, h };
}
