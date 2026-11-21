import { formatDuration, type SessionSnapshot } from '@reloj/core';
import { useEffect, useState } from 'react';

interface Props {
  readonly getSnapshot: () => SessionSnapshot;
  readonly running: boolean;
  readonly label: string | null;
  readonly hint: string | null;
  readonly describe: (remainingMs: number) => string;
}

export function TimeReadout({ getSnapshot, running, label, hint, describe }: Props) {
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
    <div className="readout">
      <p className="sr-only" aria-live="polite">
        {label ? `${label}. ` : ''}
        {live}
      </p>
      <div className="time" aria-hidden="true">
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
