/**
 * Dibujo del reloj en Canvas 2D.
 * El vidrio es propio de la web (no los shaders Skia del móvil). La arena
 * sale de la simulación del core: cada celda es un grano, y el chorro
 * son las partículas de `StreamParticles`.
 */
import {
  CLASSIC_MODEL,
  hash32,
  outlinePoints,
  radiusAt,
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

/**
 * Toda la silueta del vidrio, no solo el centro ni los flancos.
 * El punto está en píxeles CSS del lienzo.
 */
export function hitVessel(
  layout: GlassLayout,
  x: number,
  y: number,
  profile: HourglassProfile = CLASSIC_MODEL.profile,
): boolean {
  const nx = (x - layout.cx) / layout.halfW;
  const ny = (y - layout.cy) / layout.halfH;
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return false;
  if (Math.abs(ny) > 1.03) return false;
  return Math.abs(nx) <= radiusAt(profile, ny) + 0.035;
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
  const pts = outlinePoints(profile, 240, inner);
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
  /** Giro visual (cambio de fase + gesto + introducción). La arena va pegada al vidrio. */
  readonly rotation: number;
  /** Escala alrededor del centro. 1 en reposo. */
  readonly poseScale: number;
  /** 0 esconde la sombra del suelo (el vidrio está en el aire). 1 es la sombra normal. */
  readonly shadow: number;
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 1 con el reloj de pie, 0 de canto. Smoothstep para que la sombra
 * salga y vuelva con el giro, sin un corte al empezar o al acabar.
 */
function floorShadowAmount(rotation: number): number {
  const upright = Math.min(1, Math.abs(Math.cos(rotation)));
  return upright * upright * (3 - 2 * upright);
}

/** Sombra quieta en el suelo. Se apaga mientras el vidrio gira y vuelve al reposo. */
function drawTableShadow(ctx: CanvasRenderingContext2D, layout: GlassLayout, dark: boolean, amount: number) {
  if (amount < 0.004) return;
  const { cx, cy, halfW, halfH } = layout;
  const baseY = cy + halfH * 0.985;
  const shift = halfW * 0.16;
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.filter = 'blur(22px)';
  ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.38)' : 'rgba(84, 64, 44, 0.28)';
  oval(ctx, cx + shift, baseY, halfW * 0.92, halfW * 0.15);
  ctx.filter = 'blur(5px)';
  ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.62)' : 'rgba(70, 52, 36, 0.55)';
  oval(ctx, cx + shift * 0.25, baseY + halfW * 0.01, halfW * 0.34, halfW * 0.04);
  ctx.filter = 'blur(9px)';
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = dark ? 'rgba(255, 220, 170, 0.12)' : 'rgba(255, 246, 228, 0.38)';
  oval(ctx, cx + halfW * 0.38, baseY, halfW * 0.3, halfW * 0.055);
  ctx.restore();
}

