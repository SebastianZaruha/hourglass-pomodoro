import {
  activeCycleConfig,
  nearestStepIndex,
  stepMinutes,
  stepToDuration,
  type SessionSnapshot,
  type SessionState,
  type Settings,
} from '@reloj/core';
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';

import type { MaquinaGiro } from '../comun/giro';
import {
  decideStageClick,
  decideStageDoubleClick,
  ensureNotificationPermission,
  primeAudio,
  type SettingsPatch,
} from '../comun/tiempo';

interface Entrada {
  readonly menu: boolean;
  readonly setMenu: (open: boolean) => void;
  readonly legal: { href: string; title: string } | null;
  readonly setLegal: (doc: { href: string; title: string } | null) => void;
  readonly introBloquea: boolean;
  readonly view: SessionSnapshot;
  readonly state: SessionState;
  readonly settings: Settings;
  readonly update: (patch: SettingsPatch | ((current: Settings) => SettingsPatch)) => void;
  readonly toggle: () => void;
  readonly restart: () => void;
  readonly giro: MaquinaGiro;
  readonly wake: () => void;
  readonly stageRef: RefObject<HTMLDivElement | null>;
}

/**
 * Clic, doble clic, rueda y teclado. Los números son los publicados:
 * 260 ms, 72 px de rueda, y el doble clic no reinicia si empezó en pausa.
 */
export function useEntrada(e: Entrada) {
  const introRef = useRef(e.introBloquea);
  introRef.current = e.introBloquea;
  const legalRef = useRef(e.legal);
  legalRef.current = e.legal;
  const wakeRef = useRef(e.wake);
  wakeRef.current = e.wake;
  const giroRef = useRef(e.giro);
  giroRef.current = e.giro;

  const doToggle = useCallback(() => {
    primeAudio();
    const status = e.state.timer.status;
    if (status === 'idle' || status === 'finished') void ensureNotificationPermission();
    e.toggle();
    wakeRef.current();
  }, [e.state.timer.status, e.toggle]);

  const doRestart = useCallback(() => {
    if (giroRef.current.ordenar({ tipo: 'reiniciar' }) !== 'commit') return;
    e.restart();
    wakeRef.current();
  }, [e.restart]);

  const toggleRef = useRef(doToggle);
  toggleRef.current = doToggle;
  const menuRef = useRef(e.menu);
  menuRef.current = e.menu;
  const setMenuRef = useRef(e.setMenu);
  setMenuRef.current = e.setMenu;
  const setLegalRef = useRef(e.setLegal);
  setLegalRef.current = e.setLegal;

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        if (legalRef.current) {
          setLegalRef.current(null);
          return;
        }
        if (menuRef.current) setMenuRef.current(false);
        return;
      }
      if (legalRef.current || introRef.current) return;
      if (ev.code !== 'Space' || ev.repeat) return;
      const target = ev.target instanceof Element ? ev.target : null;
      if (target?.closest('button, a, input, textarea, select')) return;
      ev.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const wheelAcc = useRef(0);
  useEffect(() => {
    const el = e.stageRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      if (
        introRef.current ||
        e.menu ||
        e.state.timer.status === 'running' ||
        e.state.timer.status === 'paused'
      )
        return;
      let dy = ev.deltaY;
      if (ev.deltaMode === 1) dy *= 16;
      if (ev.deltaMode === 2) dy *= 400;
      wheelAcc.current += dy;
      const steps = Math.trunc(wheelAcc.current / 72);
      if (steps === 0) return;
      wheelAcc.current -= steps * 72;
      if (e.settings.sessionMode === 'cycles') {
        const cycle = activeCycleConfig(e.settings);
        e.update({
          sessionMode: 'cycles',
          cyclePreset: 'custom',
          customCycle: { ...cycle, workMin: stepMinutes(cycle.workMin, -steps) },
        });
      } else {
        e.update({
          sessionMode: 'single',
          lastDurationMs: stepToDuration(nearestStepIndex(e.settings.lastDurationMs) - steps),
        });
      }
      wakeRef.current();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [e.menu, e.settings, e.state.timer.status, e.update, e.stageRef]);

  const clickTimer = useRef<number | null>(null);
  /** Esta pareja de clics empezó con PAUSA: el doble clic no reinicia. */
  const resumeArmed = useRef(false);
  const viewRef = useRef(e.view);
  viewRef.current = e.view;
  const suppressRef = useRef(false);

  const onStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (introRef.current || menuRef.current) return;
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const decision = decideStageClick({
      status: viewRef.current.status,
      detail: event.detail,
      pendingToggle: clickTimer.current !== null,
      resumeArmed: resumeArmed.current,
    });
    if (decision.kind === 'ignore-extra') return;
    if (decision.kind === 'cancel-pending') {
      if (clickTimer.current !== null) {
        window.clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      return;
    }
    resumeArmed.current = decision.armResume;
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      doToggle();
    }, 260);
  };

  const onStageDoubleClick = () => {
    window.getSelection()?.removeAllRanges();
    if (introRef.current || menuRef.current) return;
    if (decideStageDoubleClick(viewRef.current.status, resumeArmed.current) === 'ignore') return;
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    resumeArmed.current = false;
    doRestart();
  };

  const onStageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (introRef.current) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      doToggle();
    }
  };

  const onStageMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.detail > 1) event.preventDefault();
  };

  return {
    onStageClick,
    onStageDoubleClick,
    onStageKeyDown,
    onStageMouseDown,
    suppressClickRef: suppressRef,
    onReinicio: () => {
      e.restart();
      wakeRef.current();
    },
  };
}
