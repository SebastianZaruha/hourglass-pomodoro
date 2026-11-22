import { MAX_DURATION_MS, MIN_DURATION_MS } from '../timer';

/**
 * Fracción del bulbo de arriba al elegir una duración.
 * La misma curva que la web: 0,1 en el mínimo y 1 en el máximo.
 */
export function nivelDeDuracion(duracionMs: number): number {
  const d = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duracionMs));
  const t = Math.log(d / MIN_DURATION_MS) / Math.log(MAX_DURATION_MS / MIN_DURATION_MS);
  return 0.1 + 0.9 * t;
}
