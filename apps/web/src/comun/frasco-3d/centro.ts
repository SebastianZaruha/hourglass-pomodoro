// Centro del perfil, sin three: así el arranque no se trae el motor.
import { CUELLO_FILA } from './encuadre';
import { EXTERIOR } from './perfil-datos';

function extremoFila(pares: readonly number[], mayor: boolean): number {
  let y = mayor ? -Infinity : Infinity;
  for (let i = 1; i < pares.length; i += 2) {
    const fila = pares[i]!;
    if (mayor ? fila > y : fila < y) y = fila;
  }
  return y;
}

/** Fila del centro del perfil (de arriba a abajo). El cuello queda por encima. */
export const CENTRO_FILA = (extremoFila(EXTERIOR, false) + extremoFila(EXTERIOR, true)) / 2;
/** Ese centro, en coordenadas de la malla: origen en el cuello, Y hacia arriba. */
export const CENTRO_LOCAL_Y = CUELLO_FILA - CENTRO_FILA;
