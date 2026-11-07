/**
 * Visitas ambientales (abeja, zorro, ráfaga).
 *
 * Solo avanzan con el reloj en marcha. La primera no puede caer en los
 * primeros 30 s, y entre una y otra pasan de 3 a 6 minutos.
 */
export type VisitKind = 0 | 1;

export interface Visit {
  readonly start: number;
  readonly dur: number;
  readonly kind: VisitKind;
  readonly seed: number;
}

export interface VisitClock {
  readonly elapsed: number;
  readonly nextAt: number;
  readonly active: Visit | null;
}

export function freshVisitClock(rand: () => number = Math.random): VisitClock {
  return { elapsed: 0, nextAt: 180 + rand() * 180, active: null };
}

export function stepVisit(
  state: VisitClock,
  dt: number,
  running: boolean,
  enabled: boolean,
  rand: () => number = Math.random,
): VisitClock {
  if (!enabled || !running || !(dt > 0)) return state;
  const elapsed = state.elapsed + dt;
  let nextAt = state.nextAt;
  let active = state.active;
  if (active && elapsed >= active.start + active.dur) {
    active = null;
    nextAt = elapsed + 180 + rand() * 180;
  }
  if (!active && elapsed >= nextAt && elapsed >= 30) {
    const kind: VisitKind = rand() < 0.5 ? 0 : 1;
    const dur = kind === 0 ? 6 + rand() * 3 : 4 + rand() * 3;
    active = { start: elapsed, dur, kind, seed: rand() };
  }
  return { elapsed, nextAt, active };
}

/** 0 al empezar, 1 en el medio, 0 al terminar. */
export function visitEnvelope(visit: Visit, now: number): number {
  const t = (now - visit.start) / Math.max(0.001, visit.dur);
  if (t <= 0 || t >= 1) return 0;
  const edge = Math.min(t, 1 - t) / 0.18;
  return Math.min(1, edge);
}
