/**
 * Regla de la PAUSA con el móvil de lado (1.8.6, lógica pura).
 *
 * Diseño: tumbar el móvil (≈90°) pausa, con el reloj muy desenfocado y
 * «Pausa» girado para leerse en horizontal. Mientras el móvil está de lado,
 * el reloj está en pausa: «de lado = en pausa».
 *
 * Hay dos causas de pausa y solo se guarda una cosa: si la pausa la ha puesto
 * SOLO tumbar el móvil (`tiltOnly`).
 *
 *   ┌──────────────────────┬───────────────────────────────────────────────┐
 *   │ Qué pasa             │ Qué hace                                      │
 *   ├──────────────────────┼───────────────────────────────────────────────┤
 *   │ tumbar, en marcha    │ pausa (tiltOnly = true)                       │
 *   │ tumbar, ya en pausa  │ nada: sigue en pausa, ahora con el aspecto de │
 *   │                      │ la pausa de lado (rótulo girado, desenfoque)  │
 *   │ tocar, de lado       │ no reanuda ni empieza: una pista suave        │
 *   │ tocar, de pie        │ empezar / pausar / reanudar (tiltOnly = false)│
 *   │ de pie otra vez      │ si la pausa era solo de tumbar → reanuda;     │
 *   │                      │ si la pusiste tú (dedo, notificación) → sigue │
 *   │                      │ en pausa hasta que toques                     │
 *   │ voltear              │ empieza de cero (lo hace la pantalla)         │
 *   └──────────────────────┴───────────────────────────────────────────────┘
 *
 * Así una pausa que pones tú nunca se quita sola, y una que solo ha puesto
 * el móvil se quita sola al ponerlo de pie, como hasta ahora.
 */
import type { TimerStatus } from '../timer/types';

export interface PauseRuleState {
  /** La pausa actual la ha puesto solo tumbar el móvil. */
  readonly tiltOnly: boolean;
}

export const PAUSE_RULE_INITIAL: PauseRuleState = Object.freeze({ tiltOnly: false });

export type PauseInput =
  | { readonly type: 'tap'; readonly status: TimerStatus; readonly sideways: boolean }
  | { readonly type: 'tilt-pause'; readonly status: TimerStatus }
  | { readonly type: 'tilt-resume'; readonly status: TimerStatus }
  | { readonly type: 'flip' };

/**
 * Qué tiene que hacer la pantalla:
 *  - 'toggle': empezar / pausar / reanudar (lo normal al tocar de pie);
 *  - 'pause' / 'resume': pausar o reanudar;
 *  - 'hint': nada con el reloj; enseñar que hay que ponerlo de pie;
 *  - 'none': nada.
 */
export type PauseAction = 'toggle' | 'pause' | 'resume' | 'hint' | 'none';

export interface PauseDecision {
  readonly state: PauseRuleState;
  readonly action: PauseAction;
}

const MANUAL: PauseRuleState = Object.freeze({ tiltOnly: false });
const TILT: PauseRuleState = Object.freeze({ tiltOnly: true });

export function pauseRule(state: PauseRuleState, input: PauseInput): PauseDecision {
  switch (input.type) {
    case 'tap':
      if (!input.sideways) return { state: MANUAL, action: 'toggle' };
      // De lado = en pausa. Si por lo que sea corría (el móvil estaba plano
      // al tumbarlo), el toque lo pausa; si no, solo la pista.
      if (input.status === 'running') return { state: MANUAL, action: 'pause' };
      return { state, action: 'hint' };
    case 'tilt-pause':
      if (input.status === 'running') return { state: TILT, action: 'pause' };
      // Ya en pausa (con el dedo o desde la notificación): se queda como está.
      return { state, action: 'none' };
    case 'tilt-resume':
      if (input.status === 'paused' && state.tiltOnly) return { state: MANUAL, action: 'resume' };
      return { state: MANUAL, action: 'none' };
    case 'flip':
      return { state: MANUAL, action: 'none' };
  }
}

/** Desenfoque del reloj en pausa (ver `PauseBlur` en la app). */
export type PauseLook = 'none' | 'soft' | 'full';

export interface PausePresentation {
  /** Desenfoque del reloj. */
  readonly blur: PauseLook;
  /** «Pausa» girado hacia el lado del móvil (si no, derecho). */
  readonly landscape: boolean;
}

/**
 * Cómo se ve la pausa: de lado, siempre como la pausa de lado (aunque la
 * pusieras con el dedo antes de tumbarlo); de pie, la pausa ligera.
 */
export function pausePresentation(status: TimerStatus, sideways: boolean): PausePresentation {
  if (status !== 'paused') return { blur: 'none', landscape: false };
  return sideways ? { blur: 'full', landscape: true } : { blur: 'soft', landscape: false };
}
