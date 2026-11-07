/**
 * Césped detrás del frasco y briznas delante.
 *
 * Las dos fotos comparten el recorte: el punto de apoyo del JSON cae en el
 * pie del vidrio. Las briznas no reciben el ratón.
 */
import { coverFrame, groundContact, type MaterialId } from '@reloj/core';
import { useEffect, type RefObject } from 'react';

import type { HourglassHandle } from '../hourglass/useEngine';

const SCENE: Record<MaterialId, string> = {
  arena: '/backgrounds/scene-arena.webp',
  lluvia: '/backgrounds/scene-lluvia.webp',
  miel: '/backgrounds/scene-miel.webp',
  nieve: '/backgrounds/scene-nieve.webp',
};

const BLADES: Record<MaterialId, string> = {
  arena: '/backgrounds/blades-arena.webp',
  lluvia: '/backgrounds/blades-lluvia.webp',
  miel: '/backgrounds/blades-miel.webp',
  nieve: '/backgrounds/blades-nieve.webp',
};

interface Props {
  readonly id: MaterialId;
  readonly layoutRef: RefObject<HourglassHandle | null>;
}

export function ScenePlate({ id, layoutRef }: Props) {
  useEffect(() => {
    const app = document.querySelector('.app');
    const blades = document.querySelector<HTMLImageElement>('.blades');
    const scene = new Image();
    scene.src = SCENE[id];
    let alive = true;

    const place = () => {
      if (!alive || !scene.naturalWidth || !app) return;
      const canvas = document.querySelector('.glass-canvas');
      const box = layoutRef.current?.layoutCss();
      if (!canvas || !box) return;
      const rect = canvas.getBoundingClientRect();
      const contact = groundContact(id, true);
      const frame = coverFrame(
        window.innerWidth,
        window.innerHeight,
        scene.naturalWidth,
        scene.naturalHeight,
        rect.left + box.cx,
        rect.top + box.cy + box.halfH,
        contact.x,
        contact.y,
      );
      const root = document.documentElement;
      root.style.setProperty('--scene-image', `url("${SCENE[id]}")`);
      root.style.setProperty('--scene-size', `${frame.w}px ${frame.h}px`);
      root.style.setProperty('--scene-pos', `${frame.x}px ${frame.y}px`);
      if (blades) {
        blades.src = BLADES[id];
        blades.style.left = `${frame.x}px`;
        blades.style.top = `${frame.y}px`;
        blades.style.width = `${frame.w}px`;
        blades.style.height = `${frame.h}px`;
      }
    };

    scene.onload = place;
    const canvas = document.querySelector('.glass-canvas');
    const observer = new ResizeObserver(place);
    if (canvas) observer.observe(canvas);
    window.addEventListener('resize', place);
    const kick = window.setTimeout(place, 600);
    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.clearTimeout(kick);
      document.documentElement.style.removeProperty('--scene-image');
    };
  }, [id, layoutRef]);

  return <img className="blades" alt="" src={BLADES[id]} />;
}
