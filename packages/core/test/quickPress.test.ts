import { describe, expect, it } from 'vitest';

import { PRESS_CANCEL_DISTANCE, QuickPress, tooltipLeft } from '../src/menu/quickPress';

describe('QuickPress (botones redondos: etiqueta con pulsación larga)', () => {
  it('un toque normal activa el botón', () => {
    const p = new QuickPress();
    p.begin(100, 500);
    p.move(103, 498);
    expect(p.release()).toBe('activate');
  });

  it('mantener pulsado enseña la etiqueta y al soltar NO activa', () => {
    const p = new QuickPress();
    p.begin(100, 500);
    expect(p.longPress()).toBe(true);
    expect(p.showedTooltip).toBe(true);
    expect(p.release()).toBe('none');
  });

  it('si el dedo se va antes de soltar, no se activa', () => {
    const p = new QuickPress();
    p.begin(100, 500);
    expect(p.move(100, 500 - PRESS_CANCEL_DISTANCE - 1)).toBe(true);
    expect(p.isCancelled).toBe(true);
    expect(p.release()).toBe('none');
  });

  it('aunque vuelva encima del botón, sigue cancelada (como en Android)', () => {
    const p = new QuickPress();
    p.begin(100, 500);
    p.move(160, 500);
    p.move(100, 500);
    expect(p.release()).toBe('none');
  });

  it('cancelada antes de tiempo: no sale la etiqueta', () => {
    const p = new QuickPress();
    p.begin(100, 500);
    p.move(140, 500);
    expect(p.longPress()).toBe(false);
  });

  it('con la etiqueta a la vista, deslizar fuera tampoco activa', () => {
    const p = new QuickPress();
    p.begin(100, 500);
    p.longPress();
    p.move(200, 500);
    expect(p.release()).toBe('none');
  });

  it('cada pulsación empieza de cero', () => {
    const p = new QuickPress();
    p.begin(100, 500);
    p.longPress();
    p.release();
    p.begin(100, 500);
    expect(p.release()).toBe('activate');
  });

  it('soltar sin haber bajado el dedo no activa; movimientos raros no cancelan', () => {
    const p = new QuickPress();
    expect(p.release()).toBe('none');
    p.begin(100, 500);
    expect(p.move(Number.NaN, 500)).toBe(false);
    expect(p.release()).toBe('activate');
  });
});

describe('tooltipLeft (etiqueta sin salirse de la fila)', () => {
  it('centrada sobre el botón si cabe', () => {
    expect(tooltipLeft(150, 80, 320)).toBe(110);
  });
  it('el primer botón: pegada al borde izquierdo', () => {
    expect(tooltipLeft(24, 90, 320)).toBe(0);
    expect(tooltipLeft(24, 90, 320, 4)).toBe(4);
  });
  it('el último botón: pegada al borde derecho', () => {
    expect(tooltipLeft(296, 120, 320)).toBe(200);
  });
  it('más ancha que la fila: centrada en la fila', () => {
    expect(tooltipLeft(24, 400, 320)).toBe(-40);
  });
});
