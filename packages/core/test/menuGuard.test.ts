import { describe, expect, it } from 'vitest';
import { MENU_GUARD_SIZE, inMenuGuard } from '../src';

const L = { width: 390, height: 844, safeTop: 24, safeBottom: 16, flipped: false };

describe('zona de guarda del botón del menú', () => {
  it('de pie: esquina de abajo a la derecha (1.8.10), sobre el margen seguro', () => {
    expect(inMenuGuard(390 - 24, 844 - 16 - 52, L)).toBe(true); // el propio botón
    expect(inMenuGuard(390 - MENU_GUARD_SIZE, 844 - 16 - MENU_GUARD_SIZE, L)).toBe(true); // borde de la zona
    expect(inMenuGuard(370, 840, L)).toBe(true); // dentro del margen de la barra de gestos
    expect(inMenuGuard(390 - MENU_GUARD_SIZE - 1, 820, L)).toBe(false);
    expect(inMenuGuard(370, 844 - 16 - MENU_GUARD_SIZE - 1, L)).toBe(false);
    expect(inMenuGuard(195, 420, L)).toBe(false); // el reloj
    expect(inMenuGuard(195, 844 - 16 - 52, L)).toBe(false); // el tiempo, centrado abajo
    expect(inMenuGuard(370, 40, L)).toBe(false); // arriba a la derecha (donde estaba hasta la 1.8.9)
  });

  it('volteado: la esquina pasa a arriba a la izquierda', () => {
    const F = { ...L, flipped: true };
    expect(inMenuGuard(20, 24 + 20, F)).toBe(true);
    expect(inMenuGuard(20, 10, F)).toBe(true); // dentro del margen de arriba
    expect(inMenuGuard(370, 830, F)).toBe(false);
    expect(inMenuGuard(MENU_GUARD_SIZE + 1, 30, F)).toBe(false);
    expect(inMenuGuard(20, 24 + MENU_GUARD_SIZE + 1, F)).toBe(false);
  });

  it('datos raros: fuera de la zona', () => {
    expect(inMenuGuard(Number.NaN, 10, L)).toBe(false);
  });
});
