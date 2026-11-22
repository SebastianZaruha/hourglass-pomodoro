/**
 * Escena del móvil: fondo, colores y, más adelante, agua y nube.
 * Clásico usa los temas de hoy, los mismos objetos.
 */
import type { SceneId } from '@reloj/core';

import type { HourglassTheme } from '../theme/theme';

export type Material = 'arena' | 'agua';

/** Foto en cover. `anclaY` 1 apoya el borde de abajo (se recorta el cielo). */
export type FondoMovil =
  | { readonly tipo: 'procedural' }
  | { readonly tipo: 'foto'; readonly fuente: number; readonly anclaY: number };

export interface AspectoMovil {
  readonly fondo: FondoMovil;
  readonly tema: HourglassTheme;
  /** Ángulo de la luz de los granos. 0° es la derecha y 90° es abajo. F2b. */
  readonly luzGrano?: number;
}

export interface EscenaMovil {
  readonly id: SceneId;
  readonly nombre: { readonly es: string; readonly en: string };
  readonly material: Material;
  readonly claro: AspectoMovil;
  readonly oscuro: AspectoMovil;
  /** Solo Lluvia lleva la nube de vídeo sobre la boca. */
  readonly nube?: boolean;
}
