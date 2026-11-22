import { hash32, type ContentPalette, type SandSimulation, type StreamParticles } from '@reloj/core';

import { type GeometriaFrasco, type Scheme } from '../../comun/frasco';

export function buildPaletteLut(palette: ContentPalette): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const tones = palette.grainTones;
  const mean = [0, 1, 2].map((c) => tones.reduce((sum, tone) => sum + (tone[c] ?? 0), 0) / tones.length);
  const contrast = 0.75;
  for (let t = 1; t < 256; t++) {
    const h = hash32(t * 977);
    let rgb: readonly number[];
    if ((h % 1000) / 1000 < palette.speckRatio) {
      rgb = palette.speck;
    } else {
      const a = tones[h % tones.length] ?? [200, 170, 130];
      const b = tones[(h >>> 8) % tones.length] ?? a;
      const k = ((h >>> 16) & 255) / 255;
      rgb = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    for (let c = 0; c < 3; c++) {
      const channel = mean[c] ?? 0;
      const value = rgb[c] ?? channel;
      lut[t * 3 + c] = Math.round(channel + (value - channel) * contrast);
    }
  }
  return lut;
}

export function paintCells(sim: SandSimulation, lut: Uint8ClampedArray, image: ImageData): void {
  const cells = sim.cells;
  const data = image.data;
  data.fill(0);
  for (let i = 0; i < cells.length; i++) {
    const tone = cells[i] ?? 0;
    if (tone === 0) continue;
    const o = i * 4;
    const l = tone * 3;
    data[o] = lut[l] ?? 0;
    data[o + 1] = lut[l + 1] ?? 0;
    data[o + 2] = lut[l + 2] ?? 0;
    data[o + 3] = 255;
  }
}

export function makeGrainNoise(size = 160): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const speck = Math.random() < 0.04;
    const n = speck ? 90 + Math.random() * 40 : 170 + Math.random() * 85;
    const o = i * 4;
    image.data[o] = n;
    image.data[o + 1] = n * 0.94;
    image.data[o + 2] = n * 0.82;
    image.data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const RUIDO: Record<Scheme, number> = { light: 0.2, dark: 0.16 };
/**
 * Grosor del borde del revelado, fracción del alto del montón.
 * Por debajo de BORDE_MIN_PX el corte se vería un grano suelto.
 */
const BORDE_LLENADO = 0.08;
const BORDE_MIN_PX = 4;
/**
 * Zona del embudo, en la coordenada de la ventana (0 = cuello).
 * Más arriba la pared ya es ancha y el peldaño de una celda no se ve.
 */
const EMBUDO_Y = 0.35;
/**
 * Hasta aquí el montón se cierra en cono. En el cuello queda el ancho del hilo.
 * Fuera, la arena sigue la pared. Solo es un recorte al pintar.
 */
const PICO_Y = 0.12;
/** Ancho del hilo, como fracción del hueco. La punta del cono mide lo mismo. */
const HILO_FRACCION = 0.22;
/**
 * Filas del bulbo emisor junto al hueco. Un grano ahí solo se pinta si
 * una cadena vertical o diagonal lo une al resto del montón. La simulación
 * no se toca.
 */
const FRANJA_GARGANTA = 4;

function medioDelCuello(radio: (y: number) => number, yn: number, vw: number): number {
  const pared = radio(yn) * (vw / 2);
  const dist = Math.abs(yn);
  if (dist >= PICO_Y) return pared;
  const boca = radio(0) * (vw / 2);
  const hilo = Math.max(0.6, boca * HILO_FRACCION);
  const abierto = radio(PICO_Y) * (vw / 2);
  const cono = hilo + (abierto - hilo) * (dist / PICO_Y);
  return Math.min(pared, cono);
}
/**
 * Si la arena de la fila llega a esta distancia del vidrio, el hueco es el
 * peldaño de la rejilla y se rellena. Un montón suelto queda más adentro.
 */
const PELDAÑO_CELDAS = 2.2;

/**
 * Dirección de la luz de noche, en grados, o null si este pintado no
 * se sombrea. La pone Arena en oscuro y la quita al salir. Clásico y
 * el modo claro no la activan, y entonces el color de los granos no cambia.
 */
