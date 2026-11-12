/**
 * Lo que no cambia entre temas. Los colores de aquí son neutros:
 * el vidrio no lleva el color de la escena.
 * `tokens.css` repite los números sin color; un test comprueba que coinciden.
 */

export const ESPACIOS = [4, 8, 12, 16, 24, 32, 48] as const;
export const RADIO_PANEL = 28;
export const RADIO_CONTROL = 999;
export const TEXTOS = [13, 15, 17, 22] as const;
export const DURACION_RAPIDA = 160;
export const DURACION_NORMAL = 360;
export const DURACION_LENTA = 620;
export const CURVA = 'cubic-bezier(0.33, 0, 0.2, 1)';
export const VIDRIO_BLUR = 36;
export const VIDRIO_SATURACION = 1.1;
export const HALO_BLUR = 14;

/** Velo blanco, sin matiz. Claro 30 %, oscuro 7 %. */
export const VIDRIO_CLARO = {
  velo: 'rgba(255, 255, 255, 0.30)',
  veloBrillo: 1.04,
  borde: 'rgba(255, 255, 255, 0.45)',
} as const;

export const VIDRIO_OSCURO = {
  velo: 'rgba(255, 255, 255, 0.07)',
  veloBrillo: 0.78,
  borde: 'rgba(255, 255, 255, 0.14)',
} as const;

/** Elegido: blanco al 72 % en claro y al 18 % en oscuro. Hover: blanco al 10 %. */
export const CONTROL_ELEGIDO_CLARO = 'rgba(255, 255, 255, 0.72)';
export const CONTROL_ELEGIDO_OSCURO = 'rgba(255, 255, 255, 0.18)';
export const CONTROL_HOVER = 'rgba(255, 255, 255, 0.10)';

/** Sin backdrop-filter el velo sube al 85 % para que el texto no quede al aire. */
export const VELO_SIN_FILTRO = 'rgba(255, 255, 255, 0.85)';

/** Cortina detrás del panel legal. Negra, sin el marrón de antes. */
export const SCRIM = 'rgba(0, 0, 0, 0.28)';

/**
 * Colores del lienzo que hoy están fijos (el agua y la luz no cambian en esta fase).
 * Viven aquí para que no haya literales en el dibujo. Los números son los de 25fca17.
 */
export const PINTURA = {
  agua: ['rgba(214, 232, 238, 0.28)', 'rgba(168, 198, 210, 0.34)', 'rgba(92, 132, 148, 0.46)'] as const,
  menisco: 'rgba(255,255,255,0.28)',
  lluvia: 'rgba(255,255,255,0.28)',
  luzMedia: 'rgba(255,255,255,0.12)',
  focoMedio: 'rgba(255,255,255,0.7)',
  focoFin: 'rgba(255,255,255,0)',
  mascara0: '#fff',
  mascaraMedia: 'rgba(255,255,255,0.22)',
  mascaraFin: 'rgba(255,255,255,0)',
} as const;
