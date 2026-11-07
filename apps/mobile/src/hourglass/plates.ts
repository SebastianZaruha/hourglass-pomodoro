/**
 * Fotos del suelo y del primer plano. La piedra grande no se dibuja:
 * el frasco se apoya en la hierba de la escena.
 */
import type { MaterialId } from '@reloj/core';

export const PLATES: Record<MaterialId, { readonly scene: number; readonly blades: number }> = {
  arena: {
    scene: require('../../assets/materials/scene-arena-v.webp'),
    blades: require('../../assets/materials/blades-arena-v.webp'),
  },
  lluvia: {
    scene: require('../../assets/materials/scene-lluvia-v.webp'),
    blades: require('../../assets/materials/blades-lluvia-v.webp'),
  },
  miel: {
    scene: require('../../assets/materials/scene-miel-v.webp'),
    blades: require('../../assets/materials/blades-miel-v.webp'),
  },
  nieve: {
    scene: require('../../assets/materials/scene-nieve-v.webp'),
    blades: require('../../assets/materials/blades-nieve-v.webp'),
  },
};

export const SPRITES = {
  puff: require('../../assets/materials/cloud-puff.png'),
  shade: require('../../assets/materials/cloud-shade.png'),
  streak: require('../../assets/materials/rain-streak.png'),
  drop: require('../../assets/materials/honey-drop.png'),
  grain: require('../../assets/materials/grain-tile.png'),
} as const;
