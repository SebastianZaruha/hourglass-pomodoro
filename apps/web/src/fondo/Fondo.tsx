import { useEffect, useRef, useState } from 'react';

import { encuadreFondo } from './encuadre';
import { colorDeFondo } from '../medios/assetLoader';
import type { FondoTema, ModoTema } from '../temas/tipos';

interface Props {
  readonly modo: ModoTema;
  readonly ancla: { readonly x: number; readonly y: number };
  readonly ancho: number;
  readonly alto: number;
  readonly pie: { readonly x: number; readonly y: number };
  readonly reducir: boolean;
  readonly ahorro: boolean;
  readonly estrecho: boolean;
}

/**
 * El color del tema se ve al instante. La foto o el vídeo del modo activo
 * llegan después; el resto lo pide `assetLoader` cuando el navegador está libre.
 */
export function Fondo({ modo, ancla, ancho, alto, pie, reducir, ahorro, estrecho }: Props) {
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

  const base = { background: colorDeFondo(fondo) };

  if (fondo.tipo === 'degradado') return <div className="fondo degradado" style={base} />;

  const marco = encuadreFondo(
    ancho,
    alto,
    fondo.tipo === 'foto' ? (fondo.ancho ?? 1792) : 1920,
    fondo.tipo === 'foto' ? (fondo.alto ?? 1008) : 1080,
    ancla,
    pie,
  );
  const estilo = { left: marco.x, top: marco.y, width: marco.w, height: marco.h };

  if (fondo.tipo === 'foto') return <Foto fondo={fondo} estilo={estilo} base={base} estrecho={estrecho} />;

  const video = !reducir && !ahorro && !fallo;
  return (
    <div className="fondo" style={base}>
      <img src={fondo.poster} alt="" style={estilo} />
      {video ? (
        <video
          ref={videoRef}
          style={{ ...estilo, opacity: listo ? 1 : 0 }}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
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

function Foto({
  fondo,
  estilo,
  base,
  estrecho,
}: {
  readonly fondo: Extract<FondoTema, { tipo: 'foto' }>;
  readonly estilo: { left: number; top: number; width: number; height: number };
  readonly base: { background: string };
  readonly estrecho: boolean;
}) {
  const chica = estrecho ? fondo.estrecho : undefined;
  return (
    <picture className="fondo" style={base}>
      {chica?.avif ? <source media="(max-width: 700px)" srcSet={chica.avif} type="image/avif" /> : null}
      {chica ? <source media="(max-width: 700px)" srcSet={chica.webp} type="image/webp" /> : null}
      {fondo.avif ? <source srcSet={fondo.avif} type="image/avif" /> : null}
      {fondo.jpg ? <source srcSet={fondo.src} type="image/webp" /> : null}
      <img src={fondo.jpg ?? fondo.src} alt="" style={estilo} />
    </picture>
  );
}
