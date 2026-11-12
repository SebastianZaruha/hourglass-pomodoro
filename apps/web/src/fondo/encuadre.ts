import type { Caja } from '../layout/calcularLayout';

export interface Ancla {
  readonly x: number;
  readonly y: number;
}

/**
 * Cover que apoya el `ancla` de la foto en el pie del frasco.
 * Así los dos modos de un tema comparten el punto de contacto.
 */
export function encuadreFondo(
  ancho: number,
  alto: number,
  imgW: number,
  imgH: number,
  ancla: Ancla,
  pie: { readonly x: number; readonly y: number },
): Caja {
  const iw = imgW > 0 ? imgW : 1;
  const ih = imgH > 0 ? imgH : 1;
  const ax = Math.min(0.94, Math.max(0.06, ancla.x));
  const ay = Math.min(0.94, Math.max(0.06, ancla.y));
  const cubrir = Math.max(ancho / iw, alto / ih);
  // Cover a veces no deja margen vertical: el pie quedaría en el aire.
  // Se acerca lo justo para poder apoyar el ancla en el pie y seguir tapando la vista.
  const paraY = Math.max(pie.y / (ay * ih), (alto - pie.y) / ((1 - ay) * ih));
  const paraX = Math.max(pie.x / (ax * iw), (ancho - pie.x) / ((1 - ax) * iw));
  const escala = Math.max(cubrir, paraX, paraY);
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
