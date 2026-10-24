/**
 * Canto de la hoja al píxel físico (1.8.7).
 *
 * El canto de la hoja (filo de luz de 1 px y recorte del vidrio) se dibuja en
 * Skia; si cae entre dos píxeles, el suavizado cambia de un fotograma a otro
 * al final de la subida, cuando la hoja avanza décimas de píxel por
 * fotograma, y el filo parpadea. Redondeado, se mueve de píxel en píxel (a
 * 2,6 píxeles por punto no se ven los saltos) y queda quieto y nítido arriba.
 *
 * (Hasta la 1.8.8 este archivo era `stillBackdrop.ts` y también decidía
 * cuándo hacer la foto fija del vidrio. Desde la 1.8.9 el vidrio no tiene
 * desenfoque ni foto: solo queda el redondeo.)
 */

/**
 * Redondea una coordenada (en puntos) al píxel físico más cercano.
 *
 * Worklet. OJO (1.8.5): sin valores por defecto en los parámetros.
 */
export function snapToPixel(value: number, density: number): number {
  'worklet';
  if (!Number.isFinite(value)) return value;
  if (!(density > 0) || !Number.isFinite(density)) return value;
  return Math.round(value * density) / density;
}