export function drawHourglass(ctx: CanvasRenderingContext2D, scene: DrawScene): void {
  const { layout, scheme, profile } = scene;
  const { cx, cy, halfW, halfH } = layout;
  const dark = scheme === 'dark';
  const w = ctx.canvas.clientWidth;
  const h = ctx.canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const poseScale = scene.poseScale;
  const shadowAmount = floorShadowAmount(scene.rotation) * scene.shadow;
  if (poseScale !== 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(poseScale, poseScale);
    ctx.translate(-cx, -cy);
  }
  drawTableShadow(ctx, layout, dark, shadowAmount);
  if (poseScale !== 1) ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  if (poseScale !== 1) ctx.scale(poseScale, poseScale);
  ctx.rotate(scene.rotation);
  ctx.translate(-cx, -cy);

  trace(ctx, profile, layout, false);
  ctx.save();
  ctx.clip();
  const glass = ctx.createLinearGradient(cx - halfW, cy - halfH, cx + halfW * 0.2, cy + halfH);
  if (dark) {
    glass.addColorStop(0, 'rgba(255, 236, 214, 0.07)');
    glass.addColorStop(0.42, 'rgba(255, 236, 214, 0.015)');
    glass.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  } else {
    glass.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    glass.addColorStop(0.4, 'rgba(255, 252, 247, 0.04)');
    glass.addColorStop(1, 'rgba(120, 96, 72, 0.06)');
  }
  ctx.fillStyle = glass;
  ctx.fillRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);

  // Banda de absorción en el canto: el vidrio se ve más grueso ahí.
  ctx.save();
  ctx.lineWidth = Math.max(7, halfW * 0.07);
  ctx.strokeStyle = dark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(92, 78, 64, 0.14)';
  trace(ctx, profile, layout, false);
  ctx.stroke();
  ctx.restore();

  trace(ctx, profile, layout, true);
  ctx.save();
  ctx.clip();
  const left = cx - halfW;
  const top = cy - halfH;
  // Granos nítidos: la rejilla ya va a ~2 px, suavizarla la deja borrosa.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene.sand, left, top, halfW * 2, halfH * 2);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = dark ? 0.16 : 0.2;
  const pattern = ctx.createPattern(scene.noise, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(left, top, halfW * 2, halfH * 2);
  }
  ctx.restore();

  const cellW = (halfW * 2) / scene.sim.cols;
  const cellH = (halfH * 2) / scene.sim.rows;
  const count = scene.particles.count;
  ctx.imageSmoothingEnabled = true;
  for (let i = 0; i < count; i++) {
    const px = scene.particles.x[i] ?? 0;
    const py = scene.particles.y[i] ?? 0;
    const size = scene.particles.size[i] ?? 0.3;
    const tone = scene.particles.tone[i] ?? 1;
    const x = left + (px / scene.sim.cols) * halfW * 2;
    const y = top + (py / scene.sim.rows) * halfH * 2;
    const radius = Math.max(0.6, size * cellW * 1.15);
    const l = tone * 3;
    ctx.fillStyle = `rgb(${scene.lut[l] ?? 200}, ${scene.lut[l + 1] ?? 170}, ${scene.lut[l + 2] ?? 130})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, Math.max(radius, size * cellH * 0.9), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Canto interior, fino.
  ctx.lineWidth = Math.max(1, halfW * 0.012);
  ctx.strokeStyle = dark ? 'rgba(255, 238, 214, 0.28)' : 'rgba(255, 252, 246, 0.72)';
  trace(ctx, profile, layout, true);
  ctx.stroke();
  ctx.restore();

  // Contorno exterior: línea oscura y un filo de luz a la izquierda.
  ctx.lineWidth = Math.max(1.15, halfW * 0.014);
  ctx.strokeStyle = dark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(92, 78, 64, 0.42)';
  trace(ctx, profile, layout, false);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, halfW * 0.007);
  ctx.strokeStyle = dark ? 'rgba(255, 238, 214, 0.42)' : 'rgba(255, 255, 255, 0.88)';
  ctx.save();
  ctx.translate(-0.6, -0.4);
  trace(ctx, profile, layout, false);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  trace(ctx, profile, layout, false);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  const shine = ctx.createRadialGradient(
    cx - halfW * 0.42,
    cy - halfH * 0.62,
    halfW * 0.02,
    cx - halfW * 0.2,
    cy - halfH * 0.48,
    halfW * 0.48,
  );
  shine.addColorStop(0, dark ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.85)');
  shine.addColorStop(0.35, dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(cx - halfW * 0.28, cy - halfH * 0.55, halfW * 0.28, halfH * 0.16, -0.7, 0, Math.PI * 2);
  ctx.fill();
  const lower = ctx.createRadialGradient(
    cx - halfW * 0.36,
    cy + halfH * 0.22,
    1,
    cx - halfW * 0.1,
    cy + halfH * 0.4,
    halfW * 0.42,
  );
  lower.addColorStop(0, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.45)');
  lower.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lower;
  ctx.beginPath();
  ctx.ellipse(cx - halfW * 0.22, cy + halfH * 0.32, halfW * 0.24, halfH * 0.12, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
