import type { Luz, ModoTema, Tema, UiTema } from './tipos';

function sombra(color: string, opacidad: number, desenfoque: number, inclinacion: number): Luz['sombra'] {
  return { color, opacidad, desenfoque, inclinacion };
}

function luz(parcial: Omit<Luz, 'nube'> & { nube?: Luz['nube'] }): Luz {
  return {
    ...parcial,
    nube: parcial.nube ?? { brillo: 1, saturacion: 1, tinte: '#ffffff' },
  };
}

const claro: UiTema = {
  tinta: '#1c2a26',
  tintaSuave: '#3d524c',
  hora: '#3e524c',
  pista: '#5d726b',
  pausa: '#1c2a26',
  menu: 'rgba(228, 236, 232, 0.9)',
  menuSolido: '#e4ece8',
  borde: 'rgba(28, 42, 38, 0.14)',
  pastilla: '#f7faf8',
  pastillaTinta: '#1c2a26',
  pie: '#6d8078',
  halo: 'rgba(255, 255, 255, 0.28)',
  barra: '#c5d0cb',
};

const oscuro: UiTema = {
  tinta: '#e7efeb',
  tintaSuave: '#b7c4be',
  hora: '#d5ded9',
  pista: '#9aaba3',
  pausa: '#e7efeb',
  menu: 'rgba(32, 42, 40, 0.9)',
  menuSolido: '#202a28',
  borde: 'rgba(231, 239, 235, 0.14)',
  pastilla: '#d5e0da',
  pastillaTinta: '#1c2a26',
  pie: '#8ea099',
  halo: 'rgba(0, 0, 0, 0.35)',
  barra: '#1a2422',
};

function modo(fondo: ModoTema['fondo'], valores: Luz, ui: UiTema, granos: ModoTema['granos']): ModoTema {
  return { fondo, luz: valores, ui, granos };
}

/** Orbes cálidos a la izquierda del césped, donde se apoya el frasco. */
export const lluvia: Tema = {
  id: 'lluvia',
  nombre: 'Lluvia',
  contenido: 'agua',
  nube: true,
  anclaSuelo: { x: 0.3, y: 0.9 },
  claro: modo(
    { tipo: 'foto', src: '/fondos/lluvia-claro.webp', avif: '/fondos/lluvia-claro.avif' },
    luz({
      direccion: -42,
      tinte: '#e7f0ea',
      fuerzaTinte: 0.1,
      brillo: 1,
      reflejos: 0.72,
      brilloBorde: 0.28,
      sombra: sombra('#1a2420', 0.32, 22, -18),
      nube: { brillo: 1, saturacion: 0.92, tinte: '#f4f7f6' },
    }),
    claro,
    'clara',
  ),
  oscuro: modo(
    {
      tipo: 'video',
      webm: '/fondos/lluvia-oscuro.webm',
      mp4: '/fondos/lluvia-oscuro.mp4',
      poster: '/fondos/lluvia-oscuro.webp',
    },
    luz({
      direccion: -28,
      tinte: '#ffc896',
      fuerzaTinte: 0.16,
      brillo: 0.74,
      reflejos: 0.58,
      brilloBorde: 0.46,
      sombra: sombra('#000000', 0.55, 26, -12),
      nube: { brillo: 0.62, saturacion: 0.55, tinte: '#9aa3a6' },
    }),
    oscuro,
    'oscura',
  ),
};
