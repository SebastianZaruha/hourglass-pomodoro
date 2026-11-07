/**
 * Registro de materiales del reloj.
 *
 * Arena: simulación grano a grano (la de siempre). Lluvia y miel: una
 * entrada de esta tabla y el porcentaje de tiempo (ver shape/geometry).
 * Añadir otro material con un aspecto que ya exista (`granos`, `lluvia`,
 * `miel`) es otra entrada aquí. Un aspecto nuevo necesita su pintor.
 */
import type { StreamProfile } from './streamProfile';
import { SAND_STREAM } from './streamProfile';

export type { StreamProfile };
export { SAND_STREAM };

export type ContentKind = 'granular' | 'shape';

/** Color RGB en 0..255. */
export type Rgb = readonly [number, number, number];

export const MATERIAL_IDS = ['arena', 'lluvia', 'miel'] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

/** Qué pintor usa. `granos` es el de la arena. */
export type MaterialLook = 'granos' | 'lluvia' | 'miel';

export interface ContentPalette {
  readonly grainTones: readonly Rgb[];
  readonly speck: Rgb;
  readonly speckRatio: number;
}

/** Desplazamiento del fondo, en unidades 0..255. [0, 0, 0] no cambia nada. */
export type AtmosphereShift = readonly [number, number, number];

interface MaterialBase {
  readonly id: MaterialId;
  readonly name: string;
  readonly palette: { readonly light: ContentPalette; readonly dark: ContentPalette };
  readonly look: MaterialLook;
  readonly atmosphere: { readonly light: AtmosphereShift; readonly dark: AtmosphereShift };
}

/** Arena: el autómata de granos. Estos números son los de la 1.8. */
export interface GranularMaterial extends MaterialBase {
  readonly kind: 'granular';
  readonly slideChance: number;
  readonly staticFriction: number;
  readonly fillRatio: number;
  readonly idleCrater: number;
  readonly flowCrater: number;
  readonly sparkle: boolean;
  readonly stream: StreamProfile;
}

/**
 * Material dibujado desde el porcentaje. El chorro va a `ribbonSpeed`
 * ciclos por segundo, da igual cuánto dure el reloj.
 */
export interface ShapeMaterial extends MaterialBase {
  readonly kind: 'shape';
  /** Cuánto del bulbo ocupa el «lleno», para no pegarse al vidrio. */
  readonly fullFraction: number;
  /** Altura de la onda, en unidades del perfil. 0 = superficie quieta. */
  readonly waves: number;
  /** Ciclos de onda por segundo, solo mientras corre. */
  readonly waveSpeed: number;
  /** Cúpula en el centro (miel). 0 = nivel. */
  readonly mound: number;
  /** Ciclos del chorro por segundo. */
  readonly ribbonSpeed: number;
  readonly ribbonCount: number;
  /** Nube de algodón en el bulbo de arriba (lluvia). */
  readonly cloud: boolean;
}

export type MaterialDefinition = GranularMaterial | ShapeMaterial;

/** @deprecated El pintor importaba este nombre. Es el mismo registro. */
export type ContentDefinition = MaterialDefinition;

const NO_TINT: AtmosphereShift = [0, 0, 0];

export const SAND: GranularMaterial = {
  id: 'arena',
  name: 'Arena',
  kind: 'granular',
  look: 'granos',
  palette: {
    light: {
      grainTones: [
        [214, 192, 158],
        [204, 179, 141],
        [224, 205, 174],
        [196, 170, 131],
        [230, 214, 188],
      ],
      speck: [150, 124, 96],
      speckRatio: 0.025,
    },
    dark: {
      grainTones: [
        [186, 160, 124],
        [172, 146, 110],
        [198, 175, 141],
        [160, 134, 100],
        [206, 186, 155],
      ],
      speck: [112, 92, 70],
      speckRatio: 0.025,
    },
  },
  slideChance: 0.55,
  staticFriction: 0.3,
  fillRatio: 0.86,
  idleCrater: 0.25,
  flowCrater: 0.35,
  sparkle: true,
  stream: SAND_STREAM,
  atmosphere: { light: NO_TINT, dark: NO_TINT },
};

/** Nube que encoge, lluvia continua y agua que se acumula abajo. */
export const RAIN: ShapeMaterial = {
  id: 'lluvia',
  name: 'Lluvia',
  kind: 'shape',
  look: 'lluvia',
  palette: {
    light: {
      grainTones: [
        [168, 184, 190],
        [154, 172, 180],
        [186, 198, 202],
        [142, 160, 170],
      ],
      speck: [120, 140, 150],
      speckRatio: 0.02,
    },
    dark: {
      grainTones: [
        [126, 146, 154],
        [112, 132, 142],
        [146, 164, 170],
        [100, 120, 130],
      ],
      speck: [80, 100, 110],
      speckRatio: 0.02,
    },
  },
  fullFraction: 0.9,
  waves: 0.012,
  waveSpeed: 1.15,
  mound: 0,
  ribbonSpeed: 1.35,
  ribbonCount: 11,
  cloud: true,
  atmosphere: { light: [-8, -3, 8], dark: [-5, -2, 6] },
};

/** Miel: nivel ámbar, cúpula suave y un hilo grueso y lento. */
export const HONEY: ShapeMaterial = {
  id: 'miel',
  name: 'Miel',
  kind: 'shape',
  look: 'miel',
  palette: {
    light: {
      grainTones: [
        [210, 160, 72],
        [196, 142, 56],
        [224, 178, 98],
        [180, 126, 48],
      ],
      speck: [140, 90, 36],
      speckRatio: 0.04,
    },
    dark: {
      grainTones: [
        [188, 140, 62],
        [170, 120, 48],
        [206, 158, 82],
        [154, 106, 40],
      ],
      speck: [110, 72, 32],
      speckRatio: 0.04,
    },
  },
  fullFraction: 0.88,
  waves: 0.007,
  waveSpeed: 0.55,
  mound: 0.045,
  ribbonSpeed: 0.42,
  ribbonCount: 5,
  cloud: false,
  atmosphere: { light: [10, 4, -12], dark: [8, 3, -6] },
};

export const MATERIALS: Readonly<Record<MaterialId, MaterialDefinition>> = {
  arena: SAND,
  lluvia: RAIN,
  miel: HONEY,
};

export const CONTENT_CATALOG: readonly MaterialDefinition[] = MATERIAL_IDS.map((id) => MATERIALS[id]);

export const DEFAULT_CONTENT_ID: MaterialId = SAND.id;

export function isMaterialId(id: string): id is MaterialId {
  return (MATERIAL_IDS as readonly string[]).includes(id);
}

export function isShapeMaterial(material: MaterialDefinition): material is ShapeMaterial {
  return material.kind === 'shape';
}

/** Busca un material; si el id no existe (ajustes viejos o rotos) devuelve arena. */
export function getContent(id: string | undefined | null): MaterialDefinition {
  return id && isMaterialId(id) ? MATERIALS[id] : SAND;
}
