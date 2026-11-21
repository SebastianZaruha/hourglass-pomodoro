import type { Aspecto, Escena } from '../../comun/frasco';
import { crearAgua } from './agua';
import { Nube } from './nube';

/**
 * Lluvia. El agua es su masa: se mece, refracta el fondo y suelta gotas.
 * La luz ambiente va a 0: no oscurece ni tiñe el vidrio. El reloj, en ancha, sube al bulbo.
 */
const claro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/lluvia-claro.webp',
    jpg: '/fondos/lluvia-claro.jpg',
  },
  // Césped plano entre la charca y las rocas. El tope impide acercar más de 1,1× cover.
  ancla: { x: 0.46, y: 0.72, tope: 1.1 },
  reserva: '#d8d8d6',
  barra: '#c5d0cb',
  reloj: { digitos: '#2E302F', pista: '#2E302F' },
  tinta: '#161816',
  vidrio: { velo: 'rgba(0, 0, 0, 0.12)', saturacion: 1.4 },
  luz: { direccion: -102, tinte: '#ffe0b0', fuerza: 0 },
  sombra: { color: 'rgba(84, 64, 44, 0.28)', opacidad: 1 },
};

const oscuro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/lluvia-oscuro.webp',
    jpg: '/fondos/lluvia-oscuro.jpg',
  },
  ancla: { x: 0.46, y: 0.72, tope: 1.1 },
  reserva: '#141414',
  barra: '#1a2422',
  reloj: { digitos: '#8F8B86', pista: '#8F8B86' },
  tinta: '#F4F6F5',
  vidrio: { velo: 'rgba(0, 0, 0, 0.12)', saturacion: 1.4 },
  luz: { direccion: -102, tinte: '#ff8a2a', fuerza: 0 },
  sombra: { color: 'rgba(0, 0, 0, 0.38)', opacidad: 1 },
};

export const lluvia: Escena = {
  id: 'lluvia',
  nombre: { es: 'Lluvia', en: 'Rain' },
  relojAlto: true,
  claro,
  oscuro,
  Encima: Nube,
  crearContenido: (medida, esquema) => crearAgua(medida, esquema),
};
