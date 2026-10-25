/**
 * Bucle del reloj: la simulación del core marca cuánta arena queda arriba
 * y este lienzo la dibuja. La gravedad es siempre hacia abajo: no hay
 * sensores ni reacción al ratón. Girar el vidrio con el gesto es solo visual
 * Un volteo (arrastre que pasa el umbral, o doble clic) gira 180° y
 * la cuenta vuelve a empezar.
 */
import {
  CLASSIC_MODEL,
  GRAVITY_DOWN,
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  SAND,
  StreamParticles,
  SandSimulation,
  flowBudget,
  sandLevelForDuration,
  syncSandToTarget,
  targetSourceGrains,
  type SessionSnapshot,
  type StreamInput,
} from '@reloj/core';
import { useEffect, type RefObject } from 'react';

import { buildPaletteLut, drawHourglass, layoutFor, makeGrainNoise, paintCells, type Scheme } from './draw';

const TURN_MS = 950;
const FLIP_MS = 1000;
/** Embudo del bulbo de arriba. Más bajo que 0,25: la V queda menos honda. */
const TOP_CRATER = 0.16;
const STEPS_PER_FRAME = 2;
const SAND_CELL_PX = 2.15;

export interface HourglassParams {
  getSnapshot: () => SessionSnapshot;
  scheme: Scheme;
  reduceMotion: boolean;
  gestureAngle: number;
  gestureActive: boolean;
  /** Sube para pedir un giro de 180° que reinicia la cuenta. */
  flipToken: number;
  /** Ángulo del que parte ese giro (radianes). */
  flipFrom: number;
  /** El motor lo pone a true mientras el giro de 180° no ha terminado. */
  flipBusy: boolean;
}

