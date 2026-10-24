import { describe, expect, it } from 'vitest';

import { snapToPixel } from '../src/menu/pixel';

describe('snapToPixel', () => {
  it('redondea al píxel físico', () => {
    expect(snapToPixel(100.2, 1)).toBe(100);
    expect(snapToPixel(100.2, 2)).toBe(100);
    expect(snapToPixel(100.3, 2)).toBe(100.5);
    // 2,625 píxeles por punto (A55): siempre un múltiplo de 1/2,625.
    const v = snapToPixel(123.456, 2.625);
    expect(Math.abs(v * 2.625 - Math.round(v * 2.625))).toBeLessThan(1e-9);
    expect(Math.abs(v - 123.456)).toBeLessThanOrEqual(0.5 / 2.625);
  });

  it('densidad rara o valor no finito: lo deja igual', () => {
    expect(snapToPixel(10.3, 0)).toBe(10.3);
    expect(snapToPixel(10.3, Number.NaN)).toBe(10.3);
    expect(snapToPixel(Number.NaN, 2)).toBeNaN();
  });
});
