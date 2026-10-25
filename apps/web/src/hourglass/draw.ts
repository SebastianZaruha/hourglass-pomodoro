/**
 * Dibujo del reloj en Canvas 2D.
 * El vidrio es propio de la web (no los shaders Skia del móvil). La arena
 * sale de la simulación del core: cada celda es un grano, y el chorro
 * son las partículas de `StreamParticles`.
 */
import {
  hash32,
  outlinePoints,
  type ContentPalette,
  type HourglassProfile,
  type SandSimulation,
  type StreamParticles,
} from '@reloj/core';

export interface GlassLayout {
  readonly cx: number;
  readonly cy: number;
  readonly halfW: number;
  readonly halfH: number;
}

export type Scheme = 'light' | 'dark';

export function layoutFor(width: number, height: number, profile: HourglassProfile): GlassLayout {
  const availW = width * 0.84;
  const availH = height * 0.86;
  let glassW = availW;
  let glassH = glassW * profile.halfHeightRatio;
  if (glassH > availH) {
    glassH = availH;
    glassW = glassH / profile.halfHeightRatio;
  }
  return {
    cx: width / 2,
    cy: height * 0.48,
    halfW: glassW / 2,
    halfH: glassH / 2,
  };
}

/** ¿El punto cae en un flanco del reloj (para girarlo) y no en el centro? */
export function hitGlassSide(layout: GlassLayout, x: number, y: number): boolean {
  const dx = x - layout.cx;
  const dy = y - layout.cy;
  if (Math.abs(dy) > layout.halfH * 0.98) return false;
  const adx = Math.abs(dx);
  if (adx > layout.halfW * 1.12) return false;
  return adx >= layout.halfW * 0.36;
}

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

function trace(
  ctx: CanvasRenderingContext2D,
  profile: HourglassProfile,
  layout: GlassLayout,
  inner: boolean,
) {
  const pts = outlinePoints(profile, 140, inner);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const x = layout.cx + p.x * layout.halfW;
    const y = layout.cy + p.y * layout.halfH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    if (!p) continue;
    ctx.lineTo(layout.cx - p.x * layout.halfW, layout.cy + p.y * layout.halfH);
  }
  ctx.closePath();
}

export interface DrawScene {
  readonly profile: HourglassProfile;
  readonly layout: GlassLayout;
  readonly scheme: Scheme;
  readonly sand: HTMLCanvasElement;
  readonly noise: HTMLCanvasElement;
  readonly sim: SandSimulation;
  readonly particles: StreamParticles;
  readonly lut: Uint8ClampedArray;
  /** Giro visual (cambio de fase + gesto). La arena va pegada al vidrio. */
  readonly rotation: number;
}

export function drawHourglass(ctx: CanvasRenderingContext2D, scene: DrawScene): void {
  const { layout, scheme, profile } = scene;
  const { cx, cy, halfW, halfH } = layout;
  const dark = scheme === 'dark';
  const w = ctx.canvas.clientWidth;
  const h = ctx.canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.filter = 'blur(16px)';
  ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(84, 64, 44, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + halfH * 0.97, halfW * 0.78, Math.max(8, halfW * 0.11), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'none';
  ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(70, 52, 36, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + halfH * 0.95, halfW * 0.42, Math.max(4, halfW * 0.045), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(scene.rotation);
  ctx.translate(-cx, -cy);

  trace(ctx, profile, layout, false);
  ctx.save();
  ctx.clip();
  const glass = ctx.createLinearGradient(cx, cy - halfH, cx, cy + halfH);
  if (dark) {
    glass.addColorStop(0, 'rgba(255, 236, 214, 0.10)');
    glass.addColorStop(0.45, 'rgba(255, 236, 214, 0.03)');
    glass.addColorStop(1, 'rgba(255, 236, 214, 0.07)');
  } else {
    glass.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    glass.addColorStop(0.42, 'rgba(255, 252, 247, 0.08)');
    glass.addColorStop(1, 'rgba(255, 250, 242, 0.22)');
  }
  ctx.fillStyle = glass;
  ctx.fillRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
  ctx.restore();

  trace(ctx, profile, layout, true);
  ctx.save();
  ctx.clip();
  const left = cx - halfW;
  const top = cy - halfH;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scene.sand, left, top, halfW * 2, halfH * 2);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = dark ? 0.28 : 0.34;
  const pattern = ctx.createPattern(scene.noise, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(left, top, halfW * 2, halfH * 2);
  }
  ctx.restore();

  const cellW = (halfW * 2) / scene.sim.cols;
  const cellH = (halfH * 2) / scene.sim.rows;
  const count = scene.particles.count;
  for (let i = 0; i < count; i++) {
    const px = scene.particles.x[i] ?? 0;
    const py = scene.particles.y[i] ?? 0;
    const size = scene.particles.size[i] ?? 0.3;
    const tone = scene.particles.tone[i] ?? 1;
    const x = left + (px / scene.sim.cols) * halfW * 2;
    const y = top + (py / scene.sim.rows) * halfH * 2;
    const radius = Math.max(0.7, size * cellW * 1.35);
    const l = tone * 3;
    ctx.fillStyle = `rgb(${scene.lut[l] ?? 200}, ${scene.lut[l + 1] ?? 170}, ${scene.lut[l + 2] ?? 130})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, Math.max(radius, size * cellH), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = Math.max(6, halfW * 0.09);
  ctx.strokeStyle = dark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(90, 70, 50, 0.16)';
  trace(ctx, profile, layout, true);
  ctx.stroke();
  ctx.restore();

  const rim = ctx.createLinearGradient(cx - halfW, cy - halfH, cx + halfW, cy + halfH);
  if (dark) {
    rim.addColorStop(0, 'rgba(255, 236, 214, 0.55)');
    rim.addColorStop(0.45, 'rgba(255, 236, 214, 0.14)');
    rim.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  } else {
    rim.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    rim.addColorStop(0.4, 'rgba(255, 252, 246, 0.35)');
    rim.addColorStop(1, 'rgba(120, 96, 72, 0.28)');
  }
  ctx.lineWidth = Math.max(1.6, halfW * 0.028);
  ctx.strokeStyle = rim;
  ctx.lineJoin = 'round';
  trace(ctx, profile, layout, false);
  ctx.stroke();

  ctx.save();
  trace(ctx, profile, layout, false);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  const shine = ctx.createRadialGradient(
    cx - halfW * 0.32,
    cy - halfH * 0.52,
    2,
    cx - halfW * 0.05,
    cy - halfH * 0.42,
    halfW * 0.62,
  );
  shine.addColorStop(0, dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.7)');
  shine.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(cx - halfW * 0.12, cy - halfH * 0.46, halfW * 0.46, halfH * 0.22, -0.5, 0, Math.PI * 2);
  ctx.fill();
  const lower = ctx.createRadialGradient(
    cx - halfW * 0.28,
    cy + halfH * 0.28,
    2,
    cx,
    cy + halfH * 0.42,
    halfW * 0.5,
  );
  lower.addColorStop(0, dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.4)');
  lower.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lower;
  ctx.beginPath();
  ctx.ellipse(cx - halfW * 0.08, cy + halfH * 0.38, halfW * 0.38, halfH * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
