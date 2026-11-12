import type { ModoTema, Tema, UiTema } from './tipos';

const claro: UiTema = {
  tinta: '#3c3228',
  tintaSuave: '#6a5848',
  hora: '#5c4632',
  pista: '#8a7360',
  pausa: '#3c3228',
  menu: 'rgba(244, 236, 224, 0.9)',
  menuSolido: '#f4ece0',
  borde: 'rgba(60, 50, 40, 0.14)',
  pastilla: '#fffaf3',
  pastillaTinta: '#3c3228',
  pie: '#a08b74',
  halo: 'rgba(255, 248, 236, 0.32)',
  barra: '#e6d7c4',
};

const oscuro: UiTema = {
  tinta: '#f6eee4',
  tintaSuave: '#d4c2ae',
  hora: '#f0d7b8',
  pista: '#c4ae96',
  pausa: '#f6eee4',
  menu: 'rgba(58, 44, 34, 0.9)',
  menuSolido: '#3a2c22',
  borde: 'rgba(246, 238, 228, 0.14)',
  pastilla: '#e6d2bc',
  pastillaTinta: '#3a2c22',
  pie: '#b79a80',
  halo: 'rgba(0, 0, 0, 0.4)',
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
          direccion: 25,
          tinte: '#ffb46a',
          fuerzaTinte: 0.18,
          brillo: 0.7,
          reflejos: 0.6,
          brilloBorde: 0.5,
          sombra: { color: '#000000', opacidad: 0.55, desenfoque: 26, inclinacion: 16 },
          nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
        }
      : {
          direccion: -35,
          tinte: '#e9d6b8',
          fuerzaTinte: 0.12,
          brillo: 1,
          reflejos: 0.8,
          brilloBorde: 0.22,
          sombra: { color: '#4a3826', opacidad: 0.35, desenfoque: 22, inclinacion: -20 },
          nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
        },
  };
}

export const arena: Tema = {
  id: 'arena',
  nombre: 'Arena',
  contenido: 'arena',
  nube: false,
  anclaSuelo: { x: 0.33, y: 0.92 },
  claro: modo(
    { tipo: 'foto', src: '/fondos/arena-claro.webp', avif: '/fondos/arena-claro.avif' },
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
