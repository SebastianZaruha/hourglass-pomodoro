import { useVidrioLiquido, type OpcionesVidrioLiquido } from './useVidrioLiquido';
import type { RefObject } from 'react';

/**
 * Los números de la vuelta «tapa más, sin color propio».
 * Safari y Firefox usan el mismo vidrio sin refracción ('desenfoque'),
 * no el .vidrio de la app: así tapan igual y el texto se lee igual.
 */
export const HOJA: OpcionesVidrioLiquido = {
  respaldo: 'desenfoque',
  profundidad: 30,
  borde: 18,
  suavizado: 16,
  curvatura: 1.8,
  escarcha: 7,
  grano: 0.07,
  bisel: 0.8,
};

/**
 * El mismo vidrio líquido para todas las hojas. No copia el efecto en cada panel.
 * `extra` cambia algún número para una hoja concreta (p. ej. la pausa, a pantalla
 * completa, va sin canto).
 */
export function useHojaVidrio(
  ref: RefObject<HTMLElement | null>,
  activo = true,
  extra: OpcionesVidrioLiquido = {},
) {
  return useVidrioLiquido(ref, { ...HOJA, ...extra, activo });
}
