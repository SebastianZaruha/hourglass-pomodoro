import { useEffect, useRef, type RefObject } from 'react';

import { ahorraDatos } from '../../../comun/fondo';
import type { PropsEncima } from '../../../comun/frasco';
import { engancharBucle } from './bucle';
import './nube.css';

const FORMA = 438 / 1100;
const POSTER = '/nube/nube.webp';
const WEBM = '/nube/nube.webm';
const MP4 = '/nube/nube.mp4';

/**
 * Tapa la boca del frasco. El ángulo no llega aquí: solo un número de opacidad.
 * -1 es el doble clic: se apaga en el acto y vuelve en 360 ms.
 * El resto sigue la curva (1 a 0° y 0 a 50°) con un fundido de 620 ms.
 */
export function Nube({ caja, opacidad, reducir, oscuro }: PropsEncima) {
  const raiz = useRef<HTMLDivElement>(null);
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const soloFoto = reducir || ahorraDatos();
  useOpacidad(raiz, opacidad);
  useEffect(() => {
    if (soloFoto) return;
    const a = videoA.current;
    const b = videoB.current;
    if (!a || !b) return;
    return engancharBucle(a, b);
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
      <div className="nube-velo">
        {soloFoto ? (
          <img className="nube-foto" src={POSTER} alt="" />
        ) : (
          <>
            <video ref={videoA} className="nube-video" muted playsInline preload="auto" poster={POSTER}>
              <source src={WEBM} type="video/webm" />
              <source src={MP4} type="video/mp4" />
            </video>
            <video ref={videoB} className="nube-video" muted playsInline preload="auto" poster={POSTER}>
              <source src={WEBM} type="video/webm" />
              <source src={MP4} type="video/mp4" />
            </video>
          </>
        )}
      </div>
    </div>
  );
}

function useOpacidad(raiz: RefObject<HTMLDivElement | null>, opacidad: RefObject<number>) {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let raf = 0;
    let modo: 'seguir' | 'oculta' | 'vuelve' = 'seguir';
    let vuelveHasta = 0;
    el.style.transition = 'opacity 620ms var(--suave)';
    const cuadro = (ahora: number) => {
      const valor = opacidad.current ?? 1;
      if (valor < 0) {
        if (modo !== 'oculta') {
          el.style.transition = 'none';
          el.style.opacity = '0';
          modo = 'oculta';
        }
      } else if (modo === 'oculta') {
        el.style.transition = 'opacity 360ms var(--suave)';
        el.style.opacity = String(valor);
        modo = 'vuelve';
        vuelveHasta = ahora + 360;
      } else if (modo === 'vuelve' && ahora < vuelveHasta) {
        el.style.opacity = String(valor);
      } else {
        if (modo !== 'seguir') el.style.transition = 'opacity 620ms var(--suave)';
        modo = 'seguir';
        el.style.opacity = String(valor);
      }
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [opacidad, raiz]);
}
