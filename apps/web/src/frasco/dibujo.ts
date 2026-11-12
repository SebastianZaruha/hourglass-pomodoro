import type { SandSimulation, StreamParticles } from '@reloj/core';

import type { Caja } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';
import type { Activos } from './activos';
import { dibujarContenido } from './contenido';
import { aplicarLuz } from './luzAplicar';
import { dibujarSombra } from './luz';
import { dibujarNube, actualizarNube } from './nube';

export interface OrdenDibujo {
  readonly frasco: Caja;
  readonly nube: Caja;
  readonly luz: Luz;
  readonly tipo: 'arena' | 'agua';
  readonly angulo: number;
  readonly anguloAgua: number;
  readonly volumenArriba: number;
  readonly volumenAbajo: number;
  readonly mostrarNube: boolean;
  readonly reducir: boolean;
  readonly llueve: boolean;
  readonly sim: SandSimulation | null;
  readonly chorro: StreamParticles | null;
  readonly lut: Uint8ClampedArray | null;
  readonly arena: HTMLCanvasElement | null;
}

/** Pinta sombra, vidrio, contenido y nube. Los colores salen de `luz`. */
export function dibujar(ctx: CanvasRenderingContext2D, orden: OrdenDibujo, activos: Activos): void {
  const viewW = ctx.canvas.clientWidth;
  const viewH = ctx.canvas.clientHeight;
  ctx.clearRect(0, 0, viewW, viewH);
  dibujarSombra(ctx, orden.frasco, orden.luz, orden.angulo, activos.sombra);

  const { x, y, w, h } = orden.frasco;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(orden.angulo);
  ctx.translate(-cx, -cy);

  if (activos.dorso) ctx.drawImage(activos.dorso, x, y, w, h);
  else vidrioDeReserva(ctx, orden.frasco, orden.luz.tinte);

  dibujarContenido(ctx, {
    frasco: orden.frasco,
    tipo: orden.tipo,
    volumenArriba: orden.volumenArriba,
    volumenAbajo: orden.volumenAbajo,
    anguloAgua: orden.anguloAgua,
    arena: orden.arena,
    texturaAgua: activos.agua,
    mascara: activos.mascara,
    sim: orden.sim,
    chorro: orden.chorro,
    lut: orden.lut,
    llueve: orden.llueve,
  });

  aplicarLuz(ctx, orden.frasco, orden.luz, activos.frente, activos.dorso);
  ctx.restore();

  if (orden.mostrarNube) {
    const fuente = actualizarNube(orden.reducir ? null : activos.nubeVideo, activos.nubePoster);
    dibujarNube(ctx, orden.nube, fuente, orden.angulo, orden.luz.nube);
  }
}

/** Si las fotos no llegan, un vidrio relleno. Nunca el frasco de líneas viejo. */
function vidrioDeReserva(ctx: CanvasRenderingContext2D, frasco: Caja, tinte: string): void {
  const { x, y, w, h } = frasco;
  ctx.save();
  ctx.fillStyle = tinte;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.24, w * 0.42, h * 0.22, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w / 2, y + h * 0.74, w * 0.42, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
