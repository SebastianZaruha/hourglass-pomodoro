import type { SandSimulation, StreamParticles } from '@reloj/core';

import { VIDRIO_NEUTRO } from '../estilo/tokens';
import type { Caja } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';
import type { Activos } from './activos';
import { dibujarContenido } from './contenido';
import type { Geometria } from './geometria';
import { aplicarLuz } from './luzAplicar';
import { pintarAgua } from './pintarAgua';
import { dibujarSombra } from './luz';
import { dibujarNube, actualizarNube } from './nube';

export interface OrdenDibujo {
  readonly frasco: Caja;
  readonly nube: Caja;
  readonly luz: Luz;
  readonly tipo: 'arena' | 'agua';
  readonly angulo: number;
  readonly anguloAgua: number;
  readonly phi: number;
  readonly volumenArriba: number;
  readonly volumenAbajo: number;
  readonly oscuro: boolean;
  readonly dt: number;
  readonly geo: Geometria | null;
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
  dibujarSombra(ctx, orden.frasco, orden.luz, orden.angulo);

  const { x, y, w, h } = orden.frasco;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(orden.angulo);
  ctx.translate(-cx, -cy);

  if (activos.dorso) ctx.drawImage(activos.dorso, x, y, w, h);
  else if (activos.mascara) dibujarSilueta(ctx, orden.frasco, activos.mascara);

  if (orden.tipo === 'arena') {
    dibujarContenido(ctx, {
      frasco: orden.frasco,
      tipo: orden.tipo,
      volumenArriba: orden.volumenArriba,
      volumenAbajo: orden.volumenAbajo,
      anguloAgua: orden.anguloAgua,
      arena: orden.arena,
      mascara: activos.mascara,
      sim: orden.sim,
      chorro: orden.chorro,
      lut: orden.lut,
      llueve: orden.llueve,
      tinte: orden.luz.tinte,
      direccion: orden.luz.direccion,
      brillo: orden.luz.brillo,
      fuerzaTinte: orden.luz.fuerzaTinte,
    });
  }
  ctx.restore();

  if (orden.tipo === 'agua' && orden.geo) {
    pintarAgua(ctx, {
      frasco: orden.frasco,
      geo: orden.geo,
      angulo: orden.angulo,
      phi: orden.phi,
      fraccionArriba: orden.volumenArriba,
      fraccionAbajo: orden.volumenAbajo,
      oscuro: orden.oscuro,
      llueve: orden.llueve,
      dt: orden.dt,
      mascara: activos.mascara,
    });
  }

  aplicarLuz(ctx, orden.frasco, orden.luz, orden.angulo, activos.frente, activos.dorso);

  if (orden.mostrarNube) {
    const fuente = actualizarNube(orden.reducir ? null : activos.nubeVideo, activos.nubePoster);
    dibujarNube(ctx, orden.nube, fuente, orden.angulo, orden.luz.nube);
  }
}

let silueta: HTMLCanvasElement | null = null;

/** La máscara real, con un vidrio neutro, hasta que llega la foto. */
function dibujarSilueta(ctx: CanvasRenderingContext2D, frasco: Caja, mascara: CanvasImageSource): void {
  const w = Math.max(2, Math.round(frasco.w));
  const h = Math.max(2, Math.round(frasco.h));
  if (!silueta || silueta.width !== w || silueta.height !== h) {
    silueta = document.createElement('canvas');
    silueta.width = w;
    silueta.height = h;
  }
  const g = silueta.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.fillStyle = VIDRIO_NEUTRO;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mascara, 0, 0, w, h);
  ctx.drawImage(silueta, frasco.x, frasco.y, frasco.w, frasco.h);
}
