import { VIDRIO_CLARO, VIDRIO_OSCURO } from '../estilo/tokens';
import type { UiTema } from './tipos';

/** El vidrio es el mismo en los tres temas. Solo cambia la tinta. */
export function uiDe(scheme: 'light' | 'dark', tinta: string, tintaSuave: string): UiTema {
  const vidrio = scheme === 'dark' ? VIDRIO_OSCURO : VIDRIO_CLARO;
  return {
    tinta,
    tintaSuave,
    velo: vidrio.velo,
    veloBrillo: vidrio.veloBrillo,
    borde: vidrio.borde,
  };
}
