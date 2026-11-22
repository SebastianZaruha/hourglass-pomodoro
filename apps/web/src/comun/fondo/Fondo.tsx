import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

import type { Aspecto } from '../frasco';
import { yBaseBulbo, yBaseOpaca } from './caja';
import { encuadreFondo, type Ancla, type Caja } from './encuadre';
import { ahorraDatos } from './precarga';
import { engancharFundido, engancharReproduccion, fuenteDeVideo } from './reproducir';
import './fondo.css';

/** El degradado estrecho publicado. El ancho vive en el aspecto. */
const DEGRADADO_ESTRECHO =
  'radial-gradient(70% 48% at 50% 32%, var(--glow), transparent 72%), linear-gradient(180deg, var(--bg-top), var(--bg-bottom))';

/** Las fotos de Arena son 16:9. Sirve hasta que llega el tamaño real. */
const FORMA = { w: 1792, h: 1008 };

const medidas = new Map<string, { w: number; h: number }>();

interface Props {
  readonly aspecto: Aspecto;
  readonly caja: Caja | null;
  readonly reducir: boolean;
  /** Rejilla estrecha: el degradado publicado cambia de sitio. */
  readonly angosta: boolean;
}

interface Capa {
  readonly id: number;
  readonly aspecto: Aspecto;
  readonly visible: boolean;
}

interface Vista {
  readonly ancho: number;
  readonly alto: number;
  readonly izquierda: number;
  readonly arriba: number;
  readonly estrecho: boolean;
}

/** La duna solo existe en Arena. El resto apoya en el borde del archivo. */
function esArena(aspecto: Aspecto): boolean {
  const fondo = aspecto.fondo;
  if (fondo.tipo === 'foto') return fondo.webp.includes('/arena-');
  if (fondo.tipo === 'video') return fondo.poster.includes('/arena-');
  return false;
}

function claveDe(aspecto: Aspecto): string {
  const fondo = aspecto.fondo;
  if (fondo.tipo === 'degradado') return `degradado:${fondo.css}`;
  if (fondo.tipo === 'foto') return `foto:${fondo.avif ?? fondo.webp}:${fondo.jpg ?? ''}:${fondo.estrecho?.avif ?? fondo.estrecho?.webp ?? ''}`;
  return `video:${fondo.webm}`;
}

