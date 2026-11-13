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
 *
 * El ángulo lo escribe el giro. Este efecto solo lleva el reloj de la intro
 * y las variables CSS; el fotograma es el de Frasco.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

import type { MaquinaGiro } from '../giro';

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

const QUIETA = { activa: false, angulo: 0, escala: 1, sombra: 1 } as const;

export function usePageIntro(
  appRef: RefObject<HTMLElement | null>,
  giro: MaquinaGiro,
): {
  readonly className: string;
  readonly blocksInput: boolean;
  readonly settled: boolean;
  readonly paso: (now: number) => boolean;
} {
  const [mode] = useState<Mode>(() => {
    if (introPlayed) return 'off';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduce ? 'reduced' : 'full';
  });
  const [phase, setPhase] = useState<Phase>(() => (mode === 'off' ? 'done' : 'hide'));
  const pasoRef = useRef<(now: number) => boolean>(() => false);

  useLayoutEffect(() => {
    if (mode === 'off') return;
    let alive = true;
    let showTimer = 0;
    let doneTimer = 0;
    let pulseTimer = 0;
    let finished = false;
    let t0: number | null = null;
    let revealed = false;

    const rest = () => giro.fijarIntro(QUIETA);

    const clearVars = () => {
      const app = appRef.current;
      if (!app) return;
      app.style.removeProperty('--intro-x');
      app.style.removeProperty('--intro-y');
      app.style.removeProperty('--intro-glass');
    };

    if (mode === 'reduced') {
      pasoRef.current = () => false;
      showTimer = window.setTimeout(() => {
        if (!alive) return;
        setPhase('show');
        doneTimer = window.setTimeout(() => {
          if (!alive) return;
          finished = true;
          introPlayed = true;
          rest();
          setPhase('done');
        }, INTRO.reducedFade + 40);
      }, 40);
      return () => {
        alive = false;
        pasoRef.current = () => false;
        window.clearTimeout(showTimer);
        window.clearTimeout(doneTimer);
        if (!finished) rest();
      };
    }

    pasoRef.current = (now: number) => {
      if (!alive || finished) return false;
      const app = appRef.current;
      const frame = app?.querySelector('.glass-frame');
      const ready = frame instanceof HTMLElement ? frame.getBoundingClientRect() : null;
      if (!app || !ready || ready.width < 8 || ready.height < 8) return true;
      if (t0 === null) {
        t0 = now;
        const dx = window.innerWidth / 2 - (ready.left + ready.width / 2);
        const dy = window.innerHeight / 2 - (ready.top + ready.height * 0.48);
        pasoRef.current = (frameNow: number) => {
          if (!alive || finished) return false;
          const pose = poseAt(frameNow - (t0 ?? frameNow));
          app.style.setProperty('--intro-x', `${(dx * pose.centered).toFixed(2)}px`);
          app.style.setProperty('--intro-y', `${(dy * pose.centered).toFixed(2)}px`);
          app.style.setProperty('--intro-glass', pose.glassOpacity.toFixed(3));
          giro.fijarIntro({
            activa: !pose.done,
            angulo: pose.done ? 0 : pose.angle,
            escala: pose.done ? 1 : pose.scale,
            sombra: pose.done ? 1 : pose.shadow,
          });
          if (!revealed && frameNow - (t0 ?? frameNow) >= INTRO.chromeDelay) {
            revealed = true;
            setPhase('show');
          }
          if (pose.done) {
            finished = true;
            introPlayed = true;
            rest();
            clearVars();
            setPhase('pulse');
            pulseTimer = window.setTimeout(() => {
              if (alive) setPhase('done');
            }, INTRO.pulse);
            return false;
          }
          return true;
        };
      }
      return pasoRef.current(now);
    };

    pasoRef.current(performance.now());

    return () => {
      alive = false;
      pasoRef.current = () => false;
      window.clearTimeout(pulseTimer);
      if (!finished) {
        clearVars();
        rest();
      }
    };
  }, [mode, appRef, giro]);

  const settled = phase === 'done';
  const paso = (now: number) => pasoRef.current(now);
  if (phase === 'done') return { className: '', blocksInput: false, settled, paso };
  if (phase === 'pulse') return { className: 'intro-menu-pulse', blocksInput: false, settled, paso };
  const reduced = mode === 'reduced' ? ' intro-reduced' : '';
  const hidden = phase === 'hide' ? ' intro-hide-chrome' : '';
  return { className: `intro-play${hidden}${reduced}`, blocksInput: true, settled, paso };
}
