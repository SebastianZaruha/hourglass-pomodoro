/**
 * Vidrio de foto. La arena la pinta el contenido, entre el dorso y el frente.
 * La luz va con fuerza 0: Clásico sigue con el degradado publicado.
 */
import type { GeometriaFrasco } from './contrato';
import { FOTO_ALTO, FOTO_ANCHO, RELLENO_ANCHO } from './geometria';
import { pintarLuz, type LuzEscena } from './luz';
import { pintarSombra } from './sombra';

export interface GlassLayout {
  readonly cx: number;
  readonly cy: number;
  readonly halfW: number;
  readonly halfH: number;
}

export type Scheme = 'light' | 'dark';

const ASPECTO = FOTO_ALTO / FOTO_ANCHO;

/** Caja de la foto, con la misma regla que el frasco dibujado de la publicada. */
export function layoutFor(width: number, height: number): GlassLayout {
  const availW = width * 0.84;
  const availH = height * 0.86;
  let glassW = availW;
  let glassH = glassW * ASPECTO;
  if (glassH > availH) {
    glassH = availH;
    glassW = glassH / ASPECTO;
  }
  return {
    cx: width / 2,
    cy: height * 0.48,
    halfW: glassW / 2,
    halfH: glassH / 2,
  };
}

/** Encoge el vidrio lo justo para que, de canto, siga cabiendo en el lienzo. */
export function escalaDeIntro(
  base: number,
  layout: { halfW: number; halfH: number },
  angle: number,
  cssW: number,
  cssH: number,
): number {
  const across = Math.abs(Math.sin(angle));
  const along = Math.abs(Math.cos(angle));
  const span = (layout.halfH * 2 * across + layout.halfW * 2 * along) * base;
  const room = Math.min(cssW, cssH) * 0.92;
  if (span <= room || span < 1) return base;
  return (base * room) / span;
}

export interface CajaVidrio {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface VidrioFoto {
  readonly layout: GlassLayout;
  readonly scheme: Scheme;
  readonly rotation: number;
  readonly poseScale: number;
  readonly sombra: number;
  readonly atras: CanvasImageSource | null;
  readonly delante: CanvasImageSource | null;
  readonly geo: GeometriaFrasco | null;
  /** Pasados 2,5 s sin las fotos: la silueta de la máscara, nunca las elipses. */
  readonly silueta: boolean;
  readonly luz: LuzEscena;
}

function cajaDe(layout: GlassLayout): CajaVidrio {
  return {
    x: layout.cx - layout.halfW,
    y: layout.cy - layout.halfH,
    w: layout.halfW * 2,
    h: layout.halfH * 2,
  };
}

/**
 * La foto se encoge, con el centro quieto, para que la base se apoye
 * en la sombra. Alrededor de un 1 %: el valor es el que se ve apoyado.
 */
const ESCALA_FOTO = 0.99;

/**
 * Borde de abajo del vidrio que se ve, en la foto de 2048.
 * El archivo sigue transparente por debajo; ese margen no es la base.
 */
const BASE_OPACA = 2013 / 2048;

/** La foto, más ancha, para que el vidrio opaco coincida con la caja, y un poco más baja de escala. */
function cajaFoto(caja: CajaVidrio): CajaVidrio {
  const cx = caja.x + caja.w / 2;
  const cy = caja.y + caja.h / 2;
  const w = caja.w * RELLENO_ANCHO * ESCALA_FOTO;
  const h = caja.h * ESCALA_FOTO;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function yBaseOpaca(caja: CajaVidrio): number {
  return caja.y + caja.h * BASE_OPACA;
}

function conGiro(
  ctx: CanvasRenderingContext2D,
  layout: GlassLayout,
  rotation: number,
  poseScale: number,
  pintar: () => void,
): void {
  const { cx, cy } = layout;
  ctx.save();
  ctx.translate(cx, cy);
  if (poseScale !== 1) ctx.scale(poseScale, poseScale);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);
  pintar();
  ctx.restore();
}

/** Velo y borde de la máscara. Solo si las fotos no han llegado. */
function pintarSilueta(ctx: CanvasRenderingContext2D, mask: CanvasImageSource, caja: CajaVidrio): void {
  const { x, y, w, h } = caja;
  ctx.save();
  ctx.drawImage(mask, x, y, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(236, 234, 230, 0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  const o = 1.5;
  ctx.save();
  ctx.drawImage(mask, x - o, y, w, h);
  ctx.drawImage(mask, x + o, y, w, h);
  ctx.drawImage(mask, x, y - o, w, h);
  ctx.drawImage(mask, x, y + o, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(236, 234, 230, 0.62)';
  ctx.fillRect(x - o, y - o, w + o * 2, h + o * 2);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(mask, x, y, w, h);
  ctx.restore();
}

/**
 * Sombra, dorso, contenido, frente y luz.
 * El frente es la lámina de brillos: el negro no tapa la arena.
 */
export function pintarVidrio(
  ctx: CanvasRenderingContext2D,
  scene: VidrioFoto,
  pintarContenido: (ctx: CanvasRenderingContext2D, caja: CajaVidrio) => void,
): void {
  const { layout, scheme } = scene;
  const caja = cajaFoto(cajaDe(layout));
  pintarSombra(ctx, layout, scheme, scene.sombra, scene.poseScale, ESCALA_FOTO, yBaseOpaca(caja));

  const fotos = scene.atras && scene.delante;
  if (!fotos && !(scene.silueta && scene.geo)) return;

  conGiro(ctx, layout, scene.rotation, scene.poseScale, () => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (fotos && scene.atras) ctx.drawImage(scene.atras, caja.x, caja.y, caja.w, caja.h);
    else if (scene.geo) pintarSilueta(ctx, scene.geo.mascara, caja);
    pintarContenido(ctx, caja);
    if (fotos && scene.delante) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(scene.delante, caja.x, caja.y, caja.w, caja.h);
      ctx.restore();
    }
  });

  if (fotos && scene.delante) pintarLuz(ctx, scene.delante, caja, scene.luz);
}
