import type { Aspecto, Escena } from '../../comun/frasco';
import { crearAgua } from './agua';

/**
 * Lluvia. El agua es su masa, sin gotas ni nube todavía.
 * La luz ambiente va a 0: no oscurece ni tiñe el vidrio. El reloj, en ancha, sube al bulbo.
 */
const claro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/lluvia-claro.webp',
    avif: '/fondos/lluvia-claro.avif',
    estrecho: { webp: '/fondos/lluvia-claro-estrecho.webp', avif: '/fondos/lluvia-claro-estrecho.avif' },
  },
  ancla: { x: 0.28, y: 0.8 },
  reserva: '#c5cdc8',
  barra: '#c5d0cb',
  reloj: { digitos: '#2E302F', pista: '#2E302F' },
  tinta: '#161816',
  vidrio: { velo: 'rgba(0, 0, 0, 0.12)', saturacion: 1.4 },
  luz: { direccion: -102, tinte: '#ffe0b0', fuerza: 0 },
  sombra: { color: 'rgba(84, 64, 44, 0.28)', opacidad: 1 },
};

const oscuro: Aspecto = {
  fondo: {
    tipo: 'video',
    webm: '/fondos/lluvia-oscuro.webm',
    mp4: '/fondos/lluvia-oscuro.mp4',
    poster: '/fondos/lluvia-oscuro.webp',
  },
  ancla: { x: 0.28, y: 0.8 },
  reserva: '#2c2824',
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
  crearContenido: (medida, esquema) => crearAgua(medida, esquema),
};
