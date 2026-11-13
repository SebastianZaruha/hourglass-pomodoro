import { arena } from './arena';
import { clasico } from './clasico';
import { lluvia } from './lluvia';
import type { IdTema, Tema } from './tipos';

export type { ContenidoTema, FondoTema, IdTema, Luz, ModoTema, Tema, UiTema } from './tipos';
export { modoDe } from './tipos';

export const TEMAS: readonly Tema[] = [lluvia, arena, clasico];

const POR_ID: Record<IdTema, Tema> = { lluvia, arena, clasico };

export function temaPorId(id: string | null | undefined): Tema {
  if (id === 'lluvia' || id === 'arena' || id === 'clasico') return POR_ID[id];
  return lluvia;
}

/** Un «claro» guardado de antes pasa a Clásico. Lo demás, si no vale, es Lluvia. */
export function escenaGuardada(raw: string | null): IdTema {
  if (raw === 'claro') return 'clasico';
  if (raw === 'lluvia' || raw === 'arena' || raw === 'clasico') return raw;
  return 'lluvia';
}

const CLAVE = 'hourglass-web/escena';

export function leerEscena(storage: Pick<Storage, 'getItem'> = localStorage): IdTema {
  try {
    return escenaGuardada(storage.getItem(CLAVE));
  } catch {
    return 'lluvia';
  }
}

export function guardarEscena(id: IdTema, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(CLAVE, id);
  } catch {
    // Sin almacenamiento la escena sigue en memoria.
  }
}
