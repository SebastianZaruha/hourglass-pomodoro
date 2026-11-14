import type { Aspecto, Escena } from '../../comun/frasco';
import { crearArena } from '../arena-modelo';

/**
 * Arena. La arena es la de arena-modelo, sin cambios.
 * La luz viene de la lámpara de la foto. El reloj, en ancha, sube al bulbo.
 */
const claro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/arena-claro.webp',
    avif: '/fondos/arena-claro.avif',
    estrecho: { webp: '/fondos/arena-claro-estrecho.webp', avif: '/fondos/arena-claro-estrecho.avif' },
  },
  ancla: { x: 0.3, y: 0.84 },
  reserva: '#e4c7a4',
  barra: '#e6d7c4',
  reloj: { digitos: '#4A4541', pista: '#4A4541' },
  tinta: '#2A2623',
  vidrio: { velo: 'rgba(0, 0, 0, 0.08)', saturacion: 1.05 },
  luz: { direccion: -104, tinte: '#ffc98a', fuerza: 0.7 },
  sombra: { color: 'rgba(84, 64, 44, 0.28)', opacidad: 1 },
};

const oscuro: Aspecto = {
  fondo: {
    tipo: 'video',
    webm: '/fondos/arena-oscuro.webm',
    mp4: '/fondos/arena-oscuro.mp4',
    poster: '/fondos/arena-oscuro.webp',
  },
  ancla: { x: 0.3, y: 0.84 },
  reserva: '#3a2618',
  barra: '#241910',
  reloj: { digitos: '#B7B1AA', pista: '#B7B1AA' },
  tinta: '#FFFFFF',
  vidrio: { velo: 'rgba(0, 0, 0, 0.08)', saturacion: 1.05 },
  luz: { direccion: -104, tinte: '#ff7a1a', fuerza: 0.92 },
  sombra: { color: 'rgba(0, 0, 0, 0.38)', opacidad: 1 },
};

export const arena: Escena = {
  id: 'arena',
  nombre: { es: 'Arena', en: 'Sand' },
  relojAlto: true,
  claro,
  oscuro,
  crearContenido: (medida, esquema) => crearArena(medida, esquema),
};
