/**
 * Eventos de uso para los anuncios de estudio. Solo se envían tras Aceptar.
 * Sin identificadores, sin duración exacta (cubos) y sin nombres reservados
 * de Firebase (`session_start` lo manda el SDK solo cuando la recogida está on).
 */

export type TimerEventName = 'timer_start' | 'timer_complete';

export interface UsageContext {
  readonly language: 'es' | 'en';
  readonly theme: 'system' | 'light' | 'dark';
  readonly mode: 'single' | 'cycles';
}

export type TimerEventParams = Readonly<Record<string, string>>;

/** Cubo de minutos. No es el valor exacto, para no mandar duraciones raras. */
export function durationBucket(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min <= 5) return '5';
  if (min <= 10) return '10';
  if (min <= 15) return '15';
  if (min <= 25) return '25';
  if (min <= 45) return '45';
  if (min <= 60) return '60';
  if (min <= 90) return '90';
  if (min <= 120) return '120';
  return '120plus';
}

export function timerStartParams(input: UsageContext & { readonly durationMs: number }): TimerEventParams {
  return {
    mode: input.mode,
    duration_bucket: durationBucket(input.durationMs),
    language: input.language,
    theme: input.theme,
  };
}

export function timerCompleteParams(
  input: Pick<UsageContext, 'mode'> & { readonly durationMs: number },
): TimerEventParams {
  return {
    mode: input.mode,
    duration_bucket: durationBucket(input.durationMs),
  };
}
