import { describe, expect, it } from 'vitest';

import { GLASS_FULL_AT, glassFade } from '../src/menu/glassFade';

describe('glassFade', () => {
  it('es 0 con la hoja escondida y 1 desde GLASS_FULL_AT', () => {
    expect(glassFade(0)).toBe(0);
    expect(glassFade(GLASS_FULL_AT)).toBe(1);
    expect(glassFade(0.8)).toBe(1);
    expect(glassFade(1)).toBe(1);
  });

  it('sube sin saltos y nunca baja al abrir', () => {
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = glassFade(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      // Ningún paso de 1 % de recorrido cambia el vidrio más de un 4 %.
      expect(v - prev).toBeLessThan(0.04);
      prev = v;
    }
  });

  it('valores raros no rompen nada', () => {
    expect(glassFade(Number.NaN)).toBe(0);
    expect(glassFade(-1)).toBe(0);
    expect(glassFade(0.5, 0)).toBe(0);
  });
});
