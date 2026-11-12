import type { ModoTema, Tema, UiTema } from './tipos';

/** Los colores de «Claro» publicado: beige, hora suave, panel casi opaco. */
const claro: UiTema = {
  tinta: '#4f443b',
  tintaSuave: '#6b5e53',
  hora: '#b3a698',
  pista: '#c4b8ab',
  pausa: '#7d6e60',
  menu: 'rgba(247, 242, 235, 0.96)',
  menuSolido: '#f7f2eb',
  borde: 'rgba(92, 78, 64, 0.12)',
  pastilla: '#fffcf8',
  pastillaTinta: '#3e342c',
  pie: '#b3a698',
  halo: 'rgba(255, 252, 246, 0.45)',
  barra: '#ebe5dd',
};

/** Copia del oscuro publicado: degradado, hora y panel. */
const oscuro: UiTema = {
  tinta: '#f3ece3',
  tintaSuave: '#cbbba8',
  hora: '#9c9086',
  pista: '#7d7268',
  pausa: '#d9cbbc',
  menu: 'rgba(58, 49, 42, 0.97)',
  menuSolido: '#3a312a',
  borde: 'rgba(255, 236, 214, 0.08)',
  pastilla: '#d8c3a6',
  pastillaTinta: '#3a312a',
  pie: '#8a7d72',
  halo: 'rgba(0, 0, 0, 0.28)',
  barra: '#241c18',
};

function modo(ui: UiTema, granos: ModoTema['granos'], noche: boolean): ModoTema {
  return {
    fondo: { tipo: 'degradado' },
    ui,
    granos,
    luz: noche
      ? {
          direccion: -18,
          tinte: '#d8c3a6',
          fuerzaTinte: 0.08,
          brillo: 0.78,
          reflejos: 0.42,
          brilloBorde: 0.18,
          sombra: { color: '#000000', opacidad: 0.5, desenfoque: 22, inclinacion: -14 },
          nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
        }
      : {
          direccion: -24,
          tinte: '#fff6ea',
          fuerzaTinte: 0.06,
          brillo: 1.02,
          reflejos: 0.7,
          brilloBorde: 0.16,
          sombra: { color: '#54402c', opacidad: 0.28, desenfoque: 20, inclinacion: -16 },
          nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
        },
  };
}

export const clasico: Tema = {
  id: 'clasico',
  nombre: 'Clásico',
  contenido: 'arena',
  nube: false,
  anclaSuelo: { x: 0.5, y: 0.8 },
  claro: modo(claro, 'clara', false),
  oscuro: modo(oscuro, 'oscura', true),
};