function useVista(pilaRef: RefObject<HTMLDivElement | null>): Vista {
  const [vista, setVista] = useState<Vista>({ ancho: 0, alto: 0, izquierda: 0, arriba: 0, estrecho: false });
  useLayoutEffect(() => {
    const el = pilaRef.current;
    if (!el) return;
    const medir = () => {
      const rect = el.getBoundingClientRect();
      const siguiente = {
        ancho: Math.round(rect.width),
        alto: Math.round(rect.height),
        izquierda: Math.round(rect.left),
        arriba: Math.round(rect.top),
        estrecho: window.innerWidth < 736,
      };
      setVista((prev) =>
        prev.ancho === siguiente.ancho &&
        prev.alto === siguiente.alto &&
        prev.izquierda === siguiente.izquierda &&
        prev.arriba === siguiente.arriba &&
        prev.estrecho === siguiente.estrecho
          ? prev
          : siguiente,
      );
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [pilaRef]);
  return vista;
}

function useMedida(src: string): { w: number; h: number } {
  const [medida, setMedida] = useState(() => medidas.get(src) ?? FORMA);
  useEffect(() => {
    const conocida = medidas.get(src);
    if (conocida) {
      setMedida(conocida);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const siguiente = { w: img.naturalWidth, h: img.naturalHeight };
      if (siguiente.w < 1 || siguiente.h < 1) return;
      medidas.set(src, siguiente);
      setMedida(siguiente);
    };
    img.src = src;
  }, [src]);
  return medida;
}

function marcoDe(
  ancho: number,
  alto: number,
  imgW: number,
  imgH: number,
  ancla: Ancla,
  pie: { readonly x: number; readonly y: number } | null,
): CSSProperties | null {
  if (!pie || ancho < 2 || alto < 2) return null;
  const caja = encuadreFondo(ancho, alto, imgW, imgH, ancla, pie);
  return { left: caja.x, top: caja.y, width: caja.w, height: caja.h };
}

/**
 * El color de reserva se ve al momento. La foto o el vídeo entran después.
 * Al cambiar de escena o de modo, la capa nueva sube de 0 a 1 en 360 ms
 * y la vieja se retira al terminar.
 */
export function Fondo({ aspecto, caja, reducir, angosta }: Props) {
  const pilaRef = useRef<HTMLDivElement>(null);
  const vista = useVista(pilaRef);
  const [ahorro] = useState(ahorraDatos);
  const clave = claveDe(aspecto);
  const seq = useRef(1);
  const [capas, setCapas] = useState<readonly Capa[]>(() => [{ id: 1, aspecto, visible: true }]);

  useEffect(() => {
    setCapas((prev) => {
      const ultima = prev[prev.length - 1];
      if (ultima && claveDe(ultima.aspecto) === clave) return prev;
      seq.current += 1;
      return [...prev, { id: seq.current, aspecto, visible: reducir }];
    });
  }, [clave, aspecto, reducir]);

  useEffect(() => {
    if (reducir) return;
    let vivo = true;
    const marco = requestAnimationFrame(() => {
      if (!vivo) return;
      setCapas((prev) => {
        const i = prev.length - 1;
        const capa = prev[i];
        if (!capa || capa.visible || claveDe(capa.aspecto) !== clave) return prev;
        const copia = prev.slice();
        copia[i] = { ...capa, visible: true };
        return copia;
      });
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(marco);
    };
  }, [clave, reducir]);

  useEffect(() => {
    const ultima = capas[capas.length - 1];
    if (!ultima?.visible || capas.length < 2) return;
    const id = window.setTimeout(
      () => {
        setCapas((prev) => {
          const viva = prev[prev.length - 1];
          return viva ? [viva] : prev;
        });
      },
      reducir ? 0 : 420,
    );
    return () => window.clearTimeout(id);
  }, [capas, reducir]);

  const pie =
    caja && vista.ancho > 0
      ? {
          x: caja.x + caja.w / 2 - vista.izquierda,
          y: (esArena(aspecto) ? yBaseBulbo(caja) : yBaseOpaca(caja)) - vista.arriba,
        }
      : null;

  return (
    <div ref={pilaRef} className="fondo-pila" aria-hidden="true">
      {capas.map((capa) => (
        <CapaFondo
          key={capa.id}
          capa={capa}
          ancho={vista.ancho}
          alto={vista.alto}
          pie={pie}
          estrecho={vista.estrecho}
          angosta={angosta}
          reducir={reducir}
          ahorro={ahorro}
        />
      ))}
    </div>
  );
}

function CapaFondo({
  capa,
  ancho,
  alto,
  pie,
  estrecho,
  angosta,
  reducir,
  ahorro,
}: {
  readonly capa: Capa;
  readonly ancho: number;
  readonly alto: number;
  readonly pie: { readonly x: number; readonly y: number } | null;
  readonly estrecho: boolean;
  readonly angosta: boolean;
  readonly reducir: boolean;
  readonly ahorro: boolean;
}) {
  const fondo = capa.aspecto.fondo;
  const fondoCapa =
    fondo.tipo === 'degradado' ? (angosta ? DEGRADADO_ESTRECHO : fondo.css) : capa.aspecto.reserva;
  return (
    <div
      className={capa.visible ? 'fondo-capa se-ve' : 'fondo-capa'}
      style={{ background: fondoCapa, ['--reserva-fondo' as string]: capa.aspecto.reserva }}
    >
      {fondo.tipo === 'foto' ? (
        <Foto
          fondo={fondo}
          ancla={capa.aspecto.ancla}
          ancho={ancho}
          alto={alto}
          pie={pie}
          estrecho={estrecho}
        />
      ) : null}
      {fondo.tipo === 'video' ? (
        <Video
          fondo={fondo}
          ancla={capa.aspecto.ancla}
          ancho={ancho}
          alto={alto}
          pie={pie}
          reducir={reducir}
          ahorro={ahorro}
        />
      ) : null}
    </div>
  );
}

function Foto({
  fondo,
  ancla,
  ancho,
  alto,
  pie,
  estrecho,
}: {
  readonly fondo: Extract<Aspecto['fondo'], { tipo: 'foto' }>;
  readonly ancla: Ancla;
  readonly ancho: number;
  readonly alto: number;
  readonly pie: { readonly x: number; readonly y: number } | null;
  readonly estrecho: boolean;
}) {
  const elegida = estrecho && fondo.estrecho ? fondo.estrecho : fondo;
  const medida = useMedida(elegida.webp);
  const marco = marcoDe(ancho, alto, medida.w, medida.h, ancla, pie);
  const [listo, setListo] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = imgRef.current;
    setListo(Boolean(img && img.complete && img.naturalWidth > 0));
  }, [elegida.webp]);
  if (!marco) return null;
  return (
    <picture>
      {elegida.avif ? <source srcSet={elegida.avif} type="image/avif" /> : null}
      {elegida.jpg ? <source srcSet={elegida.webp} type="image/webp" /> : null}
      <img
        ref={imgRef}
        className={listo ? 'fondo-medio listo' : 'fondo-medio'}
        src={elegida.jpg ?? elegida.webp}
        alt=""
        fetchPriority="high"
        style={marco}
        onLoad={() => setListo(true)}
      />
    </picture>
  );
}

function Video({
  fondo,
  ancla,
  ancho,
  alto,
  pie,
  reducir,
  ahorro,
}: {
  readonly fondo: Extract<Aspecto['fondo'], { tipo: 'video' }>;
  readonly ancla: Ancla;
  readonly ancho: number;
  readonly alto: number;
  readonly pie: { readonly x: number; readonly y: number } | null;
  readonly reducir: boolean;
  readonly ahorro: boolean;
}) {
  const medida = useMedida(fondo.poster);
  const marco = marcoDe(ancho, alto, medida.w, medida.h, ancla, pie);
  const [posterListo, setPosterListo] = useState(false);
  const [videoListo, setVideoListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const posterRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ecoRef = useRef<HTMLVideoElement>(null);
  const reproduce = !reducir && !ahorro && !fallo;
  const src = fuenteDeVideo(fondo.webm, fondo.mp4);
  const fundido = fondo.fundido === true;
  useEffect(() => {
    const img = posterRef.current;
    setPosterListo(Boolean(img && img.complete && img.naturalWidth > 0));
  }, [fondo.poster]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !reproduce) return;
    setVideoListo(false);
    video.src = src;
    const eco = ecoRef.current;
    if (fundido && eco) eco.src = src;
    const soltar = fundido && eco ? engancharFundido(video, eco) : engancharReproduccion(video);
    const alError = () => {
      if (video.src.endsWith(fondo.mp4) || src === fondo.mp4) {
        setFallo(true);
        return;
      }
      video.src = fondo.mp4;
      video.load();
    };
    video.addEventListener('error', alError);
    return () => {
      video.removeEventListener('error', alError);
      soltar();
    };
  }, [fondo.mp4, fondo.webm, fundido, reproduce, src]);
  if (!marco) return null;
  return (
    <>
      <img
        ref={posterRef}
        className={posterListo ? 'fondo-medio listo' : 'fondo-medio'}
        src={fondo.poster}
        alt=""
        fetchPriority="high"
        style={marco}
        onLoad={() => setPosterListo(true)}
      />
      {reproduce ? (
        <video
          key={fondo.webm}
          ref={videoRef}
          className={videoListo ? 'fondo-video listo' : 'fondo-video'}
          style={marco}
          muted
          loop={!fundido}
          playsInline
          autoPlay
          preload="auto"
          poster={fondo.poster}
          onPlaying={() => setVideoListo(true)}
        />
      ) : null}
      {reproduce && fundido ? (
        <video
          key={`${fondo.webm}-eco`}
          ref={ecoRef}
          className="fondo-video fondo-eco"
          style={marco}
          muted
          playsInline
          preload="auto"
          poster={fondo.poster}
        />
      ) : null}
    </>
  );
}
