/**
 * Escena y briznas a pantalla completa, en el mismo recorte que el frasco.
 * El pie del sprite cae en el contacto de la foto. Las briznas quedan delante.
 */
import { dioramaPlacement, type MaterialId } from '@reloj/core';
import { useEffect, type RefObject } from 'react';

import type { HourglassHandle } from '../hourglass/useEngine';
import { preloadJar } from '../hourglass/photoreal';

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

export function ScenePlate({ id }: Props) {
  useEffect(() => {
    preloadJar(id);
    const scene = new Image();
    scene.src = SCENE[id];
    let alive = true;

    const place = () => {
      if (!alive || !scene.naturalWidth) return;
      const photo = document.querySelector<HTMLImageElement>('.scene-photo');
      const blades = document.querySelector<HTMLImageElement>('.blades');
      if (!photo || !blades) return;
      const viewW = document.documentElement.clientWidth;
      const viewH = document.documentElement.clientHeight;
      const frame = dioramaPlacement(viewW, viewH, scene.naturalWidth, scene.naturalHeight, id, true).scene;
      const left = `${frame.x}px`;
      const top = `${frame.y}px`;
      const width = `${frame.w}px`;
      const height = `${frame.h}px`;
      for (const img of [photo, blades]) {
        img.style.left = left;
        img.style.top = top;
        img.style.width = width;
        img.style.height = height;
      }
      if (blades.getAttribute('src') !== BLADES[id]) blades.src = BLADES[id];
    };

    scene.onload = place;
    const observer = new ResizeObserver(place);
    observer.observe(document.documentElement);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    let tries = 0;
    const kick = window.setInterval(() => {
      place();
      tries += 1;
      if (tries > 20) window.clearInterval(kick);
    }, 150);
    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.clearInterval(kick);
    };
  }, [id]);

  return (
    <>
      <img className="scene-photo" alt="" src={SCENE[id]} />
      <img className="blades" alt="" src={BLADES[id]} />
    </>
  );
}
