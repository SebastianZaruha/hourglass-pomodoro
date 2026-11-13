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

/** El agua usa el mismo nivel que la arena: la duración manda, no el reloj a 1. */
export function volumenAgua(duracionMs: number, restanteMs: number): { arriba: number; abajo: number } {
  const arriba = nivelDesdeTiempo(duracionMs, restanteMs);
  return { arriba, abajo: Math.min(1, Math.max(0, 1 - arriba)) };
}

/**
 * Acerca el nivel mostrado al objetivo. Un fotograma corto no salta:
 * a los ~0,6 s ya está encima.
 */
export function pasoNivel(actual: number, objetivo: number, dt: number): number {
  if (!Number.isFinite(actual)) return objetivo;
  const k = 1 - Math.exp(-Math.max(0, dt) * 5);
  const siguiente = actual + (objetivo - actual) * k;
  return Math.abs(objetivo - siguiente) < 0.0015 ? objetivo : siguiente;
}

/** Al cerrar la media vuelta, lo de abajo pasa arriba y sigue visible. */
export function volumenTrasCanje(
  arriba: number,
  abajo: number,
): { arriba: number; abajo: number; visible: true } {
  return { arriba: abajo, abajo: arriba, visible: true };
}
