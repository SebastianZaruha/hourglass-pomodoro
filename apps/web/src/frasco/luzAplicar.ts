import { PINTURA } from '../estilo/tokens';
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
 * Tinte, brillo de borde y reflejos salen solo de `luz`.
 * El lavado se recorta al vidrio en una hoja: destination-in
 * en el lienzo principal borraría el resto del fotograma.
 */
function girar(g: CanvasRenderingContext2D, w: number, h: number, angulo: number, pintar: () => void): void {
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(angulo);
  g.translate(-w / 2, -h / 2);
  pintar();
  g.restore();
}

export function aplicarLuz(
  ctx: CanvasRenderingContext2D,
  frasco: Caja,
  luz: Luz,
  angulo: number,
  frente: CanvasImageSource | null,
  dorso: CanvasImageSource | null,
): void {
  const { x, y, w, h } = frasco;
  const dir = vectorLuz(luz.direccion);
  const g = hoja(w, h);
  if (g && placa && dorso) {
    const grad = g.createLinearGradient(
      w / 2 + dir.x * w * 0.62,
      h / 2 + dir.y * h * 0.55,
      w / 2 - dir.x * w * 0.62,
      h / 2 - dir.y * h * 0.55,
    );
    grad.addColorStop(0, PINTURA.luzMedia);
    grad.addColorStop(1, PINTURA.lavadoFin);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    const hx = w / 2 + dir.x * w * 0.34;
    const hy = h / 2 + dir.y * h * 0.3;
    const radio = w * (0.2 + luz.brilloBorde * 0.22);
    const foco = g.createRadialGradient(hx, hy, 2, hx, hy, radio);
    foco.addColorStop(0, PINTURA.focoMedio);
    foco.addColorStop(1, PINTURA.focoFin);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = Math.min(0.35, 0.08 + luz.brilloBorde * 0.15);
    g.fillStyle = foco;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'destination-in';
    g.globalAlpha = 1;
    girar(g, w, h, angulo, () => g.drawImage(dorso, 0, 0, w, h));

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.15;
    ctx.drawImage(placa, x, y, w, h);
    ctx.restore();
  }

  if (frente && placa) {
    const g2 = hoja(w, h);
    if (!g2) return;
    girar(g2, w, h, angulo, () => g2.drawImage(frente, 0, 0, w, h));
    g2.globalCompositeOperation = 'source-atop';
    g2.globalAlpha = Math.min(0.25, luz.reflejos * 0.2);
    g2.fillStyle = PINTURA.luzMedia;
    g2.fillRect(0, 0, w, h);
    const mascara = g2.createLinearGradient(
      w / 2 + dir.x * w * 0.55,
      h / 2 + dir.y * h * 0.5,
      w / 2 - dir.x * w * 0.4,
      h / 2 - dir.y * h * 0.35,
    );
    mascara.addColorStop(0, PINTURA.mascara0);
    mascara.addColorStop(0.5, PINTURA.mascaraMedia);
    mascara.addColorStop(1, PINTURA.mascaraFin);
    g2.globalCompositeOperation = 'destination-in';
    g2.globalAlpha = 1;
    g2.fillStyle = mascara;
    g2.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, luz.reflejos * Math.max(0.35, luz.brillo));
    ctx.drawImage(placa, x, y, w, h);
    ctx.restore();
  }
}
