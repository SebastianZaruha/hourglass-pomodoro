import type { Aspecto, Escena } from '../../comun/frasco';
import { crearArena, fijarLuzGrano } from '../arena-modelo';

/**
 * Arena. El movimiento de la arena es el de arena-modelo, sin cambios.
 * En oscuro, el pintado sombrea los granos con la luz de las esferas de la foto.
 * La luz ambiente del vidrio va a 0. El reloj, en ancha, sube al bulbo.
 * El fondo va a cover, centrado: no se amplía para apoyar el frasco en la duna.
 */

/**
 * Hacia la esfera cálida de la izquierda, a la altura de la arena y un poco
 * por debajo. 0° es la derecha y 90° es abajo en el lienzo. 176° queda
 * casi horizontal: el paso del sombreado no se va en diagonal.
 * El vidrio no usa este número (oscuro.luz.fuerza es 0 y su dirección se queda).
 */
const LUZ_GRANO_OSCURO = 176;
const claro: Aspecto = {
  fondo: {
    tipo: 'foto',
    webp: '/fondos/arena-claro.webp',
    avif: '/fondos/arena-claro.avif',
    estrecho: { webp: '/fondos/arena-claro-estrecho.webp', avif: '/fondos/arena-claro-estrecho.avif' },
  },
  ancla: { x: 0.5, y: 0.5, cover: true },
  reserva: '#e4c7a4',
  barra: '#e6d7c4',
  reloj: { digitos: '#e9ceae', pista: '#e9ceae' },
  tinta: '#71350d',
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
  ancla: { x: 0.5, y: 0.5, cover: true },
  reserva: '#3a2618',
  barra: '#241910',
  reloj: { digitos: '#754e30', pista: '#754e30' },
  tinta: '#754e30',
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
        if (p.esquema === 'oscuro') {
          // La luz de los granos lee el giro del contexto. El vidrio de foto lo trae
          // girado; la hoja del frasco 3D no, y ahí se descuenta el ángulo aquí.
          const t = ctx.getTransform();
          const girado = Math.atan2(t.b, t.a);
          fijarLuzGrano(LUZ_GRANO_OSCURO + ((girado - p.angulo) * 180) / Math.PI);
        }
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
