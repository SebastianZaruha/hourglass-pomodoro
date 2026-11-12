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
  const escala = Math.max(ancho / iw, alto / ih);
  const w = iw * escala;
  const h = ih * escala;
  let x = pie.x - ancla.x * w;
  let y = pie.y - ancla.y * h;
  if (x > 0) x = 0;
  if (y > 0) y = 0;
  if (x + w < ancho) x = ancho - w;
  if (y + h < alto) y = alto - h;
  return { x, y, w, h };
}
