import { hash32, type ContentPalette, type SandSimulation, type StreamParticles } from '@reloj/core';

export function buildPaletteLut(palette: ContentPalette): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const tones = palette.grainTones;
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

export function dibujarChorro(
  ctx: CanvasRenderingContext2D,
  sim: SandSimulation,
  particles: StreamParticles,
  lut: Uint8ClampedArray,
  w: number,
  h: number,
): void {
  const cellW = w / sim.cols;
  const count = particles.count;
  for (let i = 0; i < count; i++) {
    const px = particles.x[i] ?? 0;
    const py = particles.y[i] ?? 0;
    const size = particles.size[i] ?? 0.3;
    const tone = particles.tone[i] ?? 1;
    const l = tone * 3;
    ctx.fillStyle = `rgb(${lut[l] ?? 200}, ${lut[l + 1] ?? 170}, ${lut[l + 2] ?? 130})`;
    ctx.beginPath();
    ctx.arc((px / sim.cols) * w, (py / sim.rows) * h, Math.max(0.6, size * cellW), 0, Math.PI * 2);
    ctx.fill();
  }
}
