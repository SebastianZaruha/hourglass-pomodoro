import { hash32, type ContentPalette, type SandSimulation, type StreamParticles } from '@reloj/core';

import {
  CUELLO_FILA,
  CUELLO_X,
  FOTO_ALTO,
  FOTO_ANCHO,
  opacidadFundido,
  type GeometriaFrasco,
  type Scheme,
} from '../../comun/frasco';

export function buildPaletteLut(palette: ContentPalette): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const tones = palette.grainTones;
  const mean = [0, 1, 2].map((c) => tones.reduce((sum, tone) => sum + (tone[c] ?? 0), 0) / tones.length);
  const contrast = 0.75;
  for (let t = 1; t < 256; t++) {
    const h = hash32(t * 977);
    let rgb: readonly number[];
    if ((h % 1000) / 1000 < palette.speckRatio) {
      rgb = palette.speck;
    } else {
      const a = tones[h % tones.length] ?? [200, 170, 130];
      const b = tones[(h >>> 8) % tones.length] ?? a;
      const k = ((h >>> 16) & 255) / 255;
      rgb = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    for (let c = 0; c < 3; c++) {
      const channel = mean[c] ?? 0;
      const value = rgb[c] ?? channel;
      lut[t * 3 + c] = Math.round(channel + (value - channel) * contrast);
    }
  }
  return lut;
}

export function paintCells(sim: SandSimulation, lut: Uint8ClampedArray, image: ImageData): void {
  const cells = sim.cells;
  const data = image.data;
  data.fill(0);
  for (let i = 0; i < cells.length; i++) {
    const tone = cells[i] ?? 0;
    if (tone === 0) continue;
    const o = i * 4;
    const l = tone * 3;
    data[o] = lut[l] ?? 0;
    data[o + 1] = lut[l + 1] ?? 0;
    data[o + 2] = lut[l + 2] ?? 0;
    data[o + 3] = 255;
  }
}

export function makeGrainNoise(size = 160): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const speck = Math.random() < 0.04;
    const n = speck ? 90 + Math.random() * 40 : 170 + Math.random() * 85;
    const o = i * 4;
    image.data[o] = n;
    image.data[o + 1] = n * 0.94;
    image.data[o + 2] = n * 0.82;
    image.data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const RUIDO: Record<Scheme, number> = { light: 0.2, dark: 0.16 };

/**
 * Dirección de la luz de noche, en grados, o null si este pintado no
 * se sombrea. La pone Arena en oscuro y la quita al salir. Clásico y
 * el modo claro no la activan, y entonces el color de los granos no cambia.
 */
let luzGrano: number | null = null;

export function fijarLuzGrano(direccion: number | null): void {
  luzGrano = direccion;
}

export interface ArenaPintada {
  readonly scheme: Scheme;
  readonly caja: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly sand: HTMLCanvasElement;
  readonly noise: HTMLCanvasElement;
  readonly sim: SandSimulation;
  readonly particles: StreamParticles;
  readonly lut: Uint8ClampedArray;
  readonly geo: GeometriaFrasco;
  /**
   * Fundido del reinicio, en el lienzo de la arena. `queda` es la opacidad
   * del montón viejo. El nuevo es el de ahora, dado la vuelta 180°.
   */
  readonly fundido?: {
    readonly viejo: HTMLCanvasElement;
    readonly queda: number;
    readonly blurSale: number;
    readonly blurEntra: number;
  };
}

let hoja: HTMLCanvasElement | null = null;

/**
 * Rejilla, ruido y chorro en la ventana interior, recortados con la máscara.
 * El contexto ya está girado con el frasco: la hoja se pega en ese marco.
 */
