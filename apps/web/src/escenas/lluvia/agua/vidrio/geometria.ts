// @ts-nocheck — el módulo llega con índices sin comprobar. No se reescribe su cálculo.
// Funciones de geometría pequeñas y puras. Ninguna crea objetos: escriben en arrays que ya existen.
import type { Matriz2D, Poligono } from './tipos';

/** Rellena `destino` con la matriz frasco → mundo: escala, rotación (rad, horario) y posición del pivote. */
export function matrizFrasco(angulo: number, x: number, y: number, escala: number, destino: Matriz2D): Matriz2D {
  const c = Math.cos(angulo) * escala;
  const s = Math.sin(angulo) * escala;
  destino.a = c; destino.b = s; destino.c = -s; destino.d = c; destino.e = x; destino.f = y;
  return destino;
}

/** Pasa los puntos del polígono del frasco al mundo, dentro de `destino` (mismo tamaño). */
export function transformarPoligono(origen: Poligono, m: Matriz2D, destino: Float32Array): void {
  for (let i = 0; i < origen.length; i += 2) {
    const x = origen[i], y = origen[i + 1];
    destino[i] = m.a * x + m.c * y + m.e;
    destino[i + 1] = m.b * x + m.d * y + m.f;
  }
}

/**
 * Busca dónde corta la recta horizontal `y` al polígono.
 * Devuelve la x más a la izquierda (lado = -1) o más a la derecha (lado = +1), o NaN si no lo corta.
 */
export function corteHorizontal(p: Float32Array, y: number, lado: -1 | 1): number {
  let mejor = NaN;
  const n = p.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    const y0 = p[i + 1], y1 = p[j + 1];
    // Solo los lados que cruzan y (medio abierto para no contar dos veces un vértice).
    if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
      const x = p[i] + ((y - y0) / (y1 - y0)) * (p[j] - p[i]);
      if (mejor !== mejor || (lado < 0 ? x < mejor : x > mejor)) mejor = x;
    }
  }
  return mejor;
}

/**
 * Interpolación Catmull-Rom: una curva suave que pasa por todas las alturas.
 * `t` va de 0 a alturas.length - 1 (puede tener decimales). En los extremos repite el borde.
 */
export function interpolar(alturas: ArrayLike<number>, t: number): number {
  const ultimo = alturas.length - 1;
  if (t <= 0) return alturas[0];
  if (t >= ultimo) return alturas[ultimo];
  const i = Math.floor(t);
  const f = t - i;
  const p0 = alturas[i > 0 ? i - 1 : 0];
  const p1 = alturas[i];
  const p2 = alturas[i + 1];
  const p3 = alturas[i + 2 <= ultimo ? i + 2 : ultimo];
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

/** Traza el polígono (ya en el mundo) como camino actual del contexto. */
export function trazarPoligono(ctx: CanvasRenderingContext2D, p: Float32Array): void {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.closePath();
}
