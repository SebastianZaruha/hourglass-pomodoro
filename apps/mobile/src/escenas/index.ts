import type { SceneId } from '@reloj/core';

import type { ColorSchemeName, HourglassTheme } from '../theme/theme';
import { arena } from './arena';
import { clasico } from './clasico';
import { lluvia } from './lluvia';
import type { EscenaMovil, FondoMovil, Material } from './tipos';

const ESCENAS: readonly EscenaMovil[] = [clasico, lluvia, arena];

export function getEscena(id: SceneId | null | undefined): EscenaMovil {
  return ESCENAS.find((e) => e.id === id) ?? clasico;
}

export function temaDe(escena: EscenaMovil, scheme: ColorSchemeName): HourglassTheme {
  return scheme === 'dark' ? escena.oscuro.tema : escena.claro.tema;
}

export function fondoDe(escena: EscenaMovil, scheme: ColorSchemeName): FondoMovil {
  return scheme === 'dark' ? escena.oscuro.fondo : escena.claro.fondo;
}

export function materialDe(escena: EscenaMovil): Material {
  return escena.material;
}

export { arena, clasico, lluvia };
export type { AspectoMovil, EscenaMovil, FondoMovil, Material } from './tipos';
