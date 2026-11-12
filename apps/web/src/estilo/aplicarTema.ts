import type { ModoTema } from '../temas/tipos';
import {
  CONTROL_ELEGIDO_CLARO,
  CONTROL_ELEGIDO_OSCURO,
  CONTROL_HOVER,
  SCRIM,
  VELO_SIN_FILTRO,
} from './tokens';

/**
 * Escribe en `.app` las variables que salen del modo.
 * El CSS solo lee variables: no hay una copia por tema.
 */
export function aplicarTema(nodo: HTMLElement, modo: ModoTema, scheme: 'light' | 'dark'): void {
  nodo.style.colorScheme = scheme;
  const elegido = scheme === 'dark' ? CONTROL_ELEGIDO_OSCURO : CONTROL_ELEGIDO_CLARO;
  const vars: Record<string, string> = {
    '--hora': modo.reloj.digitos,
    '--pista': modo.reloj.pista,
    '--halo': modo.reloj.halo,
    '--halo-alfa': `${modo.reloj.haloOpacidad * 100}%`,
    '--tinta': modo.ui.tinta,
    '--tinta-suave': modo.ui.tintaSuave,
    '--velo': modo.ui.velo,
    '--velo-brillo': String(modo.ui.veloBrillo),
    '--borde': modo.ui.borde,
    '--reserva': modo.reserva,
    '--control-elegido': elegido,
    '--control-hover': CONTROL_HOVER,
    '--velo-opaco': VELO_SIN_FILTRO,
    '--scrim': SCRIM,
  };
  for (const [nombre, valor] of Object.entries(vars)) nodo.style.setProperty(nombre, valor);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo.barra);
}
