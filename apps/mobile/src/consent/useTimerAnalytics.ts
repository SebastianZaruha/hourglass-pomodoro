import { sessionCue, type SessionSnapshot } from '@reloj/core';
import { useEffect, useRef } from 'react';

import { logTimerEvent, setUsageContext } from './collection';
import { timerCompleteParams, timerStartParams, type UsageContext } from './events';

type Snapshot = Pick<SessionSnapshot, 'status' | 'transitions'>;

/**
 * `timer_start` al pasar a marcha (no al reanudar una pausa) y `timer_complete`
 * cuando la arena termina sola. Con el consentimiento apagado no se llama al SDK.
 */
export function useTimerAnalytics(
  enabled: boolean,
  view: Snapshot,
  usage: UsageContext,
  durationMs: number,
): void {
  const { status, transitions } = view;
  const { language, theme, mode } = usage;
  const previous = useRef<Snapshot>({ status, transitions });

  useEffect(() => {
    if (!enabled) return;
    void setUsageContext({ language, theme, mode });
  }, [enabled, language, theme, mode]);

  useEffect(() => {
    const before = previous.current;
    const next = { status, transitions };
    previous.current = next;
    if (!enabled) return;
    const started = status === 'running' && before.status !== 'running' && before.status !== 'paused';
    if (started) {
      void logTimerEvent('timer_start', timerStartParams({ language, theme, mode, durationMs }));
    }
    if (sessionCue(before, next) === 'finished') {
      void logTimerEvent('timer_complete', timerCompleteParams({ mode, durationMs }));
    }
  }, [enabled, status, transitions, language, theme, mode, durationMs]);
}
