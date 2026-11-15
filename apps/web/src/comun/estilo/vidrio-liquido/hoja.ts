import { useVidrioLiquido, type OpcionesVidrioLiquido } from './useVidrioLiquido';
import type { RefObject } from 'react';

/** Los números del encargo. El respaldo deja el .vidrio de la app en Safari y Firefox. */
const HOJA: OpcionesVidrioLiquido = {
  respaldo: 'app',
  profundidad: 15,
  borde: 11,
  suavizado: 11,
  curvatura: 2.4,
};

/** El mismo vidrio líquido para todas las hojas. No copia el efecto en cada panel. */
export function useHojaVidrio(ref: RefObject<HTMLElement | null>, activo = true) {
  return useVidrioLiquido(ref, { ...HOJA, activo });
}
