import { JAR_FOOT_X, JAR_FOOT_Y } from './geometria';
import { presenciaVertical } from './alpha';
import type { Caja } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';

/** Sombra de contacto centrada en el pie. No gira con el arrastre: solo se apaga. */
export function dibujarSombra(ctx: CanvasRenderingContext2D, frasco: Caja, luz: Luz, angulo: number): void {
  const cantidad = presenciaVertical(angulo);
  if (cantidad < 0.02) return;
  const cx = frasco.x + frasco.w * JAR_FOOT_X;
  const cy = frasco.y + frasco.h * JAR_FOOT_Y;
  const blur = Math.max(36, luz.sombra.desenfoque * 2);
  ctx.save();
  ctx.fillStyle = luz.sombra.color;
  ctx.globalAlpha = Math.min(0.28, luz.sombra.opacidad * 0.4) * cantidad;
  ctx.filter = `blur(${blur}px)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, frasco.w * 0.42, frasco.w * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
