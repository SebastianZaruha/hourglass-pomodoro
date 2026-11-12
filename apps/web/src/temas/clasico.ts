import type { FondoTema, Luz, ModoTema, Tema, UiTema } from './tipos';

/** Los colores de «Claro» publicado: beige, hora suave, panel casi opaco. */
const claro: UiTema = {
  tinta: '#4f443b',
  tintaSuave: '#6b5e53',
  hora: '#4a4038',
  pista: '#241f1b',
  pausa: '#7d6e60',
  menu: 'rgba(255, 255, 255, 0.86)',
  menuSolido: '#f4f4f3',
  borde: 'rgba(92, 78, 64, 0.12)',
  pastilla: '#fffcf8',
  pastillaTinta: '#3e342c',
  pie: '#b3a698',
  halo: 'rgba(255, 252, 246, 0.7)',
  barra: '#ebe5dd',
};

/** Copia del oscuro publicado: hora y panel. El fondo es el estudio. */
const oscuro: UiTema = {
  tinta: '#f3ece3',
  tintaSuave: '#cbbba8',
  hora: '#f3ece4',
  pista: '#fffaf4',
  pausa: '#d9cbbc',
  menu: 'rgba(8, 8, 10, 0.84)',
  menuSolido: '#141416',
  borde: 'rgba(255, 236, 214, 0.08)',
  pastilla: '#d8c3a6',
  pastillaTinta: '#3a312a',
  pie: '#8a7d72',
  halo: 'rgba(12, 10, 8, 0.7)',
  barra: '#241c18',
};

function foto(nombre: string): FondoTema {
  return {
    tipo: 'foto',
    src: `/fondos/${nombre}.webp`,
    avif: `/fondos/${nombre}.avif`,
    jpg: `/fondos/${nombre}.jpg`,
    ancho: 1280,
    alto: 720,
  };
}

/** Ventana arriba a la izquierda: el brillo cae a la derecha del pie. */
const luzClara: Luz = {
  direccion: -42,
  tinte: '#f3e4d0',
  fuerzaTinte: 0.5,
  brillo: 1.04,
  reflejos: 0.7,
  brilloBorde: 0.46,
  sombra: { color: '#8a7058', opacidad: 0.58, desenfoque: 12, inclinacion: 26 },
  nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
};

/** Un foco cálido arriba a la izquierda y el resto del estudio a oscuras. */
const luzOscura: Luz = {
  direccion: -48,
  tinte: '#e8a86a',
  fuerzaTinte: 0.82,
  brillo: 0.34,
  reflejos: 0.22,
  brilloBorde: 0.74,
  sombra: { color: '#000000', opacidad: 0.8, desenfoque: 16, inclinacion: 30 },
  nube: { brillo: 1, saturacion: 1, tinte: '#ffffff' },
};

function modo(fondo: FondoTema, ui: UiTema, granos: ModoTema['granos'], luz: Luz): ModoTema {
  return { fondo, ui, granos, luz };
}

export const clasico: Tema = {
  id: 'clasico',
  nombre: 'Clásico',
  contenido: 'arena',
  nube: false,
  anclaSuelo: { x: 0.32, y: 0.8 },
  claro: modo(foto('clasico-claro'), claro, 'clara', luzClara),
  oscuro: modo(foto('clasico-oscuro'), oscuro, 'oscura', luzOscura),
};
