// @ts-nocheck — el módulo llega con índices sin comprobar. No se reescribe su cálculo.
// Un bulbo de agua: geometría en el mundo de este frame + cómo se pinta.
import { corteHorizontal, interpolar, transformarPoligono, trazarPoligono } from './geometria';
import type { CopiasFondo } from './fondo';
import type { EstadoBulbo, Matriz2D, Poligono } from './tipos';

// ── Valores para ajustar el aspecto ─────────────────────────────────────────────
/** Tiras verticales de refracción. Más = curva más fina, más coste. */
export const TIRAS = 64;
/** < 1: el agua hace de lupa y agranda lo de detrás. 1 = sin aumento. */
const AUMENTO = 0.86;
/** Px que se tuerce el fondo por cada unidad de pendiente de la ola. */
const REFRACCION = 14;
/** 0..1: cuánto sube y baja el fondo con la ola (efecto lente bajo la superficie). */
const SIGUE_OLA = 0.7;
/**
 * Velo del agua "un poco opaca": gris claro arriba y más oscuro en el fondo (volumen).
 * Gris neutro (R = G = B): nada de azul. Son un velo 0,12 y un negro 0,24 ya combinados en uno.
 */
const VELO_ARRIBA = 'rgba(232, 232, 232, 0.12)';
const VELO_FONDO = 'rgba(64, 64, 64, 0.33)';
/** Luz suave del agua contra la pared del vidrio (borde interior). */
const BORDE = 0.08;
const BORDE_GROSOR = 10;
/** Línea de brillo de la superficie: opacidad y grosor (px). */
const BRILLO = 0.9;
const BRILLO_GROSOR = 1.1;
/** Banda clara justo bajo la superficie. */
const BANDA = 0.2;
const BANDA_GROSOR = 3;
const BANDA_BAJADA = 2.5;
/** Menisco: cuánto sube por el vidrio y cuánto entra hacia dentro (px). */
const MENISCO_ALTO = 3.5;
const MENISCO_ANCHO = 7;
/**
 * Resolución de la capa del agua, en px por px CSS. Lo que va en ella ya es borroso, así que
 * a media resolución no se nota y cuesta 4 veces menos (en un móvil a 3×, 36 veces menos que a pantalla completa).
 */
const CAPA_ESCALA = 0.5;
/** Desenfoque (px) con el que ya usamos solo la copia más borrosa. */
export const DESENFOQUE_MAX = 8;

/** Lo que sabemos de un bulbo en el frame actual, todo en coordenadas del mundo. */
export interface BulboMundo {
  frasco: Poligono;
  pts: Float32Array;
  xMin: number; xMax: number; yMin: number; yMax: number;
  nivel: number;
  /** Paredes en la línea de agua en reposo (NaN si el bulbo está lleno o vacío). */
  xIzq: number; xDer: number;
  /** y de la superficie en cada borde de tira (TIRAS + 1 valores). */
  sup: Float32Array;
  /** La y más alta de la superficie (la cresta), sin salir del bulbo. */
  techo: number;
  /** false si no hay agua que pintar. */
  visible: boolean;
  /**
   * Capa pequeña (CAPA_ESCALA px por px CSS) donde se pinta todo lo "borroso": fondo en tiras, velo, volumen.
   * Así el trabajo caro no se multiplica por el devicePixelRatio (×9 en un móvil a 3×);
   * luego se pega una sola vez, recortada a resolución completa.
   */
  capa: HTMLCanvasElement;
  capaCtx: CanvasRenderingContext2D;
  cx0: number; cy0: number; // esquina de la capa en el mundo
  capaAncho: number; capaAlto: number; // parte usada de la capa este frame, en px de la capa
}

export function crearBulbo(frasco: Poligono): BulboMundo {
  const capa = document.createElement('canvas');
  return {
    frasco, pts: new Float32Array(frasco.length),
    xMin: 0, xMax: 0, yMin: 0, yMax: 0, nivel: 0, xIzq: NaN, xDer: NaN,
    sup: new Float32Array(TIRAS + 1), techo: 0, visible: false,
    capa, capaCtx: capa.getContext('2d')!, cx0: 0, cy0: 0, capaAncho: 0, capaAlto: 0,
  };
}

