import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

const mascara = path.resolve(import.meta.dirname, '../public/frasco/jar-mask.webp');

/** Ancho y alto del VP8, en los 14 bits que siguen a la firma. */
function medidasWebp(ruta) {
  const cab = readFileSync(ruta).subarray(0, 64);
  const firma = cab.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
  assert.ok(firma >= 0 && firma + 7 <= cab.length, 'la máscara no es un WebP VP8');
  return {
    ancho: cab.readUInt16LE(firma + 3) & 0x3fff,
    alto: cab.readUInt16LE(firma + 5) & 0x3fff,
  };
}

/** Lee el gris del WebP con ffmpeg, que el CI ya instala. */
function luminancia() {
  const { ancho, alto } = medidasWebp(mascara);
  const bruto = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', mascara, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'],
    { maxBuffer: 8_000_000 },
  );
  assert.equal(bruto.length, ancho * alto, `ffmpeg no devolvió ${ancho}x${alto}`);
  return { ancho, alto, luma: new Uint8Array(bruto.buffer, bruto.byteOffset, bruto.byteLength) };
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
