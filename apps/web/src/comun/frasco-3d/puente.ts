import type { Frasco3D } from './tipos';

/**
 * Lo que comparten la capa WebGL (Capa3D) y el bucle de Frasco.
 * La capa pone `estado` y `motor`; Frasco pone `despertar` y, con el 3D listo,
 * manda el ángulo, la pose de la intro y el pintor del contenido.
 * La intro espera a que el estado deje de ser 'cargando'. Con 'fallo' se usa
 * el frasco de foto en 2D, que solo es el de reserva.
 */
export type Estado3D = 'cargando' | 'listo' | 'fallo';

export interface Puente3D {
  estado: Estado3D;
  motor: Pick<Frasco3D, 'girar' | 'setFrascoVisible' | 'setContenido' | 'setPoseIntro'> | null;
  /** Despierta el bucle de Frasco (se duerme en reposo). */
  despertar: (() => void) | null;
  /**
   * Para quien pinta en el mundo (el agua): de px de la ventana a la hoja que
   * recibe `ctx` (tipo 'frasco'), girada `angulo`. `cuello` es el cuello y
   * `centro` el eje del giro, ambos en px de la ventana.
   */
  pantalla: ((ctx: CanvasRenderingContext2D, angulo: number) => {
    matriz: DOMMatrix;
    cuello: { x: number; y: number };
    centro: { x: number; y: number };
    fondo?: { x: number; y: number; w: number; h: number };
    escala?: number;
  }) | null;
}

export function crearPuente3D(): Puente3D {
  return { estado: 'cargando', motor: null, despertar: null, pantalla: null };
}
