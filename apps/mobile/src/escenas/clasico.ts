/**
 * Clásico. El tema es el de siempre; solo el relleno de los controles del
 * menú se ajusta para leerse sobre el vidrio (CONTROLES.clasico).
 */
import type { HourglassTheme } from '../theme/theme';
import { DARK_THEME, LIGHT_THEME } from '../theme/theme';
import { CONTROLES, type ControlesEscena } from './paleta';
import type { EscenaMovil } from './tipos';

function conControles(tema: HourglassTheme, controles: ControlesEscena): HourglassTheme {
  return { ...tema, ui: { ...tema.ui, ...controles } };
}

export const clasico: EscenaMovil = {
  id: 'clasico',
  nombre: { es: 'Clásico', en: 'Classic' },
  material: 'arena',
  claro: { fondo: { tipo: 'procedural' }, tema: conControles(LIGHT_THEME, CONTROLES.clasico.light) },
  oscuro: { fondo: { tipo: 'procedural' }, tema: conControles(DARK_THEME, CONTROLES.clasico.dark) },
};
