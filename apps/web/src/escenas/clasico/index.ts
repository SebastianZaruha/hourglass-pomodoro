import type { Aspecto, Escena } from '../../comun/frasco';
import { crearArena } from '../arena-modelo';

/** Degradado ancho publicado (`styles.css`). El estrecho sigue en el CSS. */
const DEGRADADO =
  'radial-gradient(46% 42% at 28% 42%, var(--glow), transparent 70%), linear-gradient(180deg, var(--bg-top), var(--bg-bottom))';

/**
 * Colores de la web publicada. En esta vuelta los pinta el CSS;
 * la luz va a 0 para que no se dibuje nada encima del vidrio.
 */
const claro: Aspecto = {
  fondo: { tipo: 'degradado', css: DEGRADADO },
  ancla: { x: 0.32, y: 0.8 },
  reserva: '#e3d9cc',
  barra: '#EBE5DD',
  reloj: { digitos: '#b3a698', pista: '#c4b8ab' },
  tinta: '#b3a698',
  vidrio: { velo: 'rgba(255, 255, 255, 0.22)', saturacion: 1 },
  luz: { direccion: -42, tinte: '#f3e4d0', fuerza: 0 },
  sombra: { color: 'rgba(84, 64, 44, 0.28)', opacidad: 1 },
};

const oscuro: Aspecto = {
  fondo: { tipo: 'degradado', css: DEGRADADO },
  ancla: { x: 0.32, y: 0.8 },
  reserva: '#16130f',
  barra: '#241C18',
  reloj: { digitos: '#9c9086', pista: '#7d7268' },
  tinta: '#8a7d72',
  vidrio: { velo: 'rgba(255, 236, 214, 0.07)', saturacion: 1 },
  luz: { direccion: -48, tinte: '#e8a86a', fuerza: 0 },
  sombra: { color: 'rgba(0, 0, 0, 0.38)', opacidad: 1 },
};

export const clasicoPublicado: Escena = {
  id: 'clasico',
  nombre: { es: 'Clásico', en: 'Classic' },
  relojAlto: false,
  claro,
  oscuro,
  crearContenido: (medida, esquema) => crearArena(medida, esquema),
};

const BARRA = { light: claro.barra, dark: oscuro.barra } as const;

/** `<meta name="theme-color">` de la web publicada. */
export function barraPublicada(scheme: 'light' | 'dark'): string {
  return BARRA[scheme];
}
