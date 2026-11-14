import { arena } from '../escenas/arena';
import { clasicoPublicado } from '../escenas/clasico';

export { arena } from '../escenas/arena';
export { barraPublicada, clasicoPublicado } from '../escenas/clasico';

/** Clásico, la publicada, y Arena. Con dos, el menú muestra la fila. */
export const escenas = [clasicoPublicado, arena] as const;
