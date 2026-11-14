import { hash32, type ContentPalette, type SandSimulation, type StreamParticles } from '@reloj/core';

import type { GeometriaFrasco, Scheme } from '../../comun/frasco';

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

export interface ArenaPintada {
  readonly scheme: Scheme;
  readonly caja: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly sand: HTMLCanvasElement;
  readonly noise: HTMLCanvasElement;
  readonly sim: SandSimulation;
  readonly particles: StreamParticles;
  readonly lut: Uint8ClampedArray;
  readonly geo: GeometriaFrasco;
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
  g.drawImage(scene.sand, vx, vy, vw, vh);

  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = RUIDO[scene.scheme];
  const pattern = g.createPattern(scene.noise, 'repeat');
  if (pattern) {
    g.fillStyle = pattern;
    g.fillRect(vx, vy, vw, vh);
  }
  g.restore();

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