export function pintarArena(ctx: CanvasRenderingContext2D, scene: ArenaPintada): void {
  const { caja, geo } = scene;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pxW = Math.max(1, Math.round(caja.w * dpr));
  const pxH = Math.max(1, Math.round(caja.h * dpr));
  if (!hoja || hoja.width !== pxW || hoja.height !== pxH) {
    hoja = document.createElement('canvas');
    hoja.width = pxW;
    hoja.height = pxH;
  }
  const g = hoja.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, caja.w, caja.h);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  const vx = geo.ventana.x0 * caja.w;
  const vy = geo.ventana.y0 * caja.h;
  const vw = (geo.ventana.x1 - geo.ventana.x0) * caja.w;
  const vh = (geo.ventana.y1 - geo.ventana.y0) * caja.h;

  g.imageSmoothingEnabled = false;
  if (scene.fundido) {
    const { queda, viejo, blurSale, blurEntra } = scene.fundido;
    // El mismo centro que el giro del vidrio: el cuello, no el centro del bitmap.
    const cx = (caja.w * CUELLO_X) / FOTO_ANCHO;
    const cy = (caja.h * CUELLO_FILA) / FOTO_ALTO;
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = true;
    const alfaViejo = opacidadFundido(queda);
    const alfaNuevo = opacidadFundido(1 - queda);
    if (alfaViejo > 0) {
      g.filter = blurSale > 0.05 ? `blur(${blurSale}px)` : 'none';
      g.globalAlpha = alfaViejo;
      g.drawImage(viejo, vx, vy, vw, vh);
    }
    if (alfaNuevo > 0) {
      g.filter = blurEntra > 0.05 ? `blur(${blurEntra}px)` : 'none';
      g.globalAlpha = alfaNuevo;
      g.translate(cx, cy);
      g.rotate(Math.PI);
      g.translate(-cx, -cy);
      g.drawImage(scene.sand, vx, vy, vw, vh);
      g.filter = 'none';
      g.globalAlpha = 1;
      sombrearGranos(g, ctx, scene, vx, vy, vw, vh);
    }
    g.restore();
  } else {
    g.drawImage(scene.sand, vx, vy, vw, vh);
  }

  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = RUIDO[scene.scheme];
  const pattern = g.createPattern(scene.noise, 'repeat');
  if (pattern) {
    g.fillStyle = pattern;
    g.fillRect(vx, vy, vw, vh);
  }
  g.restore();

  if (!scene.fundido) sombrearGranos(g, ctx, scene, vx, vy, vw, vh);

  const cellW = vw / scene.sim.cols;
  const cellH = vh / scene.sim.rows;
  const count = scene.particles.count;
  g.imageSmoothingEnabled = true;
  for (let i = 0; i < count; i++) {
    const px = scene.particles.x[i] ?? 0;
    const py = scene.particles.y[i] ?? 0;
    const size = scene.particles.size[i] ?? 0.3;
    const tone = scene.particles.tone[i] ?? 1;
    const x = vx + (px / scene.sim.cols) * vw;
    const y = vy + (py / scene.sim.rows) * vh;
    const radius = Math.max(0.6, size * cellW * 1.15);
    const l = tone * 3;
    g.fillStyle = `rgb(${scene.lut[l] ?? 200}, ${scene.lut[l + 1] ?? 170}, ${scene.lut[l + 2] ?? 130})`;
    g.beginPath();
    g.ellipse(x, y, radius, Math.max(radius, size * cellH * 0.9), 0, 0, Math.PI * 2);
    g.fill();
  }

  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(geo.mascara, 0, 0, caja.w, caja.h);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(hoja, caja.x, caja.y, caja.w, caja.h);
}

let telaSombra: HTMLCanvasElement | null = null;
let telaBrillo: HTMLCanvasElement | null = null;
let datosSombra: ImageData | null = null;
let datosBrillo: ImageData | null = null;

function pasoEje(v: number): -1 | 0 | 1 {
  if (v > 0.2) return 1;
  if (v < -0.2) return -1;
  return 0;
}

/**
 * Sombra de la luz de noche sobre el color ya pintado. No mueve granos:
 * multiplica por la profundidad, la cara que mira a la luz y el contacto
 * con el vidrio, y aclara un poco las caras iluminadas.
 */
