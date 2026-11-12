import {
  CLASSIC_MODEL,
  GRAVITY_DOWN,
  SAND,
  SandSimulation,
  StreamParticles,
  flowBudget,
  syncSandToTarget,
  type SessionSnapshot,
  type StreamInput,
} from '@reloj/core';
import { useEffect, useRef, type RefObject } from 'react';

import type { Layout } from '../layout/calcularLayout';
import type { Luz } from '../temas/tipos';
import { cargarActivos, type Activos } from './activos';
import { dibujar } from './dibujo';
import { anguloNivel, cuelloMojado } from './fisica/agua';
import { granosObjetivo, gravedadDelAngulo } from './fisica/arena';
import { buildPaletteLut, pintarGranos } from './granos';
import { estadoInicial, pasoFrasco, type EstadoFrasco, type OrdenFrasco } from './maquina';
import { muelleQuieto, pasoMuelle, type Muelle } from './muelle';
import { nivelAbajo, nivelDesdeTiempo } from './nivel';

export interface ModeloFrasco {
  readonly getSnapshot: () => SessionSnapshot;
  readonly luz: Luz;
  readonly tipo: 'arena' | 'agua';
  readonly granos: 'clara' | 'oscura';
  readonly mostrarNube: boolean;
  readonly reducir: boolean;
  readonly layout: Layout;
  readonly onVolteo: () => void;
  readonly onSuprimirClic: () => void;
}

const UMBRAL = 0.03;

function dentro(frasco: Layout['frasco'], x: number, y: number): boolean {
  const u = (x - frasco.x) / frasco.w - 0.5;
  const v = ((y - frasco.y) / frasco.h - 0.5) * 2;
  if (Math.abs(v) > 1.02) return false;
  const ancho = 0.16 + 0.78 * Math.abs(v) ** 0.62;
  return Math.abs(u * 2) <= ancho;
}

