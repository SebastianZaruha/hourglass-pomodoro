import { hash32, type ContentPalette, type SandSimulation, type StreamParticles } from '@reloj/core';

import type { Scheme } from '../../comun/frasco';

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
}

/** Rejilla, ruido y chorro. El contexto ya está girado y recortado al vidrio. */
export function pintarArena(ctx: CanvasRenderingContext2D, scene: ArenaPintada): void {
  const { caja } = scene;
  const left = caja.x;
  const top = caja.y;
  const width = caja.w;
  const height = caja.h;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene.sand, left, top, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = RUIDO[scene.scheme];
  const pattern = ctx.createPattern(scene.noise, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(left, top, width, height);
  }
  ctx.restore();

  const cellW = width / scene.sim.cols;
  const cellH = height / scene.sim.rows;
  const count = scene.particles.count;
  ctx.imageSmoothingEnabled = true;
  for (let i = 0; i < count; i++) {
    const px = scene.particles.x[i] ?? 0;
    const py = scene.particles.y[i] ?? 0;
    const size = scene.particles.size[i] ?? 0.3;
    const tone = scene.particles.tone[i] ?? 1;
    const x = left + (px / scene.sim.cols) * width;
    const y = top + (py / scene.sim.rows) * height;
    const radius = Math.max(0.6, size * cellW * 1.15);
    const l = tone * 3;
    ctx.fillStyle = `rgb(${scene.lut[l] ?? 200}, ${scene.lut[l + 1] ?? 170}, ${scene.lut[l + 2] ?? 130})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, Math.max(radius, size * cellH * 0.9), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
