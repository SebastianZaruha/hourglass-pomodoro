/**
 * Geometría de los materiales que no son arena.
 *
 * El estado es el porcentaje de tiempo: p = transcurrido / duración.
 * Arriba queda 1 − p y abajo p. No hay granos que contar ni que se
 * desfasen del reloj. La inclinación solo tumba la superficie.
 *
 * El chorro no es física: es un patrón que se recicla. Su fase avanza a
 * una velocidad fija (ciclos por segundo del material), igual en un reloj
 * de 5 minutos que en uno de 60.
 */
import type { HourglassProfile } from '../geometry/profile';
import { innerRadiusAt } from '../geometry/profile';
import { MIN_FLOW_GRAVITY_Y } from '../sim/flow';

const SLICES = 64;

export interface FlowPose {
  /** 0 al empezar, 1 al terminar. */
  readonly p: number;
  /** Volumen del bulbo de arriba, 0..1. */
  readonly top: number;
  /** Volumen del bulbo de abajo, 0..1. */
  readonly bottom: number;
  /**
   * Pendiente de la superficie (sube hacia la derecha si es positiva).
   * 0 = horizontal. Sale de la gravedad ya expresada en el marco del reloj.
   */
  readonly slope: number;
  /** ¿Se dibuja el chorro? En marcha, de pie y con algo todavía arriba. */
  readonly flowing: boolean;
}

