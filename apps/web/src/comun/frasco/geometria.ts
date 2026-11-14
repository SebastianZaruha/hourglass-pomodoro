import type { GeometriaFrasco } from './contrato';

/** La máscara se lee a este tamaño. La foto de verdad es el doble. */
export const FOTO_ANCHO = 446;
export const FOTO_ALTO = 1024;
/** Centro de la franja del cuello, en filas de la máscara. */
export const CUELLO_FILA = 496.5;
/** Ventana interior simétrica, en píxeles de la máscara. */
export const VENTANA_PX = { x0: 26, x1: 421, y0: 16, y1: 977 } as const;
/** Medio ancho y medio alto de esa ventana. */
export const SEMI_ANCHO = 197.5;
export const SEMI_ALTO = 480.5;
/**
 * El archivo deja 25 px transparentes a cada lado (841 de 891).
 * Sin esto el vidrio se ve más estrecho que el dibujado de producción.
 */
export const RELLENO_ANCHO = 891 / 841;

const MASCARA = '/frasco/jar-mask.webp';
const ATRAS = '/frasco/jar-back.webp';
const DELANTE = '/frasco/jar-front.webp';
const CENTRO_X = 223.5;

export interface FotosFrasco {
  readonly geo: GeometriaFrasco;
  readonly atras: HTMLImageElement;
  readonly delante: HTMLImageElement;
}

function imagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function luminancia(data: Uint8ClampedArray, i: number): number {
  return 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
}

function lienzoDe(img: CanvasImageSource, ancho: number, alto: number, suave: boolean): HTMLCanvasElement {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return lienzo;
  ctx.imageSmoothingEnabled = suave;
  ctx.drawImage(img, 0, 0, ancho, alto);
  return lienzo;
}

/** Blanco dentro, transparente fuera. Sirve para recortar y para la silueta. */
function mascaraAlfa(img: HTMLImageElement): HTMLCanvasElement {
  const lienzo = lienzoDe(img, img.naturalWidth, img.naturalHeight, false);
  const ctx = lienzo.getContext('2d');
  if (!ctx) return lienzo;
  const foto = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  const data = foto.data;
  for (let i = 0; i < data.length; i += 4) {
    const dentro = luminancia(data, i) > 127;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = dentro ? 255 : 0;
  }
  ctx.putImageData(foto, 0, 0);
  return lienzo;
}

/**
 * Lee la máscara una vez. El radio es el máximo de los dos bulbos a la
 * misma distancia del cuello, para que el volteo de la rejilla sea simétrico.
 */
export function leerGeometria(img: HTMLImageElement): GeometriaFrasco {
  const pequena = lienzoDe(img, FOTO_ANCHO, FOTO_ALTO, false);
  const ctx = pequena.getContext('2d');
  const vacio = new Float64Array(FOTO_ALTO);
  const anchos = vacio;
  const dentro = new Uint8Array(FOTO_ANCHO * FOTO_ALTO);
  if (ctx) {
    const foto = ctx.getImageData(0, 0, FOTO_ANCHO, FOTO_ALTO);
    const data = foto.data;
    for (let y = 0; y < FOTO_ALTO; y++) {
      let extremo = 0;
      for (let x = 0; x < FOTO_ANCHO; x++) {
        if (luminancia(data, (y * FOTO_ANCHO + x) * 4) <= 127) continue;
        dentro[y * FOTO_ANCHO + x] = 1;
        extremo = Math.max(extremo, Math.abs(x + 0.5 - CENTRO_X));
      }
      anchos[y] = extremo;
    }
  }

  const radioEn = (d: number): number => {
    const fila = Math.max(0, Math.min(FOTO_ALTO - 1, Math.floor(d)));
    const arriba = anchos[Math.max(0, Math.min(FOTO_ALTO - 1, Math.floor(CUELLO_FILA - fila)))] ?? 0;
    const abajo = anchos[Math.max(0, Math.min(FOTO_ALTO - 1, Math.floor(CUELLO_FILA + fila)))] ?? 0;
    return Math.max(arriba, abajo) / SEMI_ANCHO;
  };

  const puntosDe = (superior: boolean): Float32Array => {
    const lista: number[] = [];
    for (let y = 0; y < FOTO_ALTO; y += 4) {
      const esArriba = y + 0.5 < CUELLO_FILA;
      if (esArriba !== superior) continue;
      for (let x = 0; x < FOTO_ANCHO; x += 4) {
        if (dentro[y * FOTO_ANCHO + x] !== 1) continue;
        lista.push(x / FOTO_ANCHO, y / FOTO_ALTO);
      }
    }
    return Float32Array.from(lista);
  };

  return {
    aspecto: FOTO_ALTO / FOTO_ANCHO,
    ventana: {
      x0: VENTANA_PX.x0 / FOTO_ANCHO,
      x1: VENTANA_PX.x1 / FOTO_ANCHO,
      y0: VENTANA_PX.y0 / FOTO_ALTO,
      y1: VENTANA_PX.y1 / FOTO_ALTO,
    },
    radio(y: number): number {
      const ay = Math.abs(y);
      if (ay > 1) return 0;
      return radioEn(ay * SEMI_ALTO);
    },
    mascara: mascaraAlfa(img),
    puntos: { arriba: puntosDe(true), abajo: puntosDe(false) },
    cuelloY: CUELLO_FILA / FOTO_ALTO,
  };
}

let geometriaCache: Promise<GeometriaFrasco> | null = null;
let fotosCache: Promise<FotosFrasco> | null = null;

/** La máscara, aunque las fotos del vidrio no lleguen. */
export function geometriaDelFrasco(): Promise<GeometriaFrasco> {
  if (!geometriaCache) {
    geometriaCache = imagen(MASCARA).then(leerGeometria);
  }
  return geometriaCache;
}

/** Las tres imágenes. Una sola carga para el vidrio y para la arena. */
export function fotosDelFrasco(): Promise<FotosFrasco> {
  if (!fotosCache) {
    fotosCache = Promise.all([geometriaDelFrasco(), imagen(ATRAS), imagen(DELANTE)]).then(
      ([geo, atras, delante]) => ({ geo, atras, delante }),
    );
  }
  return fotosCache;
}
