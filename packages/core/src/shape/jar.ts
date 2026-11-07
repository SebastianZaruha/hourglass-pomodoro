/**
 * Colocación del frasco fotográfico y nivel de llenado.
 *
 * La tabla sale de geometry.json (volumen de revolución, no altura lineal).
 * El pie del sprite cae en el contacto de la escena. El frasco se hunde
 * un pelo al dibujarlo; aquí el rectángulo todavía apoya el pie exacto.
 */
import type { MaterialId } from '../catalog/contents';
import table from './jarTable.json';
import { groundContact, groundJarHeight, type Frame } from './plate';

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

/** Punto de la foto que debe quedar a la vista (object-position). */
export const SCENE_FOCUS: Record<MaterialId, { readonly x: number; readonly y: number }> = {
  arena: { x: 0.62, y: 0.46 },
  lluvia: { x: 0.7, y: 0.68 },
  miel: { x: 0.5, y: 0.5 },
  nieve: { x: 0.46, y: 0.4 },
};

/**
 * Cover mínimo. El foco de la escena cae cerca del centro y, en horizontal,
 * el pie queda a la izquierda para dejar el reloj digital a la derecha.
 * `mirror` voltea la foto en X (lluvia): el contacto se lee al revés.
 */
export function dioramaPlacement(
  viewW: number,
  viewH: number,
  imageW: number,
  imageH: number,
  id: MaterialId,
  imageWide: boolean,
  mirror = false,
): Diorama {
  const contact = groundContact(id, imageWide);
  const focus = SCENE_FOCUS[id];
  const iw = imageW > 0 ? imageW : 1;
  const ih = imageH > 0 ? imageH : 1;
  const wide = viewW >= viewH;
  const cu = mirror ? 1 - contact.x : contact.x;
  const fu = mirror ? 1 - focus.x : focus.x;
  const scale = Math.max(viewW / iw, viewH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const clamp = (value: number, size: number, view: number) =>
    Math.min(0, Math.max(Math.min(0, view - size), value));
  let x = clamp(viewW * 0.5 - fu * dw, dw, viewW);
  let y = clamp(viewH * (wide ? 0.46 : 0.4) - focus.y * dh, dh, viewH);
  const footTargetX = wide ? viewW * 0.3 : viewW * 0.5;
  const footNow = x + cu * dw;
  if (wide ? footNow > viewW * 0.46 : Math.abs(footNow - footTargetX) > viewW * 0.08) {
    x = clamp(x - (footNow - footTargetX), dw, viewW);
  }
  const footYTarget = viewH * (wide ? 0.8 : 0.66);
  const footYNow = y + contact.y * dh;
  if (footYNow > viewH * 0.9 || footYNow < viewH * 0.55) y = clamp(y - (footYNow - footYTarget), dh, viewH);
  const scene = { x, y, w: dw, h: dh };
  const footX = x + cu * dw;
  const footY = y + contact.y * dh;
  let jh = groundJarHeight(id, imageWide) * scene.h;
  const maxH = viewH * (wide ? 0.62 : 0.5);
  if (jh > maxH) jh = maxH;
  const jw = jh * JAR_ASPECT;
  return {
    scene,
    jar: { x: footX - JAR_FOOT_X * jw, y: footY - JAR_FOOT_Y * jh, w: jw, h: jh },
    footX,
    footY,
  };
}

/**
 * Luz de cada escena. `key` es el lado iluminado (0 izquierda, 1 derecha).
 * `dx` desplaza la sombra al lado contrario. Los colores tiñen brillos,
 * cristal y rebote del suelo; no hace falta regenerar las capas.
 */
export interface SceneLight {
  readonly dx: number;
  readonly key: number;
  readonly highlight: string;
  readonly shade: string;
  readonly ambient: string;
  readonly gleam: string;
  readonly bounce: string;
  readonly caustic: string;
  readonly shadow: string;
  readonly filter: string;
}

export const SCENE_LIGHT: Record<MaterialId, SceneLight> = {
  // Sol arriba a la derecha. Sombra hacia la izquierda. Oro cálido.
  arena: {
    dx: -0.42,
    key: 0.82,
    highlight: '#ffd7a4',
    shade: 'rgba(92, 40, 12, 0.72)',
    ambient: 'rgba(255, 186, 104, 0.55)',
    gleam: 'rgba(255, 236, 204, 0.9)',
    bounce: 'rgba(255, 156, 64, 0.55)',
    caustic: 'rgba(255, 186, 96, 0.42)',
    shadow: 'rgba(78, 32, 6, 0.46)',
    filter: 'brightness(1.07) contrast(1.05) saturate(1.14)',
  },
  // Orbe de la izquierda. Cielo neutro, brillo ámbar, sombra a la derecha.
  lluvia: {
    dx: 0.28,
    key: 0.22,
    highlight: '#ffe0b4',
    shade: 'rgba(22, 26, 28, 0.7)',
    ambient: 'rgba(214, 204, 184, 0.4)',
    gleam: 'rgba(255, 220, 176, 0.75)',
    bounce: 'rgba(214, 176, 110, 0.4)',
    caustic: 'rgba(176, 206, 196, 0.28)',
    shadow: 'rgba(14, 16, 14, 0.5)',
    filter: 'brightness(0.98) contrast(1.08) saturate(0.9)',
  },
  // Sol arriba a la izquierda. Sombra hacia la derecha. Oro de miel.
  miel: {
    dx: 0.4,
    key: 0.18,
    highlight: '#ffd09a',
    shade: 'rgba(78, 42, 10, 0.68)',
    ambient: 'rgba(255, 190, 110, 0.55)',
    gleam: 'rgba(255, 228, 186, 0.9)',
    bounce: 'rgba(232, 160, 60, 0.5)',
    caustic: 'rgba(255, 176, 64, 0.4)',
    shadow: 'rgba(70, 36, 6, 0.44)',
    filter: 'brightness(1.08) contrast(1.03) saturate(1.16)',
  },
  // Cielo frío arriba a la izquierda. Sombra corta a la derecha. Azul gris.
  nieve: {
    dx: 0.16,
    key: 0.3,
    highlight: '#d5e4f4',
    shade: 'rgba(24, 36, 58, 0.66)',
    ambient: 'rgba(166, 188, 214, 0.5)',
    gleam: 'rgba(232, 242, 255, 0.8)',
    bounce: 'rgba(186, 208, 228, 0.55)',
    caustic: 'rgba(176, 210, 255, 0.24)',
    shadow: 'rgba(36, 48, 68, 0.4)',
    filter: 'brightness(1.05) contrast(0.96) saturate(0.82)',
  },
};
