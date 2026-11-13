import type { UiTema } from './tipos';

/**
 * Vidrio esmerilado, el mismo en Lluvia, Arena y Clásico.
 * Se edita aquí: el CSS solo lee las variables.
 */
export const VIDRIO = {
  blur: 36,
  saturacion: 1.5,
} as const;

/** Velo blanco, sin gris. Claro dentro de 0,18–0,25; oscuro dentro de 0,06–0,10. */
export const VIDRIO_CLARO = {
  velo: 'rgba(255, 255, 255, 0.22)',
  borde: 'rgba(255, 255, 255, 0.32)',
  brillo: 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
  sombra: '0 16px 48px rgba(0, 0, 0, 0.16)',
} as const;

export const VIDRIO_OSCURO = {
  velo: 'rgba(255, 255, 255, 0.08)',
  borde: 'rgba(255, 255, 255, 0.30)',
  brillo: 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
  sombra: '0 18px 52px rgba(0, 0, 0, 0.28)',
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
  };
}
