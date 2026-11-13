import type { Luz, RelojTema, Tema } from './tipos';
import { uiDe } from './vidrio';

function sombra(color: string, opacidad: number, desenfoque: number, inclinacion: number): Luz['sombra'] {
  return { color, opacidad, desenfoque, inclinacion };
}

function luz(parcial: Omit<Luz, 'nube'> & { nube?: Luz['nube'] }): Luz {
  return {
    ...parcial,
    nube: parcial.nube ?? { brillo: 1, saturacion: 1, tinte: '#ffffff' },
  };
}

/** Valores de partida de la sección 3.2. Sebastián los cambia aquí. */
const relojClaro: RelojTema = {
  digitos: '#2E302F',
  pista: '#2E302F',
};

const relojOscuro: RelojTema = {
  digitos: '#8F8B86',
  pista: '#8F8B86',
};

/** Orbes cálidos a la izquierda del césped, donde se apoya el frasco. */
export const lluvia: Tema = {
  id: 'lluvia',
  nombre: 'Lluvia',
  contenido: 'agua',
  nube: true,
  adelantarArena: true,
  adelantarNube: false,
  relojCentrado: false,
  anclaSuelo: { x: 0.28, y: 0.8 },
  claro: {
    fondo: {
      tipo: 'foto',
      src: '/fondos/lluvia-claro.webp',
      avif: '/fondos/lluvia-claro.avif',
      estrecho: { webp: '/fondos/lluvia-claro-estrecho.webp', avif: '/fondos/lluvia-claro-estrecho.avif' },
    },
    reserva: '#c5cdc8',
    reloj: relojClaro,
    ui: uiDe('light', '#161816', '#181C1A'),
    barra: '#c5d0cb',
    granos: 'clara',
    luz: luz({
      direccion: -102,
      tinte: '#ffe0b0',
      fuerzaTinte: 0.72,
      brillo: 1.05,
      reflejos: 0.78,
      brilloBorde: 0.82,
      sombra: sombra('#14241c', 0.42, 18, 32),
      nube: { brillo: 1, saturacion: 0.92, tinte: '#f4f7f6' },
    }),
  },
  oscuro: {
    fondo: {
      tipo: 'video',
      webm: '/fondos/lluvia-oscuro.webm',
      mp4: '/fondos/lluvia-oscuro.mp4',
      poster: '/fondos/lluvia-oscuro.webp',
    },
    reserva: '#2c2824',
    reloj: relojOscuro,
    ui: uiDe('dark', '#F4F6F5', '#D5DBD8'),
    barra: '#1a2422',
    granos: 'oscura',
    luz: luz({
      direccion: -102,
      tinte: '#ff8a2a',
      fuerzaTinte: 0.9,
      brillo: 0.4,
      reflejos: 0.28,
      brilloBorde: 0.96,
      sombra: sombra('#000000', 0.74, 20, 36),
      nube: { brillo: 0.62, saturacion: 0.55, tinte: '#9aa3a6' },
    }),
  },
};
