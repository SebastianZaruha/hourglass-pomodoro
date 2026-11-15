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
  readonly delante: CanvasImageSource;
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
  cuelloEnPunta(data, lienzo.width, lienzo.height);
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

function hermite(t: number, p0: number, m0: number, p1: number, m1: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}

/**
 * El canal del cuello es un rectángulo. La arena, recortada con él, acaba
 * en un escalón. Aquí el hueco sigue la curva del cristal hasta una punta,
 * por la que sale el chorro. El radio de la rejilla sale de la misma forma.
 */
function cuelloEnPunta(data: Uint8ClampedArray, ancho: number, alto: number): void {
  const izquierda = new Int16Array(alto);
  const derecha = new Int16Array(alto);
  izquierda.fill(-1);
  derecha.fill(-1);
  for (let y = 0; y < alto; y++) {
    const fila = y * ancho;
    let i = -1;
    let d = -1;
    for (let x = 0; x < ancho; x++) {
      if (luminancia(data, (fila + x) * 4) <= 127) continue;
      if (i < 0) i = x;
      d = x;
    }
    izquierda[y] = i;
    derecha[y] = d;
  }
  const anchoEn = (y: number): number => {
    const i = izquierda[y] ?? -1;
    const d = derecha[y] ?? -1;
    return i < 0 || d < 0 ? 0 : d - i + 1;
  };
  const centro = alto / 2;
  const margen = alto * 0.1;
  let mejorDesde = -1;
  let mejorHasta = -1;
  let y = 0;
  while (y < alto) {
    const w = anchoEn(y);
    if (w < 4 || Math.abs(y - centro) > margen) {
      y++;
      continue;
    }
    const desde = y;
    const base = w;
    while (y < alto && Math.abs(anchoEn(y) - base) <= 2) y++;
    if (y - desde >= alto * 0.02 && y - desde > mejorHasta - mejorDesde) {
      mejorDesde = desde;
      mejorHasta = y;
    }
  }
  if (mejorDesde < 0) return;
  let desde = mejorDesde;
  let hasta = mejorHasta;
  while (desde > 0 && anchoEn(desde - 1) === 0) desde--;
  while (hasta < alto && anchoEn(hasta) === 0) hasta++;
  const arriba = desde - 1;
  const abajo = hasta;
  if (arriba < 1 || abajo >= alto - 1) return;
  if (anchoEn(arriba) < anchoEn(desde) * 2 || anchoEn(abajo) < anchoEn(hasta - 1) * 2) return;

  const paso = Math.max(4, Math.round(alto * 0.008));
  const previo = Math.max(0, arriba - paso);
  const siguiente = Math.min(alto - 1, abajo + paso);
  const tramoArriba = arriba - previo || 1;
  const tramoAbajo = siguiente - abajo || 1;
  const la = izquierda[arriba] ?? 0;
  const ra = derecha[arriba] ?? 0;
  const lb = izquierda[abajo] ?? 0;
  const rb = derecha[abajo] ?? 0;
  const pendienteL = ((izquierda[previo] ?? la) - la) / tramoArriba;
  const pendienteR = ((derecha[previo] ?? ra) - ra) / tramoArriba;
  const pendienteLb = ((izquierda[siguiente] ?? lb) - lb) / tramoAbajo;
  const pendienteRb = ((derecha[siguiente] ?? rb) - rb) / tramoAbajo;
  const bajaL = -pendienteL;
  const bajaR = -pendienteR;
  const cx = (la + ra) / 2;
  const punta = Math.max(2, Math.round((8 * alto) / 2048)) / 2;
  const cuello = (arriba + abajo) / 2;
  const tope = Math.max((ra - la) / 2, (rb - lb) / 2);

  for (let filaY = desde; filaY < hasta; filaY++) {
    let medio: number;
    if (filaY <= cuello) {
      const dy = cuello - arriba || 1;
      const t = (filaY - arriba) / dy;
      const hw0 = (ra - la) / 2;
      const dhw = (bajaR - bajaL) / 2;
      medio = hermite(t, hw0, dhw * dy, punta, -1.1 * dy);
    } else {
      const dy = abajo - cuello || 1;
      const t = (filaY - cuello) / dy;
      const hw1 = (rb - lb) / 2;
      const dhw = (pendienteRb - pendienteLb) / 2;
      medio = hermite(t, punta, 1.1 * dy, hw1, dhw * dy);
    }
    medio = Math.min(tope, Math.max(punta, medio));
    const izq = Math.round(cx - medio);
    const der = Math.round(cx + medio);
    const base = filaY * ancho * 4;
    for (let x = 0; x < ancho; x++) {
      const o = base + x * 4;
      const dentro = x >= izq && x <= der;
      const v = dentro ? 255 : 0;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
    }
  }
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
    cuelloEnPunta(data, FOTO_ANCHO, FOTO_ALTO);
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

/**
 * Los brillos del cuello, en la lámina de delante, son manchas blancas
 * anchas. Se quedan en el lomo de cada mancha, fino, y el halo se apaga.
 * El resto del frasco no se toca.
 */
function afinarBrillos(img: HTMLImageElement): HTMLCanvasElement {
  const lienzo = lienzoDe(img, img.naturalWidth, img.naturalHeight, false);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return lienzo;
  const w = lienzo.width;
  const h = lienzo.height;
  const foto = ctx.getImageData(0, 0, w, h);
  const data = foto.data;
  const n = w * h;
  const luz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    luz[i] = luminancia(data, o) * ((data[o + 3] ?? 0) / 255);
  }
  const y0 = Math.round(h * 0.42);
  const y1 = Math.round(h * 0.545);
  const pluma = Math.round(h * 0.018);
  const suave = desenfoque(luz, w, h, y0, y1);
  const nucleo = new Uint8Array(w);
  for (let y = y0; y < y1; y++) {
    const dist = Math.min(y - y0, y1 - 1 - y);
    const peso = dist >= pluma ? 1 : dist / pluma;
    if (peso <= 0) continue;
    nucleo.fill(0);
    const fila = y * w;
    let x = 0;
    while (x < w) {
      if ((suave[fila + x] ?? 0) <= 168) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < w && (suave[fila + x] ?? 0) > 168) x++;
      const anchoRun = x - x0;
      if (anchoRun < 3) {
        for (let k = x0; k < x; k++) nucleo[k] = 2;
      } else {
        const medio = (x0 + x - 1) / 2;
        nucleo[Math.floor(medio)] = 2;
        nucleo[Math.ceil(medio)] = 2;
      }
    }
    for (let k = 0; k < w; k++) {
      if (nucleo[k] !== 2) continue;
      let i = k - 1;
      while (i >= 0 && nucleo[i] !== 2 && (luz[fila + i] ?? 0) > 95) i--;
      let d = k + 1;
      while (d < w && nucleo[d] !== 2 && (luz[fila + d] ?? 0) > 95) d++;
      for (let p = i + 1; p < d; p++) if (nucleo[p] !== 2) nucleo[p] = 3;
      if (k - 1 >= 0 && nucleo[k - 1] === 3) nucleo[k - 1] = 1;
      if (k + 1 < w && nucleo[k + 1] === 3) nucleo[k + 1] = 1;
    }
    for (let k = 0; k < w; k++) {
      const marca = nucleo[k] ?? 0;
      if (marca === 0) continue;
      const o = (fila + k) * 4;
      const valor = marca === 2 ? 245 : marca === 1 ? 110 : 0;
      for (let c = 0; c < 3; c++) {
        const previo = data[o + c] ?? 0;
        data[o + c] = previo + (valor - previo) * peso;
      }
    }
  }
  ctx.putImageData(foto, 0, 0);
  return lienzo;
}

