import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';

import { decideStageClick, decideStageDoubleClick, ruedaAjustaTiempo } from '../stageClick';
import type { TimerStatus } from '@reloj/core';

interface Opciones {
  readonly menu: boolean;
  readonly legalAbierto: boolean;
  readonly intro: boolean;
  readonly status: TimerStatus;
  readonly onToggle: () => void;
  readonly onRestart: () => void;
  readonly onCloseMenu: () => void;
  readonly onCloseLegal: () => void;
  readonly onWheel: (pasos: number) => void;
  readonly suprimirClic: RefObject<boolean>;
  readonly stageRef: RefObject<HTMLElement | null>;
}

/** Clic, doble clic, rueda y teclado. La decisión sale de funciones puras. */
export function useStageInput(opciones: Opciones): {
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
} {
  const ref = useRef(opciones);
  ref.current = opciones;
  const clickTimer = useRef<number | null>(null);
  const resumeArmed = useRef(false);
  const rueda = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const actual = ref.current;
      if (event.key === 'Escape') {
        if (actual.legalAbierto) actual.onCloseLegal();
        else if (actual.menu) actual.onCloseMenu();
        return;
      }
      if (actual.legalAbierto || actual.intro) return;
      if ((event.code !== 'Space' && event.code !== 'Enter') || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('button, a, input, textarea, select')) return;
      event.preventDefault();
      actual.onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const el = opciones.stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const actual = ref.current;
      if (actual.intro || !ruedaAjustaTiempo(actual.status, actual.menu)) return;
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 16;
      if (event.deltaMode === 2) dy *= 400;
      rueda.current += dy;
      const pasos = Math.trunc(rueda.current / 72);
      if (pasos === 0) return;
      rueda.current -= pasos * 72;
      actual.onWheel(pasos);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [opciones.stageRef]);

  const onClick = (event: ReactMouseEvent<HTMLElement>) => {
    const actual = ref.current;
    if (actual.intro || actual.menu) return;
    if (actual.suprimirClic.current) {
      actual.suprimirClic.current = false;
      return;
    }
    const decision = decideStageClick({
      status: actual.status,
      detail: event.detail,
      pendingToggle: clickTimer.current !== null,
      resumeArmed: resumeArmed.current,
    });
    if (decision.kind === 'ignore-extra') return;
    if (decision.kind === 'cancel-pending') {
      if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    resumeArmed.current = decision.armResume;
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      ref.current.onToggle();
    }, 260);
  };

  const onDoubleClick = () => {
    window.getSelection()?.removeAllRanges();
    const actual = ref.current;
    if (actual.intro || actual.menu) return;
    if (decideStageDoubleClick(actual.status, resumeArmed.current) === 'ignore') return;
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
    clickTimer.current = null;
    resumeArmed.current = false;
    actual.onRestart();
  };

  return { onClick, onDoubleClick };
}