let luzGrano: number | null = null;

export function fijarLuzGrano(direccion: number | null): void {
  luzGrano = direccion;
}

export interface ArenaPintada {
  readonly scheme: Scheme;
  readonly caja: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly sand: HTMLCanvasElement;
  readonly noise: HTMLCanvasElement;
  readonly sim: SandSimulation;
  readonly particles: StreamParticles;
  readonly lut: Uint8ClampedArray;
  readonly geo: GeometriaFrasco;
  /**
   * Revelado tras el giro. `p` va de 0 a 1 con ease-in-out. Cada bulbo se llena
   * desde su base hasta la superficie. No mueve granos.
   */
  readonly llenado?: {
    readonly p: number;
    /** Fila de la superficie. `gateRow` / `rows` = bulbo vacío. */
    readonly supArriba: number;
    readonly supAbajo: number;
  };
  /** Opacidad del chorro. 1 en marcha; durante el revelado baja con `llenado.p`. */
  readonly chorro?: number;
  /** +1 si la caída va hacia yn positivo. Lo marca la gravedad, no el eje del frasco. */
  readonly abajo?: 1 | -1;
}

let hoja: HTMLCanvasElement | null = null;
let patronRuido: {
  noise: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pattern: CanvasPattern;
} | null = null;

function patronDe(g: CanvasRenderingContext2D, noise: HTMLCanvasElement): CanvasPattern | null {
  if (patronRuido && patronRuido.noise === noise && patronRuido.ctx === g) return patronRuido.pattern;
  const pattern = g.createPattern(noise, 'repeat');
  if (!pattern) return null;
  patronRuido = { noise, ctx: g, pattern };
  return pattern;
}

/**
 * Rejilla, ruido y chorro en la ventana interior, recortados con la máscara.
 * El contexto ya está girado con el frasco: la hoja se pega en ese marco.
 */
