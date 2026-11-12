import type { SandSimulation, StreamParticles } from '@reloj/core';

import type { Caja } from '../layout/calcularLayout';
import { JAR_NECK_Y } from './jarTabla';
import { lineaMenisco, poligonoLiquido } from './fisica/agua';
import { vectorLuz } from './alpha';
import { dibujarChorro } from './granos';

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
    g.imageSmoothingEnabled = false;
    g.drawImage(frame.arena, 0, 0, w, h);
    if (frame.chorro && frame.lut) {
      dibujarChorro(g, frame.sim, frame.chorro, frame.lut, w, h, {
        tinte: frame.tinte,
        fuerzaTinte: frame.fuerzaTinte,
        brillo: frame.brillo,
        direccion: frame.direccion,
      });
    }
  } else if (frame.tipo === 'agua') {
    for (const bulbo of ['arriba', 'abajo'] as const) {
      const volumen = bulbo === 'arriba' ? frame.volumenArriba : frame.volumenAbajo;
      if (volumen <= 0.001) continue;
      const figura = poligonoLiquido(bulbo, volumen, frame.anguloAgua);
      g.save();
      recortar(g, figura, w, h);
      aguaEnVidrio(g, figura, w, h, frame.tinte, frame.direccion, frame.brillo);
      g.restore();
      menisco(g, lineaMenisco(bulbo, volumen, frame.anguloAgua), w, h);
    }
    if (frame.llueve) lluvia(g, w, h);
  }
  if (frame.mascara) {
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(frame.mascara, 0, 0, w, h);
  }
  ctx.drawImage(hoja, frame.frasco.x, frame.frasco.y, w, h);
}

/**
 * Agua casi transparente: se ve el fondo, un poco más oscuro hacia abajo,
 * con un reflejo suave del lado de la luz. Sin textura de cáusticas.
 */
function aguaEnVidrio(
  ctx: CanvasRenderingContext2D,
  figura: readonly { x: number; y: number }[],
  w: number,
  h: number,
  tinte: string,
  direccion: number,
  brillo: number,
): void {
  let arriba = 1;
  let abajo = 0;
  for (const punto of figura) {
    if (punto.y < arriba) arriba = punto.y;
    if (punto.y > abajo) abajo = punto.y;
  }
  const grad = ctx.createLinearGradient(0, arriba * h, 0, Math.max(abajo * h, arriba * h + 8));
  grad.addColorStop(0, 'rgba(255,255,255,0.2)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1, 'rgba(6, 14, 20, 0.34)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = tinte;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const dir = vectorLuz(direccion);
  const hx = w * (0.5 + dir.x * 0.28);
  const hy = arriba * h + h * 0.025;
  const radio = w * 0.14;
  const foco = ctx.createRadialGradient(hx, hy, 1, hx, hy, radio);
  foco.addColorStop(0, 'rgba(255,255,255,0.7)');
  foco.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.16 + 0.22 * Math.min(1.1, Math.max(0, brillo));
  ctx.fillStyle = foco;
  ctx.fillRect(hx - radio, hy - radio * 0.6, radio * 2, radio * 1.4);
  ctx.restore();
}

function menisco(
  ctx: CanvasRenderingContext2D,
  linea: readonly { x: number; y: number }[],
  w: number,
  h: number,
): void {
  if (linea.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trazo = () => {
    ctx.beginPath();
    linea.forEach((punto, i) => {
      const x = punto.x * w;
      const y = punto.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  };
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(3.5, w * 0.012);
  trazo();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1.4, w * 0.0045);
  trazo();
  ctx.stroke();
  ctx.restore();
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
