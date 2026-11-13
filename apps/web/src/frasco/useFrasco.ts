import {
  GRAVITY_DOWN,
  SAND,
  SandSimulation,
  StreamParticles,
  TiltLod,
  flowBudget,
  syncSandToTarget,
  type SessionSnapshot,
  type StreamInput,
} from '@reloj/core';
import { useEffect, useRef, type RefObject } from 'react';

import { cajaNube } from '../layout/cajas';

import type { Layout } from '../layout/calcularLayout';
import { activarNube } from '../medios/assetLoader';
import { alFijarAngulo } from '../pruebas';
import type { Luz } from '../temas/tipos';
import { cargarActivos, cargarArena, type Activos } from './activos';
import { dibujar } from './dibujo';
import { granosObjetivo, gravedadDelAngulo } from './fisica/arena';
import { buildPaletteLut, pintarSello } from './granos';
import { muelleSuperficie } from './fisica/superficie';
import { estadoInicial, pasoFrasco, type EstadoFrasco, type OrdenFrasco } from './maquina';
import { muelleQuieto, pasoMuelle, type Muelle } from './muelle';
import { nivelAbajo, nivelDesdeTiempo } from './nivel';
import { PERFIL_FRASCO, dentroDeCelda, desdeLuminancia, type Geometria } from './geometria';
import { opacidadNube } from './nube';
import { crearSuavizado } from './suavizar';

export interface ModeloFrasco {
  readonly getSnapshot: () => SessionSnapshot;
  readonly luz: Luz;
  readonly tipo: 'arena' | 'agua';
  readonly granos: 'clara' | 'oscura';
  readonly mostrarNube: boolean;
  readonly reducir: boolean;
  readonly ahorro: boolean;
  readonly layout: Layout;
  readonly onVolteo: () => void;
  readonly onSuprimirClic: () => void;
  readonly pausado: boolean;
  readonly vuelta: number;
  readonly contenidoFijo: { readonly durationMs: number; readonly remainingMs: number } | null;
  readonly onVueltaLista: () => void;
}

const UMBRAL = 0.03;

function dentro(
  frasco: Layout['frasco'],
  x: number,
  y: number,
  angulo: number,
  geo: Geometria | null,
): boolean {
  if (!geo) {
    const u = (x - frasco.x) / frasco.w - 0.5;
    const v = ((y - frasco.y) / frasco.h - 0.5) * 2;
    if (Math.abs(v) > 1.02) return false;
    const ancho = 0.16 + 0.78 * Math.abs(v) ** 0.62;
    return Math.abs(u * 2) <= ancho;
  }
  const cx = frasco.x + frasco.w / 2;
  const cy = frasco.y + frasco.h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const c = Math.cos(-angulo);
  const s = Math.sin(-angulo);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return dentroDeCelda(geo, lx / frasco.w + 0.5, ly / frasco.h + 0.5);
}

