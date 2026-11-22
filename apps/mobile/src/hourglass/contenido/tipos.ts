import type { HourglassSnapshot } from '../types';
import type { MotionSource } from '../types';
import type { SkPicture } from '@shopify/react-native-skia';
import type { Vec2 } from '@reloj/core';

/** Lo que el bucle le cuenta al contenido en un fotograma. */
export interface EntradaMotor {
  dt: number;
  ticks: number;
  /** Gravedad en escalones: la de la simulación. */
  gravedad: Vec2;
  /** Gravedad suave: la del chorro. */
  gravedadSuave: Vec2;
  snap: HourglassSnapshot;
  reducir: boolean;
  durationMs: number;
  /** Giro de fase en curso: la arena va quieta dentro del vidrio. */
  enGiro: boolean;
  /** Vacía el bulbo de origen. El giro de fase lo pide antes de dar la vuelta. */
  vaciar: boolean;
  /** Solo esa vaciada, sin mover la arena. */
  soloVaciar: boolean;
  /** Reposo: coloca la arena de la duración y no da pasos. */
  reposo: boolean;
}

/**
 * Pieza intercambiable del reloj. Igual que `Contenido` de la web:
 * el bucle lleva el tiempo y el vidrio; esto solo avanza y pinta.
 */
export interface MotorContenido {
  /** Avanza. Devuelve true si la arena o el chorro siguen moviéndose. */
  paso(e: EntradaMotor): boolean;
  /** Picture de este fotograma. El bucle lo publica y lo libera. */
  pintar(motion: MotionSource): SkPicture;
  /**
   * La rejilla da media vuelta. `reinicio` es el volteo del móvil;
   * `fase` es el final del giro de un ciclo. En los dos la arena hace lo mismo.
   */
  alVoltear(motivo: 'reinicio' | 'fase'): void;
  /** Suelta lo que creó. No queda nada vivo. */
  destruir(): void;
  /** Hay que volver a grabar la arena (lo pone `paso`). */
  readonly hayQuePintar: boolean;
  /** Lo que costó el paso de la simulación (ms). Lo lee TiltLod. */
  readonly simMs: number;
  /** Cambia cuando cambia el pintor. */
  readonly revision: number;
}
