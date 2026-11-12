/**
 * Números de la sección 3.11. La colocación no lleva cifras sueltas.
 */

export const ANCHO_ANCHA = 900;
/**
 * Por debajo de 900 la fórmula dice estrecha. 844×390 está en la tabla como
 * ancha, así que el móvil horizontal sigue siéndolo. Entre 500 y 700 la
 * columna queda bajo 320 px y el aviso de Android no cabe sin montarse
 * en el reloj: ahí manda la fórmula y sale estrecha.
 */
export const ANCHO_ANCHA_CORTA = 720;
export const RATIO_ANCHA = 1.2;
/** Por debajo, en ancha, el reloj se desvanece si el menú no cabe. */
export const ALTO_CORTO = 560;
/** Por debajo, en estrecha, el frasco se desvanece si no llega al mínimo. */
export const ALTO_FRASCO_SE_DESVANECE = 640;
export const ALTO_SIN_SCROLL = 600;

export const MARGEN_MIN = 16;
export const MARGEN_FRACCION = 0.025;
export const MARGEN_MAX = 40;
export const MARGEN_ESTRECHO = 12;
export const AIRE = 32;
export const BORDE_PIE = 12;
export const BOTON = 44;
export const FUERA = 24;

export const COLUMNA_X = 0.52;
export const FRASCO_X = 0.3;
export const FRASCO_BASE = 0.8;
export const FRASCO_ALTO_ANCHA = 0.7;
export const FRASCO_ANCHO_ANCHA = 0.34;

export const HORA_MIN_ANCHA = 64;
export const HORA_MAX_ANCHA = 128;
export const HORA_FRACCION_ANCHA = 0.13;
export const RELOJ_TOP = 0.06;
export const MENU_BAJO_RELOJ = 24;
export const MENU_ANCHO_ANCHA = 440;

export const HORA_MIN_ESTRECHA = 56;
export const HORA_MAX_ESTRECHA = 96;
export const HORA_FRACCION_ESTRECHA = 0.17;
export const HORA_TOPE_ALTO = 0.1;
export const HORA_SUELO = 48;
export const HORA_BAJA = 0.15;
export const SEPARACION_RELOJ = 16;
export const SEPARACION_MENU = 12;
export const FRASCO_HUECO = 0.9;
export const FRASCO_ALTO_ESTRECHA = 0.56;
export const FRASCO_ANCHO_ESTRECHA = 0.42;
export const FRASCO_MIN_CERRADO = 0.3;
export const FRASCO_MIN_ABIERTO = 0.22;
export const MENU_FRACCION = 0.52;
export const MENU_TOPE = 440;
export const MENU_ANCHO_ESTRECHA = 520;
export const MENU_MARGEN_X = 24;
export const AVISO_ANCHO = 420;
export const AVISO_MIN_TIRA = 160;

export const NUBE_ANCHO = 1.72;
export const NUBE_RELACION = 438 / 1100;
export const NUBE_BULBO = 0.4;

export interface MargenSeguro {
  readonly arriba: number;
  readonly derecha: number;
  readonly abajo: number;
  readonly izquierda: number;
}

export interface MetricasDigitos {
  readonly anchoPorEm: number;
  readonly altoDigitosPorEm: number;
  readonly altoPista: number;
}

export interface EntradaLayout {
  readonly ancho: number;
  readonly alto: number;
  readonly menuAbierto: boolean;
  readonly altoMenu: number;
  readonly altoAviso: number;
  readonly altoPie: number;
  readonly margenSeguro: MargenSeguro;
  readonly digitos: MetricasDigitos;
}

/** Hasta que la fuente se mide. Manrope 200, «00:00», pista de 15 px. */
export const DIGITOS_BASE: MetricasDigitos = {
  anchoPorEm: 2.45,
  altoDigitosPorEm: 0.92,
  altoPista: 46,
};

export const MARGEN_CERO: MargenSeguro = { arriba: 0, derecha: 0, abajo: 0, izquierda: 0 };

export function clamp(min: number, valor: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

export function margenAncho(ancho: number): number {
  return clamp(MARGEN_MIN, ancho * MARGEN_FRACCION, MARGEN_MAX);
}

export function entradaDe(
  ancho: number,
  alto: number,
  menuAbierto: boolean,
  extra: Partial<EntradaLayout> = {},
): EntradaLayout {
  return {
    ancho,
    alto,
    menuAbierto,
    altoMenu: 320,
    altoAviso: 0,
    altoPie: 40,
    margenSeguro: MARGEN_CERO,
    digitos: DIGITOS_BASE,
    ...extra,
  };
}
