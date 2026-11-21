import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { SessionSnapshot } from '@reloj/core';

import type { Puente3D } from '../frasco-3d';
import type { MaquinaGiro } from '../giro';
import type { Contenido, GeometriaFrasco, MedidaLienzo } from './contrato';
import { fotosDelFrasco, geometriaDelFrasco, type FotosFrasco } from './geometria';
import { golpe } from './golpe';
import type { LuzEscena } from './luz';
import { escalaDeIntro, layoutFor, pintarVidrio, type GlassLayout, type Scheme } from './pintarVidrio';
import { cantidadSombra } from './sombra';

const ESQUEMA = { light: 'claro', dark: 'oscuro' } as const;
const ESPERA_FOTOS = 2500;
/** Al pasar al frasco 3D, el de foto se funde encima durante este tiempo. */
const RELEVO_MS = 320;

function geoVacia(): GeometriaFrasco {
  const mascara = document.createElement('canvas');
  mascara.width = 1;
  mascara.height = 1;
  return {
    aspecto: 1024 / 446,
    ventana: { x0: 0, x1: 1, y0: 0, y1: 1 },
    radio: () => 0,
    mascara,
    puntos: { arriba: new Float32Array(0), abajo: new Float32Array(0) },
    cuelloY: 0.5,
  };
}

interface Props {
  readonly crearContenido: (medida: MedidaLienzo, esquema: 'claro' | 'oscuro') => Contenido;
  /** Cambia al pasar de escena: se suelta el contenido y se crea otro. */
  readonly generacion: string;
  readonly luz: LuzEscena;
  readonly scheme: Scheme;
  readonly reducir: boolean;
  readonly getSnapshot: () => SessionSnapshot;
  readonly giro: MaquinaGiro;
  readonly introPaso: (now: number) => boolean;
  readonly onReinicio: () => void;
  readonly suppressClickRef: RefObject<boolean>;
  readonly wakeRef: RefObject<(() => void) | null>;
  /** La nube lee solo este número: 1 de pie, 0 a partir de 50°. */
  readonly alFlotar?: RefObject<number>;
  /**
   * Frasco 3D. Cuando está listo y no hay intro, pinta él el vidrio y el contenido;
   * aquí siguen el giro, la física y los gestos. Si no, el vidrio de foto de siempre.
   */
  readonly puente3d?: Puente3D;
}

