import type { Escena } from '../comun/frasco';
import { lluvia } from '../escenas/lluvia';

export { lluvia } from '../escenas/lluvia';

/** Lluvia va en el arranque. Arena y Clásico llegan en trozos aparte. */
export function cargarOtrasEscenas(): Promise<readonly Escena[]> {
  return Promise.all([import('../escenas/arena'), import('../escenas/clasico')]).then(
    ([arena, clasico]) => [lluvia, arena.arena, clasico.clasico],
  );
}
