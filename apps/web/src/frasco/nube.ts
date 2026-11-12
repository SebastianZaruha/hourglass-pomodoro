import type { Caja } from '../layout/calcularLayout';
import type { NubeLuz } from '../temas/tipos';
import { alphaFromBlack, presenciaVertical } from './alpha';

let clave: HTMLCanvasElement | null = null;
let claveCtx: CanvasRenderingContext2D | null = null;
let ultimoTiempo = -1;
/** Se mide una sola vez. Si cambia cada fotograma, la nube vibra. */
let asiento: number | null = null;

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
  if (!listo) {
    if (poster && asiento === null) medirLienzo(poster);
    return clave.width > 0 && ultimoTiempo >= 0 ? clave : poster;
  }
  if (Math.abs(video.currentTime - ultimoTiempo) < 0.03 && ultimoTiempo >= 0) return clave;
  ultimoTiempo = video.currentTime;
  ctx.drawImage(video, 0, 0, clave.width, clave.height);
  const datos = ctx.getImageData(0, 0, clave.width, clave.height);
  alphaFromBlack(datos.data);
  ctx.putImageData(datos, 0, 0);
  if (asiento === null) asiento = medirAsiento(datos.data, clave.width, clave.height);
  return clave;
}

function medirLienzo(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width < 2) return;
  const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
  asiento = medirAsiento(datos.data, canvas.width, canvas.height);
}

function medirAsiento(data: Uint8ClampedArray, width: number, height: number): number {
  const paso = 4;
  for (let y = height - 1; y >= 0; y--) {
    let opacos = 0;
    const fila = y * width * 4;
    for (let x = 0; x < width; x += paso) {
      if ((data[fila + x * 4 + 3] ?? 0) > 32) opacos++;
    }
    if (opacos > width / (paso * 18)) return (y + 1) / height;
  }
  return 1;
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
  // El asiento es fijo: la caja ya viene del layout y no se recalcula aquí.
  const bajar = Math.round(caja.h * (1 - (asiento ?? 0.86)) + caja.h * 0.11);
  const atras = {
    x: caja.x + caja.w * 0.08,
    y: caja.y + caja.h * 0.12 + bajar,
    w: caja.w * 0.84,
    h: caja.h * 0.84,
  };
  ctx.save();
  ctx.filter = `brightness(${luz.brillo}) saturate(${luz.saturacion})`;
  ctx.globalAlpha = alpha * 0.38;
  ctx.drawImage(fuente, atras.x, atras.y, atras.w, atras.h);
  ctx.globalAlpha = alpha;
  ctx.drawImage(fuente, caja.x, caja.y + bajar, caja.w, caja.h);
  ctx.restore();
}
