import { MAX_DURATION_MS, MIN_DURATION_MS } from '@reloj/core';

/**
 * Fracción del bulbo de arriba al elegir una duración.
 * Es la curva de tiempo del reloj, copiada aquí: así el agua puede
 * cambiarla sin tocar la arena.
 */
export function nivelDeDuracion(duracionMs: number): number {
  const d = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duracionMs));
  const t = Math.log(d / MIN_DURATION_MS) / Math.log(MAX_DURATION_MS / MIN_DURATION_MS);
  return 0.1 + 0.9 * t;
}
