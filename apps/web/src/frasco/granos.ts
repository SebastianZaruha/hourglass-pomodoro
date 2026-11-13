import { hash32, type ContentPalette, type SandSimulation, type StreamParticles } from '@reloj/core';

import { vectorLuz } from './alpha';

/** Lo que la luz de la escena le hace al color de la arena. */
export interface LuzGrano {
  readonly tinte: string;
  readonly fuerzaTinte: number;
  readonly brillo: number;
  readonly direccion: number;
}

/** Un tono más oscuro que el más oscuro de la paleta, para que el sexto se distinga. */
function sextoTono(tones: ContentPalette['grainTones']): readonly [number, number, number] {
  let elegido = tones[0] ?? [80, 60, 40];
  let suma = Number.POSITIVE_INFINITY;
  for (const tono of tones) {
    const s = (tono[0] ?? 0) + (tono[1] ?? 0) + (tono[2] ?? 0);
    if (s < suma) {
      suma = s;
      elegido = tono;
    }
  }
  return [
    Math.round((elegido[0] ?? 0) * 0.62),
    Math.round((elegido[1] ?? 0) * 0.62),
    Math.round((elegido[2] ?? 0) * 0.62),
  ];
}

export function buildPaletteLut(palette: ContentPalette): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const tones =
    palette.grainTones.length >= 6 ? palette.grainTones : [...palette.grainTones, sextoTono(palette.grainTones)];
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
      lut[t * 3 + c] = Math.round(Math.max(0, Math.min(255, rgb[c] ?? 0)));
    }
  }
  return lut;
}

const ESCALA_GRANO = 3;
const RADIO_SELLO = 2;

interface FormaGrano {
  readonly cols: number;
  readonly n: number;
  readonly cx: Int16Array;
  readonly cy: Int16Array;
  /** Brillo en octavos de 256: 194 es 0,76 y 314 es 1,23. */
  readonly brillo: Uint16Array;
  readonly largo: Uint8Array;
}

let forma: FormaGrano | null = null;
let sello: ImageData | null = null;
let vista: Uint32Array | null = null;
let revision = 0;

/** Cambia cada vez que el sello se vuelve a pintar. El fotograma reutiliza la lámina si no cambió. */
export function revisionSello(): number {
  return revision;
}

function formaDe(cols: number, n: number): FormaGrano {
  if (forma && forma.cols === cols && forma.n >= n) return forma;
  const cx = new Int16Array(n);
  const cy = new Int16Array(n);
  const brillo = new Uint16Array(n);
  const largo = new Uint8Array(n);
  const maxX = cols * ESCALA_GRANO - 1 - RADIO_SELLO;
  const maxY = Math.ceil(n / cols) * ESCALA_GRANO - 1 - RADIO_SELLO;
  for (let i = 0; i < n; i++) {
    const h = hash32(i + 1);
    const col = i % cols;
    const row = (i / cols) | 0;
    const jx = ((h & 15) - 7) * 0.24;
    const jy = (((h >>> 4) & 15) - 7) * 0.24;
    cx[i] = Math.min(maxX, Math.max(RADIO_SELLO, Math.round(col * ESCALA_GRANO + 1.5 + jx)));
    cy[i] = Math.min(maxY, Math.max(RADIO_SELLO, Math.round(row * ESCALA_GRANO + 1.5 + jy)));
    brillo[i] = 194 + ((h >>> 8) & 15) * 8;
    largo[i] = (h >>> 12) & 1;
  }
  forma = { cols, n, cx, cy, brillo, largo };
  return forma;
}

/**
 * Granos sueltos: disco opaco, centro desplazado y brillo propio.
 * La forma sale de una tabla fija; el fotograma solo aplica el tono.
 * Al escalar, el suavizado borra la celda. Sin esquinas a media tinta.
 */
export function pintarSello(ctx: CanvasRenderingContext2D, sim: SandSimulation, lut: Uint8ClampedArray): void {
  const cols = sim.cols * ESCALA_GRANO;
  const rows = sim.rows * ESCALA_GRANO;
  if (ctx.canvas.width !== cols || ctx.canvas.height !== rows) {
    ctx.canvas.width = cols;
    ctx.canvas.height = rows;
  }
  if (!sello || sello.width !== cols || sello.height !== rows) {
    sello = ctx.createImageData(cols, rows);
    vista = null;
  }
  if (!vista || vista.length !== cols * rows) {
    vista = new Uint32Array(sello.data.buffer, sello.data.byteOffset, cols * rows);
  }
  const pixels = vista;
  pixels.fill(0);
  const cells = sim.cells;
  const f = formaDe(sim.cols, cells.length);
  const { cx, cy, brillo, largo } = f;
  for (let i = 0; i < cells.length; i++) {
    const tone = cells[i] ?? 0;
    if (tone === 0) continue;
    const l = tone * 3;
    const q = brillo[i] ?? 256;
    const r = Math.min(255, ((lut[l] ?? 0) * q) >> 8);
    const g = Math.min(255, ((lut[l + 1] ?? 0) * q) >> 8);
    const b = Math.min(255, ((lut[l + 2] ?? 0) * q) >> 8);
    const tinta = (255 << 24) | (b << 16) | (g << 8) | r;
    const x = cx[i] ?? 0;
    const y = cy[i] ?? 0;
    const p = y * cols + x;
    pixels[p] = tinta;
    pixels[p - 1] = tinta;
    pixels[p + 1] = tinta;
    pixels[p - cols] = tinta;
    pixels[p + cols] = tinta;
    pixels[p - cols - 1] = tinta;
    pixels[p - cols + 1] = tinta;
    pixels[p + cols - 1] = tinta;
    pixels[p + cols + 1] = tinta;
    if (largo[i]) {
      pixels[p - 2] = tinta;
      pixels[p + 2] = tinta;
      pixels[p - cols * 2] = tinta;
      pixels[p + cols * 2] = tinta;
    }
  }
  ctx.putImageData(sello, 0, 0);
  revision += 1;
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