export function pintarArena(ctx: CanvasRenderingContext2D, scene: ArenaPintada): void {
  const { caja, geo } = scene;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pxW = Math.max(1, Math.round(caja.w * dpr));
  const pxH = Math.max(1, Math.round(caja.h * dpr));
  if (!hoja || hoja.width !== pxW || hoja.height !== pxH) {
    hoja = document.createElement('canvas');
    hoja.width = pxW;
    hoja.height = pxH;
  }
  const g = hoja.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, caja.w, caja.h);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  const vx = geo.ventana.x0 * caja.w;
  const vy = geo.ventana.y0 * caja.h;
  const vw = (geo.ventana.x1 - geo.ventana.x0) * caja.w;
  const vh = (geo.ventana.y1 - geo.ventana.y0) * caja.h;

  g.imageSmoothingEnabled = false;
  g.drawImage(scene.sand, vx, vy, vw, vh);
  if (scene.llenado) {
    sombrearGranos(g, ctx, scene, vx, vy, vw, vh);
    perfilarEmbudo(g, scene, vx, vy, vw, vh);
    revelarLlenado(g, scene, vx, vy, vw, vh);
  }

  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = RUIDO[scene.scheme];
  const pattern = patronDe(g, scene.noise);
  if (pattern) {
    g.fillStyle = pattern;
    g.fillRect(vx, vy, vw, vh);
  }
  g.restore();

  if (!scene.llenado) {
    sombrearGranos(g, ctx, scene, vx, vy, vw, vh);
    perfilarEmbudo(g, scene, vx, vy, vw, vh);
  }
  taparGarganta(g, scene, vx, vy, vw, vh);

  const cellW = vw / scene.sim.cols;
  const cellH = vh / scene.sim.rows;
  const count = scene.particles.count;
  const alfaChorro = scene.chorro ?? 1;
  const cx = vx + vw / 2;
  const hilo = Math.max(0.6, geo.radio(0) * (vw / 2) * HILO_FRACCION);
  const abajo = scene.abajo ?? 1;
  const enElHilo = (yn: number) => (abajo > 0 ? yn >= 0 : yn <= 0) && Math.abs(yn) <= PICO_Y;
  g.save();
  g.globalAlpha = alfaChorro;
  g.imageSmoothingEnabled = true;
  for (let i = 0; i < count; i++) {
    const px = scene.particles.x[i] ?? 0;
    const py = scene.particles.y[i] ?? 0;
    const size = scene.particles.size[i] ?? 0.3;
    const tone = scene.particles.tone[i] ?? 1;
    const x = vx + (px / scene.sim.cols) * vw;
    const y = vy + (py / scene.sim.rows) * vh;
    const l = tone * 3;
    g.fillStyle = `rgb(${scene.lut[l] ?? 200}, ${scene.lut[l + 1] ?? 170}, ${scene.lut[l + 2] ?? 130})`;
    const yn = vh > 0 ? ((y - vy) / vh) * 2 - 1 : 0;
    const fila = Math.floor(py);
    // Encima del hueco no se pinta ninguna partícula: el chorro nace del lado del montón y deja una rayita.
    if ((fila - scene.sim.gateRow) * abajo < 0) continue;
    if (enElHilo(yn)) {
      const medio = medioDelCuello(geo.radio, yn, vw);
      const r = Math.max(0.35, Math.min(hilo * 0.85, size * cellW * 0.55));
      const xG = Math.max(cx - medio + r, Math.min(cx + medio - r, x));
      g.beginPath();
      g.ellipse(xG, y, r, r * 1.35, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      const radius = Math.max(0.6, size * cellW * 1.15);
      g.beginPath();
      g.ellipse(x, y, radius, Math.max(radius, size * cellH * 0.9), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(geo.mascara, 0, 0, caja.w, caja.h);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(hoja, caja.x, caja.y, caja.w, caja.h);
}

let marcasGarganta: Uint32Array | null = null;
let colaGarganta: Int32Array | null = null;
let selloGarganta = 1;

/** Borra los granos de la garganta que no llegan al montón. No cambia las celdas. */
function taparGarganta(
  g: CanvasRenderingContext2D,
  scene: ArenaPintada,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): void {
  const sim = scene.sim;
  const cols = sim.cols;
  const rows = sim.rows;
  const cells = sim.cells;
  const mask = sim.mask;
  const gate = sim.gateRow;
  const dir = scene.abajo ?? 1;
  if (cols < 3 || rows < 3 || !(vw > 0) || !(vh > 0)) return;
  const n = cols * rows;
  if (!marcasGarganta || marcasGarganta.length < n || !colaGarganta) {
    marcasGarganta = new Uint32Array(n);
    colaGarganta = new Int32Array(n);
    selloGarganta = 1;
  }
  if (selloGarganta === 0xffffffff) {
    marcasGarganta.fill(0);
    selloGarganta = 1;
  }
  const marcas = marcasGarganta;
  const cola = colaGarganta;
  const sello = selloGarganta;
  const enBanda = (fila: number) => {
    const d = (gate - fila) * dir;
    return d >= 1 && d <= FRANJA_GARGANTA;
  };
  const fuera = gate - dir * (FRANJA_GARGANTA + 1);
  let qc = 0;
  if (fuera >= 0 && fuera < rows) {
    for (let col = 0; col < cols; col++) {
      const i = fuera * cols + col;
      if ((cells[i] ?? 0) === 0 || mask[i] !== 1) continue;
      marcas[i] = sello;
      cola[qc] = i;
      qc += 1;
    }
  }
  for (let q = 0; q < qc; q++) {
    const i = cola[q] ?? 0;
    const col = i % cols;
    const fila = (i - col) / cols;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dr === 0) continue;
        const nf = fila + dr;
        const nc = col + dc;
        if (nc < 0 || nc >= cols || nf < 0 || nf >= rows || !enBanda(nf)) continue;
        const j = nf * cols + nc;
        if (marcas[j] === sello || (cells[j] ?? 0) === 0 || mask[j] !== 1) continue;
        marcas[j] = sello;
        cola[qc] = j;
        qc += 1;
      }
    }
  }
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  const alto = vh / rows;
  const ancho = vw / cols;
  for (let d = 1; d <= FRANJA_GARGANTA; d++) {
    const fila = gate - dir * d;
    if (fila < 0 || fila >= rows) continue;
    const y = vy + (fila / rows) * vh;
    for (let col = 0; col < cols; col++) {
      const i = fila * cols + col;
      if ((cells[i] ?? 0) === 0 || mask[i] !== 1 || marcas[i] === sello) continue;
      g.fillRect(vx + (col / cols) * vw, y, ancho, alto);
    }
  }
  g.restore();
  selloGarganta = sello + 1;
}

