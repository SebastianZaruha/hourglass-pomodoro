/**
 * Pulsación en un botón redondo de la fila de ajustes rápidos (1.8.10).
 *
 *  - Un toque normal activa el botón (al soltar), como siempre.
 *  - Mantener pulsado (TOOLTIP_DELAY_MS) enseña una etiqueta pequeña con el
 *    nombre del control («Sonido», «Tema»…). Al soltar NO se activa: como
 *    las etiquetas de Android, mantener pulsado es para preguntar qué es.
 *  - Si el dedo se va del botón antes de soltar (se aleja más de
 *    PRESS_CANCEL_DISTANCE del punto donde bajó), la pulsación se cancela:
 *    al soltar no pasa nada, aunque el dedo vuelva encima (como en Android).
 *  - La etiqueta se va TOOLTIP_HIDE_MS después de soltar.
 *
 * Puro: las coordenadas son las de la pantalla (`pageX/pageY`) y el tiempo
 * lo lleva quien lo usa (Pressable: `delayLongPress`).
 */

/** Cuánto hay que mantener el dedo para ver la etiqueta (ms). */
export const TOOLTIP_DELAY_MS = 450;
/** Cuánto se queda la etiqueta a la vista después de soltar (ms). */
export const TOOLTIP_HIDE_MS = 1500;
/** Distancia (dp) desde donde bajó el dedo a partir de la cual se cancela: medio botón. */
export const PRESS_CANCEL_DISTANCE = 24;

export type QuickPressEnd = 'activate' | 'none';

export class QuickPress {
  private x = 0;
  private y = 0;
  private down = false;
  private cancelled = false;
  private tooltip = false;

  /** El dedo baja en (x, y). Empieza una pulsación nueva. */
  begin(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.down = true;
    this.cancelled = false;
    this.tooltip = false;
  }

  /** El dedo se mueve. Devuelve true si con este movimiento la pulsación queda cancelada. */
  move(x: number, y: number): boolean {
    if (!this.down || this.cancelled) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (Math.hypot(x - this.x, y - this.y) > PRESS_CANCEL_DISTANCE) {
      this.cancelled = true;
      return true;
    }
    return false;
  }

  /** Se cumplió el tiempo de mantener: ¿se enseña la etiqueta? (no si ya se canceló). */
  longPress(): boolean {
    if (!this.down || this.cancelled) return false;
    this.tooltip = true;
    return true;
  }

  /** El dedo se levanta (o el sistema corta la pulsación): ¿se activa el botón? */
  release(): QuickPressEnd {
    const activate = this.down && !this.cancelled && !this.tooltip;
    this.down = false;
    return activate ? 'activate' : 'none';
  }

  /** ¿Se canceló la pulsación en curso (el dedo se fue)? */
  get isCancelled(): boolean {
    return this.cancelled;
  }

  /** ¿Se está enseñando la etiqueta de esta pulsación? */
  get showedTooltip(): boolean {
    return this.tooltip;
  }
}

/**
 * Posición (izquierda, dp) de la etiqueta dentro de la fila: centrada sobre
 * el botón, pero sin salirse por los lados (el primer y el último botón
 * están pegados a los bordes de la hoja).
 */
export function tooltipLeft(center: number, width: number, rowWidth: number, margin = 0): number {
  const ideal = center - width / 2;
  const max = rowWidth - margin - width;
  if (max < margin) return (rowWidth - width) / 2; // no cabe: centrada en la fila
  return Math.min(max, Math.max(margin, ideal));
}
