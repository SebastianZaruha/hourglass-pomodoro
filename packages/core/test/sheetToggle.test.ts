import { describe, expect, it } from 'vitest';

import { SheetToggle, closesMenuOnAppState } from '../src/menu/sheetToggle';

const OPEN_MS = 340;
const CLOSE_MS = 260;

describe('SheetToggle (botón del menú)', () => {
  it('el primer toque abre', () => {
    const t = new SheetToggle();
    expect(t.press(0)).toBe('show');
    expect(t.show(0, OPEN_MS)).toBe(true);
    expect(t.isOpen).toBe(true);
  });

  it('los toques de más mientras se abre no la cierran', () => {
    const t = new SheetToggle();
    t.show(0, OPEN_MS);
    for (let ms = 10; ms < OPEN_MS; ms += 30) expect(t.press(ms)).toBeNull();
    expect(t.isOpen).toBe(true);
  });

  it('abierta del todo, un toque la cierra, y mientras se cierra se ignoran', () => {
    const t = new SheetToggle();
    t.show(0, OPEN_MS);
    expect(t.press(OPEN_MS)).toBe('hide');
    t.hide(OPEN_MS, CLOSE_MS);
    expect(t.press(OPEN_MS + 100)).toBeNull();
    expect(t.press(OPEN_MS + CLOSE_MS)).toBe('show');
  });

  it('abrir dos veces o cerrar cerrada no hace nada', () => {
    const t = new SheetToggle();
    expect(t.hide(0, CLOSE_MS)).toBe(false);
    expect(t.show(0, OPEN_MS)).toBe(true);
    expect(t.show(5, OPEN_MS)).toBe(false);
  });

  it('un doble toque rápido deja la hoja abierta (no abre y cierra)', () => {
    const t = new SheetToggle();
    for (const now of [0, 120]) {
      const action = t.press(now);
      if (action === 'show') t.show(now, OPEN_MS);
      if (action === 'hide') t.hide(now, CLOSE_MS);
    }
    expect(t.isOpen).toBe(true);
  });
});

describe('SheetToggle.reset y cierre al salir de la app (1.8.10)', () => {
  it('reset cierra al momento y el siguiente toque abre sin esperar', () => {
    const t = new SheetToggle();
    t.show(0, OPEN_MS);
    t.reset();
    expect(t.isOpen).toBe(false);
    expect(t.press(10)).toBe('show');
  });

  it('reset en plena animación de cierre: el siguiente toque ya abre', () => {
    const t = new SheetToggle();
    t.show(0, OPEN_MS);
    t.hide(OPEN_MS, CLOSE_MS);
    t.reset();
    expect(t.press(OPEN_MS + 1)).toBe('show');
  });

  it('pasar a segundo plano cierra el menú', () => {
    expect(closesMenuOnAppState('background', false)).toBe(true);
  });

  it('volver, inactive o un diálogo de permisos de la app no lo cierran', () => {
    expect(closesMenuOnAppState('active', false)).toBe(false);
    expect(closesMenuOnAppState('inactive', false)).toBe(false);
    expect(closesMenuOnAppState('background', true)).toBe(false);
  });
});
