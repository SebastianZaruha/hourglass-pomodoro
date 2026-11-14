import { useLayoutEffect, useState, type RefObject } from 'react';

import { layoutFor } from '../frasco';
import type { Caja } from './encuadre';

/**
 * Posición de maquetación, sin el traslado de la intro. Así el suelo
 * no se mueve mientras el frasco entra, y acaba apoyado en él.
 */
function origenDe(el: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  const visto = new Set<HTMLElement>();
  while (node && !visto.has(node)) {
    visto.add(node);
    x += node.offsetLeft;
    y += node.offsetTop;
    const padre: Element | null = node.offsetParent;
    node = padre instanceof HTMLElement ? padre : null;
  }
  return { x, y };
}

/**
 * La caja del frasco en px de la ventana. Es la de `layoutFor` sobre el
 * lienzo de Frasco: el 0,978 de su alto cae en la base del vidrio.
 */
export function useCajaFrasco(stageRef: RefObject<HTMLElement | null>): Caja | null {
  const [caja, setCaja] = useState<Caja | null>(null);
  useLayoutEffect(() => {
    const medir = () => {
      const canvas = stageRef.current?.querySelector('.glass-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const ancho = canvas.clientWidth;
      const alto = canvas.clientHeight;
      if (ancho < 2 || alto < 2) return;
      const origen = origenDe(canvas);
      const layout = layoutFor(ancho, alto);
      const siguiente = {
        x: Math.round(origen.x + layout.cx - layout.halfW),
        y: Math.round(origen.y + layout.cy - layout.halfH),
        w: Math.round(layout.halfW * 2),
        h: Math.round(layout.halfH * 2),
      };
      setCaja((prev) =>
        prev &&
        prev.x === siguiente.x &&
        prev.y === siguiente.y &&
        prev.w === siguiente.w &&
        prev.h === siguiente.h
          ? prev
          : siguiente,
      );
    };
    medir();
    const stage = stageRef.current;
    const canvas = stage?.querySelector('.glass-canvas');
    const obs = new ResizeObserver(medir);
    if (canvas) obs.observe(canvas);
    if (stage) obs.observe(stage);
    const app = stage?.closest('.app');
    const mut = new MutationObserver(medir);
    if (app) mut.observe(app, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', medir);
    return () => {
      obs.disconnect();
      mut.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [stageRef]);
  return caja;
}
