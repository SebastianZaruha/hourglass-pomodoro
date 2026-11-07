/**
 * El frasco se apoya en la hierba, no en una piedra.
 *
 * Los números salen de `anchors-ground.json` (mismo formato si cambian las
 * fotos). La escena y las briznas comparten este recorte: el punto de
 * contacto de la foto cae en el pie del vidrio.
 */
import type { MaterialId } from '../catalog/contents';
import anchors from './anchors-ground.json';

export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GroundContact {
  /** Punto de la foto, 0..1, origen arriba a la izquierda. */
  readonly x: number;
  readonly y: number;
}

export interface GroundShadow {
  /** Fracción del ancho y del alto de la escena ya recortada. */
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

interface SceneAnchor {
  readonly contact?: { readonly x?: number; readonly y?: number };
  readonly suggestedShadow?: { readonly width?: number; readonly height?: number; readonly opacity?: number };
}

const SCENES = anchors.scenes as Record<string, SceneAnchor>;

const FALLBACK_CONTACT: GroundContact = { x: 0.5, y: 0.85 };
const FALLBACK_SHADOW: GroundShadow = { width: 0.3, height: 0.02, opacity: 0.5 };

function sceneKey(id: MaterialId, wide: boolean): string {
  return `${id}-${wide ? 'h' : 'v'}`;
}

export function groundContact(id: MaterialId, wide: boolean): GroundContact {
  const row = SCENES[sceneKey(id, wide)]?.contact;
  const x = row?.x;
  const y = row?.y;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return FALLBACK_CONTACT;
  }
  return { x, y };
}

export function groundShadow(id: MaterialId, wide: boolean): GroundShadow {
  const row = SCENES[sceneKey(id, wide)]?.suggestedShadow;
  const width = row?.width;
  const height = row?.height;
  const opacity = row?.opacity;
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    typeof opacity !== 'number' ||
    !(width > 0) ||
    !(height > 0)
  ) {
    return FALLBACK_SHADOW;
  }
  return { width, height, opacity };
}

/**
 * Recorte «cover». El punto `(u, v)` de la imagen cae en `(anchorX, anchorY)`
 * y la foto sigue cubriendo la vista. Las briznas usan el mismo resultado.
 */
export function coverFrame(
  viewW: number,
  viewH: number,
  imageW: number,
  imageH: number,
  anchorX: number,
  anchorY: number,
  u = 0.5,
  v = 0.85,
): Frame {
  const iw = imageW > 0 ? imageW : 1;
  const ih = imageH > 0 ? imageH : 1;
  const uu = Math.min(0.98, Math.max(0.02, u));
  const vv = Math.min(0.98, Math.max(0.02, v));
  const ax = Number.isFinite(anchorX) ? anchorX : viewW / 2;
  const ay = Number.isFinite(anchorY) ? anchorY : viewH / 2;
  const scale = Math.max(
    viewW / iw,
    viewH / ih,
    ax / (uu * iw),
    Math.max(0, viewW - ax) / ((1 - uu) * iw),
    ay / (vv * ih),
    Math.max(0, viewH - ay) / ((1 - vv) * ih),
  );
  return {
    x: ax - uu * iw * scale,
    y: ay - vv * ih * scale,
    w: iw * scale,
    h: ih * scale,
  };
}

/** Elipse de la sombra, centrada en el pie, en las mismas coordenadas que la foto. */
export function shadowFrame(plate: Frame, footX: number, footY: number, shadow: GroundShadow): Frame {
  const w = plate.w * shadow.width;
  const h = Math.max(2, plate.h * shadow.height);
  return { x: footX - w / 2, y: footY - h * 0.45, w, h };
}
