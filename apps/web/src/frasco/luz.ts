import { JAR_FOOT_X, JAR_FOOT_Y } from './jarTabla';
import { presenciaVertical } from './alpha';
import type { Caja } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';

/** Sombra de contacto centrada en el pie. No gira con el arrastre: solo se apaga. */
export function dibujarSombra(ctx: CanvasRenderingContext2D, frasco: Caja, luz: Luz, angulo: number): void {
  const cantidad = presenciaVertical(angulo);
  if (cantidad < 0.02) return;
  const cx = frasco.x + frasco.w * JAR_FOOT_X;
  const cy = frasco.y + frasco.h * JAR_FOOT_Y - frasco.h * 0.004;
  const rad = (luz.sombra.inclinacion * Math.PI) / 180;
  const dx = Math.sin(rad) * frasco.w * 0.22;
  ctx.save();
  ctx.fillStyle = luz.sombra.color;
  ctx.globalAlpha = luz.sombra.opacidad * 0.55 * cantidad;
  ctx.filter = `blur(${luz.sombra.desenfoque}px)`;
  ctx.beginPath();
  ctx.ellipse(cx + dx, cy + frasco.w * 0.02, frasco.w * 0.46, frasco.w * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'blur(3px)';
  ctx.globalAlpha = Math.min(0.9, luz.sombra.opacidad * 1.35) * cantidad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, frasco.w * 0.2, Math.max(2.5, frasco.w * 0.028), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
