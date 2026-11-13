import type { HourglassProfile } from '@reloj/core';

/**
 * La fórmula del core no puede copiar la foto (el peor encaje se va del
 * 2 %). Estos números son los del modelo clásico, para que la rejilla de
 * granos no cambie de tamaño. La forma que se ve la recorta la máscara.
 */
export const PERFIL_FRASCO: HourglassProfile = {
  halfHeightRatio: 2.3,
  bulbCenter: 0.52,
  bulbRadiusY: 0.49,
  neckRadius: 0.045,
  fillet: 0.14,
  egg: 0.3,
  taper: 1.9,
  wallThickness: 0.024,
};
