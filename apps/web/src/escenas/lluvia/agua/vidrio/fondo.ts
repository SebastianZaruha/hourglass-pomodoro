// Copias pequeñas del fondo. Son el truco del desenfoque "gratis":
// una imagen a 1/4 de tamaño, estirada otra vez a tamaño real, ya se ve borrosa.
import type { FuenteFondo } from './tipos';

/** Dónde está la foto en el mismo espacio que `redimensionar` (px de pantalla). */
export interface EncajeFondo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CopiasFondo {
  /** Fondo a 1/reduccion del canvas, tal como se ve en pantalla. */
  bajo: HTMLCanvasElement;
  /** Otra 4 veces más pequeña: la que usamos para el desenfoque extra de la media vuelta. */
  muyBajo: HTMLCanvasElement;
  /** Cuántos px del mundo mide un px de `bajo` / de `muyBajo`. */
  escalaBajo: number;
  escalaMuyBajo: number;
  /** Máximo de copias por segundo de un fondo de vídeo. */
  fpsVideo: number;
  /** Si está, la copia se dibuja ahí. Si no, cover centrado. */
  encaje: EncajeFondo | null;
  listo: boolean;
}

export function crearCopiasFondo(reduccion: number, fpsVideo: number): CopiasFondo {
  return {
    bajo: document.createElement('canvas'),
    muyBajo: document.createElement('canvas'),
    escalaBajo: reduccion,
    escalaMuyBajo: reduccion * 4,
    fpsVideo,
    encaje: null,
    listo: false,
  };
}

/** La refracción tiene que coincidir con la foto que se ve, no con un cover centrado. */
function colocarEncaje(c: CopiasFondo, encaje: EncajeFondo): void {
  const prev = c.encaje;
  if (
    prev &&
    Math.abs(prev.x - encaje.x) < 0.5 &&
    Math.abs(prev.y - encaje.y) < 0.5 &&
    Math.abs(prev.w - encaje.w) < 0.5 &&
    Math.abs(prev.h - encaje.h) < 0.5
  ) {
    return;
  }
  c.encaje = { x: encaje.x, y: encaje.y, w: encaje.w, h: encaje.h };
  c.listo = false;
}

export function redimensionarCopias(c: CopiasFondo, ancho: number, alto: number): void {
  c.bajo.width = Math.max(1, Math.ceil(ancho / c.escalaBajo));
  c.bajo.height = Math.max(1, Math.ceil(alto / c.escalaBajo));
  c.muyBajo.width = Math.max(1, Math.ceil(ancho / c.escalaMuyBajo));
  c.muyBajo.height = Math.max(1, Math.ceil(alto / c.escalaMuyBajo));
  c.listo = false;
}

/** ¿Soporta este navegador ctx.filter? (Safari 16-17 no). Solo lo usamos una vez por foto, nunca por frame. */
function soportaFiltro(ctx: CanvasRenderingContext2D): boolean {
  ctx.filter = 'blur(1px)';
  const si = ctx.filter === 'blur(1px)';
  ctx.filter = 'none';
  return si;
}

/**
 * Dibuja el fondo donde está en pantalla.
 * `pxPorMundo` es cuántos px de este lienzo caben en un px del mundo.
 */
function dibujarFondo(
  ctx: CanvasRenderingContext2D,
  fuente: FuenteFondo,
  c: CopiasFondo,
  pxPorMundo: number,
): void {
  const ancho = ctx.canvas.width;
  const alto = ctx.canvas.height;
  ctx.clearRect(0, 0, ancho, alto);
  const encaje = c.encaje;
  if (!encaje) {
    const fw = fuente instanceof HTMLVideoElement ? fuente.videoWidth : fuente.naturalWidth;
    const fh = fuente instanceof HTMLVideoElement ? fuente.videoHeight : fuente.naturalHeight;
    if (fw < 1 || fh < 1) return;
    const s = Math.max(ancho / fw, alto / fh);
    const w = fw * s;
    const h = fh * s;
    ctx.drawImage(fuente, (ancho - w) / 2, (alto - h) / 2, w, h);
    return;
  }
  ctx.drawImage(
    fuente,
    encaje.x * pxPorMundo,
    encaje.y * pxPorMundo,
    encaje.w * pxPorMundo,
    encaje.h * pxPorMundo,
  );
}

/** Copia de `bajo` a `muyBajo` (diminuta, barata). */
function rehacerMuyBajo(c: CopiasFondo): void {
  const ctx = c.muyBajo.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c.bajo, 0, 0, c.muyBajo.width, c.muyBajo.height);
}

export function sincronizarEncaje(c: CopiasFondo, fuente: FuenteFondo): void {
  const r = fuente.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  colocarEncaje(c, { x: r.left, y: r.top, w: r.width, h: r.height });
}

/** Foto: se prepara UNA vez (al cargar o al redimensionar). Aquí sí podemos permitirnos un filtro. */
export function prepararFoto(c: CopiasFondo, foto: HTMLImageElement): void {
  if (!foto.complete || foto.naturalWidth === 0) return;
  const { width: w, height: h } = c.bajo;
  // Paso intermedio a 2× para que la reducción no "salte" píxeles (eso daría brillos que parpadean).
  const medio = document.createElement('canvas');
  medio.width = w * 2; medio.height = h * 2;
  const cm = medio.getContext('2d')!;
  cm.imageSmoothingQuality = 'high';
  dibujarFondo(cm, foto, c, 2 / c.escalaBajo);

  const ctx = c.bajo.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);
  if (soportaFiltro(ctx)) ctx.filter = 'blur(1px)'; // 1 px aquí = unos 4 px en pantalla
  ctx.drawImage(medio, 0, 0, w, h);
  ctx.filter = 'none';
  rehacerMuyBajo(c);
  c.listo = true;
}

/**
 * Vídeo: copia el frame actual a 1/4. Se salta el trabajo si el vídeo no ha avanzado
 * (un vídeo de 30 fps solo cambia uno de cada dos frames a 60 Hz).
 * Devuelve el currentTime copiado para que el llamador lo recuerde.
 */
export function copiarFrameVideo(c: CopiasFondo, video: HTMLVideoElement, ultimoTiempo: number): number {
  sincronizarEncaje(c, video);
  if (video.readyState < 2 || video.videoWidth === 0) return ultimoTiempo;
  if (c.listo && video.currentTime === ultimoTiempo) return ultimoTiempo;
  // El vídeo se ve muy borroso a través del agua: no hace falta copiarlo más de `fpsVideo` veces por segundo.
  if (c.listo && Math.abs(video.currentTime - ultimoTiempo) < 1 / c.fpsVideo) return ultimoTiempo;
  const ctx = c.bajo.getContext('2d')!;
  ctx.imageSmoothingQuality = 'medium';
  dibujarFondo(ctx, video, c, 1 / c.escalaBajo);
  rehacerMuyBajo(c);
  c.listo = true;
  return video.currentTime;
}