export interface HourglassHandle {
  wake: () => void;
  layoutCss: () => { cx: number; cy: number; halfW: number; halfH: number } | null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function streamIntensity(durationMs: number): number {
  const t = Math.log(durationMs / MIN_DURATION_MS) / Math.log(MAX_DURATION_MS / MIN_DURATION_MS);
  return 1 - 0.6 * Math.min(1, Math.max(0, t));
}

export function useHourglass(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  paramsRef: RefObject<HourglassParams>,
  handleRef: RefObject<HourglassHandle | null>,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;

    const profile = CLASSIC_MODEL.profile;
    const guess = layoutFor(
      Math.max(280, canvas.clientWidth || 480),
      Math.max(360, canvas.clientHeight || 640),
      profile,
    );
    const rawCols = Math.round((guess.halfW * 2) / SAND_CELL_PX);
    const cols = Math.max(121, Math.min(181, rawCols % 2 === 0 ? rawCols + 1 : rawCols));
    const sim = new SandSimulation({
      profile,
      cols,
      seed: 11,
      slideChance: SAND.slideChance,
      fillRatio: SAND.fillRatio,
      staticFriction: 0.28,
    });
    const particles = new StreamParticles({ capacity: 280, seed: 5 });
    const input: StreamInput = {
      dt: 1 / 60,
      emitting: false,
      intensity: 0.7,
      gravity: GRAVITY_DOWN,
      calm: false,
    };
    const sandCanvas = document.createElement('canvas');
    sandCanvas.width = sim.cols;
    sandCanvas.height = sim.rows;
    const sandCtx = sandCanvas.getContext('2d');
    if (!sandCtx) return;
    const image = sandCtx.createImageData(sim.cols, sim.rows);
    const noise = makeGrainNoise();
    let lut = buildPaletteLut(SAND.palette.light);
    let scheme: Scheme = 'light';

    const loop = {
      raf: 0,
      alive: true,
      last: 0,
      populated: false,
      idleKey: '',
      mode: '',
      runInitial: 0,
      turns: null as number | null,
      turnStart: null as number | null,
      spin: 0,
      paint: true,
      layout: null as ReturnType<typeof layoutFor> | null,
      flipToken: paramsRef.current.flipToken,
      flipStart: null as number | null,
      flipFrom: 0,
      flipDir: 1,
      flipHold: false,
    };

    const paintSand = () => {
      paintCells(sim, lut, image);
      sandCtx.putImageData(image, 0, 0);
    };

    const frame = (now: number) => {
      if (!loop.alive) return;
      const p = paramsRef.current;
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
      loop.layout = layout;

      if (p.scheme !== scheme) {
        scheme = p.scheme;
        lut = buildPaletteLut(scheme === 'dark' ? SAND.palette.dark : SAND.palette.light);
        loop.paint = true;
      }

      if (p.flipToken !== loop.flipToken) {
        loop.flipToken = p.flipToken;
        p.gestureActive = false;
        if (p.reduceMotion) {
          p.gestureAngle = 0;
          p.flipBusy = false;
        } else {
          p.flipBusy = true;
          loop.flipStart = now;
          loop.flipFrom = p.flipFrom;
          loop.flipDir = p.flipFrom < 0 ? -1 : 1;
          p.gestureAngle = 0;
        }
      }

      if (!p.flipBusy && !p.gestureActive && Math.abs(p.gestureAngle) > 0.0008) {
        p.gestureAngle *= 0.84;
        if (Math.abs(p.gestureAngle) < 0.004) p.gestureAngle = 0;
      }

      let flipAngle = 0;
      if (loop.flipStart !== null) {
        const t = Math.min(1, (now - loop.flipStart) / FLIP_MS);
        const dest = loop.flipDir * Math.PI;
        if (t < 1) {
          flipAngle = loop.flipFrom + (dest - loop.flipFrom) * easeInOutCubic(t);
        } else if (!loop.flipHold) {
          const durationMs = p.getSnapshot().durationMs;
          const level = Math.round(sim.totalGrains * sandLevelForDuration(durationMs));
          sim.arrange(Math.max(0, sim.totalGrains - level), level, GRAVITY_DOWN, { crater: TOP_CRATER });
          loop.flipHold = true;
          flipAngle = dest;
          loop.paint = true;
          particles.reset(7);
        } else {
          sim.rotateHalfTurn();
          loop.runInitial = sim.topCount;
          loop.idleKey = String(p.getSnapshot().durationMs);
          loop.populated = true;
          loop.flipStart = null;
          loop.flipHold = false;
          loop.spin = 0;
          flipAngle = 0;
          p.flipBusy = false;
          p.gestureAngle = 0;
          loop.paint = true;
          particles.reset(3);
        }
      }

      const snap = p.getSnapshot();
      const frameDt = loop.last > 0 ? Math.min(0.1, (now - loop.last) / 1000) : 1 / 60;
      loop.last = now;
      const ticks = Math.min(3, Math.max(1, Math.round(frameDt * 60 - 0.2)));

      const turns = snap.transitions;
      if (loop.turns === null || !loop.populated) loop.turns = turns;
      else if (turns !== loop.turns) {
        loop.turns = turns;
        sim.flushSource(GRAVITY_DOWN);
        if (p.reduceMotion) {
          sim.rotateHalfTurn();
          loop.runInitial = sim.topCount;
          loop.spin = 0;
          loop.paint = true;
          particles.reset(7);
        } else if (loop.turnStart === null) loop.turnStart = now;
      }
      if (loop.turnStart !== null) {
        const t = Math.min(1, (now - loop.turnStart) / TURN_MS);
        if (t < 1) loop.spin = Math.PI * easeInOutCubic(t);
        else {
          sim.rotateHalfTurn();
          loop.runInitial = sim.topCount;
          loop.spin = 0;
          loop.turnStart = null;
          loop.paint = true;
          particles.reset(7);
        }
      }
      const turning = loop.turnStart !== null || loop.flipStart !== null;

      if (!turning && snap.status === 'idle') {
        const key = String(snap.durationMs);
        if (loop.mode !== 'idle' || loop.idleKey !== key || !loop.populated) {
          const level = Math.round(sim.totalGrains * sandLevelForDuration(snap.durationMs));
          sim.arrange(level, Math.max(0, sim.totalGrains - level), GRAVITY_DOWN, { crater: TOP_CRATER });
          loop.runInitial = level;
          loop.idleKey = key;
          loop.populated = true;
          loop.paint = true;
          particles.reset(3);
        }
      } else if (!loop.populated) {
        const level = Math.round(sim.totalGrains * sandLevelForDuration(snap.durationMs));
        const top = targetSourceGrains(level, snap.remainingMs, snap.durationMs);
        sim.arrange(top, Math.max(0, sim.totalGrains - top), GRAVITY_DOWN, { crater: TOP_CRATER });
        loop.runInitial = level;
        loop.populated = true;
        loop.paint = true;
      }
      loop.mode = snap.status;

      let moved = false;
      if (turning) {
        // Durante el giro la arena va pegada al vidrio.
      } else if (loop.populated && snap.status !== 'idle') {
        const target = targetSourceGrains(loop.runInitial, snap.remainingMs, snap.durationMs);
        const budget = flowBudget(loop.runInitial, snap.durationMs, sim.totalGrains);
        for (let k = 0; k < ticks; k++) {
          if (syncSandToTarget(sim, target, GRAVITY_DOWN, { ...budget, crater: TOP_CRATER }) !== 'idle')
            moved = true;
          for (let s = 0; s < STEPS_PER_FRAME; s++) if (sim.step(GRAVITY_DOWN) > 0) moved = true;
        }
      } else {
        for (let s = 0; s < STEPS_PER_FRAME; s++) if (sim.step(GRAVITY_DOWN) > 0) moved = true;
      }

      const streaming =
        !turning && snap.status === 'running' && snap.remainingMs > 0 && sim.hasGrainAtNeck(GRAVITY_DOWN);
      input.dt = frameDt;
      input.emitting = streaming;
      input.intensity = streamIntensity(snap.durationMs);
      input.calm = p.reduceMotion;
      input.gravity = GRAVITY_DOWN;
      particles.update(sim, input);

      if (moved || loop.flipStart !== null) loop.paint = true;
      if (loop.paint) {
        paintSand();
        loop.paint = false;
      }

      const rotation = loop.flipStart !== null ? flipAngle : loop.spin + p.gestureAngle;
      drawHourglass(ctx, {
        profile,
        layout,
        scheme,
        sand: sandCanvas,
        noise,
        sim,
        particles,
        lut,
        rotation,
      });

      const keep =
        snap.status === 'running' ||
        !sim.isSettled ||
        particles.active ||
        turning ||
        p.flipBusy ||
        p.gestureActive ||
        Math.abs(p.gestureAngle) > 0.0008;
      if (keep) loop.raf = requestAnimationFrame(frame);
      else loop.raf = 0;
    };

    const wake = () => {
      if (!loop.alive || loop.raf !== 0) return;
      loop.last = 0;
      loop.raf = requestAnimationFrame(frame);
    };
    handleRef.current = { wake, layoutCss: () => loop.layout };
    const observer = new ResizeObserver(() => wake());
    observer.observe(canvas);
    wake();
    return () => {
      loop.alive = false;
      observer.disconnect();
      if (loop.raf) cancelAnimationFrame(loop.raf);
      handleRef.current = null;
    };
  }, [canvasRef, handleRef, paramsRef]);
}
