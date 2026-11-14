import { FOTO_ALTO, FOTO_ANCHO, CUELLO_FILA, SEMI_ALTO, SEMI_ANCHO } from './geometria';
import type { GeometriaFrasco } from './contrato';
import type { GlassLayout } from './pintarVidrio';

const CENTRO_X = (26 + 421) / 2;

/**
 * El clic cuenta si, girado al marco del frasco, cae dentro del radio
 * interior. La tolerancia es la publicada.
 */
export function golpe(
  layout: GlassLayout,
  geo: GeometriaFrasco,
  x: number,
  y: number,
  angulo: number,
): boolean {
  const dx = x - layout.cx;
  const dy = y - layout.cy;
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  const fotoX = ((lx + layout.halfW) / (layout.halfW * 2)) * FOTO_ANCHO;
  const fotoY = ((ly + layout.halfH) / (layout.halfH * 2)) * FOTO_ALTO;
  const nx = (fotoX - CENTRO_X) / SEMI_ANCHO;
  const ny = (fotoY - CUELLO_FILA) / SEMI_ALTO;
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return false;
  return Math.abs(nx) <= geo.radio(ny) + 0.035;
}
