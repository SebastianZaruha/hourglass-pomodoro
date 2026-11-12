import { sandLevelForDuration } from '@reloj/core';

/**
 * Volumen del bulbo de arriba. Es una fracción del tiempo, no una altura:
 * la forma del frasco la interpreta `jarSurface` o la simulación de granos.
 */
export function nivelDesdeTiempo(duracionMs: number, restanteMs: number): number {
  if (!(duracionMs > 0) || !Number.isFinite(duracionMs)) return 0;
  const fraccion = Math.min(1, Math.max(0, Number.isFinite(restanteMs) ? restanteMs / duracionMs : 0));
  return sandLevelForDuration(duracionMs) * fraccion;
}

/** Lo que no está arriba está abajo: el material total cabe en un bulbo. */
export function nivelAbajo(duracionMs: number, restanteMs: number): number {
  return Math.min(1, Math.max(0, 1 - nivelDesdeTiempo(duracionMs, restanteMs)));
}