function sombrearGranos(
  g: CanvasRenderingContext2D,
  ctx: CanvasRenderingContext2D,
  scene: ArenaPintada,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): void {
  if (luzGrano === null || vw < 2 || vh < 2) return;
  const { sim } = scene;
  const cols = sim.cols;
  const rows = sim.rows;
  if (cols < 2 || rows < 2) return;
  if (!telaSombra || telaSombra.width !== cols || telaSombra.height !== rows) {
    telaSombra = document.createElement('canvas');
    telaSombra.width = cols;
    telaSombra.height = rows;
    telaBrillo = document.createElement('canvas');
    telaBrillo.width = cols;
    telaBrillo.height = rows;
    datosSombra = null;
    datosBrillo = null;
  }
  const sg = telaSombra.getContext('2d');
  const bg = telaBrillo?.getContext('2d');
  if (!sg || !bg || !telaBrillo) return;
  if (!datosSombra) datosSombra = sg.createImageData(cols, rows);
  if (!datosBrillo) datosBrillo = bg.createImageData(cols, rows);
  datosSombra.data.fill(0);
  datosBrillo.data.fill(0);

  const trazo = ctx.getTransform();
  const angulo = Math.atan2(trazo.b, trazo.a);
  const rad = (luzGrano * Math.PI) / 180 - angulo;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);
  let sx = pasoEje(lx);
  let sy = pasoEje(ly);
  if (sx === 0 && sy === 0) {
    if (Math.abs(lx) >= Math.abs(ly)) sx = lx >= 0 ? 1 : -1;
    else sy = ly >= 0 ? 1 : -1;
  }

  const cells = sim.cells;
  const mask = sim.mask;
  const fondo = new Int16Array(cols * rows);
  const colDesde = sx > 0 ? cols - 1 : 0;
  const colHasta = sx > 0 ? -1 : cols;
  const colPaso = sx > 0 ? -1 : 1;
  const filaDesde = sy > 0 ? rows - 1 : 0;
  const filaHasta = sy > 0 ? -1 : rows;
  const filaPaso = sy > 0 ? -1 : 1;
  const sd = datosSombra.data;
  const bd = datosBrillo.data;

  for (let row = filaDesde; row !== filaHasta; row += filaPaso) {
    for (let col = colDesde; col !== colHasta; col += colPaso) {
      const i = row * cols + col;
      const tono = cells[i] ?? 0;
      if (tono === 0) continue;
      const nx = col + sx;
      const ny = row + sy;
      const dentro = nx >= 0 && ny >= 0 && nx < cols && ny < rows;
      const vecino = dentro ? (cells[ny * cols + nx] ?? 0) : 0;
      const cara = !dentro || vecino === 0;
      const profundo = dentro && vecino !== 0 ? Math.min(8, (fondo[ny * cols + nx] ?? 0) + 1) : 0;
      fondo[i] = profundo;
      let vidrio = false;
      if (
        col === 0 ||
        row === 0 ||
        col === cols - 1 ||
        row === rows - 1 ||
        (mask[i - 1] ?? 0) === 0 ||
        (mask[i + 1] ?? 0) === 0 ||
        (mask[i - cols] ?? 0) === 0 ||
        (mask[i + cols] ?? 0) === 0
      ) {
        vidrio = true;
      }
      const grano = ((tono * 17) % 11) - 5;
      let valor = 1 - profundo * 0.04 + grano * 0.022;
      if (cara) valor += 0.1;
      if (vidrio) valor -= 0.08;
      valor = Math.max(0.64, Math.min(1, valor));
      const o = i * 4;
      sd[o] = Math.round(Math.min(255, valor * 255));
      sd[o + 1] = Math.round(valor * 214);
      sd[o + 2] = Math.round(valor * 160);
      sd[o + 3] = 255;
      if (cara && profundo === 0) {
        bd[o] = 255;
        bd[o + 1] = 186;
        bd[o + 2] = 96;
        bd[o + 3] = 88;
      }
    }
  }

  sg.putImageData(datosSombra, 0, 0);
  bg.putImageData(datosBrillo, 0, 0);
  const modo = g.globalCompositeOperation;
  const suave = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(telaSombra, vx, vy, vw, vh);
  g.globalCompositeOperation = 'screen';
  g.drawImage(telaBrillo, vx, vy, vw, vh);
  g.globalCompositeOperation = modo;
  g.imageSmoothingEnabled = suave;
  g.globalAlpha = 1;
}
