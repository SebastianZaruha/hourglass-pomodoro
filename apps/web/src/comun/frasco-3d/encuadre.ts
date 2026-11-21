// Copia literal de las reglas de maquetación de Hourglass (feature/web-modular @ 3fa7dec):
//  - layoutFor      ← comun/frasco/pintarVidrio.ts
//  - cajaFoto       ← comun/frasco/pintarVidrio.ts
//  - encuadreFondo  ← comun/fondo/encuadre.ts (tal cual)
//  - filas BASE_*   ← comun/fondo/caja.ts
// Si cambian allí, cambian aquí. Todo en px CSS del lienzo.

export interface Caja { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface Ancla {
  readonly x: number;
  readonly y: number;
  /** Zoom máximo respecto a cover. Sin él, se acerca lo que haga falta para apoyar. */
  readonly tope?: number;
  /** Cover exacto y centrado. No se amplía para apoyar el pie. */
  readonly cover?: boolean;
}
export interface Punto { readonly x: number; readonly y: number }

export const FOTO_ANCHO = 446;
export const FOTO_ALTO = 1024;
export const CUELLO_FILA = 496.5;
export const RELLENO_ANCHO = 891 / 841;
export const ESCALA_FOTO = 0.99;
export const BASE_OPACA = 2013 / 2048;
export const BASE_BULBO = 1955 / 2048;
const ASPECTO = FOTO_ALTO / FOTO_ANCHO;

/** Caja de maquetación del frasco dentro de un lienzo de ancho×alto. */
export function layoutFor(width: number, height: number): Caja {
  const availW = width * 0.84;
  const availH = height * 0.86;
  let glassW = availW;
  let glassH = glassW * ASPECTO;
  if (glassH > availH) {
    glassH = availH;
    glassW = glassH / ASPECTO;
  }
  return { x: width / 2 - glassW / 2, y: height * 0.48 - glassH / 2, w: glassW, h: glassH };
}

/** La caja con la que se dibujan la foto del vidrio y el contenido (arena, agua). */
export function cajaFoto(caja: Caja): Caja {
  const cx = caja.x + caja.w / 2;
  const cy = caja.y + caja.h / 2;
  const w = caja.w * RELLENO_ANCHO * ESCALA_FOTO;
  const h = caja.h * ESCALA_FOTO;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Y de una fila de la foto (fracción 0..1), con la escala 0,99 de caja.ts. */
export function yEnFoto(caja: Caja, fila: number): number {
  const alto = caja.h * ESCALA_FOTO;
  return caja.y + (caja.h - alto) / 2 + alto * fila;
}

/** Cover que apoya el `ancla` de la foto en el pie del frasco. Es el encuadre de v2, tal cual. */
export function encuadreFondo(ancho: number, alto: number, imgW: number, imgH: number, ancla: Ancla, pie: Punto): Caja {
  const iw = imgW > 0 ? imgW : 1;
  const ih = imgH > 0 ? imgH : 1;
  const ax = Math.min(0.94, Math.max(0.06, ancla.x));
  const ay = Math.min(0.94, Math.max(0.06, ancla.y));
  const cubrir = Math.max(ancho / iw, alto / ih);
  if (ancla.cover) {
    const w = iw * cubrir;
    const h = ih * cubrir;
    return { x: (ancho - w) / 2, y: (alto - h) / 2, w, h };
  }
  const paraY = Math.max(pie.y / (ay * ih), (alto - pie.y) / ((1 - ay) * ih));
  const paraX = Math.max(pie.x / (ax * iw), (ancho - pie.x) / ((1 - ax) * iw));
  const necesaria = Math.max(cubrir, paraX, paraY);
  const tope = ancla.tope;
  const escala = tope && tope > 0 ? Math.min(necesaria, cubrir * tope) : necesaria;
  const w = iw * escala;
  const h = ih * escala;
  let x = pie.x - ax * w;
  let y = pie.y - ay * h;
  if (x > 0) x = 0;
  if (y > 0) y = 0;
  if (x + w < ancho) x = ancho - w;
  if (y + h < alto) y = alto - h;
  return { x, y, w, h };
}
