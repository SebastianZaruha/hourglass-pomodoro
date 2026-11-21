/**
 * Motor de sesión del core, con la hora del sistema.
 * En una pestaña en segundo plano el intervalo se duerme, pero el tiempo
 * se calcula con marcas: al volver, `tick` recorre las fases que hayan pasado.
 */
import {
  createSession,
  replacePlan,
  restartSession,
  samePlan,
  sessionSnapshot,
  tickSession,
  toggleSession,
  type SessionPlan,
  type SessionSnapshot,
  type SessionState,
} from '@reloj/core';
import { useCallback, useEffect, useRef, useState } from 'react';

const PHASE_WATCH_MS = 250;

export function useSession(initialPlan: SessionPlan) {
  const [state, setState] = useState<SessionState>(() => createSession(initialPlan));
  const stateRef = useRef(state);

  const apply = useCallback((fn: (s: SessionState) => SessionState) => {
    const next = fn(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const getSnapshot = useCallback((): SessionSnapshot => sessionSnapshot(stateRef.current, Date.now()), []);

  const tick = useCallback(() => apply((s) => tickSession(s, Date.now())), [apply]);

  const running = state.timer.status === 'running';
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(tick, PHASE_WATCH_MS);
    return () => window.clearInterval(id);
  }, [running, tick]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [tick]);

  const toggle = useCallback(() => apply((s) => toggleSession(s, Date.now())), [apply]);
  const restart = useCallback(() => apply((s) => restartSession(s)), [apply]);
  const replaceIfChanged = useCallback(
    (plan: SessionPlan) => apply((s) => (samePlan(s.plan, plan) ? s : replacePlan(s, plan))),
    [apply],
  );

  return {
    state,
    view: sessionSnapshot(state, Date.now()),
    getSnapshot,
    tick,
    toggle,
    restart,
    replaceIfChanged,
  };
}
