import type { SandSimulation, StreamParticles } from '@reloj/core';

import { VIDRIO_CONTORNO, VIDRIO_NEUTRO } from '../estilo/tokens';
import type { Caja } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';
import type { Activos } from './activos';
import { dibujarContenido } from './contenido';
import { dibujarChorro } from './granos';
import type { Geometria } from './geometria';
import { aplicarLuz } from './luzAplicar';
import { pintarAgua, pintarGotasEncima, type AguaFrame } from './pintarAgua';
import { dibujarSombra } from './luz';

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
  /** 0 = silueta de la máscara, 1 = foto del vidrio. */
  readonly vidrio: number;
  /** La media vuelta pinta el contenido en el frasco, no quieto en el mundo. */
  readonly enElFrasco: boolean;
}

/** Pinta sombra, vidrio, contenido y nube. Los colores salen de `luz`. Devuelve si las gotas siguen en el aire. */
export function dibujar(ctx: CanvasRenderingContext2D, orden: OrdenDibujo, activos: Activos): boolean {
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

  if (activos.mascara && orden.vidrio < 1) dibujarSilueta(ctx, orden.frasco, activos.mascara);
  if (activos.dorso && orden.vidrio > 0) {
    ctx.save();
    ctx.globalAlpha = orden.vidrio;
    ctx.drawImage(activos.dorso, x, y, w, h);
    ctx.restore();
  }

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
    if (orden.sim && orden.chorro && orden.lut) {
      ctx.save();
      ctx.translate(x, y);
      dibujarChorro(ctx, orden.sim, orden.chorro, orden.lut, w, h);
      ctx.restore();
    }
  }
  ctx.restore();

  if (orden.tipo === 'agua' && orden.geo) {
    pintarAgua(
      ctx,
      cuadroAgua(orden, activos.mascara, orden.angulo, orden.enElFrasco ? -orden.angulo : orden.phi),
    );
  }

  if (activos.dorso && orden.vidrio > 0) {
    ctx.save();
    ctx.globalAlpha = orden.vidrio;
    aplicarLuz(ctx, orden.frasco, orden.luz, orden.angulo, activos.frente, activos.dorso, activos.mascara);
    ctx.restore();
  }

  let gotas = false;
  if (orden.tipo === 'agua' && orden.geo) {
    gotas = pintarGotasEncima(ctx, cuadroAgua(orden, activos.mascara, orden.angulo, orden.phi), orden.enElFrasco);
  }
  return gotas;
}

function cuadroAgua(
  orden: OrdenDibujo,
  mascara: HTMLCanvasElement | null,
  angulo: number,
  phi: number,
): AguaFrame {
  return {
    frasco: orden.frasco,
    geo: orden.geo as Geometria,
    angulo,
    phi,
    fraccionArriba: orden.volumenArriba,
    fraccionAbajo: orden.volumenAbajo,
    oscuro: orden.oscuro,
    llueve: orden.llueve,
    dt: orden.dt,
    mascara,
  };
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

  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.fillStyle = VIDRIO_CONTORNO;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.globalCompositeOperation = 'destination-in';
  const margen = 2.5;
  g.drawImage(mascara, -w / 2 - margen, -h / 2 - margen, w + margen * 2, h + margen * 2);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(mascara, -w / 2, -h / 2, w, h);
  g.restore();
  ctx.drawImage(silueta, frasco.x, frasco.y, frasco.w, frasco.h);
}
