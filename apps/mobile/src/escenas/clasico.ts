/**
 * Clásico. Los mismos objetos de tema que la app de hoy: no hay copia.
 */
import { DARK_THEME, LIGHT_THEME } from '../theme/theme';
import type { EscenaMovil } from './tipos';

export const clasico: EscenaMovil = {
  id: 'clasico',
  nombre: { es: 'Clásico', en: 'Classic' },
  material: 'arena',
  claro: { fondo: { tipo: 'procedural' }, tema: LIGHT_THEME },
  oscuro: { fondo: { tipo: 'procedural' }, tema: DARK_THEME },
};
