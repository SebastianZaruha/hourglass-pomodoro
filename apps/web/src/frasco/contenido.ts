import type { SandSimulation, StreamParticles } from '@reloj/core';

import type { Caja } from '../layout/calcularLayout';
import { revisionSello } from './granos';

export interface ContenidoFrame {
  readonly frasco: Caja;
  readonly tipo: 'arena' | 'agua';
  readonly volumenArriba: number;
  readonly volumenAbajo: number;
  readonly anguloAgua: number;
  readonly arena: CanvasImageSource | null;
  readonly mascara: CanvasImageSource | null;
  readonly sim: SandSimulation | null;
  readonly chorro: StreamParticles | null;
  readonly lut: Uint8ClampedArray | null;
  readonly llueve: boolean;
  readonly tinte: string;
  readonly direccion: number;
  readonly brillo: number;
  readonly fuerzaTinte: number;
}

let hoja: HTMLCanvasElement | null = null;
let hojaCtx: CanvasRenderingContext2D | null = null;
let copia: HTMLCanvasElement | null = null;
let copiaCtx: CanvasRenderingContext2D | null = null;
let laminaRevision = -1;
let laminaW = 0;
let laminaH = 0;
let laminaMascara: CanvasImageSource | null = null;

function placa(w: number, h: number): CanvasRenderingContext2D | null {
  const width = Math.max(2, Math.round(w));
  const height = Math.max(2, Math.round(h));
  if (!hoja || hoja.width !== width || hoja.height !== height) {
    hoja = document.createElement('canvas');
    hoja.width = width;
    hoja.height = height;
    hojaCtx = hoja.getContext('2d');
  }
  if (!hojaCtx) return null;
  hojaCtx.setTransform(1, 0, 0, 1, 0, 0);
  hojaCtx.globalAlpha = 1;
  hojaCtx.globalCompositeOperation = 'source-over';
  hojaCtx.clearRect(0, 0, width, height);
  return hojaCtx;
}

/** Arena recortada a la máscara. El agua se pinta aparte, en el mundo. */
export function dibujarContenido(ctx: CanvasRenderingContext2D, frame: ContenidoFrame): void {
  const { w, h } = frame.frasco;
  // El lienzo intermedio va a la resolución del dispositivo. Si no, los granos
  // se estiran al pintar y en el móvil se ven bloques.
  const escala = Math.max(1, ctx.getTransform().a || 1);
  const pw = Math.max(2, Math.round(w * escala));
  const ph = Math.max(2, Math.round(h * escala));
  if (!(frame.tipo === 'arena' && frame.arena && frame.sim)) return;
  const revision = revisionSello();
  const misma =
    hoja !== null &&
    hoja.width === pw &&
    hoja.height === ph &&
    revision === laminaRevision &&
    pw === laminaW &&
    ph === laminaH &&
    frame.mascara === laminaMascara;
  if (!misma) {
    const g = placa(pw, ph);
    if (!g || !hoja) return;
    g.imageSmoothingEnabled = true;
    g.drawImage(frame.arena, 0, 0, pw, ph);
    // El perfil queda dentro de la máscara en el hombro. Se desplaza la arena
    // ya escalada y la máscara recorta. El cuello de la máscara está vacío.
    if (!copia || copia.width !== pw || copia.height !== ph) {
      copia = document.createElement('canvas');
      copia.width = pw;
      copia.height = ph;
      copiaCtx = copia.getContext('2d');
    }
    if (copia && copiaCtx && hoja) {
      copiaCtx.setTransform(1, 0, 0, 1, 0, 0);
      copiaCtx.clearRect(0, 0, pw, ph);
      copiaCtx.drawImage(hoja, 0, 0);
      const avance = Math.max(1, Math.round(pw * (48 / 446)));
      g.drawImage(copia, avance, 0);
      g.drawImage(copia, -avance, 0);
    }
    if (frame.mascara) {
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(frame.mascara, 0, 0, pw, ph);
    }
    laminaRevision = revision;
    laminaW = pw;
    laminaH = ph;
    laminaMascara = frame.mascara;
  }
  if (!hoja) return;
  ctx.drawImage(hoja, frame.frasco.x, frame.frasco.y, w, h);
}
