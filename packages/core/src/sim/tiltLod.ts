/**
 * Menos detalle en la simulación SOLO durante un giro fuerte (1.8.9).
 *
 * Qué pasaba: al inclinar mucho el móvil (sin llegar a voltearlo), casi toda
 * la arena tiene que correr hacia el otro lado y en un móvil de gama media
 * la animación bajaba a ~4 fotogramas por segundo. Medido en el core, lo
 * caro de esos fotogramas es:
 *   - reordenar las celdas cada vez que cambia la dirección de la gravedad
 *     (`ensureOrder`, una ordenación de todas las celdas: unas 15 veces lo
 *     que cuesta un paso normal), que con escalones de 3° ocurre casi en
 *     cada fotograma mientras se gira;
 *   - los pasos con miles de granos moviéndose a la vez;
 *   - y la «puesta al día» (`MAX_CATCH_UP`): a pocos fps el bucle da hasta
 *     3 veces más pasos por fotograma, lo que lo hace aún más lento.
 *
 * Mientras esto está activo, el bucle de la arena:
 *   - usa la gravedad de la simulación en escalones de `stepDeg` (10°) en
 *     vez de 3°: unas tres veces menos reordenaciones (10 divide 90: de pie
 *     y de lado la arena sigue cayendo recta). La arena cae hacia el
 *     escalón más cercano; el dibujo, el chorro y la luz siguen usando la
 *     gravedad suave, así que el giro se sigue viendo continuo;
 *   - no se pone al día (un «fotograma de 60» por fotograma);
 *   - regraba la luz y los reflejos del vidrio a la mitad de ritmo.
 * Al terminar, vuelve a los escalones de 3° (la arena se recoloca esos pocos
 * grados con una sola reordenación) y a la calidad normal.
 *
 * Cuándo se activa: solo si se cumplen LAS DOS cosas a la vez, durante
 * `heavyFrames` fotogramas:
 *   1. giro fuerte: la gravedad se ha alejado `strongTiltDeg` (40°) o más de
 *      donde estaba la última vez que el móvil estuvo quieto;
 *   2. la simulación del fotograma anterior ha costado `heavyFrameMs` (24 ms)
 *      o más, es decir, el móvil NO llega.
 * Un móvil rápido, el reloj de pie, de lado quieto o con inclinaciones
 * normales nunca lo activan. Se apaga `holdMs` (2,5 s) después de que el
 * móvil deja de girar (mientras sigue girando, se mantiene).
 *
 * Lógica pura y sin crear objetos por fotograma (lo llama el bucle de la
 * arena en el hilo de JS).
 */
import { quantizeDirection, type MutableVec2 } from '../physics/motion';
import type { Vec2 } from '../physics/vector';

export interface TiltLodOptions {
  /** Giro desde el último reposo a partir del que cuenta como «fuerte» (grados). */
  readonly strongTiltDeg: number;
  /** Coste de la simulación en un fotograma a partir del que el móvil no llega (ms). */
  readonly heavyFrameMs: number;
  /** Fotogramas caros (con giro fuerte) seguidos o no que hacen falta para activarlo. */
  readonly heavyFrames: number;
  /** Cuánto dura después de que el móvil deja de girar (ms). */
  readonly holdMs: number;
  /** Tiempo sin girar para considerar el móvil quieto (ms). */
  readonly restMs: number;
  /** Por debajo de esta velocidad de giro el móvil está quieto (grados/s). */
  readonly restDegPerSec: number;
  /** Escalón de la gravedad de la simulación mientras está activo (grados). */
  readonly stepDeg: number;
}

export const TILT_LOD: TiltLodOptions = {
  strongTiltDeg: 40,
  heavyFrameMs: 24,
  heavyFrames: 2,
  holdMs: 2500,
  restMs: 400,
  restDegPerSec: 25,
  stepDeg: 10,
};

const DEG = 180 / Math.PI;

/** Diferencia de ángulos en (−π, π]. */
function wrap(a: number): number {
  if (a > Math.PI) return a - 2 * Math.PI;
  if (a <= -Math.PI) return a + 2 * Math.PI;
  return a;
}

export class TiltLod {
  private active = false;
  /** Dirección de la gravedad la última vez que el móvil estuvo quieto. */
  private anchor = Number.NaN;
  private lastAngle = Number.NaN;
  private lastAt = 0;
  /** Desde cuándo gira despacio (null = está girando). */
  private slowSince: number | null = null;
  private heavy = 0;
  private until = 0;
  /** Gravedad de la simulación en escalones gruesos (solo mientras está activo). */
  private readonly coarse: MutableVec2 = { x: 0, y: 1 };

  constructor(private readonly options: TiltLodOptions = TILT_LOD) {}

  /** ¿Está ahora con menos detalle? */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Una vez por fotograma, antes de simular.
   *
   * @param now Marca de tiempo (ms).
   * @param gravity Gravedad suave (unitaria; la del dibujo).
   * @param simGravity Gravedad de la simulación en escalones finos.
   * @param lastSimMs Lo que costó la simulación en el fotograma anterior (ms).
   * @returns La gravedad que debe usar la simulación en este fotograma.
   */
  update(now: number, gravity: Vec2, simGravity: Vec2, lastSimMs: number): Vec2 {
    const o = this.options;
    const angle = Math.atan2(gravity.x, gravity.y);
    if (!Number.isFinite(angle)) return this.active ? this.coarse : simGravity;
    if (!Number.isFinite(this.lastAngle)) {
      this.anchor = angle;
      this.lastAngle = angle;
      this.lastAt = now;
      this.slowSince = now;
    }
    const dt = now - this.lastAt;
    const speed = dt > 0 ? (Math.abs(wrap(angle - this.lastAngle)) * DEG * 1000) / dt : 0;
    this.lastAngle = angle;
    this.lastAt = now;
    if (speed < o.restDegPerSec) this.slowSince ??= now;
    else this.slowSince = null;
    const resting = this.slowSince !== null && now - this.slowSince >= o.restMs;

    if (!this.active) {
      if (resting) {
        this.anchor = angle;
        this.heavy = 0;
      }
      const swing = Math.abs(wrap(angle - this.anchor)) * DEG;
      if (swing >= o.strongTiltDeg && lastSimMs >= o.heavyFrameMs) this.heavy += 1;
      if (this.heavy >= o.heavyFrames) {
        this.active = true;
        this.until = now + o.holdMs;
        // Empieza donde está la simulación: sin salto.
        this.coarse.x = simGravity.x;
        this.coarse.y = simGravity.y;
      }
    } else {
      if (!resting) this.until = Math.max(this.until, now + o.holdMs);
      if (now >= this.until) {
        this.active = false;
        this.heavy = 0;
        this.anchor = angle;
      }
    }

    if (!this.active) return simGravity;
    quantizeDirection(gravity, o.stepDeg, this.coarse);
    return this.coarse;
  }

  /** Vuelve a la calidad normal y olvida el giro (voltear, simulación nueva). */
  reset(): void {
    this.active = false;
    this.heavy = 0;
    this.until = 0;
    this.anchor = Number.NaN;
    this.lastAngle = Number.NaN;
    this.slowSince = null;
  }
}
