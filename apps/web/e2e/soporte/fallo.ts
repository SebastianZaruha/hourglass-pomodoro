import { test } from '@playwright/test';

/**
 * La afirmación que sigue es la de la especificación, sin recortarla.
 * Si hoy falla, Playwright lo cuenta como fallo esperado.
 * Si ya pasa, la suite se pone roja: hay que quitar esta marca en la fase que lo arregle.
 */
export function falloEsperado(causa: number, motivo: string): void {
  test.fail(true, `Fallo esperado (causa ${causa}): ${motivo}`);
}