/** Bucle único. Se duerme cuando el frasco, el agua y el reloj están quietos. */
export function useFrasco(canvasRef: RefObject<HTMLCanvasElement | null>, modelo: ModeloFrasco): void {
  const vivo = useRef(modelo);
  const pedir = useRef<() => void>(() => undefined);
  vivo.current = modelo;

  // El bucle se duerme en reposo. Un cambio de tema tiene que pintarse
  // en el acto, sin esperar al siguiente clic o al siguiente tick.
  useEffect(() => {
    pedir.current();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;

    const sim = new SandSimulation({
      profile: CLASSIC_MODEL.profile,
      cols: 161,
      seed: 11,
      slideChance: SAND.slideChance,
      fillRatio: SAND.fillRatio,
      staticFriction: 0.28,
    });
    const particles = new StreamParticles({ capacity: 220, seed: 5 });
    const arena = document.createElement('canvas');
    const arenaCtx = arena.getContext('2d');
    let lut = buildPaletteLut(SAND.palette.light);
    let paleta: ModeloFrasco['granos'] = 'clara';
    let firmaLuz = '';
    let estado: EstadoFrasco = estadoInicial();
    let agua: Muelle = muelleQuieto();
    let orden: OrdenFrasco = { tipo: 'quieto', dt: 1 / 60, reducir: false };
    let raf = 0;
    let ultimo = 0;
    let activo = true;
    let forzar = false;
    const input: StreamInput = {
      dt: 1 / 60,
      emitting: false,
      intensity: 0.7,
      gravity: GRAVITY_DOWN,
      calm: false,
    };
    const activos: Activos = cargarActivos(true, () => despertar());
    let arrastre: { id: number; inicio: number; base: number; movio: boolean } | null = null;

    const pintarArena = () => {
      if (!arenaCtx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(vivo.current.layout.frasco.w * dpr));
      const h = Math.max(2, Math.round(vivo.current.layout.frasco.h * dpr));
      if (arena.width !== w || arena.height !== h) {
        arena.width = w;
        arena.height = h;
      }
      pintarGranos(arenaCtx, sim, lut, w, h, vivo.current.luz);
    };

    const frame = (now: number) => {
      if (!activo) return;
      const m = vivo.current;
      const dt = ultimo > 0 ? Math.min(0.05, (now - ultimo) / 1000) : 1 / 60;
      ultimo = now;
      const antes = estado.angulo;
      const paso = pasoFrasco(estado, orden.tipo === 'quieto' ? { ...orden, dt, reducir: m.reducir } : orden);
      estado = paso.estado;
      orden = { tipo: 'quieto', dt, reducir: m.reducir };
      if (paso.volteoCompletado) {
        m.onVolteo();
        agua = muelleQuieto();
      } else {
        // El agua hereda el giro y el muelle la devuelve a nivel. En reposo, velocidad 0.
        agua = pasoMuelle({ valor: agua.valor + (estado.angulo - antes), velocidad: agua.velocidad }, 0, dt);
      }

      const snap = m.getSnapshot();
      const arriba = nivelDesdeTiempo(snap.durationMs, snap.remainingMs);
      const objetivo = granosObjetivo(sim.totalGrains, snap.durationMs, snap.remainingMs);
      const girando = estado.fase === 'volteando';
      let movio = forzar || girando || Math.abs(agua.velocidad) > 0 || Math.abs(estado.velocidad) > 0;
      forzar = false;
      const firma = `${m.granos}|${m.luz.tinte}|${m.luz.fuerzaTinte}|${m.luz.brillo}|${m.luz.direccion}`;
      if (firma !== firmaLuz) {
        firmaLuz = firma;
        if (m.granos !== paleta) {
          paleta = m.granos;
          lut = buildPaletteLut(paleta === 'oscura' ? SAND.palette.dark : SAND.palette.light);
        }
        movio = true;
      }
      if (m.tipo === 'arena') {
        if (paso.volteoCompletado || (!girando && estado.fase !== 'arrastrando' && snap.status === 'idle')) {
          if (sim.topCount !== objetivo) {
            sim.arrange(objetivo, Math.max(0, sim.totalGrains - objetivo), GRAVITY_DOWN);
            movio = true;
          }
        } else if (!girando && snap.status !== 'idle') {
          const inicial = granosObjetivo(sim.totalGrains, snap.durationMs, snap.durationMs);
          const budget = flowBudget(inicial, snap.durationMs, sim.totalGrains);
          const gravedad = estado.angulo === 0 ? GRAVITY_DOWN : gravedadDelAngulo(estado.angulo);
          if (syncSandToTarget(sim, objetivo, gravedad, { ...budget, crater: 0.16 }) !== 'idle') movio = true;
          if (sim.step(gravedad) > 0) movio = true;
        } else if (estado.fase === 'arrastrando' || Math.abs(estado.angulo) > 0.01) {
          if (sim.step(gravedadDelAngulo(estado.angulo)) > 0) movio = true;
        }
        input.dt = dt;
        input.emitting =
          !girando && snap.status === 'running' && snap.remainingMs > 0 && sim.hasGrainAtNeck(GRAVITY_DOWN);
        input.gravity = GRAVITY_DOWN;
        input.calm = m.reducir;
        particles.update(sim, input);
        if (movio || particles.active) pintarArena();
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pxW = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const pxH = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dibujar(
        ctx,
        {
          frasco: m.layout.frasco,
          nube: m.layout.nube,
          luz: m.luz,
          tipo: m.tipo,
          angulo: estado.angulo,
          anguloAgua: anguloNivel(estado.angulo, agua.valor),
          volumenArriba: arriba,
          volumenAbajo: nivelAbajo(snap.durationMs, snap.remainingMs),
          mostrarNube: m.mostrarNube,
          reducir: m.reducir,
          llueve:
            m.tipo === 'agua' &&
            snap.status === 'running' &&
            cuelloMojado(arriba, anguloNivel(estado.angulo, agua.valor)),
          sim,
          chorro: particles,
          lut,
          arena,
        },
        activos,
      );

      const video = activos.nubeVideo;
      if (video) {
        const parar = document.hidden || !m.mostrarNube || m.reducir;
        if (parar) video.pause();
        else if (video.paused) void video.play().catch(() => undefined);
      }
      const nubeViva = m.mostrarNube && !m.reducir && !!video && !video.paused && video.readyState >= 2;
      const seguir =
        movio ||
        particles.active ||
        snap.status === 'running' ||
        estado.fase !== 'reposo' ||
        Math.abs(estado.angulo) > 0.001 ||
        nubeViva ||
        arrastre !== null;
      raf = seguir ? requestAnimationFrame(frame) : 0;
    };

    const despertar = () => {
      forzar = true;
      if (!activo || raf !== 0) return;
      ultimo = 0;
      raf = requestAnimationFrame(frame);
    };
    pedir.current = despertar;

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const down = (event: PointerEvent) => {
      if (estado.fase === 'volteando') return;
      const p = local(event);
      const frasco = vivo.current.layout.frasco;
      if (!dentro(frasco, p.x, p.y)) return;
      const ang = Math.atan2(p.y - (frasco.y + frasco.h / 2), p.x - (frasco.x + frasco.w / 2));
      arrastre = { id: event.pointerId, inicio: ang, base: estado.angulo, movio: false };
      canvas.setPointerCapture(event.pointerId);
      despertar();
    };
    const move = (event: PointerEvent) => {
      if (!arrastre || arrastre.id !== event.pointerId) return;
      const p = local(event);
      const frasco = vivo.current.layout.frasco;
      let delta =
        Math.atan2(p.y - (frasco.y + frasco.h / 2), p.x - (frasco.x + frasco.w / 2)) - arrastre.inicio;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) > UMBRAL) arrastre.movio = true;
      const angulo = Math.min(Math.PI, Math.max(-Math.PI, arrastre.base + delta));
      orden = { tipo: 'arrastrar', angulo, dt: 1 / 60 };
      despertar();
    };
    const up = (event: PointerEvent) => {
      if (!arrastre || arrastre.id !== event.pointerId) return;
      if (arrastre.movio) vivo.current.onSuprimirClic();
      arrastre = null;
      orden = { tipo: 'soltar', reducir: vivo.current.reducir };
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      despertar();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    const observer = new ResizeObserver(() => despertar());
    observer.observe(canvas);
    const alVer = () => {
      if (document.hidden) activos.nubeVideo?.pause();
      else despertar();
    };
    document.addEventListener('visibilitychange', alVer);
    despertar();
    return () => {
      activo = false;
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      document.removeEventListener('visibilitychange', alVer);
      activos.nubeVideo?.pause();
    };
  }, [canvasRef]);
}