/** Bucle único. Se duerme cuando el frasco, el agua y el reloj están quietos. */
export function useFrasco(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  modelo: ModeloFrasco,
  nubeRef: RefObject<HTMLVideoElement | null>,
): void {
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
      profile: PERFIL_FRASCO,
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
    let orden: OrdenFrasco = { tipo: 'quieto', dt: 1 / 60, reducir: false };
    let raf = 0;
    let ultimo = 0;
    let activo = true;
    let forzar = false;
    let nubeLista = false;
    // Solo lo escribe el gancho de Playwright. En uso normal se queda en null
    // y el fotograma sigue el gesto, igual que antes.
    let anguloFijo: number | null = null;
    let geo: Geometria | null = null;
    let superficie: Muelle = muelleQuieto(0);
    let anguloPrevio = 0;
    let vueltaVista = vivo.current.vuelta;
    const lod = new TiltLod();
    let ultimoSim = 0;
    const input: StreamInput = {
      dt: 1 / 60,
      emitting: false,
      intensity: 0.7,
      gravity: GRAVITY_DOWN,
      calm: false,
    };
    const activos: Activos = cargarActivos(() => despertar());
    let arrastre: { id: number; inicio: number; base: number; movio: boolean } | null = null;
    let visto = vivo.current.layout.frasco;
    const suavizar = crearSuavizado(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
      return getComputedStyle(canvas).transitionDuration.split(',')[0]?.trim() === '0s';
    });

    const pintarArena = () => {
      if (!arenaCtx) return;
      pintarSello(arenaCtx, sim, lut);
    };

    const frame = (now: number) => {
      if (!activo) return;
      if (!geo && activos.mascara) geo = geometriaDe(activos.mascara);
      const m = vivo.current;
      const dt = ultimo > 0 ? Math.min(0.05, (now - ultimo) / 1000) : 1 / 60;
      ultimo = now;
      const paso = pasoFrasco(estado, orden.tipo === 'quieto' ? { ...orden, dt, reducir: m.reducir } : orden);
      const eraReinicio = estado.reinicio;
      if (anguloFijo === null) {
        estado = paso.estado;
        orden = { tipo: 'quieto', dt, reducir: m.reducir };
        if (paso.volteoCompletado) m.onVolteo();
        if (eraReinicio && !estado.reinicio) m.onVueltaLista();
      } else {
        // Ángulo de prueba: se pinta ese valor y no se suelta al muelle.
        estado = { fase: 'reposo', angulo: anguloFijo, velocidad: 0, objetivo: anguloFijo, reinicio: false };
        orden = { tipo: 'quieto', dt, reducir: m.reducir };
      }
      if (m.vuelta !== vueltaVista) {
        vueltaVista = m.vuelta;
        if (m.pausado || m.reducir || anguloFijo !== null) m.onVueltaLista();
        else orden = { tipo: 'reiniciar', reducir: false };
      }
      if (anguloFijo !== null) {
        superficie = muelleQuieto(0);
        anguloPrevio = estado.angulo;
      } else {
        const delta = estado.angulo - anguloPrevio;
        anguloPrevio = estado.angulo;
        const constantes = muelleSuperficie();
        superficie = pasoMuelle(
          { valor: superficie.valor + delta, velocidad: superficie.velocidad },
          0,
          dt,
          constantes.rigidez,
          constantes.amortiguacion,
        );
      }

      const snap = m.getSnapshot();
      const tiempo = m.contenidoFijo ?? snap;
      const fraccion =
        tiempo.durationMs > 0 ? Math.min(1, Math.max(0, tiempo.remainingMs / tiempo.durationMs)) : 0;
      const arriba = nivelDesdeTiempo(tiempo.durationMs, tiempo.remainingMs);
      const objetivo = granosObjetivo(sim.totalGrains, tiempo.durationMs, tiempo.remainingMs);
      const girando = estado.fase === 'volteando';
      let movio = forzar || girando || Math.abs(estado.velocidad) > 0;
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
        cargarArena(activos, despertar);
        const inclinado = Math.abs(estado.angulo) >= 0.05;
        const suave = inclinado ? gravedadDelAngulo(estado.angulo) : GRAVITY_DOWN;
        const gravedad = lod.update(now, suave, suave, ultimoSim);
        const tSim = performance.now();
        if (
          !inclinado &&
          (paso.volteoCompletado || (!girando && estado.fase !== 'arrastrando' && snap.status === 'idle'))
        ) {
          if (sim.topCount !== objetivo) {
            sim.arrange(objetivo, Math.max(0, sim.totalGrains - objetivo), GRAVITY_DOWN);
            movio = true;
          }
        } else if (!girando && snap.status !== 'idle') {
          const inicial = granosObjetivo(sim.totalGrains, snap.durationMs, snap.durationMs);
          const budget = flowBudget(inicial, snap.durationMs, sim.totalGrains);
          if (syncSandToTarget(sim, objetivo, gravedad, { ...budget, crater: 0.16 }) !== 'idle') movio = true;
          if (sim.step(gravedad) > 0) movio = true;
        } else if (inclinado || estado.fase === 'arrastrando') {
          if (sim.step(gravedad) > 0) movio = true;
        }
        ultimoSim = performance.now() - tSim;
        input.dt = dt;
        input.emitting =
          !girando && snap.status === 'running' && snap.remainingMs > 0 && sim.hasGrainAtNeck(gravedad);
        input.gravity = gravedad;
        input.calm = m.reducir;
        particles.update(sim, input);
        if (movio || particles.active) pintarArena();
      }

      const suave = suavizar(now, { frasco: m.layout.frasco, nube: m.layout.nube });
      visto = suave.par.frasco;
      if (suave.sigue) movio = true;

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
          frasco: suave.par.frasco,
          nube: suave.par.nube,
          luz: m.luz,
          tipo: m.tipo,
          angulo: estado.angulo,
          anguloAgua: estado.angulo,
          phi: superficie.valor,
          volumenArriba: m.tipo === 'agua' ? fraccion : arriba,
          volumenAbajo: m.tipo === 'agua' ? 1 - fraccion : nivelAbajo(tiempo.durationMs, tiempo.remainingMs),
          oscuro: m.granos === 'oscura',
          dt,
          geo,
          mostrarNube: m.mostrarNube,
          reducir: m.reducir,
          llueve: m.tipo === 'agua' && snap.status === 'running' && fraccion > 0.01 && fraccion < 0.995,
          sim,
          chorro: particles,
          lut,
          arena,
        },
        activos,
      );

      const video = nubeRef.current;
      if (video && nubeLista) {
        const caja = cajaNube(visto);
        video.style.transform = `translate3d(${Math.round(caja.x)}px, ${Math.round(caja.y)}px, 0)`;
        video.style.width = `${Math.round(caja.w)}px`;
        video.style.height = `${Math.round(caja.h)}px`;
        video.style.opacity = m.mostrarNube ? opacidadNube(estado.angulo).toFixed(3) : '0';
        video.style.filter = `brightness(${m.luz.nube.brillo}) saturate(${m.luz.nube.saturacion})`;
        activarNube(video, m.mostrarNube && !document.hidden && !m.reducir, m.ahorro);
      }
      const seguir =
        movio ||
        particles.active ||
        snap.status === 'running' ||
        estado.fase !== 'reposo' ||
        Math.abs(estado.angulo) > 0.001 ||
        Math.abs(superficie.valor) > 0.01 ||
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
    const quitarAngulo = alFijarAngulo((radianes) => {
      anguloFijo = radianes;
      despertar();
    });
    const ocioso =
      window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 500) as unknown as number);
    ocioso(() => {
      nubeLista = true;
      despertar();
    });

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const down = (event: PointerEvent) => {
      if (vivo.current.pausado || estado.fase === 'volteando') return;
      const p = local(event);
      const frasco = visto;
      if (!dentro(frasco, p.x, p.y, estado.angulo, geo)) return;
      const ang = Math.atan2(p.y - (frasco.y + frasco.h / 2), p.x - (frasco.x + frasco.w / 2));
      arrastre = { id: event.pointerId, inicio: ang, base: estado.angulo, movio: false };
      canvas.setPointerCapture(event.pointerId);
      despertar();
    };
    const move = (event: PointerEvent) => {
      if (!arrastre || arrastre.id !== event.pointerId) return;
      const p = local(event);
      const frasco = visto;
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
      quitarAngulo();
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

function geometriaDe(lienzo: HTMLCanvasElement): Geometria | null {
  const g = lienzo.getContext('2d');
  if (!g || lienzo.width < 2) return null;
  const imagen = g.getImageData(0, 0, lienzo.width, lienzo.height);
  const luma = new Uint8Array(lienzo.width * lienzo.height);
  for (let i = 0, p = 0; i < imagen.data.length; i += 4, p++) luma[p] = imagen.data[i + 3] ?? 0;
  return desdeLuminancia(luma, lienzo.width, lienzo.height);
}
