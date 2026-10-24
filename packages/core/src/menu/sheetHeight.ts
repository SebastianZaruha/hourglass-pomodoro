/**
 * Alto ESTABLE de la hoja de ajustes (1.8.8).
 *
 * La hoja mide su cabecera y su cuerpo (`onLayout`) y se pone ese alto. En
 * Android, Yoga redondea cada vista al píxel físico según dónde cae en la
 * pantalla, así que una misma vista puede medir un píxel más o menos según
 * la posición de su madre. Y la posición de la hoja depende de su alto: si
 * el alto medido cambia un pelo, la hoja se mueve, se vuelve a redondear, la
 * medida vuelve a cambiar… y la hoja sube y baja un píxel sin parar. Encaja
 * con lo que se veía en la 1.8.7: con la hoja a su alto natural «vibraba» y,
 * con el diagnóstico abierto (hoja al máximo y con desplazamiento, alto que
 * ya no depende de la medida), paraba.
 *
 * Dos reglas cortan ese bucle:
 *   - `settleMeasure`: una medida que CRECE se acepta siempre (nada se
 *     corta); una que ENCOGE solo si encoge de verdad (más de `tolerance`
 *     puntos, p. ej. al cambiar de pestaña o al quitar un aviso). Un vaivén
 *     de un píxel se queda en el valor mayor y la hoja no se mueve más.
 *   - `sheetLayout`: el alto se redondea HACIA ARRIBA al píxel físico, para
 *     que el canto de la hoja caiga siempre en un píxel entero.
 */

/** Encogimientos de hasta esto (puntos) se ignoran: son redondeos, no contenido nuevo. */
export const SHEET_SHRINK_TOLERANCE = 2;

/**
 * Nueva medida de una parte de la hoja, con histéresis.
 * @param previous medida en uso (0 = aún sin medir)
 * @param measured medida que acaba de llegar
 */
export function settleMeasure(
  previous: number,
  measured: number,
  tolerance: number = SHEET_SHRINK_TOLERANCE,
): number {
  if (!Number.isFinite(measured) || measured <= 0) return previous;
  if (!(previous > 0)) return measured;
  if (measured >= previous) return measured;
  return previous - measured > tolerance ? measured : previous;
}

export interface SheetLayoutInput {
  /** Cabecera medida (asa, título, resumen). */
  readonly header: number;
  /** Cuerpo medido (sin el margen de abajo). */
  readonly body: number;
  /** Margen de abajo (barra de gestos + aire). */
  readonly bottomPad: number;
  /** Alto máximo (casi toda la pantalla). */
  readonly maxHeight: number;
  /** Píxeles físicos por punto. */
  readonly density: number;
}

export interface SheetLayout {
  /** Alto de la hoja (0 = aún sin medir). */
  readonly height: number;
  /** ¿No cabe y el cuerpo se desplaza? */
  readonly scrollable: boolean;
}

/** Alto de la hoja al píxel físico: el natural o, si no cabe, el máximo. */
export function sheetLayout({ header, body, bottomPad, maxHeight, density }: SheetLayoutInput): SheetLayout {
  if (!(header > 0) || !(body > 0)) return { height: 0, scrollable: false };
  const d = density > 0 && Number.isFinite(density) ? density : 1;
  const up = (v: number) => Math.ceil(v * d - 1e-6) / d;
  const down = (v: number) => Math.floor(v * d + 1e-6) / d;
  const natural = up(header + body + bottomPad);
  const max = down(maxHeight);
  return natural > max ? { height: max, scrollable: true } : { height: natural, scrollable: false };
}
