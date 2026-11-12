import type { Caja } from '../layout/calcularLayout';
import type { NubeLuz } from '../temas/tipos';
import { alphaFromBlack, presenciaVertical } from './alpha';

let clave: HTMLCanvasElement | null = null;
let claveCtx: CanvasRenderingContext2D | null = null;
let ultimoTiempo = -1;

function lienzo(): CanvasRenderingContext2D | null {
  if (!clave) {
    clave = document.createElement('canvas');
    clave.width = 480;
    clave.height = 192;
    claveCtx = clave.getContext('2d', { willReadFrequently: true });
  }
  return claveCtx;
}

/** Vídeo sobre negro → alfa. Si el fotograma no está listo, se queda el anterior. */
export function actualizarNube(
  video: HTMLVideoElement | null,
  poster: HTMLCanvasElement | null,
): CanvasImageSource | null {
  const ctx = lienzo();
  if (!ctx || !clave) return poster;
  const listo = video && video.readyState >= 2 && video.videoWidth > 0;
  if (!listo) return clave.width > 0 && ultimoTiempo >= 0 ? clave : poster;
  if (Math.abs(video.currentTime - ultimoTiempo) < 0.03 && ultimoTiempo >= 0) return clave;
  ultimoTiempo = video.currentTime;
  ctx.drawImage(video, 0, 0, clave.width, clave.height);
  const datos = ctx.getImageData(0, 0, clave.width, clave.height);
  alphaFromBlack(datos.data);
  ctx.putImageData(datos, 0, 0);
  return clave;
}

export function dibujarNube(
  ctx: CanvasRenderingContext2D,
  caja: Caja,
  fuente: CanvasImageSource | null,
  angulo: number,
  luz: NubeLuz,
): void {
  if (!fuente) return;
  const alpha = presenciaVertical(angulo);
  if (alpha < 0.02) return;
  const atras = { x: caja.x + caja.w * 0.08, y: caja.y + caja.h * 0.12, w: caja.w * 0.84, h: caja.h * 0.84 };
  ctx.save();
  ctx.filter = `brightness(${luz.brillo}) saturate(${luz.saturacion})`;
  ctx.globalAlpha = alpha * 0.38;
  ctx.drawImage(fuente, atras.x, atras.y, atras.w, atras.h);
  ctx.globalAlpha = alpha;
  ctx.drawImage(fuente, caja.x, caja.y, caja.w, caja.h);
  ctx.restore();
}
