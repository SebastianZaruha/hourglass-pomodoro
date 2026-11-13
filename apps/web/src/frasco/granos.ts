import { hash32, type ContentPalette, type SandSimulation, type StreamParticles } from '@reloj/core';

import type { Caja } from '../layout/calcularLayout';
import { vectorLuz } from './alpha';
import { JAR_NECK_Y } from './geometria';

/** Lo que la luz de la escena le hace al color de la arena. */
export interface LuzGrano {
  readonly tinte: string;
  readonly fuerzaTinte: number;
  readonly brillo: number;
  readonly direccion: number;
}

function sextoTono(tones: ContentPalette['grainTones']): readonly [number, number, number] {
  const a = tones[0] ?? [200, 170, 130];
  const b = tones[tones.length - 1] ?? a;
  return [
    Math.round((a[0] ?? 0) * 0.4 + (b[0] ?? 0) * 0.6),
    Math.round((a[1] ?? 0) * 0.4 + (b[1] ?? 0) * 0.6),
    Math.round((a[2] ?? 0) * 0.4 + (b[2] ?? 0) * 0.6),
  ];
}

export function buildPaletteLut(palette: ContentPalette): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const tones = palette.grainTones.length >= 6 ? palette.grainTones : [...palette.grainTones, sextoTono(palette.grainTones)];
  const mean = [0, 1, 2].map((c) => tones.reduce((sum, tone) => sum + (tone[c] ?? 0), 0) / tones.length);
  for (let t = 1; t < 256; t++) {
    const h = hash32(t * 977);
    const speck = (h % 1000) / 1000 < palette.speckRatio;
    const a = tones[h % tones.length] ?? [200, 170, 130];
    const b = tones[(h >>> 8) % tones.length] ?? a;
    const k = ((h >>> 16) & 255) / 255;
    const rgb = speck
      ? palette.speck
      : [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    for (let c = 0; c < 3; c++) {
      const channel = mean[c] ?? 0;
      const value = rgb[c] ?? channel;
      lut[t * 3 + c] = Math.round(channel + (value - channel) * 0.75);
    }
  }
  return lut;
}

let sello: ImageData | null = null;

