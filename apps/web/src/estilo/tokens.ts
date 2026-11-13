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

/** Velo muy suave mientras no llegan las fotos del frasco. El contorno es el borde. */
export const VIDRIO_NEUTRO = 'rgba(236, 234, 230, 0.12)';
export const VIDRIO_CONTORNO = 'rgba(236, 234, 230, 0.62)';

/** Cortina detrás del panel legal. Negra, sin el marrón de antes. */
export const SCRIM = 'rgba(0, 0, 0, 0.28)';

/**
 * Colores del lienzo que hoy están fijos (el agua y la luz no cambian en esta fase).
 * Viven aquí para que no haya literales en el dibujo. Los números son los de 25fca17.
 */
export const PINTURA = {
  /** Velo frío. El segundo color es el mismo, un 6 % más oscuro hacia abajo. */
  agua: ['rgba(214, 228, 234, 0.26)', 'rgba(201, 214, 220, 0.26)'] as const,
  aguaOscura: ['rgba(160, 178, 188, 0.20)', 'rgba(150, 167, 177, 0.20)'] as const,
  /** Menisco de 2 px, apenas más claro. No es una línea blanca. */
  menisco: 'rgba(196, 222, 238, 0.72)',
  meniscoOscuro: 'rgba(176, 200, 214, 0.58)',
  /** Reflejo leve justo bajo la superficie, del mismo matiz. */
  reflejo: 'rgba(214, 228, 234, 0.2)',
  reflejoOscuro: 'rgba(176, 192, 200, 0.16)',
  reflejoFin: 'rgba(214, 228, 234, 0)',
  /** Gotas, un poco más claras que el velo. La opacidad va aparte. */
  gota: 'rgb(232, 240, 244)',
  gotaOscura: 'rgb(214, 226, 232)',
  lluvia: 'rgba(214, 228, 234, 0.55)',
  luzMedia: 'rgba(255,255,255,0.12)',
  lavadoFin: 'rgba(0,0,0,0.08)',
  focoMedio: 'rgba(255,255,255,0.7)',
  focoFin: 'rgba(255,255,255,0)',
  mascara0: '#fff',
  mascaraMedia: 'rgba(255,255,255,0.22)',
  mascaraFin: 'rgba(255,255,255,0)',
} as const;
