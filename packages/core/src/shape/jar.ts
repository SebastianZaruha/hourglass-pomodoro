/**
 * Colocación del frasco fotográfico y nivel de llenado.
 *
 * La tabla sale de geometry.json (volumen de revolución, no altura lineal).
 * El pie del sprite cae en el contacto de la escena. El frasco se hunde
 * un pelo al dibujarlo; aquí el rectángulo todavía apoya el pie exacto.
 */
import type { MaterialId } from '../catalog/contents';
import table from './jarTable.json';
import { coverFrame, groundContact, groundJarHeight, type Frame } from './plate';

type Row = readonly [number, number];

function asRows(value: readonly (readonly number[])[]): readonly Row[] {
  return value.map((row) => [row[0] ?? 0, row[1] ?? 0] as const);
}

function asBox(value: readonly number[]): readonly [number, number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 1, value[3] ?? 1];
}

const TOP = asRows(table.top);
const BOT = asRows(table.bot);

export const JAR_ASPECT = table.aspect;
export const JAR_FOOT_X = table.foot[0] ?? 0.5;
export const JAR_FOOT_Y = table.foot[1] ?? 0.98;
export const JAR_NECK_Y = table.neckY;
export const JAR_TOP_BOX = asBox(table.topBox);
export const JAR_BOT_BOX = asBox(table.botBox);

/** Fotogramas del bucle del chorro (atlas y vídeo). */
export const STREAM_FRAMES = 12;
export const STREAM_FPS = 10;

export function streamFrame(seconds: number, reduceMotion: boolean): number {
  if (reduceMotion || !Number.isFinite(seconds)) return 0;
  const loop = STREAM_FRAMES / STREAM_FPS;
  const t = ((seconds % loop) + loop) % loop;
  return Math.floor(t * STREAM_FPS) % STREAM_FRAMES;
}

/**
 * Y normalizada (0 arriba) de la superficie para un volumen 0..1.
 * Volumen 1 → borde alto del bulbo. Volumen 0 → borde bajo (no se ve nada).
 */
export function jarSurface(bulb: 'top' | 'bot', volume: number): number {
  const rows = bulb === 'top' ? TOP : BOT;
  const box = bulb === 'top' ? JAR_TOP_BOX : JAR_BOT_BOX;
  const v = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return box[3];
  if (v >= first[1]) return first[0];
  if (v <= last[1]) return last[0];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!;
    const b = rows[i]!;
    if (v <= a[1] && v >= b[1]) {
      const span = a[1] - b[1];
      const t = span > 0 ? (a[1] - v) / span : 0;
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return last[0];
}

export interface Diorama {
  readonly scene: Frame;
  readonly jar: Frame;
  readonly footX: number;
  readonly footY: number;
}

/**
 * Cover mínimo del viewport. El contacto queda lo más cerca posible del
 * sitio preferido (a la izquierda si la ventana es ancha) sin dejar huecos.
 * El frasco usa la misma escala de escena: alto = jarHeight × alto de foto.
 */
export function dioramaPlacement(
  viewW: number,
  viewH: number,
  imageW: number,
  imageH: number,
  id: MaterialId,
  imageWide: boolean,
): Diorama {
  const contact = groundContact(id, imageWide);
  const iw = imageW > 0 ? imageW : 1;
  const ih = imageH > 0 ? imageH : 1;
  const wide = viewW >= viewH;
  // El apoyo va abajo y, en horizontal, a la izquierda, para que el panel
  // de ajustes quepa a la derecha sin tapar el vidrio. Si hace falta, la
  // foto se acerca: miel y nieve no pueden quedarse flotando.
  const preferX = wide ? viewW * 0.28 : viewW * 0.5;
  const preferY = viewH * 0.86;
  const scene = coverFrame(viewW, viewH, iw, ih, preferX, preferY, contact.x, contact.y);
  const footX = preferX;
  const footY = preferY;
  let jh = groundJarHeight(id, imageWide) * scene.h;
  const maxH = viewH * 0.68;
  if (jh > maxH) jh = maxH;
  const jw = jh * JAR_ASPECT;
  return {
    scene,
    jar: { x: footX - JAR_FOOT_X * jw, y: footY - JAR_FOOT_Y * jh, w: jw, h: jh },
    footX,
    footY,
  };
}

/** Luz dominante de cada escena: la sombra cae al lado contrario. */
export const SCENE_LIGHT: Record<
  MaterialId,
  { readonly dx: number; readonly tint: string; readonly gleam: string; readonly caustic: string }
> = {
  arena: { dx: -0.26, tint: 'rgba(255, 210, 150, 0.95)', gleam: 'rgba(255, 236, 196, 0.55)', caustic: 'rgba(255, 186, 96, 0.34)' },
  lluvia: { dx: -0.1, tint: 'rgba(206, 224, 230, 0.9)', gleam: 'rgba(255, 214, 160, 0.42)', caustic: 'rgba(160, 210, 216, 0.3)' },
  miel: { dx: -0.18, tint: 'rgba(255, 214, 160, 0.95)', gleam: 'rgba(255, 232, 190, 0.5)', caustic: 'rgba(255, 176, 64, 0.36)' },
  nieve: { dx: 0.16, tint: 'rgba(190, 214, 240, 0.9)', gleam: 'rgba(226, 240, 255, 0.48)', caustic: 'rgba(176, 210, 255, 0.26)' },
};
