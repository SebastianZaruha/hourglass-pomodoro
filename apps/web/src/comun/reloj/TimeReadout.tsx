import { formatDuration, type SessionSnapshot } from '@reloj/core';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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

/** En ancha el reloj sube con --clock-lift. El deslizamiento lo suma para no pisar esa transformación. */
function alzado(el: HTMLElement): number {
  const app = el.closest('.app');
  if (!app || app.getAttribute('data-layout') !== 'wide') return 0;
  const n = parseFloat(getComputedStyle(app).getPropertyValue('--clock-lift'));
  return Number.isFinite(n) ? -n : 0;
}

export function TimeReadout({ getSnapshot, running, label, hint, describe, pulso = false, estrecho = false }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const previa = useRef<DOMRect | null>(null);
  const animando = useRef(false);
  useHojaVidrio(caja, estrecho);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const guardar = () => {
      if (animando.current || !caja.current) return;
      previa.current = caja.current.getBoundingClientRect();
    };
    const despues = () => requestAnimationFrame(guardar);
    window.addEventListener('resize', guardar, true);
    const app = el.closest('.app');
    const obs = app ? new MutationObserver(despues) : null;
    obs?.observe(app as Node, { attributes: true, attributeFilter: ['style'] });
    guardar();
    return () => {
      window.removeEventListener('resize', guardar, true);
      obs?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const antes = previa.current;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.transition = 'none';
    el.style.transform = '';
    const ahora = el.getBoundingClientRect();
    const dx = antes ? antes.left + antes.width / 2 - (ahora.left + ahora.width / 2) : 0;
    const dy = antes ? antes.top + antes.height / 2 - (ahora.top + ahora.height / 2) : 0;
    if (!antes || reducido || Math.hypot(dx, dy) < 1) {
      previa.current = ahora;
      return;
    }
    const lift = alzado(el);
    animando.current = true;
    el.style.transform = `translate(${dx}px, ${dy + lift}px)`;
    void el.offsetWidth;
    el.style.transition = 'transform 300ms ease';
    el.style.transform = lift ? `translateY(${lift}px)` : 'translate(0px, 0px)';
    const limpiar = () => {
      el.style.transition = '';
      el.style.transform = '';
      animando.current = false;
      previa.current = el.getBoundingClientRect();
    };
    const id = window.setTimeout(limpiar, 360);
    const alFin = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== 'transform') return;
      window.clearTimeout(id);
      limpiar();
    };
    el.addEventListener('transitionend', alFin);
    return () => {
      window.clearTimeout(id);
      el.removeEventListener('transitionend', alFin);
    };
  }, [estrecho]);
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
