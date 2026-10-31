/**
 * Entrada al abrir la página, al estilo del móvil (≈1,35 s):
 *
 *   0–300 ms   el vidrio aparece en el centro, un poco más grande, sin sombra
 *   0–900 ms   una vuelta completa, ease-in-out
 *   900–1250   vuelve a su sitio y a su tamaño; vuelve la sombra
 *   950–1350   la hora, el menú y el pie se difuminan hasta verse
 *   1350–2250  el botón de menú crece un poco, una sola vez, y vuelve
 *
 * Solo en la primera carga de esta pestaña. Con «reducir movimiento»
 * no hay giro ni desplazamiento: un fundido corto.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';

import type { HourglassHandle, HourglassParams } from './hourglass/useEngine';

export const INTRO = {
  fadeIn: 300,
  spin: 900,
  settle: 350,
  chromeDelay: 950,
  chromeFade: 400,
  startScale: 1.12,
  reducedFade: 280,
  /** Un solo aviso en el botón de menú, al terminar el fundido. */
  pulse: 900,
} as const;

/** ¿Ya terminó en esta pestaña? Un remontaje (Strict Mode) no la da por hecha. */
let introPlayed = false;

type Mode = 'off' | 'full' | 'reduced';
type Phase = 'hide' | 'show' | 'pulse' | 'done';

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

interface Pose {
  readonly glassOpacity: number;
  readonly angle: number;
  readonly scale: number;
  readonly centered: number;
  readonly shadow: number;
  readonly done: boolean;
}

function poseAt(elapsed: number): Pose {
  const spinT = clamp01(elapsed / INTRO.spin);
  const settleT = clamp01((elapsed - INTRO.spin) / INTRO.settle);
  const settle = easeOutCubic(settleT);
  return {
    glassOpacity: easeOutQuad(clamp01(elapsed / INTRO.fadeIn)),
    angle: easeInOutCubic(spinT) * Math.PI * 2,
    scale: INTRO.startScale + (1 - INTRO.startScale) * settle,
    centered: 1 - settle,
    shadow: settle,
    done: elapsed >= INTRO.chromeDelay + INTRO.chromeFade,
  };
}

export function usePageIntro(
  appRef: RefObject<HTMLElement | null>,
  paramsRef: RefObject<HourglassParams>,
  handleRef: RefObject<HourglassHandle | null>,
): { readonly className: string; readonly blocksInput: boolean; readonly settled: boolean } {
  const [mode] = useState<Mode>(() => {
    if (introPlayed) return 'off';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduce ? 'reduced' : 'full';
  });
  const [phase, setPhase] = useState<Phase>(() => (mode === 'off' ? 'done' : 'hide'));

  useLayoutEffect(() => {
    if (mode === 'off') return;
    let alive = true;
    let raf = 0;
    let showTimer = 0;
    let doneTimer = 0;
    let pulseTimer = 0;
    let finished = false;

    const restParams = () => {
      const params = paramsRef.current;
      params.introActive = false;
      params.introAngle = 0;
      params.introScale = 1;
      params.introShadow = 1;
    };

    const clearVars = () => {
      const app = appRef.current;
      if (!app) return;
      app.style.removeProperty('--intro-x');
      app.style.removeProperty('--intro-y');
      app.style.removeProperty('--intro-glass');
    };

    if (mode === 'reduced') {
      showTimer = window.setTimeout(() => {
        if (!alive) return;
        setPhase('show');
        doneTimer = window.setTimeout(() => {
          if (!alive) return;
          finished = true;
          introPlayed = true;
          restParams();
          setPhase('done');
        }, INTRO.reducedFade + 40);
      }, 40);
      return () => {
        alive = false;
        window.clearTimeout(showTimer);
        window.clearTimeout(doneTimer);
        if (!finished) restParams();
      };
    }

    const start = (now: number) => {
      if (!alive) return;
      const app = appRef.current;
      const frame = app?.querySelector('.glass-frame');
      const ready = frame instanceof HTMLElement ? frame.getBoundingClientRect() : null;
      if (!app || !ready || ready.width < 8 || ready.height < 8) {
        raf = requestAnimationFrame(start);
        return;
      }
      const rect = ready;
      const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
      const dy = window.innerHeight / 2 - (rect.top + rect.height * 0.48);
      const t0 = now;
      let revealed = false;

      const step = (frameNow: number) => {
        if (!alive) return;
        const pose = poseAt(frameNow - t0);
        app.style.setProperty('--intro-x', `${(dx * pose.centered).toFixed(2)}px`);
        app.style.setProperty('--intro-y', `${(dy * pose.centered).toFixed(2)}px`);
        app.style.setProperty('--intro-glass', pose.glassOpacity.toFixed(3));
        const params = paramsRef.current;
        params.introActive = !pose.done;
        params.introAngle = pose.done ? 0 : pose.angle;
        params.introScale = pose.done ? 1 : pose.scale;
        params.introShadow = pose.done ? 1 : pose.shadow;
        handleRef.current?.wake();
        if (!revealed && frameNow - t0 >= INTRO.chromeDelay) {
          revealed = true;
          setPhase('show');
        }
        if (pose.done) {
          finished = true;
          introPlayed = true;
          restParams();
          clearVars();
          setPhase('pulse');
          pulseTimer = window.setTimeout(() => {
            if (alive) setPhase('done');
          }, INTRO.pulse);
          return;
        }
        raf = requestAnimationFrame(step);
      };

      step(now);
    };

    start(performance.now());
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(pulseTimer);
      if (!finished) {
        clearVars();
        restParams();
      }
    };
  }, [mode, appRef, paramsRef, handleRef]);

  // `settled` solo al terminar, pulso del menú incluido. El aviso de la
  // app Android espera a esto para no salir antes de que el cromo esté listo.
  const settled = phase === 'done';
  if (phase === 'done') return { className: '', blocksInput: false, settled };
  if (phase === 'pulse') return { className: 'intro-menu-pulse', blocksInput: false, settled };
  const reduced = mode === 'reduced' ? ' intro-reduced' : '';
  const hidden = phase === 'hide' ? ' intro-hide-chrome' : '';
  return { className: `intro-play${hidden}${reduced}`, blocksInput: true, settled };
}
