import type { Frasco3D } from './tipos';

/**
 * Lo que comparten la capa WebGL (Capa3D) y el bucle de Frasco.
 * La capa pone `listo` y `motor`; Frasco pone `despertar` y, cuando el
 * frasco 3D pinta, manda el ángulo y el pintor del contenido.
 * Si `listo` es false, todo sigue como antes: el frasco de foto en 2D.
 */
export interface Puente3D {
  /** El WebGL ya pinta la escena y no ha fallado. */
  listo: boolean;
  motor: Pick<Frasco3D, 'girar' | 'setFrascoVisible' | 'setContenido'> | null;
  /** Despierta el bucle de Frasco (se duerme en reposo). */
  despertar: (() => void) | null;
  /**
   * Para quien pinta en el mundo (el agua): de px de la ventana a la hoja que
   * recibe `ctx` (tipo 'frasco'), girada `angulo`, y el cuello en px de la ventana.
   */
  pantalla: ((ctx: CanvasRenderingContext2D, angulo: number) => {
    matriz: DOMMatrix;
    cuello: { x: number; y: number };
  }) | null;
}

export function crearPuente3D(): Puente3D {
  return { listo: false, motor: null, despertar: null, pantalla: null };
}
