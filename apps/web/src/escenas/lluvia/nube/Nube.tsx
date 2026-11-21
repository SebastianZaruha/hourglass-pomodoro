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
  useOpacidad(raiz, opacidad);
  useEffect(() => {
    const tela = lienzo.current;
    if (!tela) return;
    if (soloFoto) return pintarPoster(tela, POSTER);
    const a = videoA.current;
    const b = videoB.current;
    if (!a || !b) return pintarPoster(tela, POSTER);
    return engancharBucle(a, b, tela);
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
          <video ref={videoA} className="nube-fuente" muted playsInline preload="auto" poster={POSTER}>
            <source src={WEBM} type="video/webm" />
            <source src={MP4} type="video/mp4" />
          </video>
          <video ref={videoB} className="nube-fuente" muted playsInline preload="auto">
            <source src={WEBM} type="video/webm" />
            <source src={MP4} type="video/mp4" />
          </video>
        </>
      )}
    </div>
  );
}

function useOpacidad(raiz: RefObject<HTMLDivElement | null>, opacidad: RefObject<number>) {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let raf = 0;
    el.style.transition = 'opacity 620ms var(--suave)';
    const cuadro = () => {
      const valor = opacidad.current ?? 1;
      el.style.opacity = String(Math.max(0, Math.min(1, valor)));
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [opacidad, raiz]);
}
