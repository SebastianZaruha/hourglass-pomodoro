import { arena } from '../escenas/arena';
import { clasico } from '../escenas/clasico';
import { lluvia } from '../escenas/lluvia';

export { arena } from '../escenas/arena';
export { barraPublicada, clasico } from '../escenas/clasico';
export { lluvia } from '../escenas/lluvia';

/** Lluvia es la de por defecto. Con varias, el menú muestra la fila. */
export const escenas = [lluvia, arena, clasico] as const;
