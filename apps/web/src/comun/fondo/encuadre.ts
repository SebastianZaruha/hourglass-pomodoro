export interface Caja {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Ancla {
  readonly x: number;
  readonly y: number;
  /** Zoom máximo respecto a cover. Sin él, se acerca lo que haga falta para apoyar. */
  readonly tope?: number;
  /** Cover exacto y centrado. No se amplía para apoyar el pie. */
  readonly cover?: boolean;
}

/**
 * Cover que apoya el `ancla` de la foto en el pie del frasco.
 * Así los dos modos de un tema comparten el punto de contacto.
 * Es el encuadre de v2, tal cual.
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
  if (ancla.cover) {
    const w = iw * cubrir;
    const h = ih * cubrir;
    return { x: (ancho - w) / 2, y: (alto - h) / 2, w, h };
  }
  // Cover a veces no deja margen vertical: el pie quedaría en el aire.
  // Se acerca lo justo para poder apoyar el ancla en el pie y seguir tapando la vista.
  // Con tope, no se pasa de ese múltiplo de cover: lo que falte se resuelve desplazando.
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
