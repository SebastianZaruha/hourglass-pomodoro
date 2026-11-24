/**
 * Lluvia. El material es agua: la arena de Clásico y de Arena no entra aquí.
 * Dígitos y pista, tinta del menú, barra de estado y reserva.
 */
import { CONTROLES, temaDeFoto } from './paleta';
import type { EscenaMovil } from './tipos';

const claro = temaDeFoto({
  scheme: 'light',
  digitos: '#5d5d5d',
  tinta: '#141414',
  barra: '#c5d0cb',
  reserva: '#d8d8d6',
  sombra: 'rgba(84, 64, 44, 0.28)',
  controles: CONTROLES.lluvia.light,
});

const oscuro = temaDeFoto({
  scheme: 'dark',
  digitos: '#615958',
  tinta: '#8a8281',
  barra: '#1a2422',
  reserva: '#141414',
  sombra: 'rgba(0, 0, 0, 0.38)',
  controles: CONTROLES.lluvia.dark,
});

export const lluvia: EscenaMovil = {
  id: 'lluvia',
  nombre: { es: 'Lluvia', en: 'Rain' },
  material: 'agua',
  nube: true,
  claro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/lluvia-claro.webp'), anclaY: 1 },
    tema: claro,
  },
  oscuro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/lluvia-oscuro.webp'), anclaY: 1 },
    tema: oscuro,
  },
};
