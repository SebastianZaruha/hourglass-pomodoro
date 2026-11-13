import type { UiTema } from './tipos';

/**
 * Vidrio esmerilado, el mismo en Lluvia, Arena y Clásico.
 * Se edita aquí: el CSS solo lee las variables.
 */
export const VIDRIO = {
  blur: 32,
  saturacion: 1.4,
} as const;

/** Casi sin velo, en los dos modos. El texto se sostiene con sombra, no con tinte. */
export const VIDRIO_CLARO = {
  velo: 'rgba(255, 255, 255, 0.04)',
  borde: 'rgba(255, 255, 255, 0.32)',
  brillo: 'inset 0 1px 0 rgba(255, 255, 255, 0.22)',
  sombra: '0 16px 48px rgba(0, 0, 0, 0.16)',
  sombraTexto: '0 1px 1px rgba(255, 255, 255, 0.55), 0 0 10px rgba(255, 255, 255, 0.35)',
} as const;

export const VIDRIO_OSCURO = {
  velo: 'rgba(255, 255, 255, 0.04)',
  borde: 'rgba(255, 255, 255, 0.32)',
  brillo: 'inset 0 1px 0 rgba(255, 255, 255, 0.22)',
  sombra: '0 18px 52px rgba(0, 0, 0, 0.28)',
  sombraTexto: '0 1px 2px rgba(0, 0, 0, 0.55), 0 0 10px rgba(0, 0, 0, 0.35)',
} as const;

/** El vidrio es el mismo en los tres temas. Solo cambia la tinta. */
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
