/**
 * Peso de una capa del fundido, de 0 a 1, ya con el ease-in-out.
 * El interior del vidrio es negro: un alfa de 0,5 se traga el agua.
 * Cada capa entra o sale en el primer o el último tramo y, en medio,
 * se queda entera. El desenfoque sí recorre los 900 ms.
 */
export function opacidadFundido(peso: number): number {
  if (!(peso > 0.004)) return 0;
  const t = Math.min(1, peso / 0.35);
  const s = t * t * (3 - 2 * t);
  return s;
}