/** Un sello de 3×3 por grano. Las esquinas van a media opacidad. Un solo putImageData. */
export function pintarSello(ctx: CanvasRenderingContext2D, sim: SandSimulation, lut: Uint8ClampedArray): void {
  const cols = sim.cols * 3;
  const rows = sim.rows * 3;
  if (ctx.canvas.width !== cols || ctx.canvas.height !== rows) {
    ctx.canvas.width = cols;
    ctx.canvas.height = rows;
  }
  if (!sello || sello.width !== cols || sello.height !== rows) sello = ctx.createImageData(cols, rows);
  const pixels = new Uint32Array(sello.data.buffer, sello.data.byteOffset, cols * rows);
  pixels.fill(0);
  const cells = sim.cells;
  const ancho = sim.cols;
  for (let i = 0; i < cells.length; i++) {
    const tone = cells[i] ?? 0;
    if (tone === 0) continue;
    const col = i % ancho;
    const row = (i / ancho) | 0;
    const l = tone * 3;
    const r = lut[l] ?? 0;
    const g = lut[l + 1] ?? 0;
    const b = lut[l + 2] ?? 0;
    const lleno = (255 << 24) | (b << 16) | (g << 8) | r;
    const medio = (128 << 24) | (b << 16) | (g << 8) | r;
    const x0 = col * 3;
    const y0 = row * 3;
    for (let dy = 0; dy < 3; dy++) {
      const fila = (y0 + dy) * cols + x0;
      for (let dx = 0; dx < 3; dx++) {
        const esquina = (dx === 0 || dx === 2) && (dy === 0 || dy === 2);
        pixels[fila + dx] = esquina ? medio : lleno;
      }
    }
  }
  ctx.putImageData(sello, 0, 0);
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

const tinteCache = { hex: '', rgb: [255, 255, 255] as [number, number, number] };

function rgbDe(hex: string): [number, number, number] {
  if (tinteCache.hex === hex) return tinteCache.rgb;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  tinteCache.hex = hex;
  tinteCache.rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return tinteCache.rgb;
}

/**
 * Mezcla el grano con el tinte de la escena y lo aclara del lado de la luz.
 * `nx` y `ny` van de −0.5 a 0.5 dentro del frasco.
 */
export function teñirGrano(
  r: number,
  g: number,
  b: number,
  nx: number,
  ny: number,
  luz: LuzGrano,
): readonly [number, number, number] {
  const tinte = rgbDe(luz.tinte);
  const dir = vectorLuz(luz.direccion);
  const cara = nx * dir.x + ny * dir.y;
  const mezcla = Math.min(0.5, Math.max(0, luz.fuerzaTinte) * 0.48);
  const cuerpo = 0.58 + 0.42 * Math.min(1.08, Math.max(0, luz.brillo));
  const sol = cuerpo * (1 + cara * 0.5);
  const canal = (base: number, destino: number) =>
    Math.max(0, Math.min(255, Math.round((base * (1 - mezcla) + destino * mezcla) * sol)));
  return [canal(r, tinte[0]), canal(g, tinte[1]), canal(b, tinte[2])];
}

/**
 * Cada grano es un punto del tamaño de su celda en el frasco ya medido,
 * no un píxel de la rejilla estirado.
 */
export function pintarGranos(
  ctx: CanvasRenderingContext2D,
  sim: SandSimulation,
  lut: Uint8ClampedArray,
  w: number,
  h: number,
  luz?: LuzGrano,
): void {
  ctx.clearRect(0, 0, w, h);
  const cw = w / sim.cols;
  const ch = h / sim.rows;
  const base = Math.max(0.8, Math.min(cw, ch) * 0.7);
  const cells = sim.cells;
  for (let i = 0; i < cells.length; i++) {
    const tone = cells[i] ?? 0;
    if (tone === 0) continue;
    const col = i % sim.cols;
    const row = (i / sim.cols) | 0;
    const l = tone * 3;
    const nx = col / sim.cols - 0.5;
    const ny = row / sim.rows - 0.5;
    const rgb = luz
      ? teñirGrano(lut[l] ?? 0, lut[l + 1] ?? 0, lut[l + 2] ?? 0, nx, ny, luz)
      : [lut[l] ?? 0, lut[l + 1] ?? 0, lut[l + 2] ?? 0];
    // Un poco de desorden: si no, la rejilla se lee como una tela.
    const jx = ((tone * 13 + col * 3) % 9) / 8 - 0.5;
    const jy = ((tone * 7 + row * 5) % 9) / 8 - 0.5;
    const radio = base * (0.75 + ((tone % 5) / 5) * 0.45);
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.beginPath();
    ctx.arc((col + 0.5 + jx * 0.55) * cw, (row + 0.5 + jy * 0.45) * ch, radio, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function dibujarChorro(
  ctx: CanvasRenderingContext2D,
  sim: SandSimulation,
  particles: StreamParticles,
  lut: Uint8ClampedArray,
  w: number,
  h: number,
  luz?: LuzGrano,
): void {
  const cellW = w / sim.cols;
  const count = particles.count;
  for (let i = 0; i < count; i++) {
    const px = particles.x[i] ?? 0;
    const py = particles.y[i] ?? 0;
    const size = particles.size[i] ?? 0.3;
    const tone = particles.tone[i] ?? 1;
    const l = tone * 3;
    const rgb = luz
      ? teñirGrano(
          lut[l] ?? 200,
          lut[l + 1] ?? 170,
          lut[l + 2] ?? 130,
          px / sim.cols - 0.5,
          py / sim.rows - 0.5,
          luz,
        )
      : [lut[l] ?? 200, lut[l + 1] ?? 170, lut[l + 2] ?? 130];
    ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    ctx.beginPath();
    ctx.arc((px / sim.cols) * w, (py / sim.rows) * h, Math.max(0.6, size * cellW), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** El chorro cae en vertical en el mundo, desde el cuello, sin seguir el giro del frasco. */
export function dibujarChorroMundo(
  ctx: CanvasRenderingContext2D,
  sim: SandSimulation,
  particles: StreamParticles,
  lut: Uint8ClampedArray,
  frasco: Caja,
  angulo: number,
): void {
  const count = particles.count;
  if (count === 0) return;
  const cx = frasco.x + frasco.w / 2;
  const cy = frasco.y + frasco.h / 2;
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  const cuelloY = (JAR_NECK_Y - 0.5) * frasco.h;
  const nx = cx - cuelloY * s;
  for (let i = 0; i < count; i++) {
    const py = particles.y[i] ?? 0;
    const px = particles.x[i] ?? 0;
    const ly = (py / sim.rows - 0.5) * frasco.h;
    const lx = (px / sim.cols - 0.5) * frasco.w;
    const wy = cy + lx * s + ly * c;
    const tone = particles.tone[i] ?? 1;
    const l = tone * 3;
    ctx.fillStyle = `rgb(${lut[l] ?? 0},${lut[l + 1] ?? 0},${lut[l + 2] ?? 0})`;
    ctx.fillRect(nx - 0.75, wy, 1.5, 5);
  }
}
