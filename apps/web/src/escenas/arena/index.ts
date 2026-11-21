import type { Aspecto, Escena } from '../../comun/frasco';
import { crearArena, fijarLuzGrano } from '../arena-modelo';

/**
 * Arena. El movimiento de la arena es el de arena-modelo, sin cambios.
 * En oscuro, el pintado sombrea los granos con la luz de la escena.
 * La luz ambiente del vidrio va a 0. El reloj, en ancha, sube al bulbo.
 *
 * Cresta de la duna, fracción de cada foto. La x del ancla es la de la punta
 * del frasco. Claro y estrecha miden las dos 0,75 y por eso comparten ancla;
 * el vídeo oscuro usa la cresta del póster, 0,757.
 */
const CRESTA = { claro: 0.75, oscuro: 0.757 } as const;

const claro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/arena-claro.webp',
    avif: '/fondos/arena-claro.avif',
    estrecho: { webp: '/fondos/arena-claro-estrecho.webp', avif: '/fondos/arena-claro-estrecho.avif' },
  },
  ancla: { x: 0.3, y: CRESTA.claro },
  reserva: '#e4c7a4',
  barra: '#e6d7c4',
  reloj: { digitos: '#4A4541', pista: '#4A4541' },
  tinta: '#2A2623',
  vidrio: { velo: 'rgba(0, 0, 0, 0.08)', saturacion: 1.05 },
  luz: { direccion: -104, tinte: '#ffc98a', fuerza: 0 },
  sombra: { color: 'rgba(84, 64, 44, 0.28)', opacidad: 1 },
  frasco3d: { pie: 'bulbo' },
};

const oscuro: Aspecto = {
  fondo: {
    tipo: 'video',
    webm: '/fondos/arena-oscuro.webm',
    mp4: '/fondos/arena-oscuro.mp4',
    poster: '/fondos/arena-oscuro.webp',
  },
  ancla: { x: 0.3, y: CRESTA.oscuro },
  reserva: '#3a2618',
  barra: '#241910',
  reloj: { digitos: '#B7B1AA', pista: '#B7B1AA' },
  tinta: '#FFFFFF',
  vidrio: { velo: 'rgba(0, 0, 0, 0.08)', saturacion: 1.05 },
  luz: { direccion: -104, tinte: '#ff7a1a', fuerza: 0 },
  sombra: { color: 'rgba(0, 0, 0, 0.38)', opacidad: 1 },
  frasco3d: { pie: 'bulbo' },
};

export const arena: Escena = {
  id: 'arena',
  nombre: { es: 'Arena', en: 'Sand' },
  relojAlto: true,
  claro,
  oscuro,
  crearContenido: (medida, esquema) => {
    const contenido = crearArena(medida, esquema);
    return {
      ...contenido,
      pintar(ctx, p) {
        if (p.esquema === 'oscuro') fijarLuzGrano(oscuro.luz.direccion);
        try {
          contenido.pintar(ctx, p);
        } finally {
          fijarLuzGrano(null);
        }
      },
      destruir() {
        fijarLuzGrano(null);
        contenido.destruir();
      },
    };
  },
};
