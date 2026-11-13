/**
 * Altura del agua: el k-ésimo punto más bajo, en O(n).
 * El muelle es de 2 Hz con amortiguación 0,8. El volumen es la fracción
 * de puntos y no depende del ángulo.
 */

export const SUPERFICIE_HZ = 2;
export const SUPERFICIE_ZETA = 0.8;

export function muelleSuperficie(): { rigidez: number; amortiguacion: number } {
  const omega = Math.PI * 2 * SUPERFICIE_HZ;
  return { rigidez: omega * omega, amortiguacion: 2 * SUPERFICIE_ZETA * omega };
}

/** k-ésimo menor (0 = el más bajo en la lista). Reordena el array. */
export function kesimo(valores: Float64Array, k: number): number {
  let lo = 0;
  let hi = valores.length - 1;
  const objetivo = Math.min(hi, Math.max(0, k));
  while (lo < hi) {
    const pivote = valores[lo + ((hi - lo) >> 1)] ?? 0;
    let i = lo;
    let j = hi;
    while (i <= j) {
      while ((valores[i] ?? 0) < pivote) i += 1;
      while ((valores[j] ?? 0) > pivote) j -= 1;
      if (i <= j) {
        const tmp = valores[i] ?? 0;
        valores[i] = valores[j] ?? 0;
        valores[j] = tmp;
        i += 1;
        j -= 1;
      }
    }
    if (objetivo <= j) hi = j;
    else if (objetivo >= i) lo = i;
    else break;
  }
  return valores[objetivo] ?? 0;
}

/**
 * Proyección del corte. Positivo hacia abajo en pantalla.
 * `k` cuenta desde el punto más bajo: el corte deja esa fracción debajo.
 */
export function corteDeBulbo(
  puntos: Float32Array,
  desde: number,
  cuenta: number,
  fraccion: number,
  angulo: number,
  phi: number,
  w: number,
  h: number,
): number | null {
  if (cuenta < 2 || fraccion <= 0.001) return null;
  const k = Math.min(cuenta, Math.max(1, Math.round(fraccion * cuenta)));
  const vals = new Float64Array(cuenta);
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  for (let i = 0; i < cuenta; i++) {
    const o = (desde + i) * 2;
    const dx = ((puntos[o] ?? 0) - 0.5) * w;
    const dy = ((puntos[o + 1] ?? 0) - 0.5) * h;
    const x = dx * c - dy * s;
    const y = dx * s + dy * c;
    vals[i] = x * sp + y * cp;
  }
  return kesimo(vals, cuenta - k);
}
