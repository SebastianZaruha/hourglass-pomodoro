/**
 * Bucle de animación del reloj.
 *
 * En cada fotograma (al ritmo que pide la interfaz, ver useFramePacer;
 * ~60 por segundo si el móvil puede):
 *  0. Si se ha volteado el móvil, el contenido da la vuelta (`alVoltear`) y el
 *     dibujo gira 180° en el MISMO fotograma (para que no se vea un salto).
 *  1. Pregunta al temporizador cuánto tiempo queda (calculado a partir de
 *     marcas de tiempo, así que siempre es exacto).
 *  2. El contenido pasa por el cuello los granos necesarios y avanza la
 *     simulación con la gravedad del acelerómetro.
 *  3. Si algo ha cambiado, el contenido pinta un nuevo SkPicture; si ha
 *     cambiado la inclinación, también se regraban las capas del vidrio (la
 *     luz, los reflejos y la sombra se mueven). Todo se publica en "shared
 *     values" de Reanimated: el Canvas lo dibuja en el hilo de UI sin volver
 *     a renderizar componentes de React.
 *
 * Cambio de fase (ciclos, 1.5): cuando `transitions` sube en la foto del
 * temporizador, el reloj se DA LA VUELTA con una animación (`spin`: 0 → π en
 * TURN_MS, lento-rápido-lento). La arena no se toca durante el giro (va
 * «pegada» al vidrio, como en uno de verdad); al terminar, en el MISMO
 * fotograma, la rejilla gira 180° (`alVoltear`) y `spin` vuelve a 0: el
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
 * Cuando el contenido está quieto, el temporizador no corre y el móvil no se
 * mueve, el bucle se DETIENE (cero consumo de batería) hasta que algo lo
 * despierta (un cambio de props o un aviso de la fuente de movimiento).
 *
 * Memoria: el bucle no crea objetos JS por fotograma (todo se reutiliza) y
 * cada SkPicture sustituido se libera unos fotogramas después, en un anillo
 * de tamaño fijo (PictureSlot). Si algo falla dentro del bucle (fuera del
 * render de React, así que un error boundary no lo vería), paramos el bucle
 * y avisamos con `onError`.
 */
