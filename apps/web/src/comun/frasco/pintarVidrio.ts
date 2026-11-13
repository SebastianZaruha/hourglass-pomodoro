/**
 * Vidrio dibujado de la web publicada (no los shaders del móvil).
 * La arena la pinta el contenido, dentro del recorte interior.
 */
import { CLASSIC_MODEL, outlinePoints, radiusAt, type HourglassProfile } from '@reloj/core';

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

/** Encoge el vidrio lo justo para que, de canto, siga cabiendo en el lienzo. */
export function escalaDeIntro(
  base: number,
  layout: { halfW: number; halfH: number },
  angle: number,
  cssW: number,
  cssH: number,
): number {
  const across = Math.abs(Math.sin(angle));
  const along = Math.abs(Math.cos(angle));
  const span = (layout.halfH * 2 * across + layout.halfW * 2 * along) * base;
  const room = Math.min(cssW, cssH) * 0.92;
  if (span <= room || span < 1) return base;
  return (base * room) / span;
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

const RELLENO: Record<Scheme, readonly (readonly [number, string])[]> = {
  light: [
    [0, 'rgba(255, 255, 255, 0.22)'],
    [0.4, 'rgba(255, 252, 247, 0.04)'],
    [1, 'rgba(120, 96, 72, 0.06)'],
  ],
  dark: [
    [0, 'rgba(255, 236, 214, 0.07)'],
    [0.42, 'rgba(255, 236, 214, 0.015)'],
    [1, 'rgba(0, 0, 0, 0.12)'],
  ],
};

const CANTO: Record<Scheme, string> = {
  light: 'rgba(92, 78, 64, 0.14)',
  dark: 'rgba(0, 0, 0, 0.28)',
};
const FILO_INTERIOR: Record<Scheme, string> = {
  light: 'rgba(255, 252, 246, 0.72)',
  dark: 'rgba(255, 238, 214, 0.28)',
};
const CONTORNO: Record<Scheme, string> = {
  light: 'rgba(92, 78, 64, 0.42)',
  dark: 'rgba(0, 0, 0, 0.55)',
};
const FILO_LUZ: Record<Scheme, string> = {
  light: 'rgba(255, 255, 255, 0.88)',
  dark: 'rgba(255, 238, 214, 0.42)',
};
const BRILLO_0: Record<Scheme, string> = {
  light: 'rgba(255,255,255,0.85)',
  dark: 'rgba(255,255,255,0.34)',
};
const BRILLO_1: Record<Scheme, string> = {
  light: 'rgba(255,255,255,0.18)',
  dark: 'rgba(255,255,255,0.08)',
};
const BRILLO_BAJO: Record<Scheme, string> = {
  light: 'rgba(255,255,255,0.45)',
  dark: 'rgba(255,255,255,0.16)',
};

export interface VidrioDibujado {
  readonly profile: HourglassProfile;
  readonly layout: GlassLayout;
  readonly scheme: Scheme;
  readonly rotation: number;
  readonly poseScale: number;
}

/** Vidrio girado. `pintarContenido` va en el hueco, ya recortado, como la arena publicada. */
export function pintarVidrio(
  ctx: CanvasRenderingContext2D,
  scene: VidrioDibujado,
  pintarContenido: (ctx: CanvasRenderingContext2D) => void,
): void {
  const { layout, scheme, profile } = scene;
  const { cx, cy, halfW, halfH } = layout;
  const poseScale = scene.poseScale;

  ctx.save();
  ctx.translate(cx, cy);
  if (poseScale !== 1) ctx.scale(poseScale, poseScale);
  ctx.rotate(scene.rotation);
  ctx.translate(-cx, -cy);

  trace(ctx, profile, layout, false);
  ctx.save();
  ctx.clip();
  const glass = ctx.createLinearGradient(cx - halfW, cy - halfH, cx + halfW * 0.2, cy + halfH);
  for (const stop of RELLENO[scheme]) glass.addColorStop(stop[0], stop[1]);
  ctx.fillStyle = glass;
  ctx.fillRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);

  ctx.save();
  ctx.lineWidth = Math.max(7, halfW * 0.07);
  ctx.strokeStyle = CANTO[scheme];
  trace(ctx, profile, layout, false);
  ctx.stroke();
  ctx.restore();

  trace(ctx, profile, layout, true);
  ctx.save();
  ctx.clip();
  pintarContenido(ctx);
  ctx.restore();

  ctx.lineWidth = Math.max(1, halfW * 0.012);
  ctx.strokeStyle = FILO_INTERIOR[scheme];
  trace(ctx, profile, layout, true);
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = Math.max(1.15, halfW * 0.014);
  ctx.strokeStyle = CONTORNO[scheme];
  trace(ctx, profile, layout, false);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, halfW * 0.007);
  ctx.strokeStyle = FILO_LUZ[scheme];
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
  shine.addColorStop(0, BRILLO_0[scheme]);
  shine.addColorStop(0.35, BRILLO_1[scheme]);
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
  lower.addColorStop(0, BRILLO_BAJO[scheme]);
  lower.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lower;
  ctx.beginPath();
  ctx.ellipse(cx - halfW * 0.22, cy + halfH * 0.32, halfW * 0.24, halfH * 0.12, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
