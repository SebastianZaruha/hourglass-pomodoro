import {
  GRAVITY_DOWN,
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  MIN_FLOW_GRAVITY_Y,
  SAND,
  SandSimulation,
  StreamParticles,
  TILT_LOD,
  TiltLod,
  flowBudget,
  quantizeDirection,
  sandLevelForDuration,
  syncSandToTarget,
  targetSourceGrains,
  type HourglassProfile,
  type MutableVec2,
  type SessionSnapshot,
  type StreamInput,
} from '@reloj/core';

import { MS_MEDIA_VUELTA, easeInOutCubic } from '../../comun/giro';
import {
  RELLENO_ANCHO,
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

/**
 * Embudo del bulbo de arriba. 0,16 era una V de punta y, al vaciar por el
 * centro, se hundía mucho más. 0,10 deja una hondonada de unos 5 % del ancho.
 */
const TOP_CRATER = 0.1;
/**
 * Lo mismo que el móvil (`useSandEngine`): dos pasos por fotograma, y hasta
 * tres tandas de 60 fps si el fotograma llega tarde. Con menos detalle no
 * se pone al día.
 */
const STEPS_PER_FRAME = 2;
const MAX_CATCH_UP = 3;
/**
 * Escalón de la gravedad real, como el móvil (`MotionProcessor`, 3°).
 * `step` recibe (sin θ, cos θ) en esos escalones. Por debajo del ángulo
 * de reposo el montón casi no se mueve; boca abajo, los granos caen hacia
 * la tapa. El cuello solo lo abre el temporizador, con el ángulo real.
 */
const PASO_SIM_GRADOS = 3;
/** Por debajo de esto el frasco ya no gira y el montón puede asentarse. */
const QUIETO = (TILT_LOD.restDegPerSec * Math.PI) / 180;
/** El contenido saliente llega a 4 px de desenfoque; el entrante sale de ahí. */
const BLUR_FUNDIDO = 4;

function copiarLienzo(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const copia = document.createElement('canvas');
  copia.width = src.width;
  copia.height = src.height;
  const ctx = copia.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  return copia;
}

/** Gravedad en el marco del frasco: de pie es (0, 1); boca abajo, (0, −1). */
function gravedadDelAngulo(angulo: number, out: MutableVec2): void {
  out.x = Math.sin(angulo);
  out.y = Math.cos(angulo);
}

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
  const ancho = guess.halfW * 2 * RELLENO_ANCHO * (geo.ventana.x1 - geo.ventana.x0);
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
 * La arena publicada, en la ventana de la foto. Al inclinar, cada grano
 * resbala con la gravedad del ángulo, como el móvil con el acelerómetro.
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
  let fundido: {
    desde: number;
    queda: number;
    viejo: HTMLCanvasElement;
    blurSale: number;
    blurEntra: number;
  } | null = null;
  /** El montón nuevo ya está colocado: el cierre del giro no lo vuelve a armar. */
  let preparado = false;
  let muerto = false;
  let fallo = false;
  const gravedad: MutableVec2 = { x: 0, y: 1 };
  const gravedadSim: MutableVec2 = { x: 0, y: 1 };
  const lod = new TiltLod();
  const presupuesto = { maxPerFrame: 8, teleportThreshold: 40, crater: TOP_CRATER };
  let simMs = 0;
  let ultimoAhora = 0;

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
      // Reinicio: el montón nuevo se coloca al empezar la media vuelta y se
      // funde con el viejo durante esos 900 ms. No hay paso de granos.
      const reinicio = e.fase === 'volteo' && snap.status !== 'running' && !e.reducir;
      if (reinicio && !preparado && sandCanvas) {
        subir();
        const viejo = copiarLienzo(sandCanvas);
        if (viejo) {
          const level = nivel(sim, snap.durationMs);
          sim.arrange(level, Math.max(0, sim.totalGrains - level), GRAVITY_DOWN, { crater: TOP_CRATER });
          runInitial = level;
          idleKey = String(snap.durationMs);
          mode = 'idle';
          populated = true;
          dirty = true;
          subir();
          particles.reset(3);
          lod.reset();
          fundido = { desde: e.ahora, queda: 1, viejo, blurSale: 0, blurEntra: BLUR_FUNDIDO };
          preparado = true;
        }
      }
      if (preparado && fundido && e.fase === 'volteo') {
        const key = String(snap.durationMs);
        if (snap.status !== 'idle' || idleKey !== key) {
          fundido = null;
          preparado = false;
        } else {
          const t = Math.min(1, Math.max(0, (e.ahora - fundido.desde) / MS_MEDIA_VUELTA));
          const u = easeInOutCubic(t);
          fundido.queda = 1 - u;
          fundido.blurSale = BLUR_FUNDIDO * u;
          fundido.blurEntra = BLUR_FUNDIDO * (1 - u);
          ultimoAhora = e.ahora;
          return true;
        }
      }
      const turning = e.fase === 'volteo';
      // El ángulo del volteo y el de la intro no son una inclinación: el
      // frasco gira entero y la arena va pegada. Solo el arrastre y la
      // vuelta del muelle cambian la gravedad.
      if (turning) lod.reset();
      const inclinado = !turning && (e.fase === 'arrastre' || e.fase === 'volviendo');
      const angulo = inclinado ? e.angulo : 0;
      gravedadDelAngulo(angulo, gravedad);
      quantizeDirection(gravedad, PASO_SIM_GRADOS, gravedadSim);
      const gs = turning ? gravedadSim : lod.update(e.ahora, gravedad, gravedadSim, simMs);
      const frameDt = ultimoAhora > 0 ? (e.ahora - ultimoAhora) / 1000 : 1 / 60;
      ultimoAhora = e.ahora;
      const ticks = lod.isActive ? 1 : Math.min(MAX_CATCH_UP, Math.max(1, Math.round(frameDt * 60 - 0.2)));

      if (turns === null || !populated) turns = snap.transitions;
      else if (snap.transitions !== turns) {
        turns = snap.transitions;
        sim.flushSource(gs);
        if (e.reducir) {
          sim.rotateHalfTurn();
          lod.reset();
          runInitial = sim.topCount;
          dirty = true;
          particles.reset(7);
        }
      }

      if (!turning && snap.status === 'idle') {
        const key = String(snap.durationMs);
        if (mode !== 'idle' || idleKey !== key || !populated) {
          const level = nivel(sim, snap.durationMs);
          sim.arrange(level, Math.max(0, sim.totalGrains - level), gs, { crater: TOP_CRATER });
          runInitial = level;
          idleKey = key;
          populated = true;
          dirty = true;
          particles.reset(3);
        }
      } else if (!populated) {
        const level = nivel(sim, snap.durationMs);
        const top = targetSourceGrains(level, snap.remainingMs, snap.durationMs);
        sim.arrange(top, Math.max(0, sim.totalGrains - top), gs, { crater: TOP_CRATER });
        runInitial = level;
        populated = true;
        dirty = true;
      }
      mode = snap.status;

      let moved = false;
      if (turning) {
        // Durante el giro la arena va pegada al vidrio: no se simula.
      } else if (populated) {
        // Solo el flujo del tiempo pasa granos por el cuello. Inclinar solo resbala.
        const syncing = snap.status !== 'idle';
        const budget = syncing ? flowBudget(runInitial, snap.durationMs, sim.totalGrains) : null;
        if (budget) {
          presupuesto.maxPerFrame = budget.maxPerFrame;
          presupuesto.teleportThreshold = budget.teleportThreshold;
        }
        const target = syncing ? targetSourceGrains(runInitial, snap.remainingMs, snap.durationMs) : 0;
        const simStart = performance.now();
        for (let k = 0; k < ticks; k++) {
          if (budget && syncSandToTarget(sim, target, gravedad, presupuesto) !== 'idle') moved = true;
          for (let s = 0; s < STEPS_PER_FRAME; s++) if (sim.step(gs) > 0) moved = true;
        }
        // Quieto: más pasos hasta que el montón se apoya, también al volver
        // a vertical. El tope es el de TiltLod; con el detalle bajado, no.
        const quieto = Math.abs(e.velocidad) < QUIETO;
        if (quieto && !lod.isActive && !sim.isSettled) {
          const tope = simStart + TILT_LOD.heavyFrameMs - 4;
          let n = 0;
          while (n < 600 && performance.now() < tope && !sim.isSettled) {
            n += 1;
            if (sim.step(gs) > 0) moved = true;
          }
        }
        simMs = performance.now() - simStart;
      }

      const streaming =
        !turning &&
        snap.status === 'running' &&
        snap.remainingMs > 0 &&
        gravedad.y >= MIN_FLOW_GRAVITY_Y &&
        sim.hasGrainAtNeck(gravedad);
      input.dt = e.dt;
      input.emitting = streaming;
      input.intensity = streamIntensity(snap.durationMs);
      input.calm = e.reducir;
      input.gravity = gravedad;
      particles.update(sim, input);

      if (moved || turning) dirty = true;
      subir();

      return !sim.isSettled || particles.active || turning || lod.isActive;
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
        fundido: fundido ?? undefined,
      });
    },
    alVoltear(motivo: 'reinicio' | 'fase', snap: SessionSnapshot): void {
      if (muerto || !sim || !particles) return;
      if (motivo === 'fase') {
        sim.rotateHalfTurn();
        lod.reset();
        runInitial = sim.topCount;
        dirty = true;
        particles.reset(7);
        subir();
        return;
      }
      if (!flipHold) {
        // Un fotograma a 180°. La arena nueva ya está puesta; el bitmap
        // entrante se pinta dado la vuelta para coincidir con este ángulo.
        flipHold = true;
        particles.reset(7);
        return;
      }
      flipHold = false;
      if (preparado) {
        preparado = false;
        fundido = null;
        lod.reset();
        dirty = true;
        particles.reset(3);
        subir();
        runInitial = sim.topCount;
        idleKey = String(snap.durationMs);
        mode = 'idle';
        populated = true;
        return;
      }
      sim.rotateHalfTurn();
      lod.reset();
      const level = nivel(sim, snap.durationMs);
      sim.arrange(level, Math.max(0, sim.totalGrains - level), GRAVITY_DOWN, { crater: TOP_CRATER });
      runInitial = level;
      idleKey = String(snap.durationMs);
      mode = 'idle';
      populated = true;
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
