// El frasco como torno: pared exterior + cavidad interior en una sola malla (una draw call).
// Unidades locales = px de la foto reducida (446×1024). Origen en el cuello, y hacia arriba.
// La malla se escala luego a la cajaFoto en pantalla (x/z por ancho, y por alto).
import { BufferGeometry, LatheGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CUELLO_FILA } from './encuadre';
import { EXTERIOR, INTERIOR } from './perfil-datos';

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

function puntos(pares: readonly number[], deAbajoArriba: boolean): Vector2[] {
  const p: Vector2[] = [];
  for (let i = 0; i < pares.length; i += 2) p.push(new Vector2(pares[i]!, CUELLO_FILA - pares[i + 1]!));
  // Lathe saca la normal hacia fuera si el perfil sube. La cavidad la quiere hacia el eje.
  return deAbajoArriba ? p.reverse() : p;
}

/** segmentos: vueltas del torno (96 alto, 64 bajo). */
export function crearGeometriaFrasco(segmentos = 96, conInterior = true): BufferGeometry {
  const exterior = new LatheGeometry(puntos(EXTERIOR, true), segmentos);
  if (!conInterior) return exterior;
  const interior = new LatheGeometry(puntos(INTERIOR, false), segmentos);
  const g = mergeGeometries([exterior, interior], false)!;
  exterior.dispose();
  interior.dispose();
  return g;
}
