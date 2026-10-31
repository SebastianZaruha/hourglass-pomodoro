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