export function Frasco({
  crearContenido,
  generacion,
  luz,
  scheme,
  reducir,
  getSnapshot,
  giro,
  introPaso,
  onReinicio,
  suppressClickRef,
  wakeRef,
  alFlotar,
  puente3d,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<GlassLayout | null>(null);
  const geoRef = useRef<GeometriaFrasco | null>(null);
  const crearRef = useRef(crearContenido);
  const schemeRef = useRef(scheme);
  const luzRef = useRef(luz);
  const reducirRef = useRef(reducir);
  const snapRef = useRef(getSnapshot);
  const introRef = useRef(introPaso);
  const reinicioRef = useRef(onReinicio);
  const flotarRef = useRef(alFlotar);
  const puenteRef = useRef(puente3d);
  puenteRef.current = puente3d;
  flotarRef.current = alFlotar;
  crearRef.current = crearContenido;
  schemeRef.current = scheme;
  luzRef.current = luz;
  reducirRef.current = reducir;
  snapRef.current = getSnapshot;
  introRef.current = introPaso;
  reinicioRef.current = onReinicio;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    const paint = paintRef.current;
    const paintCtx = paint?.getContext('2d', { alpha: true }) ?? null;
    if (!canvas || !ctx) return;
    const contenido = crearRef.current(
      { ancho: Math.max(280, canvas.clientWidth || 480), alto: Math.max(360, canvas.clientHeight || 640) },
      ESQUEMA[schemeRef.current],
    );
    const loop = {
      raf: 0,
      alive: true,
      last: 0,
      turns: null as number | null,
      populated: false,
      fotos: null as FotosFrasco | null,
      geo: null as GeometriaFrasco | null,
      fallo: false,
      empezado: performance.now(),
      /** El frasco 3D pinta el vidrio y el contenido. */
      tresD: false,
      relevo: 0,
      /** Al cambiar de escena con el 3D ya listo, el relevo es inmediato: sin fundido del de foto. */
      relevoInmediato: puenteRef.current?.listo === true,
    };
    if (paint && !loop.relevoInmediato) paint.style.opacity = '';
    /** Lo que pinta el 3D en su hoja. Cambia cada fotograma con el ángulo. */
    let pintor3D: ((ctx: CanvasRenderingContext2D, caja: { x: number; y: number; w: number; h: number }) => void) | null =
      null;
    const contenido3D = {
      tipo: 'frasco' as const,
      pintar: (ctx: CanvasRenderingContext2D, caja: { x: number; y: number; w: number; h: number }) => {
        if (loop.alive) pintor3D?.(ctx, caja);
      },
    };
    void fotosDelFrasco().then(
      (fotos) => {
        if (!loop.alive) return;
        loop.fotos = fotos;
        loop.geo = fotos.geo;
        geoRef.current = fotos.geo;
        wake();
      },
      () => {
        if (!loop.alive) return;
        loop.fallo = true;
        wake();
      },
    );
    void geometriaDelFrasco().then((geo) => {
      if (!loop.alive) return;
      loop.geo = geo;
      geoRef.current = geo;
      wake();
    });

    const frame = (now: number) => {
      if (!loop.alive) return;
      const fotosListas = loop.fotos !== null || loop.fallo || now - loop.empezado >= ESPERA_FOTOS;
      const introSigue = fotosListas ? introRef.current(now) : true;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pxW = Math.max(1, Math.round(cssW * dpr));
      const pxH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layout = layoutFor(cssW, cssH);
      layoutRef.current = layout;
      const reducirAhora = reducirRef.current;
      const snap = snapRef.current();

      if (loop.turns === null || !loop.populated) loop.turns = snap.transitions;
      else if (snap.transitions !== loop.turns) {
        loop.turns = snap.transitions;
        if (!reducirAhora) giro.ordenar({ tipo: 'cambioDeFase' });
      }

      const eventos = giro.avanzar(now, reducirAhora);
      for (const ev of eventos) {
        if (ev === 'reinicio-sujetar' || ev === 'reinicio-cerrar') contenido.alVoltear('reinicio', snap);
        if (ev === 'fase-cerrar') contenido.alVoltear('fase', snap);
      }

      const dt = loop.last > 0 ? Math.min(0.1, (now - loop.last) / 1000) : 1 / 60;
      loop.last = now;
      const est = giro.estado();
      const flotar = flotarRef.current;
      if (flotar) {
        // 180° también es estar de pie: la media vuelta se apaga al pasar
        // de 50° y vuelve a encenderse al acercarse al final, sin un corte.
        let grados = (Math.abs(est.angulo) * 180) / Math.PI;
        grados = Math.min(grados, Math.abs(grados - 180), Math.abs(grados - 360));
        flotar.current = Math.max(0, 1 - grados / 50);
      }
      const sigue = contenido.paso({
        ahora: now,
        dt,
        angulo: est.angulo,
        velocidad: est.velocidad,
        fase: est.fase,
        snap,
        reducir: reducirAhora,
      });
      if (est.fase !== 'volteo') loop.populated = true;

      const schemeAhora = schemeRef.current;
      const pose = giro.poseIntro();
      const poseScale = pose.activa ? escalaDeIntro(pose.escala, layout, pose.angulo, cssW, cssH) : 1;
      const esquema = ESQUEMA[schemeAhora];

      // Frasco 3D: después de la intro y solo si el WebGL ya pinta.
      const puente = puenteRef.current;
      const motor = puente && puente.listo && !pose.activa ? puente.motor : null;
      if (motor) {
        if (!loop.tresD) {
          loop.tresD = true;
          loop.relevo = loop.relevoInmediato ? now - RELEVO_MS : now;
          motor.setContenido(contenido3D);
          motor.setFrascoVisible(true);
        }
        motor.girar(est.angulo);
        const angulo = est.angulo;
        const geo = loop.geo ?? geoVacia();
        pintor3D = (context, caja) => {
          contenido.pintar(context, { caja, angulo, esquema, geo });
        };
      } else if (loop.tresD) {
        loop.tresD = false;
        pintor3D = null;
        puente?.motor?.setFrascoVisible(false);
        if (paint) paint.style.opacity = '';
      }
      const relevo = loop.tresD ? Math.min(1, (now - loop.relevo) / RELEVO_MS) : 0;
      if (loop.tresD && paint) paint.style.opacity = relevo < 1 ? String(1 - relevo) : '0';

      const escena = {
        layout,
        scheme: schemeAhora,
        rotation: est.angulo,
        poseScale,
        sombra: cantidadSombra(est.angulo) * (pose.activa ? pose.sombra : 1),
        atras: loop.fotos?.atras ?? null,
        delante: loop.fotos?.delante ?? null,
        geo: loop.geo,
        silueta: loop.fotos === null && (loop.fallo || now - loop.empezado >= ESPERA_FOTOS),
        luz: luzRef.current,
      };
      const pintarEn = (context: CanvasRenderingContext2D) => {
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        pintarVidrio(context, escena, (context, caja) => {
          contenido.pintar(context, {
            caja,
            angulo: est.angulo,
            esquema,
            geo: loop.geo ?? geoVacia(),
          });
        });
      };
      // La intro ya encoge el frasco para la columna. Fuera de ella, el
      // bitmap de la columna recortaba el giro: se pinta en un lienzo del
      // tamaño de la ventana, con el mismo centro y el mismo tamaño.
      if (loop.tresD && relevo >= 1) {
        if (paintCtx && paint) {
          paintCtx.setTransform(1, 0, 0, 1, 0, 0);
          paintCtx.clearRect(0, 0, paint.width, paint.height);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else if (!pose.activa && paint && paintCtx) {
        const vista = window.innerWidth;
        const altoVista = window.innerHeight;
        if (paint.style.width !== `${vista}px`) paint.style.width = `${vista}px`;
        if (paint.style.height !== `${altoVista}px`) paint.style.height = `${altoVista}px`;
        const cajaHit = canvas.getBoundingClientRect();
        const cajaPaint = paint.getBoundingClientRect();
        if (cajaPaint.width < vista * 0.9 || cajaPaint.height < altoVista * 0.9) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, cssW, cssH);
          pintarEn(ctx);
        } else {
          const pw = Math.max(1, Math.round(cajaPaint.width * dpr));
          const ph = Math.max(1, Math.round(cajaPaint.height * dpr));
          if (paint.width !== pw || paint.height !== ph) {
            paint.width = pw;
            paint.height = ph;
          }
          const ox = cajaHit.left - cajaPaint.left;
          const oy = cajaHit.top - cajaPaint.top;
          paintCtx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
          paintCtx.clearRect(-ox, -oy, cajaPaint.width, cajaPaint.height);
          pintarEn(paintCtx);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, cssW, cssH);
        }
      } else {
        if (paintCtx && paint) {
          paintCtx.setTransform(1, 0, 0, 1, 0, 0);
          paintCtx.clearRect(0, 0, paint.width, paint.height);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        pintarEn(ctx);
      }

      const keep =
        snap.status === 'running' ||
        sigue ||
        est.fase !== 'reposo' ||
        est.ocupado ||
        introSigue ||
        pose.activa ||
        (loop.tresD && relevo < 1);
      if (keep && loop.alive) loop.raf = requestAnimationFrame(frame);
      else loop.raf = 0;
    };

    const wake = () => {
      if (!loop.alive || loop.raf !== 0) return;
      loop.last = 0;
      loop.raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;
    const puenteMontado = puenteRef.current;
    if (puenteMontado) puenteMontado.despertar = wake;
    const observer = new ResizeObserver(() => wake());
    observer.observe(canvas);
    wake();
    return () => {
      loop.alive = false;
      observer.disconnect();
      if (loop.raf) cancelAnimationFrame(loop.raf);
      if (wakeRef.current === wake) wakeRef.current = null;
      if (puenteMontado?.despertar === wake) puenteMontado.despertar = null;
      pintor3D = null;
      if (loop.tresD) puenteMontado?.motor?.setContenido(null);
      contenido.destruir();
    };
  }, [generacion, giro, wakeRef]);

  const localPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="glass-frame">
      <canvas ref={paintRef} className="glass-paint" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="glass-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          if (giro.ocupado()) return;
          const layout = layoutRef.current;
          if (!layout) return;
          const p = localPoint(e);
          const geo = geoRef.current;
          if (!geo || !golpe(layout, geo, p.x, p.y, giro.estado().angulo)) return;
          const ang = Math.atan2(p.y - layout.cy, p.x - layout.cx);
          giro.ordenar({ tipo: 'agarrar', anguloPuntero: ang });
          e.currentTarget.setPointerCapture(e.pointerId);
          wakeRef.current?.();
        }}
        onPointerMove={(e) => {
          if (!giro.arrastrando()) return;
          const layout = layoutRef.current;
          if (!layout) return;
          const p = localPoint(e);
          const ang = Math.atan2(p.y - layout.cy, p.x - layout.cx);
          giro.ordenar({ tipo: 'mover', anguloPuntero: ang });
          wakeRef.current?.();
        }}
        onPointerUp={(e) => {
          if (!giro.arrastrando()) return;
          const resultado = giro.ordenar({ tipo: 'soltar' });
          if (resultado === 'commit') {
            suppressClickRef.current = true;
            reinicioRef.current();
          } else if (resultado === 'moved') {
            suppressClickRef.current = true;
          }
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          wakeRef.current?.();
        }}
        onPointerCancel={() => {
          giro.interrumpir();
          wakeRef.current?.();
        }}
      />
    </div>
  );
}