/**
 * Máscara que sube desde la base de cada bulbo hasta su superficie.
 * y del lienzo crece hacia abajo: lo visible queda por debajo de la línea.
 */
function revelarLlenado(
  g: CanvasRenderingContext2D,
  scene: ArenaPintada,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): void {
  const llenado = scene.llenado;
  if (!llenado) return;
  const rows = scene.sim.rows;
  const gate = scene.sim.gateRow;
  if (rows < 3) return;
  const yDe = (fila: number) => vy + ((fila + 0.5) / rows) * vh;
  const yCuello = yDe(gate);
  g.save();
  g.globalAlpha = 1;
  // Se borra lo que queda por encima de la línea. Con p = 0 el montón
  // entero desaparece; no depende de que un degradado tape el lienzo.
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  const tapar = (yTecho: number, yBase: number, ySup: number) => {
    const alto = yBase - ySup;
    if (!(alto > 0)) return;
    const suave = Math.max(BORDE_MIN_PX, alto * BORDE_LLENADO);
    const yLinea = yBase - alto * llenado.p;
    const ySolido = Math.max(yTecho, yLinea - suave);
    if (ySolido > yTecho) g.fillRect(vx, yTecho, vw, ySolido - yTecho);
    const y0 = Math.max(yTecho, yLinea - suave);
    const y1 = Math.min(yBase, yLinea);
    if (y1 - y0 > 0.5) {
      const grad = g.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, '#000');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.fillRect(vx, y0, vw, y1 - y0);
      g.fillStyle = '#000';
    }
  };
  if (llenado.supArriba < gate) tapar(vy, yDe(gate - 1), yDe(llenado.supArriba));
  if (llenado.supAbajo < rows) tapar(yCuello, yDe(rows - 1), yDe(llenado.supAbajo));
  g.restore();
}

/**
 * La rejilla pinta cada celda entera y deja un peldaño contra el vidrio.
 * En el embudo se recorta lo que sale de la pared y, si la arena ya llegaba,
 * se rellena ese peldaño. Debajo del hueco el chorro se estrecha al hilo.
 * Encima, solo se recorta a la pared: el pico es la arena que hay, y al
 * inclinar se va con ella. La simulación no se toca.
 */
function perfilarEmbudo(
  g: CanvasRenderingContext2D,
  scene: ArenaPintada,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): void {
  const cols = scene.sim.cols;
  const rows = scene.sim.rows;
  const lectura = scene.sand.getContext('2d');
  if (!lectura || cols < 3 || rows < 3) return;
  const mapa = lectura.getImageData(0, 0, cols, rows).data;
  const geo = scene.geo;
  const cx = vx + vw / 2;
  const altoFila = vh / rows;
  const anchoCelda = vw / cols;
  const margen = anchoCelda * PELDAÑO_CELDAS;
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  for (let row = 0; row < rows; row++) {
    const yn = ((row + 0.5) / rows) * 2 - 1;
    if (Math.abs(yn) > EMBUDO_Y) continue;
    const fila = row * cols;
    let izquierda = -1;
    let derecha = -1;
    for (let col = 0; col < cols; col++) {
      if ((mapa[(fila + col) * 4 + 3] ?? 0) === 0) continue;
      if (izquierda < 0) izquierda = col;
      derecha = col;
    }
    if (izquierda < 0 || derecha < 0) continue;
    const arriba = (scene.abajo ?? 1) > 0 ? yn < 0 : yn > 0;
    const medio = arriba ? geo.radio(yn) * (vw / 2) : medioDelCuello(geo.radio, yn, vw);
    const x0 = cx - medio;
    const x1 = cx + medio;
    const y = vy + (row / rows) * vh;
    const pixL = vx + izquierda * anchoCelda;
    const pixR = vx + (derecha + 1) * anchoCelda;
    g.globalCompositeOperation = 'destination-out';
    if (pixL < x0) g.fillRect(pixL, y, x0 - pixL, altoFila);
    if (pixR > x1) g.fillRect(x1, y, pixR - x1, altoFila);
    g.globalCompositeOperation = 'source-over';
    if (x0 < pixL && pixL - x0 <= margen) {
      g.drawImage(scene.sand, izquierda, row, 1, 1, x0, y, pixL - x0, altoFila);
    }
    if (pixR < x1 && x1 - pixR <= margen) {
      g.drawImage(scene.sand, derecha, row, 1, 1, pixR, y, x1 - pixR, altoFila);
    }
  }
  g.restore();
}

