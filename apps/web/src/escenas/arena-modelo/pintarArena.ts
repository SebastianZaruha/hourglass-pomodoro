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
 * El embudo acaba en el labio de arriba. El vidrio del cuello, entre los dos
 * labios, no guarda arena: el vértice de antes pasaba el centro y el
 * rectángulo de debajo conservaba el canal, y esas celdas, al filtrarse,
 * eran la franja y la mancha.
 * El canal de la máscara mide ~3.8% del alto (boca de 20 px en 891).
 */
const CUELLO_HUECO = 0.018;
/** Alto del embudo, por encima del labio. La punta son los últimos granos. */
const EMBUDO = 0.06;
/**
 * Ancho del borrado. La boca mide ~20 px de 891; el hombro, ~67.
 * 0.04 cubre la boca y no muerde el hombro.
 */
const CUELLO_ANCHO = 0.04;

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
   * Revelado tras el giro. `p` va de 0 a 1 con ease-out. Cada bulbo se llena
   * desde su base hasta la superficie. No mueve granos.
   */
  readonly llenado?: {
    readonly p: number;
    /** Fila de la superficie. `gateRow` / `rows` = bulbo vacío. */
    readonly supArriba: number;
    readonly supAbajo: number;
  };
}

let hoja: HTMLCanvasElement | null = null;

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
    revelarLlenado(g, scene, vx, vy, vw, vh);
  }

  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = RUIDO[scene.scheme];
  const pattern = g.createPattern(scene.noise, 'repeat');
  if (pattern) {
    g.fillStyle = pattern;
    g.fillRect(vx, vy, vw, vh);
  }
  g.restore();

  if (!scene.llenado) sombrearGranos(g, ctx, scene, vx, vy, vw, vh);
  afilarCuello(g, geo, caja);

  const cellW = vw / scene.sim.cols;
  const cellH = vh / scene.sim.rows;
  const count = scene.particles.count;
  const cuelloY = geo.cuelloY * caja.h;
  const huecoY = caja.h * CUELLO_HUECO;
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
    if (Math.abs(y - cuelloY) <= huecoY) {
      // En el cuello, un grano cuadrado. La elipse suavizada era un bloque.
      const lado = Math.max(0.45, size * cellW);
      g.fillRect(x - lado / 2, y - lado / 2, lado, lado);
    } else {
      const radius = Math.max(0.6, size * cellW * 1.15);
      g.beginPath();
      g.ellipse(x, y, radius, Math.max(radius, size * cellH * 0.9), 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(geo.mascara, 0, 0, caja.w, caja.h);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(hoja, caja.x, caja.y, caja.w, caja.h);
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
  g.globalCompositeOperation = 'destination-in';
  const pintarBulbo = (yTecho: number, ySuelo: number, yBase: number, ySup: number) => {
    const alto = yBase - ySup;
    if (!(alto > 0.5) || !(ySuelo > yTecho)) return;
    const suave = Math.max(BORDE_MIN_PX, alto * BORDE_LLENADO);
    const yLinea = yBase - (alto + suave) * llenado.p;
    const grad = g.createLinearGradient(0, yLinea - suave, 0, yLinea + suave);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, '#000');
    g.fillStyle = grad;
    g.fillRect(vx, yTecho, vw, ySuelo - yTecho);
  };
  if (llenado.supArriba < gate) {
    pintarBulbo(vy, yCuello, yDe(gate - 1), yDe(llenado.supArriba));
  }
  if (llenado.supAbajo < rows) {
    pintarBulbo(yCuello, vy + vh, yDe(rows - 1), yDe(llenado.supAbajo));
  }
  g.restore();
}

function afilarCuello(
  g: CanvasRenderingContext2D,
  geo: GeometriaFrasco,
  caja: { readonly w: number; readonly h: number },
): void {
  const cuello = geo.cuelloY * caja.h;
  const hueco = caja.h * CUELLO_HUECO;
  const yPunta = cuello - hueco;
  const yAbajo = cuello + hueco;
  const y0 = yPunta - caja.h * EMBUDO;
  if (!(y0 > 0) || !(yAbajo < caja.h)) return;
  const cx = caja.w * 0.5;
  g.save();
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = '#000';
  g.beginPath();
  g.rect(0, 0, caja.w, y0);
  g.moveTo(cx, yPunta);
  g.lineTo(cx - caja.w, y0);
  g.lineTo(cx + caja.w, y0);
  g.closePath();
  g.rect(0, yAbajo, caja.w, caja.h - yAbajo);
  g.fill();
  g.restore();
  // La punta antialias del cono dejaba una mancha dentro del cuello.
  // Se borra el hueco; el chorro se pinta después y no entra en este corte.
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const ancho = caja.w * CUELLO_ANCHO;
  const yHueco = yPunta + caja.h * 0.003;
  g.fillRect(cx - ancho / 2, yHueco, ancho, Math.max(0, yAbajo - yHueco));
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
