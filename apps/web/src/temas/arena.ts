import type { Luz, RelojTema, Tema } from './tipos';
import { uiDe } from './vidrio';

const relojClaro: RelojTema = {
  digitos: '#4A4541',
  pista: '#4A4541',
};

const relojOscuro: RelojTema = {
  digitos: '#7E7A75',
  pista: '#7E7A75',
};

function luz(oscuro: boolean): Luz {
  if (oscuro) {
    return {
      direccion: -104,
      tinte: '#ff7a1a',
      fuerzaTinte: 0.92,
      brillo: 0.38,
      reflejos: 0.26,
      brilloBorde: 1,
      sombra: { color: '#000000', opacidad: 0.76, desenfoque: 18, inclinacion: 38 },
      nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
    };
  }
  return {
    direccion: -104,
    tinte: '#ffc98a',
    fuerzaTinte: 0.7,
    brillo: 1.08,
    reflejos: 0.86,
    brilloBorde: 0.8,
    sombra: { color: '#5a3416', opacidad: 0.48, desenfoque: 16, inclinacion: 32 },
    nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
  };
}

export const arena: Tema = {
  id: 'arena',
  nombre: 'Arena',
  contenido: 'arena',
  nube: false,
  adelantarArena: false,
  adelantarNube: true,
  relojCentrado: false,
  anclaSuelo: { x: 0.3, y: 0.84 },
  claro: {
    fondo: {
      tipo: 'foto',
      src: '/fondos/arena-claro.webp',
      avif: '/fondos/arena-claro.avif',
      estrecho: { webp: '/fondos/arena-claro-estrecho.webp', avif: '/fondos/arena-claro-estrecho.avif' },
    },
    reserva: '#e4c7a4',
    reloj: relojClaro,
    ui: uiDe('light', '#2A2623', '#3A342F'),
    barra: '#e6d7c4',
    granos: 'clara',
    luz: luz(false),
  },
  oscuro: {
    fondo: {
      tipo: 'video',
      webm: '/fondos/arena-oscuro.webm',
      mp4: '/fondos/arena-oscuro.mp4',
      poster: '/fondos/arena-oscuro.webp',
    },
    reserva: '#3a2618',
    reloj: relojOscuro,
    ui: uiDe('dark', '#FFFFFF', '#E4DDD4'),
    barra: '#241910',
    granos: 'oscura',
    luz: luz(true),
  },
};
