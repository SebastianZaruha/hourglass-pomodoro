export interface Muelle {
  readonly valor: number;
  readonly velocidad: number;
}

export function muelleQuieto(valor = 0): Muelle {
  return { valor, velocidad: 0 };
}

/**
 * Muelle amortiguado de más (no oscila). Al llegar al objetivo se queda
 * quieto: el agua en reposo no debe balancearse.
 */
export function pasoMuelle(
  actual: Muelle,
  objetivo: number,
  dt: number,
  rigidez = 80,
  amortiguacion = 24,
): Muelle {
  const paso = Math.min(0.05, Math.max(0, dt));
  if (paso === 0) return actual;
  const aceleracion = rigidez * (objetivo - actual.valor) - amortiguacion * actual.velocidad;
  const velocidad = actual.velocidad + aceleracion * paso;
  const valor = actual.valor + velocidad * paso;
  if (Math.abs(objetivo - valor) < 0.003 && Math.abs(velocidad) < 0.02) {
    return { valor: objetivo, velocidad: 0 };
  }
  return { valor, velocidad };
}
