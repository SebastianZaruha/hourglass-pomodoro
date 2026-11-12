import { JAR_FOOT_X, JAR_FOOT_Y } from './jarTabla';
import { presenciaVertical } from './alpha';
import type { Caja } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';

/** Sombra de contacto centrada en el pie. No gira con el arrastre: solo se apaga. */
export function dibujarSombra(
  ctx: CanvasRenderingContext2D,
  frasco: Caja,
  luz: Luz,
  angulo: number,
  imagen: CanvasImageSource | null,
): void {
  const cantidad = presenciaVertical(angulo);
  if (cantidad < 0.02) return;
  const cx = frasco.x + frasco.w * JAR_FOOT_X;
  const cy = frasco.y + frasco.h * JAR_FOOT_Y;
  const rad = (luz.sombra.inclinacion * Math.PI) / 180;
  const dx = Math.sin(rad) * frasco.w * 0.18;
  ctx.save();
  ctx.globalAlpha = luz.sombra.opacidad * cantidad;
  ctx.filter = `blur(${luz.sombra.desenfoque}px)`;
  ctx.fillStyle = luz.sombra.color;
  ctx.beginPath();
  ctx.ellipse(cx + dx, cy, frasco.w * 0.42, frasco.w * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'blur(5px)';
  ctx.globalAlpha = Math.min(1, luz.sombra.opacidad * 1.15) * cantidad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + frasco.w * 0.012, frasco.w * 0.22, frasco.w * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  if (imagen) {
    ctx.filter = 'none';
    ctx.globalAlpha = 0.85 * cantidad;
    const sw = frasco.w * 0.9;
    const sh = sw * 0.28;
    ctx.drawImage(imagen, cx - sw / 2, cy - sh * 0.35, sw, sh);
  }
  ctx.restore();
}