let telaSombra: HTMLCanvasElement | null = null;
let telaBrillo: HTMLCanvasElement | null = null;
let datosSombra: ImageData | null = null;
let datosBrillo: ImageData | null = null;

function pasoEje(v: number): -1 | 0 | 1 {
  if (v > 0.2) return 1;
  if (v < -0.2) return -1;
  return 0;
}

/**
 * Sombreado de Arena oscuro. La foto tiene esferas cálidas: una a la izquierda,
 * a la altura de la arena, y otras detrás de las rocas a la derecha. Entran de
 * lado y un poco desde abajo. Solo color: no mueve granos. Clásico y Arena
 * claro no llegan aquí (`luzGrano` es null).
 */
/** Cada celda hacia la sombra de la clave. El tope evita un pozo negro. */
const SOMBRA_PASO = 0.055;
const SOMBRA_TOPE = 6;
/** De un grano al vecino, para que el montón no sea un bloque. */
const GRANO_PASO = 0.032;
/** Cara que mira a la clave, a la derecha (rim) y hacia abajo (esfera baja). */
const CARA_CLAVE = 0.08;
const VIDRIO_CONTACTO = 0.035;
/** Suelo del multiplicador: por debajo el caqui se apaga. */
const VALOR_MIN = 0.78;
const VALOR_MAX = 1;
/**
 * Multiplicación casi blanca y solo un poco cálida. 214/160 teñía de naranja
 * y, con el valor bajo, dejaba la arena plana y oscura.
 */
const TINT_R = 255;
const TINT_G = 246;
const TINT_B = 232;
/**
 * Filas junto al cuello sin velo de brillo. Ahí una celda es toda la punta:
 * el screen, al filtrarse, era el punto brillante y la mancha.
 */
const FILAS_SIN_BRILLO = 5;
/** Screen. Sube la luz general sin quemar; la clave y el rim suman encima. */
const BRILLO_BASE = 34;
const BRILLO_CLAVE = 64;
const BRILLO_RIM = 36;
const BRILLO_BAJO = 22;
const BRILLO_TOPE = 140;
const BRILLO_R = 255;
const BRILLO_G = 220;
const BRILLO_B = 184;

