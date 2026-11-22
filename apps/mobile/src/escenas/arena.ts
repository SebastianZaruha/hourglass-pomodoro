/**
 * Arena. La misma simulación que Clásico, sobre la foto.
 * En oscuro los granos se iluminan desde la esfera cálida de la izquierda.
 */
import type { HourglassTheme } from '../theme/theme';
import { temaDeFoto } from './paleta';
import type { EscenaMovil } from './tipos';

const claroBase = temaDeFoto({
  scheme: 'light',
  digitos: '#e9ceae',
  tinta: '#71350d',
  barra: '#e6d7c4',
  reserva: '#e4c7a4',
  sombra: 'rgba(84, 64, 44, 0.28)',
});

const oscuroBase = temaDeFoto({
  scheme: 'dark',
  digitos: '#754e30',
  tinta: '#754e30',
  barra: '#241910',
  reserva: '#3a2618',
  sombra: 'rgba(0, 0, 0, 0.38)',
});

/**
 * La duna clara es brillante: 0,94 deja el grano más claro (230) por debajo
 * del blanco. El oscuro, con la luz de lado, a 1 no se apaga sobre la foto.
 */
function exposicion(tema: HourglassTheme, exposure: number): HourglassTheme {
  return { ...tema, sand: { exposure, stream: tema.sand.stream } };
}

/** 0° es la derecha y 90° es abajo. 176°: casi horizontal, desde la izquierda. */
const LUZ_GRANO_OSCURO = 176;

export const arena: EscenaMovil = {
  id: 'arena',
  nombre: { es: 'Arena', en: 'Sand' },
  material: 'arena',
  claro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/arena-claro.webp'), anclaY: 1 },
    tema: exposicion(claroBase, 0.94),
  },
  oscuro: {
    fondo: { tipo: 'foto', fuente: require('../../assets/fondos/arena-oscuro.webp'), anclaY: 1 },
    tema: exposicion(oscuroBase, 1),
    luzGrano: LUZ_GRANO_OSCURO,
  },
};
