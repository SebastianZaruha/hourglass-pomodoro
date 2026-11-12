import type { ModoTema, Tema, UiTema } from './tipos';

const claro: UiTema = {
  tinta: '#3c3228',
  tintaSuave: '#6a5848',
  hora: '#4a4038',
  pista: '#241f1b',
  pausa: '#3c3228',
  menu: 'rgba(255, 255, 255, 0.86)',
  menuSolido: '#f4f4f3',
  borde: 'rgba(60, 50, 40, 0.14)',
  pastilla: '#fffaf3',
  pastillaTinta: '#3c3228',
  pie: '#a08b74',
  halo: 'rgba(255, 252, 246, 0.7)',
  barra: '#e6d7c4',
};

const oscuro: UiTema = {
  tinta: '#f6eee4',
  tintaSuave: '#d4c2ae',
  hora: '#f3ece4',
  pista: '#fffaf4',
  pausa: '#f6eee4',
  menu: 'rgba(8, 8, 10, 0.84)',
  menuSolido: '#141416',
  borde: 'rgba(246, 238, 228, 0.14)',
  pastilla: '#e6d2bc',
  pastillaTinta: '#3a2c22',
  pie: '#b79a80',
  halo: 'rgba(12, 10, 8, 0.7)',
  barra: '#241910',
};

function modo(
  fondo: ModoTema['fondo'],
  ui: UiTema,
  granos: ModoTema['granos'],
  oscuroModo: boolean,
): ModoTema {
  return {
    fondo,
    ui,
    granos,
    luz: oscuroModo
      ? {
          direccion: -104,
          tinte: '#ff7a1a',
          fuerzaTinte: 0.92,
          brillo: 0.38,
          reflejos: 0.26,
          brilloBorde: 1,
          sombra: { color: '#000000', opacidad: 0.76, desenfoque: 18, inclinacion: 38 },
          nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
        }
      : {
          direccion: -104,
          tinte: '#ffc98a',
          fuerzaTinte: 0.7,
          brillo: 1.08,
          reflejos: 0.86,
          brilloBorde: 0.8,
          sombra: { color: '#5a3416', opacidad: 0.48, desenfoque: 16, inclinacion: 32 },
          nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
        },
  };
}

export const arena: Tema = {
  id: 'arena',
  nombre: 'Arena',
  contenido: 'arena',
  nube: false,
  anclaSuelo: { x: 0.3, y: 0.84 },
  claro: modo(
    {
      tipo: 'foto',
      src: '/fondos/arena-claro.webp',
      avif: '/fondos/arena-claro.avif',
      estrecho: { webp: '/fondos/arena-claro-estrecho.webp', avif: '/fondos/arena-claro-estrecho.avif' },
    },
    claro,
    'clara',
    false,
  ),
  oscuro: modo(
    {
      tipo: 'video',
      webm: '/fondos/arena-oscuro.webm',
      mp4: '/fondos/arena-oscuro.mp4',
      poster: '/fondos/arena-oscuro.webp',
    },
    oscuro,
    'oscura',
    true,
  ),
};
