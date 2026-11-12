import type { FondoTema, Luz, RelojTema, Tema } from './tipos';
import { uiDe } from './vidrio';

const relojClaro: RelojTema = {
  digitos: '#5A5550',
  pista: '#5A5550',
};

const relojOscuro: RelojTema = {
  digitos: '#86817B',
  pista: '#86817B',
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

export const clasico: Tema = {
  id: 'clasico',
  nombre: 'Clásico',
  contenido: 'arena',
  nube: false,
  adelantarArena: false,
  adelantarNube: true,
  anclaSuelo: { x: 0.32, y: 0.8 },
  claro: {
    fondo: foto('clasico-claro'),
    reserva: '#e8dfd4',
    reloj: relojClaro,
    ui: uiDe('light', '#36322F', '#4A453F'),
    barra: '#ebe5dd',
    granos: 'clara',
    luz: luzClara,
  },
  oscuro: {
    fondo: foto('clasico-oscuro'),
    reserva: '#2a2422',
    reloj: relojOscuro,
    ui: uiDe('dark', '#F2EFEA', '#DDD6CC'),
    barra: '#241c18',
    granos: 'oscura',
    luz: luzOscura,
  },
};
