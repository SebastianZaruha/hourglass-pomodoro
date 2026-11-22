import { formatDuration, type SessionSnapshot } from '@reloj/core';
import { useEffect, useRef, useState } from 'react';

import { useHojaVidrio } from '../estilo/vidrio-liquido';

interface Props {
  readonly getSnapshot: () => SessionSnapshot;
  readonly running: boolean;
  readonly label: string | null;
  readonly hint: string | null;
  readonly pulso?: boolean;
  readonly describe: (remainingMs: number) => string;
  /** En vertical el reloj va bajo el frasco y lleva el mismo vidrio que las hojas. */
  readonly estrecho?: boolean;
}

export function TimeReadout({ getSnapshot, running, label, hint, describe, pulso = false, estrecho = false }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  useHojaVidrio(caja, estrecho);
  const [text, setText] = useState(() => formatDuration(getSnapshot().remainingMs));
  const [live, setLive] = useState(() => describe(getSnapshot().remainingMs));

  useEffect(() => {
    let minute = Math.ceil(getSnapshot().remainingMs / 60_000);
    const write = () => {
      const snap = getSnapshot();
      setText(formatDuration(snap.remainingMs));
      document.title = `${formatDuration(snap.remainingMs)} · Hourglass Pomodoro`;
      const nextMinute = Math.ceil(snap.remainingMs / 60_000);
      if (nextMinute !== minute) {
        minute = nextMinute;
        setLive(describe(snap.remainingMs));
      }
    };
    write();
    setLive(describe(getSnapshot().remainingMs));
    if (!running) return;
    const id = window.setInterval(write, 250);
    return () => window.clearInterval(id);
  }, [describe, getSnapshot, running]);

  return (
    <div ref={caja} className={estrecho ? 'readout vidrio vidrio-liquido' : 'readout'}>
      <p className="sr-only" aria-live="polite">
        {label ? `${label}. ` : ''}
        {live}
      </p>
      <div className={pulso ? 'time pulso' : 'time'} aria-hidden="true">
        {text}
      </div>
      {label ? (
        <div className="status" aria-hidden="true">
          {label}
        </div>
      ) : null}
      {hint ? (
        <p className="hint" aria-hidden="true">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
