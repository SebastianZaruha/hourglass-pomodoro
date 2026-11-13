import type { GlassLayout, Scheme } from './pintarVidrio';

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 1 con el reloj de pie, 0 de canto. Smoothstep para que la sombra
 * salga y vuelva con el giro, sin un corte al empezar o al acabar.
 */
export function cantidadSombra(rotation: number): number {
  const upright = Math.min(1, Math.abs(Math.cos(rotation)));
  return upright * upright * (3 - 2 * upright);
}

const LEJOS: Record<Scheme, string> = {
  light: 'rgba(84, 64, 44, 0.28)',
  dark: 'rgba(0, 0, 0, 0.38)',
};
const CERCA: Record<Scheme, string> = {
  light: 'rgba(70, 52, 36, 0.55)',
  dark: 'rgba(0, 0, 0, 0.62)',
};
const BRILLO: Record<Scheme, string> = {
  light: 'rgba(255, 246, 228, 0.38)',
  dark: 'rgba(255, 220, 170, 0.12)',
};

/** Sombra quieta en el suelo. Se apaga mientras el vidrio gira y vuelve al reposo. */
export function pintarSombra(
  ctx: CanvasRenderingContext2D,
  layout: GlassLayout,
  scheme: Scheme,
  amount: number,
  poseScale: number,
) {
  const { cx, cy } = layout;
  if (poseScale !== 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(poseScale, poseScale);
    ctx.translate(-cx, -cy);
  }
  if (amount >= 0.004) {
    const { halfW, halfH } = layout;
    const baseY = cy + halfH * 0.985;
    const shift = halfW * 0.16;
    ctx.save();
    ctx.globalAlpha = amount;
    ctx.filter = 'blur(22px)';
    ctx.fillStyle = LEJOS[scheme];
    oval(ctx, cx + shift, baseY, halfW * 0.92, halfW * 0.15);
    ctx.filter = 'blur(5px)';
    ctx.fillStyle = CERCA[scheme];
    oval(ctx, cx + shift * 0.25, baseY + halfW * 0.01, halfW * 0.34, halfW * 0.04);
    ctx.filter = 'blur(9px)';
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = BRILLO[scheme];
    oval(ctx, cx + halfW * 0.38, baseY, halfW * 0.3, halfW * 0.055);
    ctx.restore();
  }
  if (poseScale !== 1) ctx.restore();
}
