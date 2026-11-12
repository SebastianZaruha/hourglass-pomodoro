import { useEffect, useRef, useState } from 'react';

import { encuadreFondo } from './encuadre';
import type { ModoTema } from '../temas/tipos';

interface Props {
  readonly modo: ModoTema;
  readonly ancla: { readonly x: number; readonly y: number };
  readonly ancho: number;
  readonly alto: number;
  readonly pie: { readonly x: number; readonly y: number };
  readonly reducir: boolean;
  readonly ahorro: boolean;
}

/**
 * Foto, vídeo con póster, o el degradado de Clásico.
 * El vídeo se pausa con la pestaña oculta y no arranca si piden
 * menos movimiento o ahorro de datos.
 */
export function Fondo({ modo, ancla, ancho, alto, pie, reducir, ahorro }: Props) {
  const fondo = modo.fondo;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fallo, setFallo] = useState(false);
  const [listo, setListo] = useState(false);

  const clave = fondo.tipo === 'degradado' ? 'degradado' : fondo.tipo === 'foto' ? fondo.src : fondo.webm;

  useEffect(() => {
    setFallo(false);
    setListo(false);
  }, [clave]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const alVer = () => {
      if (document.hidden) video.pause();
      else void video.play().catch(() => setFallo(true));
    };
    document.addEventListener('visibilitychange', alVer);
    return () => document.removeEventListener('visibilitychange', alVer);
  }, [clave]);

  if (fondo.tipo === 'degradado') return <div className="fondo degradado" />;

  const marco =
    fondo.tipo === 'foto'
      ? encuadreFondo(ancho, alto, 1792, 1008, ancla, pie)
      : encuadreFondo(ancho, alto, 1920, 1080, ancla, pie);
  const estilo = { left: marco.x, top: marco.y, width: marco.w, height: marco.h };

  if (fondo.tipo === 'foto') {
    return (
      <picture className="fondo">
        {fondo.avif ? <source srcSet={fondo.avif} type="image/avif" /> : null}
        <img src={fondo.src} alt="" style={estilo} />
      </picture>
    );
  }

  const video = !reducir && !ahorro && !fallo;
  return (
    <div className="fondo">
      <img src={fondo.poster} alt="" style={estilo} />
      {video ? (
        <video
          ref={videoRef}
          style={{ ...estilo, opacity: listo ? 1 : 0 }}
          muted
          loop
          playsInline
          autoPlay
          poster={fondo.poster}
          onPlaying={() => setListo(true)}
          onError={() => setFallo(true)}
        >
          <source src={fondo.webm} type="video/webm" />
          <source src={fondo.mp4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
