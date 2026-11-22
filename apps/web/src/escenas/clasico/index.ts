import type { Aspecto, Escena } from '../../comun/frasco';
import { crearArena } from '../arena-modelo';

/**
 * Clásico. Estudio de crema en claro y carbón con un foco cálido en oscuro.
 * La arena es la de Arena, sin tocar el modelo. El reloj queda al centro.
 * La luz ambiente va a 0 para no teñir el vidrio.
 */
const claro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/clasico-claro.webp',
    avif: '/fondos/clasico-claro.avif',
  },
  ancla: { x: 0.5, y: 0.5, cover: true },
  reserva: '#e8dfd4',
  barra: '#ebe5dd',
  reloj: { digitos: '#aea499', pista: '#aea499' },
  tinta: '#928e89',
  vidrio: { velo: 'rgba(0, 0, 0, 0.12)', saturacion: 1 },
  luz: { direccion: -42, tinte: '#f3e4d0', fuerza: 0 },
  sombra: { color: 'rgba(84, 64, 44, 0.28)', opacidad: 1 },
  frasco3d: { estudio: true, tinte: '#f3e4d0' },
};

const oscuro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/clasico-oscuro.webp',
    avif: '/fondos/clasico-oscuro.avif',
  },
  ancla: { x: 0.5, y: 0.5, cover: true },
  reserva: '#2a2422',
  barra: '#241c18',
  reloj: { digitos: '#635044', pista: '#635044' },
  tinta: '#86817B',
  vidrio: { velo: 'rgba(0, 0, 0, 0.12)', saturacion: 1 },
  luz: { direccion: -48, tinte: '#e8a86a', fuerza: 0 },
  sombra: { color: 'rgba(0, 0, 0, 0.38)', opacidad: 1 },
  frasco3d: { estudio: true, tinte: '#e8a86a' },
};

export const clasico: Escena = {
  id: 'clasico',
  nombre: { es: 'Clásico', en: 'Classic' },
  relojAlto: false,
  claro,
  oscuro,
  crearContenido: (medida, esquema) => crearArena(medida, esquema),
};

const BARRA = { light: claro.barra, dark: oscuro.barra } as const;

/** `<meta name="theme-color">` de la barra del Clásico. */
export function barraPublicada(scheme: 'light' | 'dark'): string {
  return BARRA[scheme];
}