function sombrearGranos(
  g: CanvasRenderingContext2D,
  ctx: CanvasRenderingContext2D,
  scene: ArenaPintada,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): void {
  if (luzGrano === null || vw < 2 || vh < 2) return;
  const { sim } = scene;
  const cols = sim.cols;
  const rows = sim.rows;
  if (cols < 2 || rows < 2) return;
  if (!telaSombra || telaSombra.width !== cols || telaSombra.height !== rows) {
    telaSombra = document.createElement('canvas');
    telaSombra.width = cols;
    telaSombra.height = rows;
    telaBrillo = document.createElement('canvas');
    telaBrillo.width = cols;
    telaBrillo.height = rows;
    datosSombra = null;
    datosBrillo = null;
  }
  const sg = telaSombra.getContext('2d');
  const bg = telaBrillo?.getContext('2d');
  if (!sg || !bg || !telaBrillo) return;
  if (!datosSombra) datosSombra = sg.createImageData(cols, rows);
  if (!datosBrillo) datosBrillo = bg.createImageData(cols, rows);
  datosSombra.data.fill(0);
  datosBrillo.data.fill(0);

  const trazo = ctx.getTransform();
  const angulo = Math.atan2(trazo.b, trazo.a);
  const rad = (luzGrano * Math.PI) / 180 - angulo;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);
  let sx = pasoEje(lx);
  let sy = pasoEje(ly);
  if (sx === 0 && sy === 0) {
    if (Math.abs(lx) >= Math.abs(ly)) sx = lx >= 0 ? 1 : -1;
    else sy = ly >= 0 ? 1 : -1;
  }

  const cells = sim.cells;
  const mask = sim.mask;
  const fondo = new Int16Array(cols * rows);
  const colDesde = sx > 0 ? cols - 1 : 0;
  const colHasta = sx > 0 ? -1 : cols;
  const colPaso = sx > 0 ? -1 : 1;
  const filaDesde = sy > 0 ? rows - 1 : 0;
  const filaHasta = sy > 0 ? -1 : rows;
  const filaPaso = sy > 0 ? -1 : 1;
  const sd = datosSombra.data;
  const bd = datosBrillo.data;

  for (let row = filaDesde; row !== filaHasta; row += filaPaso) {
    for (let col = colDesde; col !== colHasta; col += colPaso) {
      const i = row * cols + col;
      const tono = cells[i] ?? 0;
      if (tono === 0) continue;
      const nx = col + sx;
      const ny = row + sy;
      const dentro = nx >= 0 && ny >= 0 && nx < cols && ny < rows;
      const vecino = dentro ? (cells[ny * cols + nx] ?? 0) : 0;
      const cara = !dentro || vecino === 0;
      const profundo = dentro && vecino !== 0 ? Math.min(8, (fondo[ny * cols + nx] ?? 0) + 1) : 0;
      fondo[i] = profundo;
      let vidrio = false;
      if (
        col === 0 ||
        row === 0 ||
        col === cols - 1 ||
        row === rows - 1 ||
        (mask[i - 1] ?? 0) === 0 ||
        (mask[i + 1] ?? 0) === 0 ||
        (mask[i - cols] ?? 0) === 0 ||
        (mask[i + cols] ?? 0) === 0
      ) {
        vidrio = true;
      }
      const ox = col - sx;
      const oy = row - sy;
      const rimDentro = ox >= 0 && oy >= 0 && ox < cols && oy < rows;
      const vecinoRim = rimDentro ? (cells[oy * cols + ox] ?? 0) : 0;
      const caraRim = !rimDentro || vecinoRim === 0;
      const by = row + 1;
      const abajoDentro = by >= 0 && by < rows;
      const vecinoAbajo = abajoDentro ? (cells[by * cols + col] ?? 0) : 0;
      const caraBaja = !vidrio && (!abajoDentro || vecinoAbajo === 0);
      const grano = ((tono * 17) % 11) - 5;
      let valor = 1 - Math.min(SOMBRA_TOPE, profundo) * SOMBRA_PASO + grano * GRANO_PASO;
      if (cara) valor += CARA_CLAVE;
      if (vidrio) valor -= VIDRIO_CONTACTO;
      valor = Math.max(VALOR_MIN, Math.min(VALOR_MAX, valor));
      const o = i * 4;
      sd[o] = Math.round(Math.min(255, valor * TINT_R));
      sd[o + 1] = Math.round(Math.min(255, valor * TINT_G));
      sd[o + 2] = Math.round(Math.min(255, valor * TINT_B));
      sd[o + 3] = 255;
      const enPunta = Math.abs(row - (rows - 1) / 2) <= FILAS_SIN_BRILLO;
      let brillo = enPunta ? 0 : BRILLO_BASE;
      if (!enPunta && cara && profundo === 0) brillo += BRILLO_CLAVE;
      if (!enPunta && caraRim) brillo += BRILLO_RIM;
      if (!enPunta && caraBaja) brillo += BRILLO_BAJO;
      brillo = Math.min(BRILLO_TOPE, brillo);
      bd[o] = BRILLO_R;
      bd[o + 1] = BRILLO_G;
      bd[o + 2] = BRILLO_B;
      bd[o + 3] = brillo;
    }
  }

  sg.putImageData(datosSombra, 0, 0);
  bg.putImageData(datosBrillo, 0, 0);
  const modo = g.globalCompositeOperation;
  const suave = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(telaSombra, vx, vy, vw, vh);
  g.globalCompositeOperation = 'screen';
  g.drawImage(telaBrillo, vx, vy, vw, vh);
  g.globalCompositeOperation = modo;
  g.imageSmoothingEnabled = suave;
  g.globalAlpha = 1;
}
