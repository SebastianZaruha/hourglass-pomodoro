import {
  CLASSIC_MODEL,
  GRAVITY_DOWN,
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  SAND,
  SandSimulation,
  StreamParticles,
  flowBudget,
  sandLevelForDuration,
  syncSandToTarget,
  targetSourceGrains,
  type SessionSnapshot,
  type StreamInput,
} from '@reloj/core';

import {
  layoutFor,
  type Contenido,
  type EntradaPaso,
  type MedidaLienzo,
  type Pintura,
  type Scheme,
} from '../../comun/frasco';
import { buildPaletteLut, makeGrainNoise, paintCells, pintarArena } from './pintarArena';

/** Embudo del bulbo de arriba. Más bajo que 0,25: la V queda menos honda. */
const TOP_CRATER = 0.16;
const STEPS_PER_FRAME = 2;
const SAND_CELL_PX = 2.15;

const PALETA = { light: SAND.palette.light, dark: SAND.palette.dark } as const;
const A_SCHEME: Record<'claro' | 'oscuro', Scheme> = { claro: 'light', oscuro: 'dark' };

function streamIntensity(durationMs: number): number {
  const t = Math.log(durationMs / MIN_DURATION_MS) / Math.log(MAX_DURATION_MS / MIN_DURATION_MS);
  return 1 - 0.6 * Math.min(1, Math.max(0, t));
}

function nivel(sim: SandSimulation, durationMs: number): number {
  return Math.round(sim.totalGrains * sandLevelForDuration(durationMs));
}

/**
 * La arena publicada. La rejilla, el chorro y el nivel según el tiempo
 * no cambian: solo viven aquí, detrás de Contenido.
 */
export function crearArena(medida: MedidaLienzo, esquema: 'claro' | 'oscuro'): Contenido {
  const profile = CLASSIC_MODEL.profile;
  const guess = layoutFor(medida.ancho, medida.alto, profile);
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
  if (!sandCtx) throw new Error('Sin lienzo de arena');
  const image = sandCtx.createImageData(sim.cols, sim.rows);
  const noise = makeGrainNoise();

  let scheme: Scheme = A_SCHEME[esquema];
  let lut = buildPaletteLut(PALETA[scheme]);
  let dirty = true;
  let populated = false;
  let idleKey = '';
  let mode = '';
  let runInitial = 0;
  let turns: number | null = null;
  let flipHold = false;
  let muerto = false;

  const subir = () => {
    if (!dirty) return;
    paintCells(sim, lut, image);
    sandCtx.putImageData(image, 0, 0);
    dirty = false;
  };

  const contenido: Contenido = {
    paso(e: EntradaPaso): boolean {
      if (muerto) return false;
      const snap = e.snap;
      const turning = e.fase === 'volteo';

      if (turns === null || !populated) turns = snap.transitions;
      else if (snap.transitions !== turns) {
        turns = snap.transitions;
        sim.flushSource(GRAVITY_DOWN);
        if (e.reducir) {
          sim.rotateHalfTurn();
          runInitial = sim.topCount;
          dirty = true;
          particles.reset(7);
        }
      }

      if (!turning && snap.status === 'idle') {
        const key = String(snap.durationMs);
        if (mode !== 'idle' || idleKey !== key || !populated) {
          const level = nivel(sim, snap.durationMs);
          sim.arrange(level, Math.max(0, sim.totalGrains - level), GRAVITY_DOWN, { crater: TOP_CRATER });
          runInitial = level;
          idleKey = key;
          populated = true;
          dirty = true;
          particles.reset(3);
        }
      } else if (!populated) {
        const level = nivel(sim, snap.durationMs);
        const top = targetSourceGrains(level, snap.remainingMs, snap.durationMs);
        sim.arrange(top, Math.max(0, sim.totalGrains - top), GRAVITY_DOWN, { crater: TOP_CRATER });
        runInitial = level;
        populated = true;
        dirty = true;
      }
      mode = snap.status;

      let moved = false;
      const ticks = Math.min(3, Math.max(1, Math.round(e.dt * 60 - 0.2)));
      if (turning) {
        // Durante el giro la arena va pegada al vidrio.
      } else if (populated && snap.status !== 'idle') {
        const target = targetSourceGrains(runInitial, snap.remainingMs, snap.durationMs);
        const budget = flowBudget(runInitial, snap.durationMs, sim.totalGrains);
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
      input.dt = e.dt;
      input.emitting = streaming;
      input.intensity = streamIntensity(snap.durationMs);
      input.calm = e.reducir;
      input.gravity = GRAVITY_DOWN;
      particles.update(sim, input);

      if (moved || turning) dirty = true;
      subir();

      return !sim.isSettled || particles.active || turning;
    },
    pintar(ctx: CanvasRenderingContext2D, p: Pintura): void {
      if (muerto) return;
      const next = A_SCHEME[p.esquema];
      if (next !== scheme) {
        scheme = next;
        lut = buildPaletteLut(PALETA[scheme]);
        dirty = true;
        subir();
      }
      pintarArena(ctx, {
        scheme,
        caja: p.caja,
        sand: sandCanvas,
        noise,
        sim,
        particles,
        lut,
      });
    },
    alVoltear(motivo: 'reinicio' | 'fase', snap: SessionSnapshot): void {
      if (muerto) return;
      if (motivo === 'fase') {
        sim.rotateHalfTurn();
        runInitial = sim.topCount;
        dirty = true;
        particles.reset(7);
        subir();
        return;
      }
      if (!flipHold) {
        const level = nivel(sim, snap.durationMs);
        sim.arrange(Math.max(0, sim.totalGrains - level), level, GRAVITY_DOWN, { crater: TOP_CRATER });
        flipHold = true;
        dirty = true;
        particles.reset(7);
        subir();
        return;
      }
      sim.rotateHalfTurn();
      runInitial = sim.topCount;
      idleKey = String(snap.durationMs);
      populated = true;
      flipHold = false;
      dirty = true;
      particles.reset(3);
      subir();
    },
    destruir(): void {
      muerto = true;
    },
  };
  return contenido;
}
