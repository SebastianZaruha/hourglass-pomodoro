/**
 * Entrada breve: el fondo nace desenfocado y el frasco aparece en su sitio
 * (fundido y un poco de escala). No se desplaza.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';

import type { HourglassHandle, HourglassParams } from './hourglass/useEngine';

const INTRO_MS = 820;

let introPlayed = false;

type Mode = 'off' | 'full' | 'reduced';

export function usePageIntro(
  appRef: RefObject<HTMLElement | null>,
  paramsRef: RefObject<HourglassParams>,
  handleRef: RefObject<HourglassHandle | null>,
): { readonly className: string; readonly blocksInput: boolean; readonly settled: boolean } {
  const [mode] = useState<Mode>(() => {
    if (introPlayed) return 'off';
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
  });
  const [done, setDone] = useState(mode === 'off');

  useLayoutEffect(() => {
    if (mode === 'off') return;
    const params = paramsRef.current;
    params.introActive = false;
    params.introAngle = 0;
    params.introScale = 1;
    params.introShadow = 1;
    const app = appRef.current;
    const layout = handleRef.current?.layoutCss();
    const canvas = app?.querySelector('.glass-canvas');
    if (app && layout && canvas instanceof HTMLElement) {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      if (w > 0 && h > 0) {
        app.style.setProperty('--intro-ox', `${(layout.cx / w) * 100}%`);
        app.style.setProperty('--intro-oy', `${(layout.cy / h) * 100}%`);
      }
    }
    const ms = mode === 'reduced' ? 280 : INTRO_MS;
    const timer = window.setTimeout(() => {
      introPlayed = true;
      setDone(true);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [mode, appRef, paramsRef, handleRef]);

  if (done) return { className: '', blocksInput: false, settled: true };
  const reduced = mode === 'reduced' ? ' intro-reduced' : '';
  return { className: `intro-play${reduced}`, blocksInput: true, settled: false };
}
