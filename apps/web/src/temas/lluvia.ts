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
  menu: 'rgba(255, 255, 255, 0.86)',
  menuSolido: '#f4f4f3',
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
  menu: 'rgba(8, 8, 10, 0.84)',
  menuSolido: '#141416',
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
  anclaSuelo: { x: 0.28, y: 0.8 },
  claro: modo(
    { tipo: 'foto', src: '/fondos/lluvia-claro.webp', avif: '/fondos/lluvia-claro.avif' },
    luz({
      direccion: -102,
      tinte: '#ffe0b0',
      fuerzaTinte: 0.72,
      brillo: 1.05,
      reflejos: 0.78,
      brilloBorde: 0.82,
      sombra: sombra('#14241c', 0.42, 18, 32),
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
      direccion: -102,
      tinte: '#ff8a2a',
      fuerzaTinte: 0.9,
      brillo: 0.4,
      reflejos: 0.28,
      brilloBorde: 0.96,
      sombra: sombra('#000000', 0.74, 20, 36),
      nube: { brillo: 0.62, saturacion: 0.55, tinte: '#9aa3a6' },
    }),
    oscuro,
    'oscura',
  ),
};
