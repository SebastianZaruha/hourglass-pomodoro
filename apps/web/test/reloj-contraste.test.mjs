import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

const web = path.resolve(import.meta.dirname, '..');

test('la hora y la pista contrastan sobre los píxeles del fondo', async () => {
  const { mod, cleanup } = await bundle(
    `export { calcularLayout } from './src/layout/calcularLayout.ts';
     export { encuadreFondo } from './src/fondo/encuadre.ts';
     export { TEMAS } from './src/temas/index.ts';
     export { JAR_FOOT_Y } from './src/frasco/jarTabla.ts';
     export { contraste } from './src/temas/contraste.ts';\n`,
  );
  try {
    const css = [
      readFileSync(path.join(web, 'src/temas/lluvia.css'), 'utf8'),
      readFileSync(path.join(web, 'src/temas/arena.css'), 'utf8'),
      readFileSync(path.join(web, 'src/temas/clasico.css'), 'utf8'),
    ].join('\n');
    const fotos = new Map();
    const tamanos = [
      [1440, 900],
      [390, 844],
      [360, 740],
    ];
    for (const tema of mod.TEMAS) {
      for (const scheme of ['light', 'dark']) {
        const modo = scheme === 'light' ? tema.claro : tema.oscuro;
        const fondo = modo.fondo;
        const src = fondo.tipo === 'foto' ? fondo.src : fondo.poster;
        const pintura = fotos.get(src) ?? leerFoto(path.join(web, 'public', src.slice(1)));
        fotos.set(src, pintura);
        const tokens = variables(css, tema.id, scheme);
        const hora = rgb(tokens.get('--time'));
        const pista = rgb(tokens.get('--hint'));
        const halo = rgba(tokens.get('--halo'));
        const fuerza = Number(tokens.get('--halo-fuerza'));
        const alpha = halo.a * fuerza;
        for (const [ancho, alto] of tamanos) {
          for (const menu of ancho < 700 ? [false, true] : [false]) {
            const lay = mod.calcularLayout(ancho, alto, menu);
            const pie = {
              x: lay.frasco.x + lay.frasco.w / 2,
              y: lay.frasco.y + lay.frasco.h * mod.JAR_FOOT_Y,
            };
            const marco = mod.encuadreFondo(ancho, alto, pintura.w, pintura.h, tema.anclaSuelo, pie);
            const muestras = banda(pintura, marco, lay.reloj);
            const peorHora = peor(muestras, hora, halo, alpha, mod.contraste);
            const peorPista = peor(muestras, pista, halo, alpha, mod.contraste);
            const donde = `${tema.id} ${scheme} ${ancho}x${alto}${menu ? ' menú' : ''}`;
            assert.ok(peorHora >= 3, `${donde} hora ${peorHora.toFixed(2)}`);
            assert.ok(peorPista >= 4.5, `${donde} pista ${peorPista.toFixed(2)}`);
          }
        }
      }
    }
  } finally {
    cleanup();
  }
});

function variables(css, tema, scheme) {
  const bloque = css.match(
    new RegExp(`\\.app\\[data-tema='${tema}'\\]\\[data-scheme='${scheme}'\\]\\s*\\{([^}]*)\\}`),
  );
  assert.ok(bloque, `${tema} ${scheme}`);
  const mapa = new Map();
  for (const linea of bloque[1].split(';')) {
    const corte = linea.indexOf(':');
    if (corte < 0) continue;
    mapa.set(linea.slice(0, corte).trim(), linea.slice(corte + 1).trim());
  }
  return mapa;
}

function leerFoto(ruta) {
  const info = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', ruta],
    { encoding: 'utf8' },
  ).trim();
  const [w, h] = info.split(',').map(Number);
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', ruta, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { maxBuffer: w * h * 3 + 1024 },
  );
  return { w, h, raw };
}

function banda(foto, marco, reloj) {
  const puntos = [];
  const y0 = reloj.y + reloj.h * 0.28;
  const y1 = reloj.y + reloj.h * 0.78;
  const x0 = reloj.x + reloj.w * 0.22;
  const x1 = reloj.x + reloj.w * 0.78;
  for (let sy = y0; sy <= y1; sy += 8) {
    for (let sx = x0; sx <= x1; sx += 10) {
      const ix = Math.round(((sx - marco.x) / marco.w) * foto.w);
      const iy = Math.round(((sy - marco.y) / marco.h) * foto.h);
      if (ix < 0 || iy < 0 || ix >= foto.w || iy >= foto.h) continue;
      const i = (iy * foto.w + ix) * 3;
      puntos.push([foto.raw[i], foto.raw[i + 1], foto.raw[i + 2]]);
    }
  }
  assert.ok(puntos.length > 8, 'sin píxeles detrás del reloj');
  return puntos;
}

function peor(muestras, texto, halo, alpha, contraste) {
  let minimo = Infinity;
  for (const px of muestras) {
    const fondo = mezclar(px, [halo.r, halo.g, halo.b], alpha);
    minimo = Math.min(minimo, contraste(hex(texto), hex(fondo)));
  }
  return minimo;
}

function mezclar(base, tinta, alpha) {
  return base.map((canal, i) => Math.round(canal * (1 - alpha) + tinta[i] * alpha));
}

function rgb(hex) {
  const limpio = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(limpio.slice(i, i + 2), 16));
}

function rgba(texto) {
  const partes = texto
    .slice(texto.indexOf('(') + 1, texto.indexOf(')'))
    .split(',')
    .map((parte) => Number(parte.trim()));
  return { r: partes[0], g: partes[1], b: partes[2], a: partes[3] ?? 1 };
}

function hex(canales) {
  return `#${canales.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
