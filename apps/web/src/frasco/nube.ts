import { alphaFromBlack } from './alpha';

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

/** 1 de pie, 0 a los 50°. La nube no se levanta: solo se apaga. */
export function opacidadNube(angulo: number): number {
  const t = Math.abs(angulo) / ((50 * Math.PI) / 180);
  return Math.max(0, Math.min(1, 1 - t));
}

/** Durante la media vuelta la nube sigue entera. Fuera de ella vale el ángulo. */
export function opacidadNubeEnVuelta(angulo: number, reinicio: boolean): number {
  if (reinicio) return 1;
  return opacidadNube(angulo);
}

const FUNDIDO_BUCLE_S = 2;

/** Cruce de los dos vídeos. `queda` es lo que le falta al que se está viendo. */
export function fundidoBucle(queda: number, fundido = FUNDIDO_BUCLE_S): { activo: number; reserva: number } {
  if (!(fundido > 0) || !(queda < fundido)) return { activo: 1, reserva: 0 };
  const k = Math.max(0, queda / fundido);
  return { activo: k, reserva: 1 - k };
}

export interface BucleNube {
  empezar(): void;
  parar(): void;
  destruir(): void;
}

/**
 * Dos vídeos del mismo plano. El cruce va en `timeupdate`, no en el fotograma
 * del frasco: en reposo ese bucle duerme.
 */
export function crearBucleNube(a: HTMLVideoElement, b: HTMLVideoElement): BucleNube {
  let principal = a;
  let apoyo = b;
  let encendido = false;
  const aplicar = () => {
    if (!encendido || !Number.isFinite(principal.duration)) return;
    const queda = principal.duration - principal.currentTime;
    const fundido = fundidoBucle(queda);
    if (fundido.reserva > 0 && apoyo.paused) {
      try {
        apoyo.currentTime = 0;
      } catch {
        /* el plano aún no tiene duración */
      }
      void apoyo.play().catch(() => undefined);
    }
    principal.style.opacity = fundido.activo.toFixed(3);
    apoyo.style.opacity = fundido.reserva.toFixed(3);
    if (principal.ended || queda < 0.05) {
      principal.pause();
      try {
        principal.currentTime = 0;
      } catch {
        /* igual que arriba */
      }
      principal.style.opacity = '0';
      const saliente = principal;
      principal = apoyo;
      apoyo = saliente;
      principal.style.opacity = '1';
      if (principal.paused) void principal.play().catch(() => undefined);
    }
  };
  a.addEventListener('timeupdate', aplicar);
  b.addEventListener('timeupdate', aplicar);
  a.addEventListener('ended', aplicar);
  b.addEventListener('ended', aplicar);
  return {
    empezar() {
      encendido = true;
      if (principal.paused) void principal.play().catch(() => undefined);
    },
    parar() {
      encendido = false;
      a.pause();
      b.pause();
    },
    destruir() {
      encendido = false;
      a.removeEventListener('timeupdate', aplicar);
      b.removeEventListener('timeupdate', aplicar);
      a.removeEventListener('ended', aplicar);
      b.removeEventListener('ended', aplicar);
      a.pause();
      b.pause();
    },
  };
}

