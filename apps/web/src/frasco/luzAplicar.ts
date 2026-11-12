import type { Caja } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';
import { vectorLuz } from './alpha';

let placa: HTMLCanvasElement | null = null;
let placaCtx: CanvasRenderingContext2D | null = null;

function hoja(w: number, h: number): CanvasRenderingContext2D | null {
  const width = Math.max(2, Math.round(w));
  const height = Math.max(2, Math.round(h));
  if (!placa || placa.width !== width || placa.height !== height) {
    placa = document.createElement('canvas');
    placa.width = width;
    placa.height = height;
    placaCtx = placa.getContext('2d');
  }
  if (!placaCtx || !placa) return null;
  placaCtx.setTransform(1, 0, 0, 1, 0, 0);
  placaCtx.globalAlpha = 1;
  placaCtx.globalCompositeOperation = 'source-over';
  placaCtx.clearRect(0, 0, width, height);
  return placaCtx;
}

/**
 * Un solo sitio aplica el tinte, el brillo y el reflejo del borde.
 * El tema ya viene resuelto: aquí no hay ramas por nombre de escena.
 * El lavado se recorta en una hoja aparte: si no, destination-in
 * borraría el resto del fotograma.
 */
export function aplicarLuz(
  ctx: CanvasRenderingContext2D,
  frasco: Caja,
  luz: Luz,
  frente: CanvasImageSource | null,
  dorso: CanvasImageSource | null,
): void {
  const { x, y, w, h } = frasco;
  const dir = vectorLuz(luz.direccion);
  const g = hoja(w, h);
  if (g && placa) {
    const grad = g.createLinearGradient(
      w / 2 + dir.x * w * 0.45,
      h / 2 + dir.y * h * 0.45,
      w / 2 - dir.x * w * 0.45,
      h / 2 - dir.y * h * 0.45,
    );
    grad.addColorStop(0, luz.tinte);
    grad.addColorStop(0.55, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    if (luz.brilloBorde > 0.02) {
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = luz.brilloBorde;
      const hx = w / 2 + dir.x * w * 0.22;
      const hy = h * 0.2;
      const brillo = g.createRadialGradient(hx, hy, 2, hx, hy, w * 0.38);
      brillo.addColorStop(0, 'rgba(255, 236, 210, 0.95)');
      brillo.addColorStop(1, 'rgba(255, 236, 210, 0)');
      g.fillStyle = brillo;
      g.fillRect(0, 0, w, h);
    }
    if (dorso) {
      g.globalCompositeOperation = 'destination-in';
      g.globalAlpha = 1;
      g.drawImage(dorso, 0, 0, w, h);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(1, luz.fuerzaTinte * luz.brillo);
    ctx.drawImage(placa, x, y, w, h);
    ctx.restore();
  }

  if (frente) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, luz.reflejos * Math.min(1.1, luz.brillo));
    ctx.drawImage(frente, x, y, w, h);
    ctx.restore();
  }
}