export interface FlowPoseInput {
  readonly remainingMs: number;
  readonly durationMs: number;
  readonly gravityX: number;
  readonly gravityY: number;
  readonly running: boolean;
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** p = transcurrido / duración. Entradas rotas → 0 (todo arriba). */
export function progressOf(remainingMs: number, durationMs: number): number {
  if (!(durationMs > 0) || !Number.isFinite(durationMs) || !Number.isFinite(remainingMs)) return 0;
  const remaining = Math.min(durationMs, Math.max(0, remainingMs));
  return 1 - remaining / durationMs;
}

export function flowPose(input: FlowPoseInput): FlowPose {
  const p = progressOf(input.remainingMs, input.durationMs);
  const gy = Number.isFinite(input.gravityY) ? input.gravityY : 1;
  const gx = Number.isFinite(input.gravityX) ? input.gravityX : 0;
  const slope = gy > 0.2 ? Math.min(0.85, Math.max(-0.85, gx / gy)) : 0;
  const top = 1 - p;
  return {
    p,
    top,
    bottom: p,
    slope,
    flowing: input.running && top > 0.012 && gy >= MIN_FLOW_GRAVITY_Y,
  };
}

/** Volumen de un bulbo (integral del ancho interior). */
export function bulbVolume(profile: HourglassProfile): number {
  const du = 1 / SLICES;
  let total = 0;
  for (let i = 0; i < SLICES; i++) {
    total += 2 * innerRadiusAt(profile, (i + 0.5) * du) * du;
  }
  return total;
}

/**
 * Distancia de la superficie al cuello (0 = cuello, 1 = extremo).
 *
 * `fromNeck`: el volumen se cuenta desde el cuello hacia el extremo
 * (el charco de arriba, apoyado en el cuello). Si no, el volumen es el
 * que hay entre la superficie y el extremo (el charco de abajo).
 */
export function surfaceU(profile: HourglassProfile, fill: number, fromNeck: boolean): number {
  const f = clamp01(fill);
  if (f <= 0) return fromNeck ? 0 : 1;
  if (f >= 1) return fromNeck ? 1 : 0;
  const total = bulbVolume(profile);
  if (!(total > 0)) return fromNeck ? f : 1 - f;
  const target = (fromNeck ? f : 1 - f) * total;
  const du = 1 / SLICES;
  let acc = 0;
  for (let i = 0; i < SLICES; i++) {
    const slice = 2 * innerRadiusAt(profile, (i + 0.5) * du) * du;
    acc += slice;
    if (acc >= target && slice > 0) {
      const frac = 1 - (acc - target) / slice;
      return Math.min(1, Math.max(0, (i + frac) / SLICES));
    }
  }
  return 1;
}

export interface SurfacePoint {
  x: number;
  y: number;
}

/**
 * Polilínea de la superficie libre, en coordenadas del perfil
 * (x −1..1, y −1 arriba, 0 cuello, 1 abajo). La escribe en `into`
 * y devuelve cuántos puntos valen. 0 si no hay volumen.
 */
export function writeLiquidSurface(
  profile: HourglassProfile,
  fromNeck: boolean,
  fill: number,
  slope: number,
  mound: number,
  waveAmp: number,
  wavePhase: number,
  into: SurfacePoint[],
): number {
  if (!(fill > 0.01) || into.length < 2) return 0;
  const u = surfaceU(profile, fill, fromNeck);
  const y0 = fromNeck ? -u : u;
  const n = into.length;
  const slopeC = Math.min(0.85, Math.max(-0.85, Number.isFinite(slope) ? slope : 0));
  const moundC = Number.isFinite(mound) ? mound : 0;
  const amp = Number.isFinite(waveAmp) ? waveAmp : 0;
  const phase = Number.isFinite(wavePhase) ? wavePhase : 0;
  const lo = fromNeck ? -0.97 : 0.035;
  const hi = fromNeck ? -0.035 : 0.97;
  for (let i = 0; i < n; i++) {
    const x = -1.08 + (2.16 * i) / (n - 1);
    const bell = 1 - Math.min(1, x * x);
    const y = y0 + slopeC * x * 0.55 - moundC * bell + amp * Math.sin(x * 8 + phase);
    const point = into[i] ?? { x: 0, y: 0 };
    point.x = x;
    point.y = Math.min(hi, Math.max(lo, y));
    into[i] = point;
  }
  return n;
}

export interface RibbonMark {
  /** −1..1 a lo ancho del cuello. */
  x: number;
  /** 0 junto al cuello, 1 al llegar abajo. Se recicla con la fase. */
  t: number;
  /** Largo relativo. */
  len: number;
  alpha: number;
}

/**
 * Rayas o gotas del chorro. `phase` es adimensional (ciclos): no conoce
 * la duración del reloj, así que un reloj corto y uno largo se ven igual
 * de vivos. Escribe como mucho `count` marcas en `into`.
 */
export function writeRibbons(phase: number, count: number, into: RibbonMark[]): number {
  const n = Math.max(0, Math.min(Math.floor(count), into.length));
  const base = Number.isFinite(phase) ? phase : 0;
  for (let i = 0; i < n; i++) {
    const seed = i + 1;
    const t = frac(base + seed * 0.173);
    const mark = into[i] ?? { x: 0, t: 0, len: 0, alpha: 0 };
    mark.x = Math.sin(seed * 2.399) * 0.62;
    mark.t = t;
    mark.len = 0.14 + (seed % 5) * 0.028;
    mark.alpha = 0.4 + 0.6 * Math.sin(Math.PI * t);
    into[i] = mark;
  }
  return n;
}

export interface CloudPuff {
  /** Desplazamiento horizontal, en semianchos del racimo. */
  x: number;
  /** Desplazamiento vertical, negativo = hacia el extremo de arriba. */
  y: number;
  /** Radio relativo al semiancho. */
  r: number;
  alpha: number;
  /** 0 más oscuro (panza), 1 más claro (lomo). */
  shade: number;
}

/**
 * Racimo fijo de la nube. Se escala con el volumen: no es un óvalo.
 * Los centros se solapan a propósito para que se lea como algodón.
 */
export const CLOUD_TEMPLATE: readonly { x: number; y: number; r: number; shade: number }[] = [
  { x: 0, y: -0.02, r: 0.42, shade: 0.92 },
  { x: -0.46, y: 0.1, r: 0.34, shade: 0.78 },
  { x: 0.48, y: 0.08, r: 0.33, shade: 0.76 },
  { x: -0.22, y: -0.34, r: 0.28, shade: 1 },
  { x: 0.26, y: -0.32, r: 0.26, shade: 0.96 },
  { x: 0.04, y: 0.28, r: 0.3, shade: 0.55 },
  { x: -0.72, y: 0.02, r: 0.22, shade: 0.7 },
  { x: 0.74, y: -0.02, r: 0.2, shade: 0.68 },
  { x: -0.08, y: -0.52, r: 0.18, shade: 1 },
  { x: 0.36, y: -0.16, r: 0.16, shade: 0.88 },
  { x: -0.38, y: 0.26, r: 0.18, shade: 0.5 },
];

/**
 * Coloca la nube. `fill` 0 = no hay nube. `tilt` la desplaza (gravedad x).
 * `drift` es un temblor lento (−1..1) solo mientras llueve; en reposo, 0.
 */
export function writeCloud(fill: number, tilt: number, drift: number, into: CloudPuff[]): number {
  const f = clamp01(fill);
  if (f < 0.03) return 0;
  const scale = 0.38 + 0.62 * f;
  const sink = (1 - f) * 0.55;
  const lean = Number.isFinite(tilt) ? tilt : 0;
  const wobble = Number.isFinite(drift) ? drift : 0;
  const n = Math.min(CLOUD_TEMPLATE.length, into.length);
  for (let i = 0; i < n; i++) {
    const src = CLOUD_TEMPLATE[i]!;
    const puff = into[i] ?? { x: 0, y: 0, r: 0, alpha: 0, shade: 0 };
    puff.x = (src.x + lean * 0.7) * scale + wobble * Math.sin(src.y * 3 + i);
    puff.y = src.y * scale + sink;
    puff.r = src.r * scale;
    puff.alpha = (0.22 + 0.78 * f) * (0.45 + 0.55 * src.shade);
    puff.shade = src.shade;
    into[i] = puff;
  }
  return n;
}

function frac(v: number): number {
  return v - Math.floor(v);
}
