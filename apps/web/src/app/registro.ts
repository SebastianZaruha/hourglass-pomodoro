import { clasicoPublicado } from '../escenas/clasico';

export { barraPublicada, clasicoPublicado } from '../escenas/clasico';

/** Una sola escena: el menú no tiene fila de escenas. */
export const escenas = [clasicoPublicado] as const;
