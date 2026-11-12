/**
 * Tabla del frasco fotográfico: el volumen es de revolución, no una altura.
 * Por eso un minuto no se vacía «antes»: la superficie sale de esta tabla.
 */
import tabla from './jarTable.json';

type Fila = readonly [number, number];
type CajaJar = readonly [number, number, number, number];

function filas(valor: readonly (readonly number[])[]): readonly Fila[] {
  return valor.map((fila) => [fila[0] ?? 0, fila[1] ?? 0] as const);
}

function caja(valor: readonly number[]): CajaJar {
  return [valor[0] ?? 0, valor[1] ?? 0, valor[2] ?? 1, valor[3] ?? 1];
}

export const JAR_ASPECT = tabla.aspect;
export const JAR_FOOT_X = tabla.foot[0] ?? 0.5;
export const JAR_FOOT_Y = tabla.foot[1] ?? 0.98;
export const JAR_NECK_Y = tabla.neckY;
export const JAR_TOP_BOX = caja(tabla.topBox);
export const JAR_BOT_BOX = caja(tabla.botBox);
const TOP = filas(tabla.top);
const BOT = filas(tabla.bot);

export function filasBulbo(bulbo: 'arriba' | 'abajo'): readonly Fila[] {
  return bulbo === 'arriba' ? TOP : BOT;
}

export function cajaBulbo(bulbo: 'arriba' | 'abajo'): CajaJar {
  return bulbo === 'arriba' ? JAR_TOP_BOX : JAR_BOT_BOX;
}

/**
 * Y de la foto (0 arriba) donde queda la superficie de un volumen 0..1.
 * Volumen 1 llega al borde alto; volumen 0, al borde bajo.
 */
export function jarSurface(bulbo: 'arriba' | 'abajo', volumen: number): number {
  const rows = filasBulbo(bulbo);
  const box = cajaBulbo(bulbo);
  const v = Math.min(1, Math.max(0, Number.isFinite(volumen) ? volumen : 0));
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return box[3];
  if (v >= first[1]) return first[0];
  if (v <= last[1]) return last[0];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (!a || !b) continue;
    if (v <= a[1] && v >= b[1]) {
      const span = a[1] - b[1];
      const t = span > 0 ? (a[1] - v) / span : 0;
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return last[0];
}
