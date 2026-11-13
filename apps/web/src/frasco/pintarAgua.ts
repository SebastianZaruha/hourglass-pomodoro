import { PINTURA } from '../estilo/tokens';
import type { Caja } from '../layout/calcularLayout';
import type { Geometria } from './geometria';
import { GOTAS, cercaDeLaVertical, pasoGotas } from './fisica/gotas';
import { corteDeBulbo } from './fisica/superficie';

export interface AguaFrame {
  readonly frasco: Caja;
  readonly geo: Geometria;
  readonly angulo: number;
  readonly phi: number;
  readonly fraccionArriba: number;
  readonly fraccionAbajo: number;
  readonly oscuro: boolean;
  readonly llueve: boolean;
  readonly dt: number;
  readonly mascara: CanvasImageSource | null;
}

let hoja: HTMLCanvasElement | null = null;
let hojaCtx: CanvasRenderingContext2D | null = null;
let alphaGotas = 0;
let relojGotas = 0;

function placa(w: number, h: number): CanvasRenderingContext2D | null {
  if (!hoja || hoja.width !== w || hoja.height !== h) {
    hoja = document.createElement('canvas');
    hoja.width = w;
    hoja.height = h;
    hojaCtx = hoja.getContext('2d');
  }
  if (!hojaCtx) return null;
  hojaCtx.setTransform(1, 0, 0, 1, 0, 0);
  hojaCtx.globalAlpha = 1;
  hojaCtx.globalCompositeOperation = 'source-over';
  hojaCtx.clearRect(0, 0, w, h);
  return hojaCtx;
}

function poligono(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nx: number,
  ny: number,
  limite: number,
  haciaElNormal: boolean,
): void {
  const s = haciaElNormal ? 1 : -1;
  const tx = ny;
  const ty = -nx;
  const cx = w / 2 + nx * limite;
  const cy = h / 2 + ny * limite;
  const largo = (w + h) * 2;
  ctx.beginPath();
  ctx.moveTo(cx - tx * largo, cy - ty * largo);
  ctx.lineTo(cx + tx * largo, cy + ty * largo);
  ctx.lineTo(cx + tx * largo + nx * s * largo, cy + ty * largo + ny * s * largo);
  ctx.lineTo(cx - tx * largo + nx * s * largo, cy - ty * largo + ny * s * largo);
  ctx.closePath();
}

/** Agua en el mundo: semiplano horizontal, recortado por el cuello y la máscara girada. */
export function pintarAgua(ctx: CanvasRenderingContext2D, frame: AguaFrame): void {
  const { w, h } = frame.frasco;
  const escala = Math.max(1, ctx.getTransform().a || 1);
  const jw = Math.max(2, Math.round(w * escala));
  const jh = Math.max(2, Math.round(h * escala));
  const caja = Math.cos(frame.angulo);
  const saja = Math.sin(frame.angulo);
  const pw = Math.max(jw, Math.ceil(Math.abs(jw * caja) + Math.abs(jh * saja)) + 4);
  const ph = Math.max(jh, Math.ceil(Math.abs(jw * saja) + Math.abs(jh * caja)) + 4);
  const g = placa(pw, ph);
  if (!g || !hoja) return;

  const colores = frame.oscuro ? PINTURA.aguaOscura : PINTURA.agua;
  const menisco = frame.oscuro ? PINTURA.meniscoOscuro : PINTURA.menisco;
  const grad = g.createLinearGradient(0, 0, 0, ph);
  grad.addColorStop(0, colores[0]);
  grad.addColorStop(1, colores[1]);
  const cuello = (frame.geo.cuelloFila + 0.5) / frame.geo.filas;
  const c = Math.cos(frame.angulo);
  const s = Math.sin(frame.angulo);

  const bulbos = [
    { desde: 0, cuenta: frame.geo.puntosArriba, fraccion: frame.fraccionArriba, arriba: true },
    {
      desde: frame.geo.inicioAbajo,
      cuenta: frame.geo.puntosAbajo,
      fraccion: frame.fraccionAbajo,
      arriba: false,
    },
  ] as const;

  let superficieAbajo: number | null = null;
  for (const bulbo of bulbos) {
    const corte = corteDeBulbo(
      frame.geo.puntos,
      bulbo.desde,
      bulbo.cuenta,
      bulbo.fraccion,
      frame.angulo,
      frame.phi,
      jw,
      jh,
    );
    if (corte === null) continue;
    if (!bulbo.arriba) superficieAbajo = ph / 2 + corte * Math.cos(frame.phi);
    g.save();
    poligono(g, pw, ph, -s, c, (cuello - 0.5) * jh, !bulbo.arriba);
    g.clip();
    g.fillStyle = grad;
    const nx = Math.sin(frame.phi);
    const ny = Math.cos(frame.phi);
    poligono(g, pw, ph, nx, ny, corte, true);
    g.fill();
    const tx = ny;
    const ty = -nx;
    const cx = pw / 2 + nx * corte;
    const cy = ph / 2 + ny * corte;
    g.beginPath();
    g.moveTo(cx - tx * pw, cy - ty * pw);
    g.lineTo(cx + tx * pw, cy + ty * pw);
    g.strokeStyle = menisco;
    g.lineWidth = 2;
    g.stroke();
    g.restore();
  }

  pintarGotas(g, frame, jh, cuello, superficieAbajo, pw, ph);

  if (frame.mascara) {
    g.save();
    g.globalCompositeOperation = 'destination-in';
    g.translate(pw / 2, ph / 2);
    g.rotate(frame.angulo);
    g.drawImage(frame.mascara, -jw / 2, -jh / 2, jw, jh);
    g.restore();
  }
  ctx.drawImage(hoja, frame.frasco.x + w / 2 - pw / escala / 2, frame.frasco.y + h / 2 - ph / escala / 2, pw / escala, ph / escala);
}

function pintarGotas(
  g: CanvasRenderingContext2D,
  frame: AguaFrame,
  h: number,
  cuello: number,
  superficieAbajo: number | null,
  placaW: number,
  placaH: number,
): void {
  const activo = frame.llueve && cercaDeLaVertical(frame.angulo) && superficieAbajo !== null;
  alphaGotas = pasoGotas(alphaGotas, activo, frame.dt);
  if (alphaGotas <= 0 || superficieAbajo === null) return;
  const dy = (cuello - 0.5) * h;
  const c = Math.cos(frame.angulo);
  const s = Math.sin(frame.angulo);
  const nx = -dy * s + placaW / 2;
  const ny = dy * c + placaH / 2;
  const hasta = superficieAbajo;
  const recorrido = Math.max(8, hasta - ny);
  if (recorrido < 4) return;
  relojGotas += frame.dt;
  g.save();
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  g.strokeStyle = PINTURA.lluvia;
  for (const gota of GOTAS) {
    const y = ny + ((relojGotas * gota.velocidad + gota.fase * recorrido) % recorrido);
    g.globalAlpha = gota.opacidad * alphaGotas;
    g.beginPath();
    g.moveTo(nx, y);
    g.lineTo(nx, Math.min(hasta, y + gota.largo));
    g.stroke();
    if (y + gota.largo >= hasta - 1) {
      g.beginPath();
      g.ellipse(nx, hasta, 3, 1.2, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
}
