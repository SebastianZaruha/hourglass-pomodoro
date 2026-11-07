/**
 * Cuántos pasos de simulación tocan en un fotograma.
 *
 * Históricamente eran 2 pasos por fotograma pensando en 60 Hz (120 pasos
 * por segundo). A 120 Hz, repetir esos 2 pasos duplica el trabajo y la
 * arena se asienta el doble de rápido. Aquí el presupuesto es 120 pasos
 * por segundo, repartidos según lo que duró el fotograma:
 *
 *   120 Hz → 1 paso     (8,3 ms)
 *    60 Hz → 2 pasos    (igual que antes)
 *    30 Hz → 4 pasos
 *    20 Hz → 6 pasos    (el tope: un tirón no intenta ponerse al día para siempre)
 *
 * En un giro fuerte con menos detalle (`lod`) siempre es 1: ponerse al día
 * en un móvil que ya no llega lo haría aún más lento (ver TiltLod).
 */

/** Pasos de simulación por segundo. 2 × 60 Hz, el ritmo de la 1.8. */
export const SIM_STEPS_PER_SEC = 120;

/** Tope por fotograma. Antes: MAX_CATCH_UP (3) × 2 pasos. */
export const MAX_SIM_STEPS_PER_FRAME = 6;

export interface StepBudget {
  steps: number;
  /** Resto que se arrastra al fotograma siguiente (para 90 Hz, 144 Hz…). */
  debt: number;
}

/**
 * @param debt Resto del fotograma anterior (0 la primera vez).
 * @param frameDt Segundos desde el fotograma anterior.
 * @param lod Menos detalle por un giro fuerte: un solo paso, sin arrastre.
 */
/** Escribe en `into` (el bucle lo reutiliza: no reserva un objeto por fotograma). */
export function takeSimSteps(debt: number, frameDt: number, lod: boolean, into: StepBudget): void {
  if (lod || !(frameDt > 0) || !Number.isFinite(frameDt)) {
    into.steps = 1;
    into.debt = 0;
    return;
  }
  const next = (Number.isFinite(debt) ? debt : 0) + frameDt * SIM_STEPS_PER_SEC;
  const raw = Math.floor(next);
  if (raw > MAX_SIM_STEPS_PER_FRAME) {
    into.steps = MAX_SIM_STEPS_PER_FRAME;
    into.debt = 0;
    return;
  }
  if (raw < 0) {
    into.steps = 0;
    into.debt = 0;
    return;
  }
  into.steps = raw;
  into.debt = next - raw;
}

/**
 * Cuántos «fotogramas de 60 Hz» cubre este, para el tope de granos que
 * pueden cruzar el cuello. A 60 Hz es 1 (el tope de siempre). A 120 Hz es
 * 0,5: el fotograma es más corto, así que el tope también. A 20 Hz es 3,
 * el antiguo máximo de puesta al día.
 */
export function flowSpan(frameDt: number): number {
  if (!(frameDt > 0) || !Number.isFinite(frameDt)) return 1;
  return Math.min(3, Math.max(0.5, frameDt * 60));
}
