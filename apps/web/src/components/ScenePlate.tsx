/**
 * Césped detrás del frasco y briznas delante, solo en la columna del reloj.
 *
 * El recorte es el del lienzo, no el de toda la ventana: si no, un apoyo
 * descentrado (la lluvia horizontal) agranda la foto hasta sacar el suelo.
 * Las dos capas usan el mismo recorte. Las briznas no reciben el ratón.
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
    const scene = new Image();
    scene.src = SCENE[id];
    let alive = true;

    const place = () => {
      if (!alive || !scene.naturalWidth) return;
      const canvas = document.querySelector('.glass-canvas');
      const photo = document.querySelector<HTMLImageElement>('.scene-photo');
      const blades = document.querySelector<HTMLImageElement>('.blades');
      const box = layoutRef.current?.layoutCss();
      if (!canvas || !photo || !blades || !box) return;
      const rect = canvas.getBoundingClientRect();
      const contact = groundContact(id, true);
      const frame = coverFrame(
        rect.width,
        rect.height,
        scene.naturalWidth,
        scene.naturalHeight,
        box.cx,
        box.cy + box.halfH,
        contact.x,
        contact.y,
      );
      const left = `${rect.left + frame.x}px`;
      const top = `${rect.top + frame.y}px`;
      const width = `${frame.w}px`;
      const height = `${frame.h}px`;
      for (const img of [photo, blades]) {
        img.style.left = left;
        img.style.top = top;
        img.style.width = width;
        img.style.height = height;
      }
      blades.src = BLADES[id];
    };

    scene.onload = place;
    const canvas = document.querySelector('.glass-canvas');
    const observer = new ResizeObserver(place);
    if (canvas) observer.observe(canvas);
    window.addEventListener('resize', place);
    let tries = 0;
    const kick = window.setInterval(() => {
      place();
      tries += 1;
      if (tries > 15) window.clearInterval(kick);
    }, 200);
    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.clearInterval(kick);
    };
  }, [id, layoutRef]);

  return (
    <>
      <img className="scene-photo" alt="" src={SCENE[id]} />
      <img className="blades" alt="" src={BLADES[id]} />
    </>
  );
}
