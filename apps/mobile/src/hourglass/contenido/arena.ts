/**
 * Arena del móvil. La simulación, el flujo, las partículas y el pintor
 * viven aquí. El bucle solo llama a `paso`, `pintar` y `alVoltear`.
 */
import {
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  MIN_FLOW_GRAVITY_Y,
  MS_LLENADO,
  SandSimulation,
  StreamParticles,
  flowBudget,
  sandLevelForDuration,
  syncSandToTarget,
  targetSourceGrains,
  type ContentDefinition,
  type HourglassModel,
  type StreamInput,
} from '@reloj/core';
import type { SkImage, SkPicture } from '@shopify/react-native-skia';

import type { HourglassTheme } from '../../theme/theme';
import { disposeLater } from '../disposal';
import type { HourglassLayout } from '../layout';
import type { ShaderSet } from '../resources';
import { SandPainter, buildPaletteLut, type StreamState } from '../sandPainter';
import type { MotionSource } from '../types';
import type { EntradaMotor, MotorContenido } from './tipos';

/** Pasos de simulación por fotograma (más = arena más "viva", más CPU). */
const STEPS_PER_FRAME = 2;
/**
 * Embudo suave de la arena en reposo (al elegir duración o reiniciar):
 * el centro algo más bajo que los lados, nunca una línea recta (1.6).
 */
const IDLE_CRATER = 0.25;

function primeraFilaOcupada(sim: SandSimulation, desde: number, hasta: number): number {
  for (let fila = desde; fila < hasta; fila++) {
    const inicio = fila * sim.cols;
    for (let i = inicio; i < inicio + sim.cols; i++) {
      if (sim.cells[i]) return fila;
    }
  }
  return hasta;
}

function streamIntensity(durationMs: number): number {
  const t = Math.log(durationMs / MIN_DURATION_MS) / Math.log(MAX_DURATION_MS / MIN_DURATION_MS);
  return 1 - 0.6 * Math.min(1, Math.max(0, t));
}

export interface OpcionesArena {
  readonly model: HourglassModel;
  readonly cols: number;
  readonly content: ContentDefinition;
}

export interface OpcionesPintor {
  readonly layout: HourglassLayout;
  readonly model: HourglassModel;
  readonly theme: HourglassTheme;
  readonly content: ContentDefinition;
  readonly shaders: ShaderSet;
  /** Grados, o null si la luz es la de siempre. */
  readonly luzGrano: number | null;
  /** Foto del fondo, para el agua. La arena no la usa. */
  readonly foto: SkImage | null;
  readonly anclaY: number;
}

/** La arena, lista para que el bucle la mueva. El pintor se pone aparte: el tema no reinicia la simulación. */
export function crearArena(opts: OpcionesArena): ContenidoArena {
  return new ArenaMotor(opts);
}

export interface ContenidoArena extends MotorContenido {
  ponerPintor(opts: OpcionesPintor): void;
}

class ArenaMotor implements ContenidoArena {
  private readonly sim: SandSimulation;
  private painter: SandPainter | null = null;
  private readonly particles = new StreamParticles({ capacity: 360, seed: 7 });
  /** Simulación ya rellenada. */
  private listo = false;
  /**
   * Granos del bulbo de arriba al empezar ESTA tanda. Normalmente los que
   * corresponden a la duración; tras voltear, los que había abajo.
   */
  private runInitial = 0;
  private streamShown = false;
  private streaming = false;
  private reducir = false;
  private llenado: { ms: number; progreso: number; supArriba: number; supAbajo: number } | null = null;
  hayQuePintar = false;
  simMs = 0;
  /** Sube cada vez que cambia el pintor (el bucle vuelve a pintar). */
  revision = 0;
  private readonly stream: StreamState = { flowing: false, particles: null, reduceMotion: false };
  private readonly particleInput: StreamInput = {
    dt: 0,
    emitting: false,
    intensity: 1,
    gravity: { x: 0, y: 1 },
    calm: false,
  };

  constructor(opts: OpcionesArena) {
    this.sim = new SandSimulation({
      profile: opts.model.profile,
      cols: opts.cols,
      slideChance: opts.content.slideChance,
      fillRatio: opts.content.fillRatio,
      seed: 7,
      deslizarConGiroPequeno: false,
    });
  }

