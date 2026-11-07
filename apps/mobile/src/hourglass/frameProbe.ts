/**
 * Tiempos de fotograma para medir en un móvil de verdad (el A55).
 *
 * Apagado no reserva nada y el bucle solo mira un booleano. Se enciende
 * manteniendo pulsado el título «Ajustes» (ver SettingsSheet). La lectura
 * es un anillo fijo: no crece.
 */
import type { DetailLevel } from '@reloj/core';

const N = 120;

export interface FrameNote {
  readonly jsMs: number;
  readonly simMs: number;
  readonly gapMs: number;
  readonly level: DetailLevel;
}

export interface FrameReport {
  readonly frames: number;
  readonly fps: number;
  readonly jsP50: number;
  readonly jsP95: number;
  readonly simP50: number;
  readonly gapP50: number;
  readonly level: DetailLevel;
}

let enabled = false;
const js = new Float32Array(N);
const sim = new Float32Array(N);
const gap = new Float32Array(N);
let count = 0;
let cursor = 0;
let level: DetailLevel = 'alta';

export function frameProbeEnabled(): boolean {
  return enabled;
}

export function toggleFrameProbe(): boolean {
  enabled = !enabled;
  count = 0;
  cursor = 0;
  return enabled;
}

export function noteFrame(note: FrameNote): void {
  if (!enabled) return;
  js[cursor] = note.jsMs;
  sim[cursor] = note.simMs;
  gap[cursor] = note.gapMs;
  level = note.level;
  cursor = (cursor + 1) % N;
  if (count < N) count += 1;
}

export function frameReport(): FrameReport | null {
  if (!enabled || count < 8) return null;
  const jsSorted = Array.from(js.subarray(0, count)).sort((a, b) => a - b);
  const simSorted = Array.from(sim.subarray(0, count)).sort((a, b) => a - b);
  const gapSorted = Array.from(gap.subarray(0, count))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const gapMid = gapSorted.length > 0 ? at(gapSorted, 0.5) : 0;
  return {
    frames: count,
    fps: gapMid > 0 ? 1000 / gapMid : 0,
    jsP50: at(jsSorted, 0.5),
    jsP95: at(jsSorted, 0.95),
    simP50: at(simSorted, 0.5),
    gapP50: gapMid,
    level,
  };
}

function at(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i] ?? 0;
}
