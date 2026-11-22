/**
 * Lluvia. En F1 el material sigue siendo arena; el agua llega en F3.
 * Dígitos y pista, tinta del menú, barra de estado y reserva.
 */
import { temaDeFoto } from './paleta';
import type { EscenaMovil } from './tipos';

const claro = temaDeFoto({
  scheme: 'light',
  digitos: '#5d5d5d',
  tinta: '#5d5d5d',
  barra: '#c5d0cb',
  reserva: '#d8d8d6',
  sombra: 'rgba(84, 64, 44, 0.28)',
});

const oscuro = temaDeFoto({
  scheme: 'dark',
  digitos: '#615958',
  tinta: '#615958',
  barra: '#1a2422',
  reserva: '#141414',
  sombra: 'rgba(0, 0, 0, 0.38)',
});

export const lluvia: EscenaMovil = {
  id: 'lluvia',
  nombre: { es: 'Lluvia', en: 'Rain' },
  material: 'arena',
  claro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/lluvia-claro.webp'), anclaY: 1 },
    tema: claro,
  },
  oscuro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/lluvia-oscuro.webp'), anclaY: 1 },
    tema: oscuro,
  },
};
