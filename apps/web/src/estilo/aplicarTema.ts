import type { ModoTema } from '../temas/tipos';
import { CONTROLES, VELO_SIN_FILTRO, VIDRIO, VIDRIO_TEXTO } from '../temas/vidrio';
import { SCRIM } from './tokens';

/**
 * Escribe en `.app` las variables que salen del modo.
 * El CSS solo lee variables: no hay una copia por tema.
 */
export function aplicarTema(nodo: HTMLElement, modo: ModoTema, scheme: 'light' | 'dark'): void {
  nodo.style.colorScheme = scheme;
  const vars: Record<string, string> = {
    '--hora': modo.reloj.digitos,
    '--pista': modo.reloj.pista,
    '--tinta': modo.ui.tinta,
    '--tinta-suave': modo.ui.tintaSuave,
    '--velo': modo.ui.velo,
    '--borde': modo.ui.borde,
    '--vidrio-blur': `${VIDRIO.blur}px`,
    '--vidrio-saturacion': String(VIDRIO.saturacion),
    '--vidrio-brillo': modo.ui.brillo,
    '--vidrio-sombra': modo.ui.sombra,
    '--vidrio-texto': modo.ui.sombraTexto,
    '--vidrio-tinta': VIDRIO_TEXTO.tinta,
    '--vidrio-tinta-suave': VIDRIO_TEXTO.tintaSuave,
    '--vidrio-icono': VIDRIO_TEXTO.icono,
    '--vidrio-foco': VIDRIO_TEXTO.foco,
    '--vidrio-linea': VIDRIO_TEXTO.linea,
    '--reserva': modo.reserva,
    '--control-reposo': CONTROLES.reposo,
    '--control-hover': CONTROLES.hover,
    '--control-elegido': CONTROLES.elegido,
    '--velo-opaco': VELO_SIN_FILTRO,
    '--scrim': SCRIM,
  };
  for (const [nombre, valor] of Object.entries(vars)) nodo.style.setProperty(nombre, valor);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo.barra);
}
