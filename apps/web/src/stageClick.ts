import type { TimerStatus } from '@reloj/core';

export interface StageClickInput {
  readonly status: TimerStatus;
  /** `event.detail`: 1 el primero, 2 el segundo de un doble clic. */
  readonly detail: number;
  /** Hay un clic esperando a ver si llega el segundo. */
  readonly pendingToggle: boolean;
  /** El clic que abrió esta pareja salió con PAUSA en pantalla. */
  readonly resumeArmed: boolean;
}

export type StageClickDecision =
  | { readonly kind: 'schedule'; readonly armResume: boolean }
  | { readonly kind: 'ignore-extra' }
  | { readonly kind: 'cancel-pending' };

/**
 * Clic en el escenario.
 *
 * Un clic espera un instante por si es doble (reinicio). En pausa ese segundo
 * clic no reinicia: quien hace clic quiere seguir, y un segundo toque
 * seguido no debe volver a empezar la cuenta. El «seguir» que ya estaba
 * en camino se deja correr.
 */
export function decideStageClick(input: StageClickInput): StageClickDecision {
  if (input.detail > 1 && (input.status === 'paused' || input.resumeArmed)) {
    return { kind: 'ignore-extra' };
  }
  if (input.pendingToggle) return { kind: 'cancel-pending' };
  return { kind: 'schedule', armResume: input.status === 'paused' };
}

/** El doble clic reinicia, salvo si la pareja empezó en pausa. */
export function decideStageDoubleClick(status: TimerStatus, resumeArmed: boolean): 'restart' | 'ignore' {
  if (status === 'paused' || resumeArmed) return 'ignore';
  return 'restart';
}

/** Por debajo de esto, un gesto sigue siendo un clic. */
export const UMBRAL_ARRASTRE = 0.03;

/** Si el frasco ya giró, el clic que suelta el dedo no debe pausar. */
export function arrastreSuprimeClic(deltaAngulo: number): boolean {
  return Math.abs(deltaAngulo) > UMBRAL_ARRASTRE;
}

/** La rueda cambia la duración solo con el reloj parado y el menú cerrado. */
export function ruedaAjustaTiempo(status: TimerStatus, menuAbierto: boolean): boolean {
  return status === 'idle' && !menuAbierto;
}

/** Girar o arrastrar el frasco no lo pone en marcha. Solo sigue si ya corría. */
export function giroArranca(status: TimerStatus): boolean {
  return status === 'running';
}

/** La rueda cambia el tiempo y no gira el frasco. */
export function ruedaGiraFrasco(): boolean {
  return false;
}

/** La media vuelta del reinicio o del menú no arranca la cuenta. */
export function vueltaArranca(): boolean {
  return false;
}
