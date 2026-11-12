import type { SandSimulation, StreamParticles } from '@reloj/core';

import type { Caja } from '../layout/calcularLayout';
import { JAR_NECK_Y } from './jarTabla';
import { poligonoLiquido } from './fisica/agua';
import { dibujarChorro } from './granos';

export interface ContenidoFrame {
  readonly frasco: Caja;
  readonly tipo: 'arena' | 'agua';
  readonly volumenArriba: number;
  readonly volumenAbajo: number;
  readonly anguloAgua: number;
  readonly arena: CanvasImageSource | null;
  readonly texturaAgua: CanvasImageSource | null;
  readonly mascara: CanvasImageSource | null;
  readonly sim: SandSimulation | null;
  readonly chorro: StreamParticles | null;
  readonly lut: Uint8ClampedArray | null;
  readonly llueve: boolean;
}

let hoja: HTMLCanvasElement | null = null;
let hojaCtx: CanvasRenderingContext2D | null = null;

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

function recortar(
  ctx: CanvasRenderingContext2D,
  puntos: readonly { x: number; y: number }[],
  w: number,
  h: number,
) {
  ctx.beginPath();
  puntos.forEach((punto, i) => {
    const x = punto.x * w;
    const y = punto.y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
}

/** Arena o agua, recortadas a la máscara del frasco. El nivel ya viene calculado. */
export function dibujarContenido(ctx: CanvasRenderingContext2D, frame: ContenidoFrame): void {
  const { w, h } = frame.frasco;
  const g = placa(w, h);
  if (!g || !hoja) return;
  if (frame.tipo === 'arena' && frame.arena && frame.sim) {
    g.imageSmoothingEnabled = true;
    g.drawImage(frame.arena, 0, 0, w, h);
    if (frame.chorro && frame.lut) dibujarChorro(g, frame.sim, frame.chorro, frame.lut, w, h);
  } else if (frame.tipo === 'agua' && frame.texturaAgua) {
    for (const bulbo of ['arriba', 'abajo'] as const) {
      const volumen = bulbo === 'arriba' ? frame.volumenArriba : frame.volumenAbajo;
      if (volumen <= 0.001) continue;
      g.save();
      recortar(g, poligonoLiquido(bulbo, volumen, frame.anguloAgua), w, h);
      g.drawImage(frame.texturaAgua, 0, 0, w, h);
      g.restore();
    }
    if (frame.llueve) lluvia(g, w, h);
  }
  if (frame.mascara) {
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(frame.mascara, 0, 0, w, h);
  }
  ctx.drawImage(hoja, frame.frasco.x, frame.frasco.y, w, h);
}

function lluvia(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cuello = JAR_NECK_Y * h;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  const ahora = performance.now() / 1000;
  for (let i = 0; i < 7; i++) {
    const x = w * (0.46 + (i % 5) * 0.02);
    const t = (ahora * (2.4 + i * 0.17) + i * 0.13) % 1;
    const y0 = cuello - h * 0.02 + t * h * 0.16;
    ctx.globalAlpha = 0.18 + (i % 3) * 0.05;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + 0.4, y0 + h * 0.045);
    ctx.stroke();
  }
  ctx.restore();
}
