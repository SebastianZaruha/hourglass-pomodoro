/**
 * Bucle de animación del reloj.
 *
 * En cada fotograma (al ritmo que pide la interfaz, ver useFramePacer;
 * ~60 por segundo si el móvil puede):
 *  0. Si se ha volteado el móvil, la arena da la vuelta (rotateHalfTurn) y el
 *     dibujo gira 180° en el MISMO fotograma (para que no se vea un salto).
 *  1. Pregunta al temporizador cuánto tiempo queda (calculado a partir de
 *     marcas de tiempo, así que siempre es exacto).
 *  2. El controlador de flujo pasa por el cuello los granos necesarios.
 *  3. La simulación avanza los pasos que tocan a ESTE fotograma (120 por
 *     segundo: 2 a 60 Hz, 1 a 120 Hz) con la gravedad del acelerómetro, y
 *     las partículas del chorro se mueven (el chorro se curva con la
 *     inclinación). El vidrio, si acaso, se regraba aparte a ~20 fps: eso
 *     no frena el material, que se publica en cada refresco de la pantalla.
 *  4. Si algo ha cambiado, se pinta un nuevo SkPicture de arena; si ha
 *     cambiado la inclinación, también se regraban las capas del vidrio (la
 *     luz, los reflejos y la sombra se mueven). Todo se publica en "shared
 *     values" de Reanimated: el Canvas lo dibuja en el hilo de UI sin volver
 *     a renderizar componentes de React.
 *
 * Cambio de fase (ciclos, 1.5): cuando `transitions` sube en la foto del
 * temporizador, el reloj se DA LA VUELTA con una animación (`spin`: 0 → π en
 * TURN_MS, lento-rápido-lento). La arena no se toca durante el giro (va
 * «pegada» al vidrio, como en uno de verdad); al terminar, en el MISMO
 * fotograma, la rejilla gira 180° (rotateHalfTurn) y `spin` vuelve a 0: el
 * dibujo es idéntico, pero ahora la arena está arriba y empieza a caer. Lo
 * llevamos aquí (en el hilo de JS) y no con withTiming para que el giro y el
 * cambio de la rejilla nunca se desincronicen ni un fotograma.
 *
 * Giro fuerte (1.8.9): si al inclinar mucho el móvil la simulación no llega
 * (ver `TiltLod` en el core), durante unos segundos la gravedad de la
 * simulación va en escalones más gruesos, no hay puesta al día y el vidrio
 * se regraba a la mitad de ritmo. De pie, de lado o con un móvil que llega,
 * no cambia nada.
 *
 * Cuando la arena está quieta, el temporizador no corre y el móvil no se
 * mueve, el bucle se DETIENE (cero consumo de batería) hasta que algo lo
 * despierta (un cambio de props o un aviso de la fuente de movimiento).
 *
 * Memoria: el bucle no crea objetos JS por fotograma (todo se reutiliza) y
 * cada SkPicture sustituido se libera unos fotogramas después, en un anillo
 * de tamaño fijo (PictureSlot). Si algo falla dentro del bucle (fuera del
 * render de React, así que un error boundary no lo vería), paramos el bucle
 * y avisamos con `onError`.
 */
