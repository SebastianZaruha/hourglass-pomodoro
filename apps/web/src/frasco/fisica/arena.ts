import { GRAVITY_DOWN, type Vec2 } from '@reloj/core';

import { nivelDesdeTiempo } from '../nivel';

/** Gravedad dentro del frasco cuando el vidrio está girado `angulo` radianes. */
export function gravedadDelAngulo(angulo: number): Vec2 {
  return { x: Math.sin(angulo), y: Math.cos(angulo) };
}

/** Granos que deben quedar arriba. Sale solo del tiempo, no de la rejilla anterior. */
export function granosObjetivo(total: number, duracionMs: number, restanteMs: number): number {
  if (!(total > 0)) return 0;
  return Math.round(nivelDesdeTiempo(duracionMs, restanteMs) * total);
}

export function gravedadEnReposo(): Vec2 {
  return GRAVITY_DOWN;
}
