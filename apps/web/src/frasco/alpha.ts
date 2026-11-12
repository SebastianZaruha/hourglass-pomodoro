/** Clave el color de las esquinas (negro o blanco) a transparencia. */
export function alphaFromBlack(data: Uint8ClampedArray): void {
  const br = data[0] ?? 0;
  const bg = data[1] ?? 0;
  const bb = data[2] ?? 0;
  const claro = (br + bg + bb) / 3 > 180;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const alpha = claro
      ? Math.max(0, Math.min(255, (Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb)) - 8) * 7))
      : Math.max(0, Math.min(255, ((r + g + b) / 3 - 6) * 1.55));
    if (!claro && alpha > 8) {
      const lift = 255 / alpha;
      data[i] = Math.min(255, Math.round(r * lift));
      data[i + 1] = Math.min(255, Math.round(g * lift));
      data[i + 2] = Math.min(255, Math.round(b * lift));
    } else if (alpha <= 8) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
    data[i + 3] = alpha;
  }
}

/** 1 de pie, 0 de canto. La nube y la sombra solo dependen del ángulo. */
export function presenciaVertical(angulo: number): number {
  const derecho = Math.min(1, Math.abs(Math.cos(angulo)));
  return derecho * derecho * (3 - 2 * derecho);
}

export function vectorLuz(grados: number): { x: number; y: number } {
  const rad = (grados * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}
