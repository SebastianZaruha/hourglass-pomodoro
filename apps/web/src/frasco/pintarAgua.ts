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

const solidas = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** La máscara del contenido, umbral y un par de píxeles hacia el cristal. */
export function mascaraSolida(origen: HTMLCanvasElement): HTMLCanvasElement {
  const ya = solidas.get(origen);
  if (ya) return ya;
  const w = origen.width;
  const h = origen.height;
  const src = origen.getContext('2d')?.getImageData(0, 0, w, h);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  if (!src) return origen;
  const base = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) base[i] = (src.data[i * 4 + 3] ?? 0) > 32 ? 255 : 0;
  let entrada = base;
  let salida = new Uint8Array(w * h);
  for (let paso = 0; paso < 2; paso++) {
    salida.set(entrada);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (entrada[i]) continue;
        if (entrada[i - 1] || entrada[i + 1] || entrada[i - w] || entrada[i + w]) salida[i] = 255;
      }
    }
    const tmp = entrada;
    entrada = salida;
    salida = tmp;
  }
  const g = out.getContext('2d');
  if (!g) return origen;
  const img = g.createImageData(w, h);
  for (let i = 0; i < entrada.length; i++) {
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = entrada[i] ?? 0;
  }
  g.putImageData(img, 0, 0);
  solidas.set(origen, out);
  return out;
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
  const reflejo = frame.oscuro ? PINTURA.reflejoOscuro : PINTURA.reflejo;
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
    const banda = 3 * escala;
    const brillo = g.createLinearGradient(cx, cy, cx + nx * banda, cy + ny * banda);
    brillo.addColorStop(0, reflejo);
    brillo.addColorStop(1, PINTURA.reflejoFin);
    g.fillStyle = brillo;
    poligono(g, pw, ph, nx, ny, corte, true);
    g.fill();
    g.beginPath();
    g.moveTo(cx - tx * pw, cy - ty * pw);
    g.lineTo(cx + tx * pw, cy + ty * pw);
    g.strokeStyle = menisco;
    g.lineWidth = Math.max(2, escala * 1.6);
    g.stroke();
    g.restore();
  }

  if (frame.mascara) {
    g.save();
    g.globalCompositeOperation = 'destination-in';
    g.translate(pw / 2, ph / 2);
    g.rotate(frame.angulo);
    const recorte = frame.mascara instanceof HTMLCanvasElement ? mascaraSolida(frame.mascara) : frame.mascara;
    g.drawImage(recorte, -jw / 2, -jh / 2, jw, jh);
    g.restore();
  }
  ctx.drawImage(
    hoja,
    frame.frasco.x + w / 2 - pw / escala / 2,
    frame.frasco.y + h / 2 - ph / escala / 2,
    pw / escala,
    ph / escala,
  );
}

/**
 * Gotas encima del vidrio, en píxeles de pantalla: 1,5 de ancho y 6–14 de largo.
 * En la media vuelta siguen el eje del frasco. En marcha, caen en vertical.
 */
export function pintarGotasEncima(ctx: CanvasRenderingContext2D, frame: AguaFrame, ejeFrasco: boolean): boolean {
  const { w, h } = frame.frasco;
  const cuello = (frame.geo.cuelloFila + 0.5) / frame.geo.filas;
  const corte = corteDeBulbo(
    frame.geo.puntos,
    frame.geo.inicioAbajo,
    frame.geo.puntosAbajo,
    frame.fraccionAbajo,
    ejeFrasco ? 0 : frame.angulo,
    ejeFrasco ? 0 : frame.phi,
    w,
    h,
  );
  const activo = frame.llueve && (ejeFrasco || cercaDeLaVertical(frame.angulo)) && corte !== null;
  alphaGotas = pasoGotas(alphaGotas, activo, frame.dt);
  if (alphaGotas <= 0 || corte === null) return alphaGotas > 0;
  const cx = frame.frasco.x + w / 2;
  const cy = frame.frasco.y + h / 2;
  const dy = (cuello - 0.5) * h;
  const ang = frame.angulo;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const cuelloX = cx - dy * s;
  const cuelloY = cy + dy * c;
  let hastaX = cuelloX;
  let hastaY = cy + corte;
  if (ejeFrasco) {
    hastaX = cx - corte * s;
    hastaY = cy + corte * c;
  } else {
    const sp = Math.sin(frame.phi);
    const cp = Math.cos(frame.phi);
    const ox = cx + sp * corte;
    const oy = cy + cp * corte;
    const t = Math.abs(cp) > 0.2 ? (cuelloX - ox) / cp : 0;
    hastaX = cuelloX;
    hastaY = oy - t * sp;
  }
  const largo = Math.hypot(hastaX - cuelloX, hastaY - cuelloY);
  if (largo < 8) return alphaGotas > 0;
  const ux = (hastaX - cuelloX) / largo;
  const uy = (hastaY - cuelloY) / largo;
  relojGotas += frame.dt;
  const escala = Math.max(1, ctx.getTransform().a || 1);
  const jw = Math.max(2, Math.round(w * escala));
  const jh = Math.max(2, Math.round(h * escala));
  const pw = Math.max(jw, Math.ceil(Math.abs(jw * c) + Math.abs(jh * s)) + 4);
  const ph = Math.max(jh, Math.ceil(Math.abs(jw * s) + Math.abs(jh * c)) + 4);
  const g = placa(pw, ph);
  if (!g || !hoja) return alphaGotas > 0;
  const color = frame.oscuro ? PINTURA.gotaOscura : PINTURA.gota;
  g.lineWidth = 1.5 * escala;
  g.lineCap = 'round';
  g.strokeStyle = color;
  const aPlaca = (sx: number, sy: number) => ({ x: (sx - cx) * escala + pw / 2, y: (sy - cy) * escala + ph / 2 });
  for (const gota of GOTAS) {
    const onda = Math.sin(relojGotas * 2.2 + gota.fase * Math.PI * 2) * 1.1;
    const dist = (relojGotas * gota.velocidad + gota.fase * largo) % largo;
    const x0 = cuelloX + ux * dist - uy * onda;
    const y0 = cuelloY + uy * dist + ux * onda;
    const llega = Math.min(gota.largo, largo - dist);
    const p0 = aPlaca(x0, y0);
    const p1 = aPlaca(x0 + ux * llega, y0 + uy * llega);
    g.globalAlpha = gota.opacidad * alphaGotas;
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();
  }
  if (frame.mascara) {
    g.save();
    g.globalCompositeOperation = 'destination-in';
    g.globalAlpha = 1;
    g.translate(pw / 2, ph / 2);
    g.rotate(ang);
    g.drawImage(frame.mascara, -jw / 2, -jh / 2, jw, jh);
    g.restore();
  }
  ctx.drawImage(hoja, cx - pw / escala / 2, cy - ph / escala / 2, pw / escala, ph / escala);
  return alphaGotas > 0;
}
