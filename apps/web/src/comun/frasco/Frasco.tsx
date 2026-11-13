import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { CLASSIC_MODEL, type SessionSnapshot } from '@reloj/core';

import type { MaquinaGiro } from '../giro';
import type { Contenido, GeometriaFrasco, MedidaLienzo } from './contrato';
import {
  escalaDeIntro,
  hitVessel,
  layoutFor,
  pintarVidrio,
  type GlassLayout,
  type Scheme,
} from './pintarVidrio';
import { cantidadSombra, pintarSombra } from './sombra';

const ESQUEMA = { light: 'claro', dark: 'oscuro' } as const;

interface Props {
  readonly crearContenido: (medida: MedidaLienzo, esquema: 'claro' | 'oscuro') => Contenido;
  readonly scheme: Scheme;
  readonly reducir: boolean;
  readonly getSnapshot: () => SessionSnapshot;
  readonly giro: MaquinaGiro;
  readonly introPaso: (now: number) => boolean;
  readonly onReinicio: () => void;
  readonly suppressClickRef: RefObject<boolean>;
  readonly wakeRef: RefObject<(() => void) | null>;
}

function geometriaVacia(): GeometriaFrasco {
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

export function Frasco({
  crearContenido,
  scheme,
  reducir,
  getSnapshot,
  giro,
  introPaso,
  onReinicio,
  suppressClickRef,
  wakeRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<GlassLayout | null>(null);
  const crearRef = useRef(crearContenido);
  const schemeRef = useRef(scheme);
  const reducirRef = useRef(reducir);
  const snapRef = useRef(getSnapshot);
  const introRef = useRef(introPaso);
  const reinicioRef = useRef(onReinicio);
  crearRef.current = crearContenido;
  schemeRef.current = scheme;
  reducirRef.current = reducir;
  snapRef.current = getSnapshot;
  introRef.current = introPaso;
  reinicioRef.current = onReinicio;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;
    const profile = CLASSIC_MODEL.profile;
    const geo = geometriaVacia();
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
    };

    const frame = (now: number) => {
      if (!loop.alive) return;
      const introSigue = introRef.current(now);
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
      const layout = layoutFor(cssW, cssH, profile);
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
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      pintarSombra(
        ctx,
        layout,
        schemeAhora,
        cantidadSombra(est.angulo) * (pose.activa ? pose.sombra : 1),
        poseScale,
      );
      const caja = {
        x: layout.cx - layout.halfW,
        y: layout.cy - layout.halfH,
        w: layout.halfW * 2,
        h: layout.halfH * 2,
      };
      pintarVidrio(
        ctx,
        { profile, layout, scheme: schemeAhora, rotation: est.angulo, poseScale },
        (context) => {
          contenido.pintar(context, { caja, angulo: est.angulo, esquema: ESQUEMA[schemeAhora], geo });
        },
      );

      const keep =
        snap.status === 'running' ||
        sigue ||
        est.fase !== 'reposo' ||
        est.ocupado ||
        introSigue ||
        pose.activa;
      if (keep && loop.alive) loop.raf = requestAnimationFrame(frame);
      else loop.raf = 0;
    };

    const wake = () => {
      if (!loop.alive || loop.raf !== 0) return;
      loop.last = 0;
      loop.raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;
    const observer = new ResizeObserver(() => wake());
    observer.observe(canvas);
    wake();
    return () => {
      loop.alive = false;
      observer.disconnect();
      if (loop.raf) cancelAnimationFrame(loop.raf);
      if (wakeRef.current === wake) wakeRef.current = null;
      contenido.destruir();
    };
  }, [giro, wakeRef]);

  const localPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="glass-frame">
      <canvas
        ref={canvasRef}
        className="glass-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          if (giro.ocupado()) return;
          const layout = layoutRef.current;
          if (!layout) return;
          const p = localPoint(e);
          if (!hitVessel(layout, p.x, p.y)) return;
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
