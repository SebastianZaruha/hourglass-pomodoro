/** Relación de contraste WCAG entre dos colores #rrggbb. */
export function contraste(a: string, b: string): number {
  const clara = Math.max(luminancia(a), luminancia(b));
  const oscura = Math.min(luminancia(a), luminancia(b));
  return (clara + 0.05) / (oscura + 0.05);
}

function canal(valor: number): number {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const limpio = hex.replace('#', '');
  const largo = limpio.length === 3 ? [...limpio].map((c) => c + c).join('') : limpio;
  const r = Number.parseInt(largo.slice(0, 2), 16);
  const g = Number.parseInt(largo.slice(2, 4), 16);
  const b = Number.parseInt(largo.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
