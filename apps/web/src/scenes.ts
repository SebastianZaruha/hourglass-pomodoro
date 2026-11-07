/**
 * Escenas que se ofrecen en la web. Miel y nieve siguen en el código y en
 * los archivos, pero no se muestran ni se restauran hasta que entren aquí.
 */
export const ESCENAS_ACTIVAS = ['lluvia', 'arena'] as const;

export type EscenaActiva = (typeof ESCENAS_ACTIVAS)[number];

/** Miel, nieve o un valor raro vuelven a lluvia. Arena y lluvia se quedan. */
export function escenaActiva(id: string | null | undefined): EscenaActiva {
  if (id === 'arena' || id === 'lluvia') return id;
  return 'lluvia';
}