/** Binomial [1 4 6 4 1], solo en la franja del cuello. */
function desenfoque(luz: Float32Array, w: number, h: number, y0: number, y1: number): Float32Array {
  const k = [1, 4, 6, 4, 1];
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const yA = Math.max(0, y0 - 2);
  const yB = Math.min(h - 1, y1 + 2);
  for (let y = yA; y <= yB; y++) {
    const fila = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) {
        const xx = Math.min(w - 1, Math.max(0, x + i));
        s += (luz[fila + xx] ?? 0) * (k[i + 2] ?? 0);
      }
      tmp[fila + x] = s / 16;
    }
  }
  for (let y = y0; y < y1; y++) {
    const fila = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) {
        const yy = Math.min(yB, Math.max(yA, y + i));
        s += (tmp[yy * w + x] ?? 0) * (k[i + 2] ?? 0);
      }
      out[fila + x] = s / 16;
    }
  }
  return out;
}

/**
 * Por encima de esto el píxel es un brillo de verdad y se queda.
 * El relleno negro y el halo gris del borde interior quedan por debajo.
 */
const UMBRAL_BRILLO = 168;

/**
 * Dentro de la silueta, el relleno y el halo pasan a alfa 0.
 * En `screen`, ese negro se vuelve un cuerpo opaco y el gris se ve como
 * un anillo. Fuera de la silueta no se toca un píxel: ahí vive el color
 * de la pared. Nada se repinta de blanco, así que no queda velo lechoso
 * ni una copia del fondo metida en el vidrio.
 */
function vaciarInterior(
  img: HTMLImageElement | HTMLCanvasElement,
  mascara: CanvasImageSource,
): HTMLCanvasElement {
  const ancho = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const alto = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const lienzo = lienzoDe(img, ancho, alto, false);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return lienzo;
  const silueta = document.createElement('canvas');
  silueta.width = ancho;
  silueta.height = alto;
  const sg = silueta.getContext('2d', { willReadFrequently: true });
  if (!sg) return lienzo;
  sg.imageSmoothingEnabled = true;
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(mascara, 0, 0, ancho, alto);
  const dentro = sg.getImageData(0, 0, ancho, alto).data;
  const foto = ctx.getImageData(0, 0, ancho, alto);
  const data = foto.data;
  for (let i = 0; i < data.length; i += 4) {
    if ((dentro[i + 3] ?? 0) < 128) continue;
    if ((data[i + 3] ?? 0) < 8) continue;
    if (luminancia(data, i) >= UMBRAL_BRILLO) continue;
    data[i + 3] = 0;
  }
  ctx.putImageData(foto, 0, 0);
  return lienzo;
}

/** Las tres imágenes. Una sola carga para el vidrio y para la arena. */
export function fotosDelFrasco(): Promise<FotosFrasco> {
  if (!fotosCache) {
    fotosCache = Promise.all([geometriaDelFrasco(), imagen(ATRAS), imagen(DELANTE)]).then(
      ([geo, atras, delante]) => ({
        geo,
        atras: vaciarInterior(atras, geo.mascara),
        delante: vaciarInterior(afinarBrillos(delante), geo.mascara),
      }),
    );
  }
  return fotosCache;
}