import { TiltLod, type TimerStatus } from '@reloj/core';
import type { SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { useLatest } from '../hooks/useLatest';
import type { EntradaMotor, MotorContenido } from './contenido/tipos';
import type { ObjectPose } from './objectPose';
import { useFramePacer } from './useFramePacer';
import { PictureSlot, recordEmptyPicture } from './pictureSlot';
import type { GlassPainter } from './staticLayers';
import type { HourglassSnapshot, MotionSource } from './types';

export interface SandEngineParams {
  readonly contenido: MotorContenido;
  /** Cambia con el pintor de la arena (tema, tamaño) sin recrear la simulación. */
  readonly revisionPintor: number;
  readonly glass: GlassPainter;
  readonly poseDelFrasco: ((giro: number) => ObjectPose) | null;
  readonly poseActive: boolean;
  readonly motion: MotionSource;
  /** Devuelve la foto actual del temporizador. */
  readonly getSnapshot: () => HourglassSnapshot;
  readonly status: TimerStatus;
  readonly durationMs: number;
  /**
   * Sube en cada reinicio con giro (mantener pulsado). 0 no gira: es el
   * reposo de siempre, también con reducir movimiento.
   */
  readonly reinicio: number;
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
 * Giro al mantener pulsado para reiniciar. Media vuelta, como el volteo de
 * la web (MS_MEDIA_VUELTA), y al quedar de pie se coloca el montón nuevo.
 * Entre 600 y 900. Con reducir movimiento no hay giro.
 */
export const GIRO_REINICIO_MS = 750;

/**
 * Fotogramas largos (el navegador a 20–30 fps): la arena da los pasos que
 * le tocarían a 60 fps, hasta este máximo de «fotogramas de 60» por
 * fotograma. Sin esto, a pocos fps la arena caía más despacio que el
 * tiempo, se acumulaba retraso y salía a tirones. A 60 fps: 1 (como siempre).
 */
const MAX_CATCH_UP = 3;
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

function entradaVacia(): EntradaMotor {
  return {
    dt: 0,
    ticks: 1,
    gravedad: { x: 0, y: 1 },
    gravedadSuave: { x: 0, y: 1 },
    snap: { status: 'idle', remainingMs: 0, durationMs: 0, elapsedMs: 0, progress: 0 },
    reducir: false,
    durationMs: 0,
    enGiro: false,
    vaciar: false,
    soloVaciar: false,
    reposo: false,
  };
}

export function useSandEngine(params: SandEngineParams): SandEngineOutput {
  const { status, durationMs, motion, reinicio } = params;
  const [emptyPicture] = useState(recordEmptyPicture);
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

  // Quien da paso al siguiente fotograma: la interfaz, cuando ha dibujado el anterior.
  const pacer = useFramePacer();

  const loop = useRef({
    /** ¿Hay un fotograma pedido? */
    scheduled: false,
    dirty: true,
    failed: false,
    /** Contenido ya visto (para no girar al montar uno nuevo). */
    contenido: null as MotorContenido | null,
    /** Volteos ya aplicados a la arena. */
    flips: motion.flips,
    /** Cambios de fase ya vistos (null = aún no sabemos cuántos había). */
    turns: null as number | null,
    /** Inicio (performance.now) del giro de cambio de fase en curso, o null. */
    turnStart: null as number | null,
    /** Inicio del giro de reinicio (mantener pulsado), o null. */
    reinicioStart: null as number | null,
    /** Un fotograma quieto a 180°, como el «sujetar» del volteo de la web. */
    reinicioHold: false,
    /** Último reinicio ya animado. */
    reinicioHecho: 0,
    /** Capas del vidrio: con qué pintor e inclinación se grabaron. */
    glass: null as GlassPainter | null,
    lightX: Number.NaN,
    lightY: Number.NaN,
    /** Cuándo se grabó el vidrio por última vez (performance.now). */
    glassAt: 0,
    sampleAngle: 0,
    sampleScale: 1,
    sampleY: 0,
    /** La luz ha cambiado pero aún no tocaba regrabar: queda pendiente. */
    glassPending: false,
    /** Marca de tiempo del fotograma anterior (para calcular dt). */
    lastTime: 0,
    /** Menos detalle durante un giro fuerte (1.8.9). */
    lod: new TiltLod(),
    /** Lo que costó simular el fotograma anterior (ms), para `lod`. */
    simMs: 0,
    /** Entrada del contenido, reutilizada en cada fotograma. */
    entrada: entradaVacia(),
  });

  // La función que despierta el bucle (estable entre renders).
  const wake = useCallback(() => {
    const state = loop.current;
    state.dirty = true;
    if (state.scheduled || state.failed) return;

    /** Fin del giro: la rejilla da la vuelta y el dibujo vuelve a 0, a la vez. */
    const finishTurn = () => {
      live.current.contenido.alVoltear('fase');
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
      const m = p.motion;
      const g = m.gravity; // suave: chorro y dibujo
      const snap = p.getSnapshot();

      let changed = state.dirty;
      state.dirty = false;

      // 0) Volteo: la arena da la vuelta y el dibujo gira 180° a la vez.
      if (m.flips !== state.flips) {
        state.flips = m.flips;
        p.contenido.alVoltear('reinicio');
        rotation.value = m.flipped ? Math.PI : 0;
        // Voltear no es un giro fuerte «a medias»: calidad normal.
        state.lod.reset();
        changed = true;
      }

      const now = performance.now();
      // En escalones: simulación. Durante un giro fuerte en un móvil que no
      // llega, escalones más gruesos (TiltLod, 1.8.9).
      const gs = state.lod.update(now, g, m.simGravity, state.simMs);
      const lod = state.lod.isActive;
      const frameDt = state.lastTime > 0 ? (now - state.lastTime) / 1000 : 1 / 60;
      state.lastTime = now;
      // Cuántos «fotogramas de 60 fps» caben en este (1 a 60 fps; el margen
      // evita que un fotograma de 17–24 ms cuente doble).
      // Con menos detalle no se pone al día: a pocos fps, más pasos por
      // fotograma lo harían aún más lento.
      const ticks = lod ? 1 : Math.min(MAX_CATCH_UP, Math.max(1, Math.round(frameDt * 60 - 0.2)));

      const e = state.entrada;
      e.dt = frameDt;
      e.ticks = ticks;
      e.gravedad = gs;
      e.gravedadSuave = g;
      e.snap = snap;
      e.reducir = p.reduceMotion;
      e.durationMs = p.durationMs;
      e.enGiro = false;
      e.vaciar = false;
      e.soloVaciar = false;
      e.reposo = false;

      // 0b) Cambio de fase (ciclos): empieza el giro animado del reloj.
      const turns = snap.transitions ?? 0;
      if (state.turns === null || state.contenido !== p.contenido) {
        state.turns = turns; // primera foto o contenido nuevo: nada que girar
        state.contenido = p.contenido;
      } else if (turns !== state.turns) {
        state.turns = turns;
        // La fase anterior ha terminado: su arena tiene que estar abajo. Los
        // pocos granos rezagados (resbalan despacio por el embudo) pasan ya;
        // si no, tras el giro quedaban colgando bajo el cuello y bajaban
        // como un bloque. La vaciada va ANTES de dar la vuelta.
        e.vaciar = true;
        e.soloVaciar = true;
        p.contenido.paso(e);
        e.vaciar = false;
        e.soloVaciar = false;
        if (p.reduceMotion) {
          // Sin animación: la arena da la vuelta en el acto.
          finishTurn();
        } else if (state.turnStart === null) {
          state.turnStart = now;
          p.onTurnChange?.(true);
        }
        changed = true;
      }

      // 0c) Reinicio (mantener pulsado): el frasco da media vuelta con lo que
      //     había dentro. Al terminar, de pie, se coloca el montón nuevo.
      //     La nube no gira: el ángulo es el del frasco, no el del lienzo.
      if (state.reinicioStart !== null) {
        const t = Math.min(1, (now - state.reinicioStart) / GIRO_REINICIO_MS);
        if (p.reduceMotion) {
          state.reinicioStart = null;
          state.reinicioHold = false;
          spin.value = 0;
          if (snap.status === 'idle') e.reposo = true;
        } else if (t < 1) {
          spin.value = Math.PI * easeInOutCubic(t);
        } else if (!state.reinicioHold) {
          state.reinicioHold = true;
          spin.value = Math.PI;
        } else {
          state.reinicioStart = null;
          state.reinicioHold = false;
          spin.value = 0;
          if (snap.status === 'idle') e.reposo = true;
        }
        changed = true;
      }
      const turning = state.turnStart !== null;
      if (turning && state.reinicioStart === null) {
        const t = Math.min(1, (now - (state.turnStart as number)) / TURN_MS);
        if (t < 1) {
          spin.value = Math.PI * easeInOutCubic(t);
        } else {
          finishTurn();
          state.turnStart = null;
          p.onTurnChange?.(false);
        }
        changed = true;
      }

      // 1-3) Colocar, sincronizar y mover la arena. Durante el giro no se
      //      sincroniza: la arena va quieta dentro del vidrio.
      e.enGiro = state.turnStart !== null || state.reinicioStart !== null;
      const sigue = p.contenido.paso(e);
      state.simMs = p.contenido.simMs;

      // La foto se muestrea en las coordenadas del fondo, incluso al girar el frasco.
      const giro = spin.value;
      const pose = p.poseDelFrasco?.(giro);
      const angle = pose?.angle ?? 0;
      const scale = pose?.scale ?? 1;
      const dy = pose?.dy ?? 0;
      const sampleMoved = angle !== state.sampleAngle || scale !== state.sampleScale || dy !== state.sampleY;
      state.sampleAngle = angle;
      state.sampleScale = scale;
      state.sampleY = dy;

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
        slots.front.publish(p.glass.recordFront(t));
        state.glass = p.glass;
        state.lightX = t.x;
        state.lightY = t.y;
        changed = true; // la luz de la arena también se mueve
      }

      if (glassDue || sampleMoved) {
        slots.body.publish(p.glass.recordBody({ x: state.lightX, y: state.lightY }, pose));
      }

      // 4b) Contenido.
      if (changed || sampleMoved || p.contenido.hayQuePintar) {
        slots.sand.publish(p.contenido.pintar(m, giro, pose));
      }

      // ¿Seguimos? Mientras corre el tiempo o la arena se mueve, sí.
      const keepGoing =
        snap.status === 'running' ||
        sigue ||
        state.dirty ||
        turning ||
        state.reinicioStart !== null ||
        state.glassPending ||
        (p.poseDelFrasco !== null && p.poseActive) ||
        // Hasta volver a la calidad normal (y recolocar la arena a 3°).
        lod;
      if (keepGoing) {
        state.scheduled = true;
        pacer.request(frame);
      } else state.lastTime = 0;
    };
    state.scheduled = true;
    pacer.request(frame);
  }, [live, rotation, spin, slots, pacer]);

  // Al elegir duración, colocamos la arena. Al reiniciar con giro, el
  // montón viejo da la vuelta y el nuevo se coloca al quedar de pie.
  useEffect(() => {
    if (status !== 'idle') return;
    const state = loop.current;
    const ahora = live.current;
    if (state.turnStart !== null) ahora.onTurnChange?.(false);
    state.turnStart = null;
    const girar = reinicio > 0 && reinicio !== state.reinicioHecho && !ahora.reduceMotion;
    if (girar) {
      state.reinicioHecho = reinicio;
      state.reinicioHold = false;
      state.reinicioStart = performance.now();
      spin.set(0);
      wake();
      return;
    }
    state.reinicioStart = null;
    state.reinicioHold = false;
    const e = state.entrada;
    e.gravedad = ahora.motion.simGravity;
    e.durationMs = durationMs;
    e.reposo = true;
    e.vaciar = false;
    e.soloVaciar = false;
    e.enGiro = false;
    ahora.contenido.paso(e);
    e.reposo = false;
    spin.set(0);
    wake();
  }, [params.contenido, status, durationMs, wake, live, spin, reinicio]);

  // Cualquier cambio relevante despierta el bucle.
  useEffect(() => {
    wake();
  }, [
    status,
    params.contenido,
    params.revisionPintor,
    params.glass,
    params.poseDelFrasco,
    params.poseActive,
    params.reduceMotion,
    wake,
  ]);

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