import {
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  flowBudget,
  flowSpan,
  freshDetail,
  MIN_FLOW_GRAVITY_Y,
  sandLevelForDuration,
  streamDetail,
  StreamParticles,
  syncSandToTarget,
  takeSimSteps,
  targetSourceGrains,
  TiltLod,
  updateDetail,
  type SandSimulation,
  type StreamInput,
  type TimerStatus,
} from '@reloj/core';
import type { SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { useLatest } from '../hooks/useLatest';
import { frameProbeEnabled, noteFrame } from './frameProbe';
import { useFramePacer } from './useFramePacer';
import { PictureSlot, recordEmptyPicture } from './pictureSlot';
import type { SandPainter, StreamState } from './sandPainter';
import type { GlassPainter } from './staticLayers';
import type { HourglassSnapshot, MotionSource } from './types';

export interface SandEngineParams {
  /** Null cuando el reloj muestra un material por porcentaje (no hay rejilla). */
  readonly sim: SandSimulation | null;
  readonly painter: SandPainter | null;
  readonly glass: GlassPainter;
  readonly motion: MotionSource;
  /** Devuelve la foto actual del temporizador. */
  readonly getSnapshot: () => HourglassSnapshot;
  readonly status: TimerStatus;
  readonly durationMs: number;
  readonly reduceMotion: boolean;
  /** Se llama si el dibujo falla (para que un error boundary lo recupere). */
  readonly onError: (error: unknown) => void;
  /** Avisa al empezar (true) y al acabar (false) el giro de cambio de fase. */
  readonly onTurnChange?: (turning: boolean) => void;
}

export interface SandEngineOutput {
  readonly background: SharedValue<SkPicture>;
  readonly shadow: SharedValue<SkPicture>;
  readonly body: SharedValue<SkPicture>;
  readonly sand: SharedValue<SkPicture>;
  readonly front: SharedValue<SkPicture>;
  /** Giro de TODO el dibujo (radianes): 0 de pie, π con el móvil volteado. */
  readonly rotation: SharedValue<number>;
  /** Giro del reloj (sin el fondo) en un cambio de fase: 0 → π. */
  readonly spin: SharedValue<number>;
}

/** Duración del giro en un cambio de fase (ms). */
export const TURN_MS = 950;

/**
 * Embudo suave de la arena en reposo (al elegir duración o reiniciar):
 * el centro algo más bajo que los lados, nunca una línea recta (1.6).
 */
const IDLE_CRATER = 0.25;
/** Cambio mínimo de inclinación para regrabar las capas del vidrio (más pequeño no se ve). */
const LIGHT_EPSILON = 0.01;
/**
 * Como mucho, una regrabación del vidrio cada tanto (ms; ~20 por segundo).
 * La luz y los reflejos se mueven despacio con la inclinación: a 20 fps se
 * ven igual de suaves y son cuatro capas menos que grabar y subir por
 * fotograma al sostener el móvil en la mano (1.8.1).
 */
const GLASS_MIN_MS = 50;
/** Lo mismo durante un giro fuerte con menos detalle (1.8.9, ver TiltLod): ~10 por segundo. */
const GLASS_MIN_MS_LOD = 100;

export function useSandEngine(params: SandEngineParams): SandEngineOutput {
  const { sim, status, durationMs, motion } = params;
  const [emptyPicture] = useState(recordEmptyPicture);
  // Granos sueltos del chorro: capacidad fija, se crean una sola vez.
  const [particles] = useState(() => new StreamParticles({ capacity: 360, seed: 7 }));
  const background = useSharedValue<SkPicture>(emptyPicture);
  const shadow = useSharedValue<SkPicture>(emptyPicture);
  const body = useSharedValue<SkPicture>(emptyPicture);
  const sand = useSharedValue<SkPicture>(emptyPicture);
  const front = useSharedValue<SkPicture>(emptyPicture);
  const rotation = useSharedValue(motion.flipped ? Math.PI : 0);
  const spin = useSharedValue(0);
  const slots = useMemo(
    () => ({
      background: new PictureSlot(background, emptyPicture),
      shadow: new PictureSlot(shadow, emptyPicture),
      body: new PictureSlot(body, emptyPicture),
      sand: new PictureSlot(sand, emptyPicture),
      front: new PictureSlot(front, emptyPicture),
    }),
    [background, shadow, body, sand, front, emptyPicture],
  );

  // Guardamos los parámetros más recientes en una ref para que el bucle
  // (que vive fuera del ciclo de render de React) siempre lea valores frescos.
  const live = useLatest(params);

  /** Granos que había arriba al empezar con esta duración. */
  const initialGrains = useMemo(
    () => (sim ? Math.round(sim.totalGrains * sandLevelForDuration(durationMs)) : 0),
    [sim, durationMs],
  );
  const initialRef = useLatest(initialGrains);

  // Quien da paso al siguiente fotograma: la interfaz, cuando ha dibujado el anterior.
  const pacer = useFramePacer();

  const loop = useRef({
    /** ¿Hay un fotograma pedido? */
    scheduled: false,
    dirty: true,
    failed: false,
    /** Simulación ya rellenada de arena (para detectar simulaciones nuevas). */
    populated: null as SandSimulation | null,
    /**
     * Granos del bulbo de arriba al empezar ESTA tanda. Normalmente los que
     * corresponden a la duración; tras voltear, los que había abajo.
     */
    runInitial: 0,
    /** Volteos ya aplicados a la arena. */
    flips: motion.flips,
    /** Cambios de fase ya vistos (null = aún no sabemos cuántos había). */
    turns: null as number | null,
    /** Inicio (performance.now) del giro de cambio de fase en curso, o null. */
    turnStart: null as number | null,
    streamShown: false,
    /** Capas del vidrio: con qué pintor e inclinación se grabaron. */
    glass: null as GlassPainter | null,
    lightX: Number.NaN,
    lightY: Number.NaN,
    /** Cuándo se grabó el vidrio por última vez (performance.now). */
    glassAt: 0,
    /** La luz ha cambiado pero aún no tocaba regrabar: queda pendiente. */
    glassPending: false,
    /** Estado del chorro reutilizado en cada fotograma (sin crear objetos). */
    stream: { flowing: false, particles: null, reduceMotion: false } as StreamState,
    /** Resto de pasos de simulación (para refrescos que no son 60 ni 120). */
    stepDebt: 0,
    /** Salida reutilizada de `takeSimSteps`. */
    stepSlot: { steps: 0, debt: 0 },
    detail: freshDetail(),
    /** Entrada de las partículas, reutilizada en cada fotograma. */
    particleInput: {
      dt: 0,
      emitting: false,
      intensity: 1,
      gravity: { x: 0, y: 1 },
      calm: false,
    } as StreamInput,
    /** Marca de tiempo del fotograma anterior (para calcular dt). */
    lastTime: 0,
    /** Menos detalle durante un giro fuerte (1.8.9). */
    lod: new TiltLod(),
    /** Lo que costó simular el fotograma anterior (ms), para `lod`. */
    simMs: 0,
  });

  // La función que despierta el bucle (estable entre renders).
  const wake = useCallback(() => {
    const state = loop.current;
    state.dirty = true;
    if (state.scheduled || state.failed) return;

    /** Fin del giro: la rejilla da la vuelta y el dibujo vuelve a 0, a la vez. */
    const finishTurn = (sim: SandSimulation) => {
      if (state.populated === sim) {
        sim.rotateHalfTurn();
        // La nueva fase vacía TODO lo que ahora está arriba (como al voltear).
        state.runInitial = sim.topCount;
      }
      particles.reset(7);
      spin.value = 0;
    };

    const frame = () => {
      state.scheduled = false;
      try {
        runFrame();
      } catch (error) {
        // No reintentamos en bucle: paramos y dejamos que el error boundary
        // remonte el lienzo (el temporizador no se entera: va por timestamps).
        state.failed = true;
        live.current.onError(error);
      }
    };

    const runFrame = () => {
      const p = live.current;
      const sim = p.sim;
      const painter = p.painter;
      if (!sim || !painter) return;
      const m = p.motion;
      const g = m.gravity; // suave: chorro y dibujo
      const snap = p.getSnapshot();

      let changed = state.dirty;
      state.dirty = false;

      // 0) Volteo: la arena da la vuelta y el dibujo gira 180° a la vez.
      if (m.flips !== state.flips) {
        state.flips = m.flips;
        if (state.populated === sim) {
          sim.rotateHalfTurn();
          // La nueva tanda vacía TODO lo que ahora está arriba.
          state.runInitial = sim.topCount;
        }
        particles.reset(7);
        rotation.value = m.flipped ? Math.PI : 0;
        // Voltear no es un giro fuerte «a medias»: calidad normal.
        state.lod.reset();
        changed = true;
      }

      const now = performance.now();
      const frameStart = now;
      // En escalones: simulación. Durante un giro fuerte en un móvil que no
      // llega, escalones más gruesos (TiltLod, 1.8.9).
      const gs = state.lod.update(now, g, m.simGravity, state.simMs);
      const lod = state.lod.isActive;
      const hadClock = state.lastTime > 0;
      const frameDt = hadClock ? (now - state.lastTime) / 1000 : 1 / 60;
      state.lastTime = now;
      // 120 pasos por segundo (2 a 60 Hz, 1 a 120 Hz). En un giro fuerte, uno.
      const slot = state.stepSlot;
      takeSimSteps(state.stepDebt, frameDt, lod, slot);
      state.stepDebt = slot.debt;
      const steps = slot.steps;

      // 0b) Cambio de fase (ciclos): empieza el giro animado del reloj.
      const turns = snap.transitions ?? 0;
      if (state.turns === null || state.populated !== sim) {
        state.turns = turns; // primera foto o simulación nueva: nada que girar
      } else if (turns !== state.turns) {
        state.turns = turns;
        // La fase anterior ha terminado: su arena tiene que estar abajo. Los
        // pocos granos rezagados (resbalan despacio por el embudo) pasan ya;
        // si no, tras el giro quedaban colgando bajo el cuello y bajaban
        // como un bloque.
        sim.flushSource(gs);
        if (p.reduceMotion) {
          // Sin animación: la arena da la vuelta en el acto.
          finishTurn(sim);
        } else if (state.turnStart === null) {
          state.turnStart = now;
          p.onTurnChange?.(true);
        }
        changed = true;
      }
      const turning = state.turnStart !== null;
      if (turning) {
        const t = Math.min(1, (now - (state.turnStart as number)) / TURN_MS);
        if (t < 1) {
          spin.value = Math.PI * easeInOutCubic(t);
        } else {
          finishTurn(sim);
          state.turnStart = null;
          p.onTurnChange?.(false);
        }
        changed = true;
      }

      // 1-2) Sincronizar la arena con el tiempo restante.
      if (state.populated !== sim) {
        // Simulación nueva (cambio de tamaño, Fast Refresh, remontaje tras
        // un error...): la rellenamos según el tiempo restante AHORA. Antes
        // de esto, una simulación recreada con el tiempo corriendo se quedaba
        // vacía y la arena "desaparecía" hasta el siguiente gesto.
        state.runInitial = initialRef.current;
        const top =
          snap.status === 'idle'
            ? state.runInitial
            : targetSourceGrains(state.runInitial, snap.remainingMs, snap.durationMs);
        sim.arrange(top, sim.totalGrains - top, gs, {
          crater: snap.status === 'idle' ? IDLE_CRATER : 0.35,
        });
        state.populated = sim;
        particles.reset(7);
        changed = true;
      }
      // 2-3) Sincronizar y mover la arena, una vez por «fotograma de 60 fps»
      //      (a 60 fps, una vez). Durante el giro no se sincroniza: la arena
      //      va quieta dentro del vidrio.
      const syncing = snap.status !== 'idle' && state.turnStart === null;
      const target = syncing ? targetSourceGrains(state.runInitial, snap.remainingMs, snap.durationMs) : 0;
      // Límites según el caudal: con mucha arena y poco tiempo puede pasar
      // más por fotograma y no se recoloca por un simple retraso.
      const budget = syncing ? flowBudget(state.runInitial, snap.durationMs, sim.totalGrains) : null;
      const span = flowSpan(frameDt);
      const scaled = budget
        ? {
            maxPerFrame: Math.max(1, Math.ceil(budget.maxPerFrame * span)),
            teleportThreshold: budget.teleportThreshold,
          }
        : null;
      const simStart = performance.now();
      if (scaled && syncSandToTarget(sim, target, gs, scaled) !== 'idle') changed = true;
      for (let i = 0; i < steps; i++) {
        if (sim.step(gs) > 0) changed = true;
      }
      state.simMs = performance.now() - simStart;

      // 3b) Granos sueltos del chorro. Siguen cayendo aunque el flujo se
      //     corte: así el chorro termina con los últimos granos.
      const streaming =
        state.turnStart === null &&
        snap.status === 'running' &&
        snap.remainingMs > 0 &&
        gs.y >= MIN_FLOW_GRAVITY_Y &&
        sim.hasGrainAtNeck(gs);
      const pin = state.particleInput;
      pin.dt = frameDt;
      pin.emitting = streaming;
      pin.intensity = streamIntensity(snap.durationMs);
      pin.gravity = g;
      pin.calm = p.reduceMotion;
      pin.detail = streamDetail(state.detail.level);
      particles.update(sim, pin);

      // 4a) Vidrio: regrabamos si cambió el pintor (tamaño/tema) o la luz.
      const t = m.tilt;
      const newGlass = state.glass !== p.glass;
      const lightMoved =
        Math.abs(t.x - state.lightX) > LIGHT_EPSILON || Math.abs(t.y - state.lightY) > LIGHT_EPSILON;
      const glassDue =
        newGlass || (lightMoved && now - state.glassAt >= (lod ? GLASS_MIN_MS_LOD : GLASS_MIN_MS));
      state.glassPending = lightMoved && !glassDue;
      if (glassDue) {
        state.glassAt = now;
        slots.background.publish(p.glass.recordBackground(t));
        slots.shadow.publish(p.glass.recordShadow(t));
        slots.body.publish(p.glass.recordBody(t));
        slots.front.publish(p.glass.recordFront(t));
        state.glass = p.glass;
        state.lightX = t.x;
        state.lightY = t.y;
        changed = true; // la luz de la arena también se mueve
      }

      // 4b) Arena.
      if (changed || particles.active || streaming !== state.streamShown) {
        const stream = state.stream;
        stream.flowing = streaming;
        stream.particles = particles;
        stream.reduceMotion = p.reduceMotion;
        slots.sand.publish(painter.paint(sim, m, stream));
        state.streamShown = streaming;
      }

      // ¿Seguimos? Mientras corre el tiempo o la arena se mueve, sí.
      const keepGoing =
        snap.status === 'running' ||
        !sim.isSettled ||
        state.dirty ||
        particles.active ||
        turning ||
        state.glassPending ||
        // Hasta volver a la calidad normal (y recolocar la arena a 3°).
        lod;
      if (hadClock) {
        updateDetail(state.detail, { jsMs: performance.now() - frameStart, gapMs: frameDt * 1000 });
      }
      if (frameProbeEnabled()) {
        noteFrame({
          jsMs: performance.now() - frameStart,
          simMs: state.simMs,
          gapMs: hadClock ? frameDt * 1000 : 0,
          level: state.detail.level,
        });
      }
      if (keepGoing) {
        state.scheduled = true;
        pacer.request(frame);
      } else state.lastTime = 0;
    };
    state.scheduled = true;
    pacer.request(frame);
  }, [live, initialRef, particles, rotation, spin, slots, pacer]);

  // Al elegir duración (o reiniciar), colocamos la arena directamente.
  useEffect(() => {
    if (!sim || status !== 'idle') return;
    const state = loop.current;
    sim.arrange(initialGrains, sim.totalGrains - initialGrains, live.current.motion.simGravity, {
      crater: IDLE_CRATER,
    });
    state.populated = sim;
    state.runInitial = initialGrains;
    // Si estaba dando la vuelta (cambio de fase) y se reinicia, se cancela.
    if (state.turnStart !== null) live.current.onTurnChange?.(false);
    state.turnStart = null;
    spin.set(0);
    wake();
  }, [sim, status, initialGrains, wake, live, spin]);

  // Cualquier cambio relevante despierta el bucle.
  useEffect(() => {
    wake();
  }, [status, params.painter, params.glass, params.reduceMotion, wake]);

  // La fuente de movimiento (acelerómetro) también lo despierta.
  useEffect(() => motion.subscribe(wake), [motion, wake]);

  // Al desmontar, paramos el bucle y liberamos (con margen) los pictures.
  // Los shared values vuelven al picture vacío por si React vuelve a montar
  // el mismo componente (StrictMode, Fast Refresh): así nunca apuntan a un
  // objeto liberado. El picture vacío (unos bytes) no se libera por eso.
  useEffect(() => {
    const state = loop.current;
    state.failed = false;
    return () => {
      if (state.scheduled) pacer.cancel();
      state.scheduled = false;
      state.dirty = true;
      state.glass = null;
      slots.background.release();
      slots.shadow.release();
      slots.body.release();
      slots.sand.release();
      slots.front.release();
    };
  }, [slots, pacer]);

  return { background, shadow, body, sand, front, rotation, spin };
}

/** Curva lento-rápido-lento (como un objeto real que se gira con la mano). */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Grosor relativo del chorro: más fino cuanto más largo es el temporizador. */
function streamIntensity(durationMs: number): number {
  const t = Math.log(durationMs / MIN_DURATION_MS) / Math.log(MAX_DURATION_MS / MIN_DURATION_MS);
  return 1 - 0.6 * Math.min(1, Math.max(0, t));
}
