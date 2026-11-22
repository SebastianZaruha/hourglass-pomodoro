/**
 * Arena. En F1 el material es arena, la misma simulación que Clásico.
 * Dígitos y pista, tinta del menú, barra de estado y reserva.
 */
import { temaDeFoto } from './paleta';
import type { EscenaMovil } from './tipos';

const claro = temaDeFoto({
  scheme: 'light',
  digitos: '#e9ceae',
  tinta: '#71350d',
  barra: '#e6d7c4',
  reserva: '#e4c7a4',
  sombra: 'rgba(84, 64, 44, 0.28)',
});

const oscuro = temaDeFoto({
  scheme: 'dark',
  digitos: '#754e30',
  tinta: '#754e30',
  barra: '#241910',
  reserva: '#3a2618',
  sombra: 'rgba(0, 0, 0, 0.38)',
});

export const arena: EscenaMovil = {
  id: 'arena',
  nombre: { es: 'Arena', en: 'Sand' },
  material: 'arena',
  claro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/arena-claro.webp'), anclaY: 1 },
    tema: claro,
  },
  oscuro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/arena-oscuro.webp'), anclaY: 1 },
    tema: oscuro,
  },
};
