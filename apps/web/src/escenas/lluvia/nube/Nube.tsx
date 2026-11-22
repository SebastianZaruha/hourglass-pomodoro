import { useEffect, useRef, type RefObject } from 'react';

import { ahorraDatos } from '../../../comun/fondo';
import type { PropsEncima } from '../../../comun/frasco';
import { engancharBucle, pintarPoster } from './bucle';
import './nube.css';

const FORMA = 438 / 1100;
const POSTER = '/nube/nube.webp';
const WEBM = '/nube/nube.webm';
const MP4 = '/nube/nube.mp4';

/**
 * Tapa la boca del frasco. El ángulo no llega aquí: solo un número de opacidad.
 * La curva es la de la inclinación (1 a 0° y 0 a 50°), también en la media
 * vuelta: 180° vuelve a contar como de pie, así el fundido regresa sin corte.
 */
export function Nube({ caja, opacidad, reducir, oscuro }: PropsEncima) {
  const raiz = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const soloFoto = reducir || ahorraDatos();
  useOpacidad(raiz, opacidad, reducir);
  useEffect(() => {
    const tela = lienzo.current;
    if (!tela) return;
    if (soloFoto) return pintarPoster(tela, POSTER);
    const a = videoA.current;
    const b = videoB.current;
    if (!a || !b) return pintarPoster(tela, POSTER);
    const subir = () => {
      b.preload = 'auto';
    };
    if (a.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) subir();
    else a.addEventListener('canplaythrough', subir, { once: true });
    const soltar = engancharBucle(a, b, tela);
    return () => {
      a.removeEventListener('canplaythrough', subir);
      soltar?.();
    };
  }, [soloFoto]);

  const ancho = caja.w * 1.5;
  const alto = ancho * FORMA;
  const left = Math.round(caja.x + caja.w / 2 - ancho / 2);
  const top = Math.round(caja.y - 0.28 * alto);

  return (
    <div
      ref={raiz}
      className={oscuro ? 'nube nube-oscura' : 'nube'}
      style={{ left, top, width: ancho, height: alto }}
      aria-hidden="true"
    >
      <canvas ref={lienzo} className="nube-lienzo" />
      {soloFoto ? null : (
        <>
          <video ref={videoA} className="nube-fuente" muted autoPlay playsInline preload="auto">
            <source src={MP4} type="video/mp4" />
            <source src={WEBM} type="video/webm" />
          </video>
          <video ref={videoB} className="nube-fuente" muted playsInline preload="metadata">
            <source src={MP4} type="video/mp4" />
            <source src={WEBM} type="video/webm" />
          </video>
        </>
      )}
    </div>
  );
}

/** Visible un rato, se apaga y vuelve. No depende del ángulo del frasco. */
function cicloNube(ahora: number): number {
  const u = (ahora % 26000) / 26000;
  const suave = (t: number) => t * t * (3 - 2 * t);
  if (u < 0.42) return 1;
  if (u < 0.58) return 1 - suave((u - 0.42) / 0.16);
  if (u < 0.74) return 0;
  return suave((u - 0.74) / 0.26);
}

function useOpacidad(raiz: RefObject<HTMLDivElement | null>, opacidad: RefObject<number>, reducir: boolean) {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let raf = 0;
    el.style.transition = 'opacity 620ms var(--suave)';
    const cuadro = (ahora: number) => {
      const valor = opacidad.current ?? 1;
      const ciclo = reducir ? 1 : cicloNube(ahora);
      el.style.opacity = String(Math.max(0, Math.min(1, valor * ciclo)));
      if (!reducir) {
        const t = ahora / 1000;
        const x = Math.sin(t * 0.07) * 8;
        const y = Math.cos(t * 0.05) * 5;
        el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [opacidad, raiz, reducir]);
}
