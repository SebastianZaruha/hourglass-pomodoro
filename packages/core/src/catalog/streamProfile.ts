/**
 * Chorro de granos de la arena. Los números son los históricos: si no se
 * pasa perfil, `StreamParticles` usa estos y la arena no cambia.
 * La lluvia y la miel no lo usan: su chorro es un patrón, no partículas.
 */
export interface StreamProfile {
  readonly gravityScale: number;
  readonly rateScale: number;
  readonly sizeScale: number;
  readonly splashChance: number;
  readonly swirlPerSec: number;
  readonly strayChance: number;
}

export const SAND_STREAM: StreamProfile = {
  gravityScale: 1,
  rateScale: 1,
  sizeScale: 1,
  splashChance: 0.16,
  swirlPerSec: 28,
  strayChance: 0.04,
};
