import { describe, expect, it } from 'vitest';

import { SHEET_SHRINK_TOLERANCE, settleMeasure, sheetLayout } from '../src/menu/sheetHeight';

const DENSITY = 2.625; // p. ej. un Samsung A55 (420 dpi)

describe('settleMeasure (alto medido con histéresis)', () => {
  it('la primera medida se acepta', () => {
    expect(settleMeasure(0, 103.81)).toBe(103.81);
  });

  it('crecer se acepta siempre (nada se corta)', () => {
    expect(settleMeasure(100, 100.38)).toBe(100.38);
    expect(settleMeasure(100, 180)).toBe(180);
  });

  it('un vaivén de un píxel no cambia el alto', () => {
    expect(settleMeasure(100.38, 100)).toBe(100.38);
    expect(settleMeasure(100.38, 100.38 - SHEET_SHRINK_TOLERANCE)).toBe(100.38);
  });

  it('encoger de verdad (otra pestaña, aviso que se va) se acepta', () => {
    expect(settleMeasure(420, 260)).toBe(260);
    expect(settleMeasure(300, 300 - SHEET_SHRINK_TOLERANCE - 0.5)).toBe(300 - SHEET_SHRINK_TOLERANCE - 0.5);
  });

  it('ignora medidas sin sentido', () => {
    expect(settleMeasure(120, 0)).toBe(120);
    expect(settleMeasure(120, Number.NaN)).toBe(120);
  });
});

describe('sheetLayout (alto de la hoja)', () => {
  it('sin medir, alto 0', () => {
    expect(sheetLayout({ header: 0, body: 200, bottomPad: 30, maxHeight: 800, density: DENSITY })).toEqual({
      height: 0,
      scrollable: false,
    });
  });

  it('el alto natural, redondeado HACIA ARRIBA al píxel físico', () => {
    const { height, scrollable } = sheetLayout({
      header: 96.19,
      body: 250.1,
      bottomPad: 38.38,
      maxHeight: 800,
      density: DENSITY,
    });
    expect(scrollable).toBe(false);
    expect(height).toBeGreaterThanOrEqual(96.19 + 250.1 + 38.38);
    expect(height - (96.19 + 250.1 + 38.38)).toBeLessThan(1 / DENSITY);
    expect(Number.isInteger(Math.round(height * DENSITY * 1e6) / 1e6)).toBe(true);
  });

  it('si no cabe, el máximo y con desplazamiento', () => {
    const r = sheetLayout({ header: 100, body: 900, bottomPad: 30, maxHeight: 790.3, density: DENSITY });
    expect(r.scrollable).toBe(true);
    expect(r.height).toBeLessThanOrEqual(790.3);
  });
});

describe('el bucle medida ↔ posición (lo que hacía vibrar la hoja)', () => {
  // Modelo de Yoga: el alto de una vista es la diferencia de sus bordes
  // redondeados al píxel, así que depende de dónde cae su borde de arriba.
  const SCREEN = 914.2857; // 2400 px / 2.625
  const rounded = (top: number, h: number) =>
    (Math.round((top + h) * DENSITY) - Math.round(top * DENSITY)) / DENSITY;
  const TRUE_HEADER = 96.82;
  const TRUE_BODY = 247.06;
  const PAD = 38.1;

  /** Varias pasadas de medir → fijar el alto → volver a medir. */
  function run(settle: boolean, oldCeil: boolean) {
    let header = 0;
    let body = 0;
    let height = 0;
    const heights: number[] = [];
    for (let i = 0; i < 12; i++) {
      const top = SCREEN - (height || 400);
      let h = rounded(top, TRUE_HEADER);
      let b = rounded(top + h, TRUE_BODY);
      if (oldCeil) {
        h = Math.ceil(h);
        b = Math.ceil(b);
      }
      header = settle ? settleMeasure(header, h) : h;
      body = settle ? settleMeasure(body, b) : b;
      height = oldCeil
        ? header + body + PAD
        : sheetLayout({ header, body, bottomPad: PAD, maxHeight: 850, density: DENSITY }).height;
      heights.push(height);
    }
    return heights;
  }

  it('con las nuevas reglas el alto se queda quieto enseguida', () => {
    const h = run(true, false);
    const tail = h.slice(3);
    expect(new Set(tail).size).toBe(1);
  });

  it('como en la 1.8.7 (medida al punto, sin histéresis) no se para nunca', () => {
    // No pasa con todos los altos (depende de los decimales); con este, sí:
    // la hoja sube y baja 1-2 puntos en cada pasada.
    const h = run(false, true);
    const tail = h.slice(3);
    expect(new Set(tail).size).toBeGreaterThan(1);
  });

  it('las nuevas reglas lo paran para cualquier alto', () => {
    for (let dh = 0; dh < 1; dh += 0.07) {
      for (let db = 0; db < 1; db += 0.07) {
        let header = 0;
        let body = 0;
        let height = 0;
        const seen: number[] = [];
        for (let i = 0; i < 10; i++) {
          const top = SCREEN - (height || 400);
          const h = rounded(top, 96 + dh);
          header = settleMeasure(header, h);
          body = settleMeasure(body, rounded(top + h, 247 + db));
          height = sheetLayout({ header, body, bottomPad: PAD, maxHeight: 850, density: DENSITY }).height;
          seen.push(height);
        }
        expect(new Set(seen.slice(4)).size).toBe(1);
      }
    }
  });
});
