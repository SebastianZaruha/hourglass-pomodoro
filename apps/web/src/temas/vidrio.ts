import type { UiTema } from './tipos';

/**
 * Vidrio esmerilado, el mismo en Lluvia, Arena y Clásico.
 * Se edita aquí: el CSS solo lee las variables.
 * El desenfoque no sube. El velo es oscuro y bajo, en los dos modos.
 */
export const VIDRIO = {
  blur: 32,
  saturacion: 1.4,
} as const;

/** Texto e iconos blancos. La sombra es oscura para que se lean sobre el fondo. */
export const VIDRIO_TEXTO = {
  tinta: '#ffffff',
  tintaSuave: 'rgba(255, 255, 255, 0.78)',
  sombra: '0 1px 2px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 0, 0, 0.28)',
  icono: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))',
  foco: 'rgba(255, 255, 255, 0.9)',
  linea: 'rgba(255, 255, 255, 0.22)',
} as const;

/**
 * Botones del vidrio. Reposo casi transparente, elegido un velo mayor.
 * Nunca un bloque blanco.
 */
export const CONTROLES = {
  reposo: 'rgba(255, 255, 255, 0.07)',
  hover: 'rgba(255, 255, 255, 0.12)',
  elegido: 'rgba(255, 255, 255, 0.18)',
} as const;

/** Sin backdrop-filter el velo se vuelve opaco y oscuro, para que el texto blanco siga leyéndose. */
export const VELO_SIN_FILTRO = 'rgba(0, 0, 0, 0.72)';

/** Velo negro suave. Nada de tinte blanco. */
export const VIDRIO_CLARO = {
  velo: 'rgba(0, 0, 0, 0.12)',
  borde: 'rgba(255, 255, 255, 0.32)',
  brillo: 'inset 0 1px 0 rgba(255, 255, 255, 0.22)',
  sombra: '0 16px 48px rgba(0, 0, 0, 0.16)',
  sombraTexto: VIDRIO_TEXTO.sombra,
} as const;

export const VIDRIO_OSCURO = {
  velo: 'rgba(0, 0, 0, 0.12)',
  borde: 'rgba(255, 255, 255, 0.32)',
  brillo: 'inset 0 1px 0 rgba(255, 255, 255, 0.22)',
  sombra: '0 18px 52px rgba(0, 0, 0, 0.28)',
  sombraTexto: VIDRIO_TEXTO.sombra,
} as const;

/** El vidrio es el mismo en los tres temas. La tinta de fuera (pie, botón) sí cambia. */
export function uiDe(scheme: 'light' | 'dark', tinta: string, tintaSuave: string): UiTema {
  const vidrio = scheme === 'dark' ? VIDRIO_OSCURO : VIDRIO_CLARO;
  return {
    tinta,
    tintaSuave,
    velo: vidrio.velo,
    borde: vidrio.borde,
    brillo: vidrio.brillo,
    sombra: vidrio.sombra,
    sombraTexto: vidrio.sombraTexto,
  };
}