  ponerPintor(opts: OpcionesPintor): void {
    const palette = opts.theme.scheme === 'dark' ? opts.content.palette.dark : opts.content.palette.light;
    const next = new SandPainter(
      opts.layout,
      opts.model,
      opts.theme,
      buildPaletteLut(palette),
      opts.shaders,
      opts.luzGrano,
    );
    const prev = this.painter;
    this.painter = next;
    this.revision += 1;
    if (prev) disposeLater([prev]);
  }

  paso(e: EntradaMotor): boolean {
    if (e.vaciar && this.listo) this.sim.flushSource(e.gravedad);
    if (e.soloVaciar) return false;
    if (e.reposo) {
      const granos = Math.round(this.sim.totalGrains * sandLevelForDuration(e.durationMs));
      this.sim.arrange(granos, this.sim.totalGrains - granos, e.gravedad, { crater: IDLE_CRATER });
      this.listo = true;
      this.runInitial = granos;
      this.llenado = null;
      if (e.rellenar) {
        this.particles.reset(7);
        this.streaming = false;
        this.hayQuePintar = true;
        this.llenado = {
          ms: 0,
          progreso: 0,
          supArriba: primeraFilaOcupada(this.sim, 0, this.sim.gateRow),
          supAbajo: primeraFilaOcupada(this.sim, this.sim.gateRow + 1, this.sim.rows),
        };
      }
      return this.llenado !== null;
    }
    const llenado = this.llenado;
    if (llenado && e.snap.status === 'idle' && !e.enGiro && !e.reducir) {
      // Como en la web: durante el revelado los granos ya están asentados.
      llenado.ms += Math.max(0, Math.min(0.1, e.dt)) * 1000;
      const t = Math.min(1, llenado.ms / MS_LLENADO);
      if (t < 1) {
        llenado.progreso = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
        this.hayQuePintar = true;
        return true;
      }
    }
    this.llenado = null;
    let movio = llenado !== null;
    if (!this.listo) {
      this.runInitial = Math.round(this.sim.totalGrains * sandLevelForDuration(e.durationMs));
      const top =
        e.snap.status === 'idle'
          ? this.runInitial
          : targetSourceGrains(this.runInitial, e.snap.remainingMs, e.snap.durationMs);
      this.sim.arrange(top, this.sim.totalGrains - top, e.gravedad, {
        crater: e.snap.status === 'idle' ? IDLE_CRATER : 0.35,
      });
      this.listo = true;
      this.particles.reset(7);
      movio = true;
    }
    const syncing = e.snap.status !== 'idle' && !e.enGiro;
    const target = syncing ? targetSourceGrains(this.runInitial, e.snap.remainingMs, e.snap.durationMs) : 0;
    const budget = syncing ? flowBudget(this.runInitial, e.snap.durationMs, this.sim.totalGrains) : null;
    const simStart = performance.now();
    for (let k = 0; k < e.ticks; k++) {
      if (budget && syncSandToTarget(this.sim, target, e.gravedad, budget) !== 'idle') movio = true;
      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        if (this.sim.step(e.gravedad) > 0) movio = true;
      }
    }
    this.simMs = performance.now() - simStart;
    const streaming =
      !e.enGiro &&
      e.snap.status === 'running' &&
      e.snap.remainingMs > 0 &&
      e.gravedad.y >= MIN_FLOW_GRAVITY_Y &&
      this.sim.hasGrainAtNeck(e.gravedad);
    const pin = this.particleInput;
    pin.dt = e.dt;
    pin.emitting = streaming;
    pin.intensity = streamIntensity(e.snap.durationMs);
    pin.gravity = e.gravedadSuave;
    pin.calm = e.reducir;
    this.particles.update(this.sim, pin);
    this.streaming = streaming;
    this.reducir = e.reducir;
    this.hayQuePintar = movio || this.particles.active || streaming !== this.streamShown;
    return !this.sim.isSettled || this.particles.active;
  }

  pintar(motion: MotionSource, giro: number): SkPicture {
    const painter = this.painter;
    if (!painter) throw new Error('La arena no tiene pintor.');
    const stream = this.stream;
    stream.flowing = this.streaming;
    stream.particles = this.particles;
    stream.reduceMotion = this.reducir;
    this.streamShown = this.streaming;
    return painter.paint(this.sim, motion, stream, giro, this.llenado);
  }

  alVoltear(_motivo: 'reinicio' | 'fase'): void {
    if (this.listo) {
      this.sim.rotateHalfTurn();
      this.runInitial = this.sim.topCount;
    }
    this.particles.reset(7);
  }

  destruir(): void {
    const painter = this.painter;
    this.painter = null;
    if (painter) disposeLater([painter]);
  }
}
