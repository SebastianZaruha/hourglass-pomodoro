import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

const mascara = path.resolve(import.meta.dirname, '../public/frasco/jar-mask.webp');

function luminancia() {
  const script = `
from PIL import Image
im = Image.open(${JSON.stringify(mascara)}).convert('RGB')
w, h = im.size
px = im.load()
out = bytearray(w * h)
for y in range(h):
    fila = y * w
    for x in range(w):
        out[fila + x] = px[x, y][0]
import sys
sys.stdout.buffer.write(w.to_bytes(4, 'little') + h.to_bytes(4, 'little') + out)
`;
  const bruto = execFileSync('python3', ['-c', script], { maxBuffer: 8_000_000 });
  const ancho = bruto.readUInt32LE(0);
  const alto = bruto.readUInt32LE(4);
  return { ancho, alto, luma: new Uint8Array(bruto.buffer, bruto.byteOffset + 8, ancho * alto) };
}

test('la rejilla copia la máscara y el cuello es la fila más estrecha', async () => {
  const { mod, cleanup } = await bundle(
    `export { desdeLuminancia, diferenciaDeFilas } from './src/frasco/geometria/desdeMascara.ts';\n`,
  );
  try {
    const { ancho, alto, luma } = luminancia();
    const geo = mod.desdeLuminancia(luma, ancho, alto);
    assert.ok(geo.puntosArriba > 1000, 'el bulbo de arriba tiene área');
    assert.ok(geo.puntosAbajo > 1000, 'el bulbo de abajo tiene área');
    const diff = mod.diferenciaDeFilas(luma, ancho, alto, geo);
    let minimo = 1e9;
    for (const cuenta of geo.anchos) if (cuenta > 0 && cuenta < minimo) minimo = cuenta;
    assert.equal(geo.anchos[geo.cuelloFila], minimo);
    assert.equal(diff.cuelloEsElMinimo, true);
    assert.ok(diff.maxima <= 0.02, `la peor fila se desvía ${diff.maxima.toFixed(3)}`);
  } finally {
    cleanup();
  }
});
