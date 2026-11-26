import { describe, expect, it } from 'vitest';
import { crearModeloAgua, MS_LLENADO, type EntradaAgua } from '../src/agua/modelo';

const duracion = 25 * 60_000;
const reposo: EntradaAgua = {
  dt: 0,
  ahora: 0,
  theta: 0,
  durationMs: duracion,
  remainingMs: duracion,
  corriendo: false,
  pausa: false,
  enGiro: false,
  reposo: true,
};

describe('rellenado de Lluvia', () => {
  it('vuelve a llenar de abajo arriba tras cada reinicio desde reposo', () => {
    const agua = crearModeloAgua();
    agua.paso(reposo);
    agua.paso({ ...reposo, reposo: false, ahora: MS_LLENADO });

    for (const ahora of [1000, 2000]) {
      expect(agua.paso({ ...reposo, ahora, rellenar: true }).llenado).toBe(0);
      expect(agua.paso({ ...reposo, reposo: false, ahora: ahora + MS_LLENADO / 2 }).llenado).toBe(0.5);
      expect(agua.paso({ ...reposo, reposo: false, ahora: ahora + MS_LLENADO }).llenado).toBeNull();
    }
  });

  it('aplica los cambios de duración en reposo sin reiniciar el llenado', () => {
    const agua = crearModeloAgua();
    agua.paso(reposo);
    const nuevaDuracion = 40 * 60_000;
    const vista = agua.paso({ ...reposo, ahora: 20, durationMs: nuevaDuracion, remainingMs: nuevaDuracion });
    expect(vista.llenado).toBeNull();
  });
});
