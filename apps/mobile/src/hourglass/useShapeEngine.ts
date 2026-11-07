/**
 * Bucle de la lluvia y de la miel.
 *
 * No hay autómata. Cada fotograma lee el tiempo, calcula la pose (porcentaje
 * → niveles) y, si corre, avanza la fase del chorro a velocidad fija. El
 * vidrio sigue regrabándose como mucho a ~20 fps: eso no limita el material,
 * que se publica en cada refresco. En reposo el bucle se para.
 */
import {
  cloudIdle,
  flowPose,
  freshDetail,
  shapeBudget,
  updateDetail,
  type ShapeMaterial,
  type TimerStatus,
} from '@reloj/core';
import type { SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { useLatest } from '../hooks/useLatest';
import { frameProbeEnabled, noteFrame } from './frameProbe';
import { PictureSlot, recordEmptyPicture } from './pictureSlot';
import type { ShapePainter } from './shapePainter';
import type { GlassPainter } from './staticLayers';
import type { HourglassSnapshot, MotionSource } from './types';
import { useFramePacer } from './useFramePacer';
import { TURN_MS } from './useSandEngine';

export interface ShapeEngineParams {
  readonly material: ShapeMaterial | null;
  readonly painter: ShapePainter | null;
  readonly glass: GlassPainter;
  readonly motion: MotionSource;
  readonly getSnapshot: () => HourglassSnapshot;
  readonly status: TimerStatus;
  readonly reduceMotion: boolean;
  readonly onError: (error: unknown) => void;
  readonly onTurnChange?: (turning: boolean) => void;
}

const LIGHT_EPSILON = 0.01;
const GLASS_MIN_MS = 50;

export function useShapeEngine(params: ShapeEngineParams): {
  background: SharedValue<SkPicture>;
  shadow: SharedValue<SkPicture>;
  body: SharedValue<SkPicture>;
  sand: SharedValue<SkPicture>;
  front: SharedValue<SkPicture>;
  rotation: SharedValue<number>;
  spin: SharedValue<number>;
} {
  const { status, motion } = params;
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
  const live = useLatest(params);
  const pacer = useFramePacer();
  const loop = useRef({
    scheduled: false,
    dirty: true,
    failed: false,
    flips: motion.flips,
    turns: null as number | null,
    turnStart: null as number | null,
    glass: null as GlassPainter | null,
    lightX: Number.NaN,
    lightY: Number.NaN,
    glassAt: 0,
    glassPending: false,
    lastTime: 0,
    phase: 0,
    cloudTime: 0,
    detail: freshDetail(),
  });

  const wake = useCallback(() => {
    const state = loop.current;
    state.dirty = true;
    if (state.scheduled || state.failed) return;
    const frame = () => {
      state.scheduled = false;
      try {
        runFrame();
      } catch (error) {
        state.failed = true;
        live.current.onError(error);
      }
    };
    const runFrame = () => {
      const p = live.current;
      const painter = p.painter;
      if (!painter || !p.material) return;
      const m = p.motion;
      const now = performance.now();
      const frameStart = now;
      const hadClock = state.lastTime > 0;
      const frameDt = hadClock ? Math.min(0.05, (now - state.lastTime) / 1000) : 1 / 60;
      state.lastTime = now;
      let changed = state.dirty;
      state.dirty = false;

      if (m.flips !== state.flips) {
        state.flips = m.flips;
        rotation.value = m.flipped ? Math.PI : 0;
        changed = true;
      }

      const snap = p.getSnapshot();
      const turns = snap.transitions ?? 0;
      if (state.turns === null) state.turns = turns;
      else if (turns !== state.turns) {
        state.turns = turns;
        if (p.reduceMotion) {
          spin.value = 0;
        } else if (state.turnStart === null) {
          state.turnStart = now;
          p.onTurnChange?.(true);
        }
        changed = true;
      }
      const turning = state.turnStart !== null;
      if (turning) {
        const t = Math.min(1, (now - (state.turnStart as number)) / TURN_MS);
        if (t < 1) spin.value = Math.PI * ease(t);
        else {
          spin.value = 0;
          state.turnStart = null;
          p.onTurnChange?.(false);
        }
        changed = true;
      }

      const running = snap.status === 'running' && state.turnStart === null;
      const pose = flowPose({
        remainingMs: snap.remainingMs,
        durationMs: snap.durationMs,
        gravityX: m.gravity.x,
        gravityY: m.gravity.y,
        running,
      });
      if (pose.flowing && !p.reduceMotion) state.phase += frameDt;
      const breathe = !!p.material?.cloud && !p.reduceMotion;
      if (breathe && snap.status !== 'paused') state.cloudTime += frameDt;
      const idle = cloudIdle(state.cloudTime, breathe);
      const budget = shapeBudget(state.detail.level);

      const tilt = m.tilt;
      const lightMoved =
        Math.abs(tilt.x - state.lightX) > LIGHT_EPSILON || Math.abs(tilt.y - state.lightY) > LIGHT_EPSILON;
      const glassDue = state.glass !== p.glass || (lightMoved && now - state.glassAt >= GLASS_MIN_MS);
      state.glassPending = lightMoved && !glassDue;
      if (glassDue) {
        state.glassAt = now;
        slots.background.publish(p.glass.recordBackground(tilt));
        slots.shadow.publish(p.glass.recordShadow(tilt));
        slots.body.publish(p.glass.recordBody(tilt));
        slots.front.publish(p.glass.recordFront(tilt));
        state.glass = p.glass;
        state.lightX = tilt.x;
        state.lightY = tilt.y;
        changed = true;
      }

      // Mientras corre, el nivel y el chorro cambian cada fotograma.
      const cloudMoves = breathe && snap.status !== 'paused';
      if (changed || running || pose.flowing || cloudMoves) {
        slots.sand.publish(
          painter.paint({
            pose,
            phase: state.phase,
            drift: 0,
            idle,
            reduceMotion: p.reduceMotion,
            ribbons: budget.ribbons,
            puffs: budget.puffs,
            waves: budget.waves,
          }),
        );
      }

      const jsMs = performance.now() - frameStart;
      if (hadClock) updateDetail(state.detail, { jsMs, gapMs: frameDt * 1000 });
      if (frameProbeEnabled()) {
        noteFrame({ jsMs, simMs: 0, gapMs: hadClock ? frameDt * 1000 : 0, level: state.detail.level });
      }

      const keep =
        snap.status === 'running' || turning || state.dirty || state.glassPending || changed || cloudMoves;
      if (keep) {
        state.scheduled = true;
        pacer.request(frame);
      } else state.lastTime = 0;
    };
    state.scheduled = true;
    pacer.request(frame);
  }, [live, pacer, rotation, slots, spin]);

  useEffect(() => {
    wake();
  }, [status, params.painter, params.glass, params.material, params.reduceMotion, wake]);

  useEffect(() => motion.subscribe(wake), [motion, wake]);

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

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
