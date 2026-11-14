import {
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
  type HourglassProfile,
  type SessionSnapshot,
  type StreamInput,
} from '@reloj/core';

import {
  geometriaDelFrasco,
  layoutFor,
  type Contenido,
  type EntradaPaso,
  type GeometriaFrasco,
  type MedidaLienzo,
  type Pintura,
  type Scheme,
} from '../../comun/frasco';
import { buildPaletteLut, makeGrainNoise, paintCells, pintarArena } from './pintarArena';

/** Embudo del bulbo de arriba, el de la publicada. */
const TOP_CRATER = 0.16;
const STEPS_PER_FRAME = 2;
const SAND_CELL_PX = 2.15;
/** Ventana interior de la foto: 961 de alto y 395 de ancho. */
const PERFIL: HourglassProfile = {
  halfHeightRatio: 961 / 395,
  bulbCenter: 0.5,
  bulbRadiusY: 0.5,
  neckRadius: 0,
  fillet: 0.14,
  egg: 0,
  taper: 1,
  wallThickness: 0,
};

const PALETA = { light: SAND.palette.light, dark: SAND.palette.dark } as const;
const A_SCHEME: Record<'claro' | 'oscuro', Scheme> = { claro: 'light', oscuro: 'dark' };

function streamIntensity(durationMs: number): number {
  const t = Math.log(durationMs / MIN_DURATION_MS) / Math.log(MAX_DURATION_MS / MIN_DURATION_MS);
  return 1 - 0.6 * Math.min(1, Math.max(0, t));
}

function nivel(sim: SandSimulation, durationMs: number): number {
  return Math.round(sim.totalGrains * sandLevelForDuration(durationMs));
}

function columnas(anchoInterior: number): number {
  let n = Math.round(anchoInterior / SAND_CELL_PX);
  if (n % 2 === 0) n += 1;
  return Math.max(121, Math.min(181, n));
}

function crearSim(medida: MedidaLienzo, geo: GeometriaFrasco): SandSimulation {
  const guess = layoutFor(medida.ancho, medida.alto);
  const ancho = guess.halfW * 2 * (geo.ventana.x1 - geo.ventana.x0);
  return new SandSimulation({
    profile: PERFIL,
    cols: columnas(ancho),
    seed: 11,
    slideChance: SAND.slideChance,
    fillRatio: SAND.fillRatio,
    staticFriction: 0.28,
    radioInterior: (y) => geo.radio(y),
  });
}

/**
 * La arena publicada, en la ventana de la foto. Todavía no reacciona
 * a la inclinación: el frasco gira y la arena va pegada al vidrio.
 */
export function crearArena(medida: MedidaLienzo, esquema: 'claro' | 'oscuro'): Contenido {
  let sim: SandSimulation | null = null;
  let geo: GeometriaFrasco | null = null;
  let particles: StreamParticles | null = null;
  let sandCanvas: HTMLCanvasElement | null = null;
  let sandCtx: CanvasRenderingContext2D | null = null;
  let image: ImageData | null = null;
  const noise = makeGrainNoise();
  const input: StreamInput = {
    dt: 1 / 60,
    emitting: false,
    intensity: 0.7,
    gravity: GRAVITY_DOWN,
    calm: false,
  };

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
  let fallo = false;

  void geometriaDelFrasco().then(
    (g) => {
      if (muerto) return;
      geo = g;
      sim = crearSim(medida, g);
      particles = new StreamParticles({ capacity: 280, seed: 5 });
      sandCanvas = document.createElement('canvas');
      sandCanvas.width = sim.cols;
      sandCanvas.height = sim.rows;
      sandCtx = sandCanvas.getContext('2d');
      if (sandCtx) image = sandCtx.createImageData(sim.cols, sim.rows);
      dirty = true;
    },
    () => {
      fallo = true;
    },
  );

  const subir = () => {
    if (!dirty || !sim || !sandCtx || !image) return;
    paintCells(sim, lut, image);
    sandCtx.putImageData(image, 0, 0);
    dirty = false;
  };

  const contenido: Contenido = {
    paso(e: EntradaPaso): boolean {
      if (muerto || fallo) return false;
      if (!sim || !particles) return true;
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
      if (muerto || !sim || !particles || !sandCanvas || !geo) return;
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
        geo,
      });
    },
    alVoltear(motivo: 'reinicio' | 'fase', snap: SessionSnapshot): void {
      if (muerto || !sim || !particles) return;
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
