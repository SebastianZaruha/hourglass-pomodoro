// @ts-nocheck — el módulo llega con índices sin comprobar. No se reescribe su cálculo.
// Gotas finas que caen del cuello. Todo vive en arrays creados una vez (una "piscina"):
// una gota nueva reutiliza un hueco libre, así no se crea basura en cada frame.
import { superficieEn, type BulboMundo, type Gradientes } from './bulbo';
import { trazarPoligono } from './geometria';

/** Máximo de gotas y de ondas a la vez. */
const MAX_GOTAS = 48;
const MAX_ONDAS = 16;
/** Gotas por segundo con caudal 1 (y con "reducir movimiento" activado en el sistema). */
const GOTAS_POR_SEG = 18;
const GOTAS_POR_SEG_REDUCIDO = 5;
/** Gravedad en px/s² y velocidad de salida del cuello. */
const GRAVEDAD = 1100;
const VEL_SALIDA = 60;
/** Vida de la ondita al caer (s) y cuánto crece (px/s). */
const VIDA_ONDA = 0.35;
const CRECE_ONDA = 26;

export interface PiscinaGotas {
  x: Float32Array; y: Float32Array; v: Float32Array; viva: Uint8Array;
  ox: Float32Array; oy: Float32Array; edad: Float32Array; onda: Uint8Array;
  pendientes: number; // fracción de gota acumulada para el próximo nacimiento
}

export function crearPiscina(): PiscinaGotas {
  return {
    x: new Float32Array(MAX_GOTAS), y: new Float32Array(MAX_GOTAS), v: new Float32Array(MAX_GOTAS),
    viva: new Uint8Array(MAX_GOTAS),
    ox: new Float32Array(MAX_ONDAS), oy: new Float32Array(MAX_ONDAS), edad: new Float32Array(MAX_ONDAS),
    onda: new Uint8Array(MAX_ONDAS),
    pendientes: 0,
  };
}

/** Lo que necesitan las gotas de este frame (lo rellena agua-vidrio.ts). */
export interface ContextoGotas {
  /** Bulbo que está abajo en el mundo (donde caen) y su índice. */
  destino: BulboMundo;
  indice: 0 | 1;
  /** Cuello en el mundo. */
  cx: number; cy: number;
  alfa: number;
  reducido: boolean;
  alCaer?: (bulbo: 0 | 1, u: number, fuerza: number) => void;
}

export function moverYPintarGotas(
  ctx: CanvasRenderingContext2D, p: PiscinaGotas, c: ContextoGotas, caudal: number, dtMs: number, g: Gradientes,
): void {
  const dt = Math.min(dtMs, 50) / 1000; // tras una pestaña en segundo plano, no saltar de golpe
  const d = c.destino;

  // Solo nacen gotas si el cuello está claramente por encima del bulbo de destino (no con el frasco tumbado).
  const centro = (d.yMin + d.yMax) / 2;
  const porEncima = centro - c.cy > 0.25 * (d.yMax - d.yMin);
  if (caudal > 0 && porEncima) {
    p.pendientes += caudal * (c.reducido ? GOTAS_POR_SEG_REDUCIDO : GOTAS_POR_SEG) * dt;
    for (let i = 0; i < MAX_GOTAS && p.pendientes >= 1; i++) {
      if (p.viva[i]) continue;
      p.viva[i] = 1;
      p.x[i] = c.cx + (Math.random() - 0.5) * 2;
      p.y[i] = c.cy;
      p.v[i] = VEL_SALIDA * (0.7 + Math.random() * 0.6);
      p.pendientes -= 1;
    }
    if (p.pendientes > 1) p.pendientes = 1; // piscina llena: no acumular deuda
  }

  ctx.save();
  ctx.globalAlpha = c.alfa;
  trazarPoligono(ctx, d.pts);
  ctx.clip(); // las gotas nunca se salen del vidrio, gire como gire

  ctx.fillStyle = g.gota;
  for (let i = 0; i < MAX_GOTAS; i++) {
    if (!p.viva[i]) continue;
    p.v[i] += GRAVEDAD * dt;
    p.y[i] += p.v[i] * dt;
    const suelo = d.visible ? superficieEn(d, p.x[i]) : d.yMax;
    if (p.y[i] >= suelo) {
      p.viva[i] = 0;
      if (d.visible) nuevaOnda(p, p.x[i], suelo);
      if (c.alCaer && d.xDer > d.xIzq) {
        c.alCaer(c.indice, (p.x[i] - d.xIzq) / (d.xDer - d.xIzq), Math.min(1, p.v[i] / 700));
      }
      continue;
    }
    // Estela: el gradiente unidad 0..1 se estira a lo largo de la gota.
    const largo = Math.min(14, 3 + p.v[i] * 0.02);
    ctx.save();
    ctx.translate(p.x[i], p.y[i] - largo);
    ctx.scale(1, largo);
    ctx.fillRect(-0.6, 0, 1.2, 1);
    ctx.restore();
  }
  // Cabezas brillantes, en una segunda pasada para cambiar de color una sola vez.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  for (let i = 0; i < MAX_GOTAS; i++) {
    if (p.viva[i]) ctx.fillRect(p.x[i] - 0.75, p.y[i] - 1.5, 1.5, 1.5);
  }

  // Onditas donde caen: elipses que crecen y se apagan.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < MAX_ONDAS; i++) {
    if (!p.onda[i]) continue;
    p.edad[i] += dt;
    if (p.edad[i] >= VIDA_ONDA) { p.onda[i] = 0; continue; }
    const r = 1 + p.edad[i] * CRECE_ONDA;
    ctx.globalAlpha = c.alfa * 0.6 * (1 - p.edad[i] / VIDA_ONDA);
    ctx.beginPath();
    ctx.ellipse(p.ox[i], p.oy[i], r, r * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function nuevaOnda(p: PiscinaGotas, x: number, y: number): void {
  for (let i = 0; i < MAX_ONDAS; i++) {
    if (p.onda[i]) continue;
    p.onda[i] = 1; p.ox[i] = x; p.oy[i] = y; p.edad[i] = 0;
    return;
  }
}