/** Coloca el bulbo en el mundo y calcula la curva de la superficie. */
export function prepararBulbo(b: BulboMundo, m: Matriz2D, estado: EstadoBulbo): void {
  transformarPoligono(b.frasco, m, b.pts);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < b.pts.length; i += 2) {
    const x = b.pts[i], y = b.pts[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  b.xMin = x0; b.xMax = x1; b.yMin = y0; b.yMax = y1;
  b.cx0 = Math.floor(x0) - 1; b.cy0 = Math.floor(y0) - 1;
  b.capaAncho = Math.ceil((x1 + 2 - b.cx0) * CAPA_ESCALA);
  b.capaAlto = Math.ceil((y1 + 2 - b.cy0) * CAPA_ESCALA);
  // El canvas de la capa solo crece, y de golpe a la diagonal (cabe en cualquier ángulo):
  // cambiar width/height lo borra y cuesta, así que pasa una vez y no en cada frame.
  if (b.capa.width < b.capaAncho || b.capa.height < b.capaAlto) {
    const lado = Math.ceil(Math.hypot(b.capaAncho, b.capaAlto));
    b.capa.width = lado; b.capa.height = lado;
  }
  b.nivel = estado.nivel;
  b.visible = estado.nivel < y1 - 0.5 && estado.nivel === estado.nivel; // descarta NaN
  if (!b.visible) return;

  // La línea de agua en reposo, de pared a pared. Las alturas se reparten sobre ella.
  b.xIzq = corteHorizontal(b.pts, estado.nivel, -1);
  b.xDer = corteHorizontal(b.pts, estado.nivel, 1);
  // Lleno (o geometría rara): repartimos sobre todo el ancho; la superficie queda fuera del vidrio.
  const izq = b.xIzq === b.xIzq ? b.xIzq : x0;
  const der = b.xDer === b.xDer && b.xDer - izq > 0.5 ? b.xDer : x1;

  const a = estado.alturas;
  const ultimo = a.length - 1;
  const paso = (x1 - x0) / TIRAS;
  for (let k = 0; k <= TIRAS; k++) {
    const x = x0 + k * paso;
    const u = (x - izq) / (der - izq); // 0 en la pared izquierda, 1 en la derecha
    b.sup[k] = estado.nivel - interpolar(a, (u < 0 ? 0 : u > 1 ? 1 : u) * ultimo);
  }
  let techo = b.sup[0];
  for (let k = 1; k <= TIRAS; k++) if (b.sup[k] < techo) techo = b.sup[k];
  b.techo = techo < y0 ? y0 : techo;
}

/** Gradientes que se crean una sola vez, en un espacio "unidad" (0..1); luego se colocan con translate/scale. */
export interface Gradientes {
  /** Vertical 0→1: velo claro → velo oscuro. */
  velo: CanvasGradient;
  /** Horizontal 0→1: se apaga hacia las paredes. */
  brillo: CanvasGradient;
  /** Radial de radio 1 para el menisco. */
  menisco: CanvasGradient;
  /** Vertical 0→1 para la estela de las gotas: transparente → blanco. */
  gota: CanvasGradient;
}

export function crearGradientes(ctx: CanvasRenderingContext2D): Gradientes {
  const velo = ctx.createLinearGradient(0, 0, 0, 1);
  velo.addColorStop(0, VELO_ARRIBA);
  velo.addColorStop(1, VELO_FONDO);
  const brillo = ctx.createLinearGradient(0, 0, 1, 0);
  brillo.addColorStop(0, 'rgba(255, 255, 255, 0)');
  brillo.addColorStop(0.25, 'rgba(255, 255, 255, 0.55)');
  brillo.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
  brillo.addColorStop(0.75, 'rgba(255, 255, 255, 0.55)');
  brillo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  const menisco = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  menisco.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  menisco.addColorStop(1, 'rgba(255, 255, 255, 0)');
  const gota = ctx.createLinearGradient(0, 0, 0, 1);
  gota.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gota.addColorStop(1, 'rgba(255, 255, 255, 0.55)');
  return { velo, brillo, menisco, gota };
}

/** Traza la curva de la superficie bajada `dy` px (sin cerrar). */
function trazarSuperficie(ctx: CanvasRenderingContext2D, b: BulboMundo, dy: number): void {
  const paso = (b.xMax - b.xMin) / TIRAS;
  ctx.beginPath();
  ctx.moveTo(b.xMin, b.sup[0] + dy);
  for (let k = 1; k <= TIRAS; k++) ctx.lineTo(b.xMin + k * paso, b.sup[k] + dy);
}

/**
 * Pinta el bulbo. `mezcla` (0..1) es cuánto usamos la copia más borrosa (media vuelta)
 * y `alfa` la opacidad del frasco.
 */
export function pintarBulbo(
  ctx: CanvasRenderingContext2D, b: BulboMundo, alturas: ArrayLike<number>,
  fondo: CopiasFondo, g: Gradientes, mezcla: number, alfa: number, refraccion = true,
  cuello?: { x: number; y: number },
): void {
  if (!b.visible) return;
  pintarCapa(b, fondo, g, mezcla, refraccion);

  ctx.save();
  trazarPoligono(ctx, b.pts);
  ctx.clip(); // 1) solo dentro del vidrio
  if (cuello) recortarPico(ctx, b.pts, cuello.x, cuello.y);

  ctx.save();
  trazarSuperficie(ctx, b, 0);
  ctx.lineTo(b.xMax, b.yMax + 1);
  ctx.lineTo(b.xMin, b.yMax + 1);
  ctx.closePath();
  ctx.clip(); // 2) y solo por debajo de la ola
  ctx.globalAlpha = alfa;
  // Una sola copia de la capa, estirada a su tamaño real. El recorte va a resolución completa: bordes nítidos.
  // Solo copiamos desde la cresta más alta hacia abajo: lo de encima no se vería.
  const k = CAPA_ESCALA;
  const desde = Math.max(0, Math.floor((b.techo - 2 - b.cy0) * k));
  const filas = b.capaAlto - desde;
  if (filas > 0) {
    ctx.drawImage(b.capa, 0, desde, b.capaAncho, filas, b.cx0, b.cy0 + desde / k, b.capaAncho / k, filas / k);
  }
  ctx.restore(); // fuera el recorte de la ola; seguimos dentro del vidrio

  // Brillo de la superficie y banda clara debajo, a resolución completa para que salgan finos.
  const L = b.xDer - b.xIzq;
  if (L > 1) {
    const apagado = 1 - 0.6 * mezcla; // con desenfoque, brillos más anchos y suaves
    const grosor = 1 + 2 * mezcla;
    // Escala UNIFORME L×L: el gradiente horizontal 0..1 cae justo de pared a pared
    // y el grosor de línea se divide por L para seguir midiendo lo mismo en px.
    trazarSuperficie(ctx, b, BANDA_BAJADA);
    ctx.save();
    ctx.translate(b.xIzq, 0);
    ctx.scale(L, L);
    ctx.strokeStyle = g.brillo;
    ctx.globalAlpha = alfa * BANDA * apagado;
    ctx.lineWidth = (BANDA_GROSOR * grosor) / L;
    ctx.stroke();
    ctx.restore();

    trazarSuperficie(ctx, b, 0);
    ctx.save();
    ctx.translate(b.xIzq, 0);
    ctx.scale(L, L);
    ctx.strokeStyle = g.brillo;
    ctx.globalAlpha = alfa * BRILLO * apagado;
    ctx.lineWidth = (BRILLO_GROSOR * grosor) / L;
    ctx.stroke();
    ctx.restore();

    pintarMenisco(ctx, b, b.nivel - alturas[0], -1, g, alfa * apagado);
    pintarMenisco(ctx, b, b.nivel - alturas[alturas.length - 1], 1, g, alfa * apagado);
  }
  ctx.restore();
}

/** Lo borroso del agua, en la capa pequeña: fondo refractado en tiras, velo y borde interior. Sin recortes. */
function pintarCapa(b: BulboMundo, fondo: CopiasFondo, g: Gradientes, mezcla: number, refraccion: boolean): void {
  const c = b.capaCtx;
  const paso = (b.xMax - b.xMin) / TIRAS;
  const yFin = b.yMax + 1;
  const k = CAPA_ESCALA;
  c.setTransform(k, 0, 0, k, -b.cx0 * k, -b.cy0 * k); // la capa usa coordenadas del mundo
  c.clearRect(b.cx0, b.cy0, b.xMax - b.cx0 + 2, b.yMax - b.cy0 + 2);

  // Refracción: el fondo borroso en tiras verticales, cada una algo desplazada según la ola.
  if (fondo.listo) {
    const cx = (b.xMin + b.xMax) / 2;
    const eb = fondo.escalaBajo, em = fondo.escalaMuyBajo;
    // Sin refracción: misma copia borrosa, recta (sin lupa, sin desvío, sin seguir la ola).
    const aumento = refraccion ? AUMENTO : 1, desvio = refraccion ? REFRACCION : 0, sigue = refraccion ? SIGUE_OLA : 0;
    let xa = Math.round(b.xMin * k) / k;
    for (let i = 0; i < TIRAS; i++) {
      // Bordes en px enteros de la capa: tiras pegadas sin solaparse, así no se ven costuras.
      const xb = Math.round((b.xMin + (i + 1) * paso) * k) / k;
      const w = xb - xa;
      if (w <= 0) continue;
      const s0 = b.sup[i], s1 = b.sup[i + 1];
      const arriba = (s0 < s1 ? s0 : s1) - 1;
      const alto = yFin - arriba;
      if (alto > 0) {
        const pendiente = (s1 - s0) / paso;
        const ola = b.nivel - (s0 + s1) / 2; // > 0 en la cresta
        // Lupa centrada en (cx, nivel) + desvío por pendiente + el fondo acompaña a la ola.
        const sx = cx + (xa - cx) * aumento + pendiente * desvio;
        const sy = b.nivel + (arriba - b.nivel) * aumento + ola * sigue;
        const sw = w * aumento, sh = alto * aumento;
        if (mezcla < 1) {
          c.globalAlpha = 1;
          c.drawImage(fondo.bajo, sx / eb, sy / eb, sw / eb, sh / eb, xa, arriba, w, alto);
        }
        if (mezcla > 0) {
          c.globalAlpha = mezcla; // fundido hacia la copia más borrosa
          c.drawImage(fondo.muyBajo, sx / em, sy / em, sw / em, sh / em, xa, arriba, w, alto);
        }
      }
      xa = xb;
    }
    c.globalAlpha = 1;
  }

  // Velo: claro bajo la superficie, más oscuro hacia el fondo.
  const techo = b.techo;
  if (yFin - techo > 1) {
    c.save();
    c.translate(0, techo);
    c.scale(1, yFin - techo); // el gradiente unidad 0..1 pasa a ir de la superficie al fondo
    c.fillStyle = g.velo;
    c.fillRect(b.xMin, 0, b.xMax - b.xMin, 1);
    c.restore();
  }

  // Borde interior claro: el trazo del vidrio, ancho y casi transparente (lo de fuera lo quita el recorte).
  trazarPoligono(c, b.pts);
  c.strokeStyle = 'rgba(255, 255, 255, 1)';
  c.globalAlpha = BORDE;
  c.lineWidth = BORDE_GROSOR;
  c.stroke();
  c.globalAlpha = 1;
}

/** Arco claro donde el agua toca la pared: sube unos px por el vidrio. lado -1 = pared izquierda. */
function pintarMenisco(
  ctx: CanvasRenderingContext2D, b: BulboMundo, y: number, lado: -1 | 1, g: Gradientes, alfa: number,
): void {
  const x = corteHorizontal(b.pts, y, lado);
  if (x !== x) return;
  ctx.globalAlpha = alfa;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(MENISCO_ANCHO, MENISCO_ANCHO);
  ctx.fillStyle = g.menisco;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x - lado * MENISCO_ANCHO, y);
  ctx.quadraticCurveTo(x - lado, y, x + lado, y - MENISCO_ALTO);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * En el cuello el agua acaba en un punto. El recorte es un cono desde el
 * centro del cuello hasta la pared, y el resto del bulbo se queda igual.
 * Las gotas, que se pintan después, son el hilo. No mueve el nivel.
 */
function recortarPico(ctx, pts, nx, ny) {
  const n = pts.length;
  if (n < 6) return;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 2) {
    sx += pts[i];
    sy += pts[i + 1];
  }
  const c = n / 2;
  sx /= c;
  sy /= c;
  let dx = sx - nx;
  let dy = sy - ny;
  const largo = Math.hypot(dx, dy);
  if (!(largo > 1)) return;
  dx /= largo;
  dy /= largo;
  const eje = (i) => (pts[i] - nx) * dx + (pts[i + 1] - ny) * dy;
  let maxT = 0;
  for (let i = 0; i < n; i += 2) {
    const t = eje(i);
    if (t > maxT) maxT = t;
  }
  // La franja del cuello, no el bulbo. 0,12 del eje cae donde el vidrio ya abre.
  const L = maxT * 0.12;
  if (!(L > 4)) return;
  const cortes = [];
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    const t0 = eje(i);
    const t1 = eje(j);
    if (!((t0 < L && t1 >= L) || (t1 < L && t0 >= L))) continue;
    const f = (L - t0) / (t1 - t0 || 1);
    const x = pts[i] + (pts[j] - pts[i]) * f;
    const y = pts[i + 1] + (pts[j + 1] - pts[i + 1]) * f;
    cortes.push({ i, x, y, s: -dy * (x - nx) + dx * (y - ny), lejos: t1 >= L ? j : i });
  }
  if (cortes.length < 2) return;
  let izq = cortes[0];
  let der = cortes[0];
  for (let k = 1; k < cortes.length; k++) {
    if (cortes[k].s < izq.s) izq = cortes[k];
    if (cortes[k].s > der.s) der = cortes[k];
  }
  if (!(der.s - izq.s > 1)) return;
  let paso = 0;
  for (const candidato of [2, -2]) {
    let i = izq.lejos;
    let vale = false;
    for (let k = 0; k < c + 2; k++) {
      if (i === der.lejos || i === der.i) { vale = true; break; }
      const sig = (i + candidato + n) % n;
      if (eje(sig) < L - 0.5 && sig !== der.lejos && sig !== der.i) break;
      i = sig;
    }
    if (vale) { paso = candidato; break; }
  }
  if (paso === 0) return;
  ctx.beginPath();
  ctx.moveTo(nx, ny);
  ctx.lineTo(izq.x, izq.y);
  let i = izq.lejos;
  for (let k = 0; k < c + 2; k++) {
    ctx.lineTo(pts[i], pts[i + 1]);
    if (i === der.lejos) break;
    i = (i + paso + n) % n;
  }
  ctx.lineTo(der.x, der.y);
  ctx.closePath();
  ctx.clip();
}

/** y de la superficie en una x del mundo (para que las gotas sepan dónde caen). */
export function superficieEn(b: BulboMundo, x: number): number {
  const t = ((x - b.xMin) / (b.xMax - b.xMin)) * TIRAS;
  if (!(t >= 0 && t <= TIRAS)) return b.yMax;
  const i = Math.min(TIRAS - 1, Math.floor(t));
  const f = t - i;
  return b.sup[i] * (1 - f) + b.sup[i + 1] * f;
}
