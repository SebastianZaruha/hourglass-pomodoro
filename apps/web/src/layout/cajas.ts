import { JAR_ASPECT, JAR_FOOT_Y } from '../frasco/geometria';
import { NUBE_ANCHO, NUBE_RELACION } from './medidas';

export interface Caja {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function caja(x: number, y: number, w: number, h: number): Caja {
  return { x, y, w, h };
}

export function seSolapan(a: Caja, b: Caja): boolean {
  return a.x + a.w > b.x + 1 && b.x + b.w > a.x + 1 && a.y + a.h > b.y + 1 && b.y + b.h > a.y + 1;
}

/** La base del frasco cae en `pieY`. Si el ancho no cabe, baja el alto. */
export function frascoEn(pieX: number, pieY: number, altoMax: number, anchoMax: number): Caja {
  let alto = altoMax;
  let ancho = alto * JAR_ASPECT;
  if (ancho > anchoMax) {
    ancho = anchoMax;
    alto = ancho / JAR_ASPECT;
  }
  return caja(pieX - ancho * 0.5, pieY - alto * JAR_FOOT_Y, ancho, alto);
}

/** El borde de arriba del frasco queda en `y`. */
export function frascoDesdeArriba(centroX: number, y: number, alto: number, anchoMax: number): Caja {
  let h = Math.max(0, alto);
  let w = h * JAR_ASPECT;
  if (w > anchoMax) {
    w = anchoMax;
    h = w / JAR_ASPECT;
  }
  return caja(centroX - w / 2, y, w, h);
}

/** Cubre el borde de arriba del frasco y no pasa de 1,3 veces su ancho. */
export function cajaNube(frasco: Caja): Caja {
  const ancho = frasco.w * NUBE_ANCHO;
  const alto = ancho * NUBE_RELACION;
  const y = frasco.y - alto * 0.28;
  return caja(frasco.x + frasco.w / 2 - ancho / 2, y, ancho, alto);
}
