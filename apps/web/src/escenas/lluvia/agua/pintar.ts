import { opacidadFundido, type Pintura } from '../../../comun/frasco';
import type { Superficie, VistaAgua } from './modelo';

interface Tinte {
  readonly arriba: string;
  readonly menisco: string;
  readonly reflejo: string;
}

/**
 * Frío y transparente. El matiz se queda entre el azul y el verde, nunca en el marrón.
 * Estos rgba son los que tienen que verse sobre el interior negro.
 */
const TINTES: Record<'claro' | 'oscuro', Tinte> = {
  claro: {
    arriba: 'rgba(214, 228, 234, 0.26)',
    menisco: 'rgba(196, 222, 238, 0.72)',
    reflejo: 'rgba(214, 228, 234, 0.2)',
  },
  oscuro: {
    arriba: 'rgba(160, 178, 188, 0.20)',
    menisco: 'rgba(176, 200, 214, 0.58)',
    reflejo: 'rgba(214, 228, 234, 0.2)',
  },
};

/**
 * El frente del vidrio es negro opaco y luego cae en soft-light, que eleva
 * el color al cuadrado. Sin este paso el agua sale a unos 12 de canal y el
 * bulbo de abajo, sobre el negro, parece vacío.
 */
function queSeVea(css: string): string {
  const m = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/.exec(css);
  if (!m) return css;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = Number(m[4]);
  const media = (r + g + b) / (3 * 255);
  if (!(a > 0) || !(media > 0)) return css;
  const alfa = Math.min(1, Math.sqrt(a * media) / media);
  return `rgba(${r}, ${g}, ${b}, ${alfa.toFixed(3)})`;
}

interface Eje {
  readonly x: number;
  readonly y: number;
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

function olaEn(sup: Superficie, s: number): number {
  const ancho = sup.s1 - sup.s0;
  if (!(ancho > 1)) return 0;
  const t = ((s - sup.s0) / ancho) * (sup.onda.length - 1);
  if (t <= 0) return sup.onda[0] ?? 0;
  if (t >= sup.onda.length - 1) return sup.onda[sup.onda.length - 1] ?? 0;
  const i = Math.floor(t);
  const f = t - i;
  return (sup.onda[i] ?? 0) * (1 - f) + (sup.onda[i + 1] ?? 0) * f;
}

function punto(cx: number, cy: number, tangent: Eje, down: Eje, s: number, h: number, ola: number): Punto {
  return {
    x: cx + tangent.x * s + down.x * (h - ola),
    y: cy + tangent.y * s + down.y * (h - ola),
  };
}

/**
 * Rellena el lado de abajo de la línea y lo recorta al bulbo.
 * La máscara, después, lo deja pared con pared.
 */
function rellenar(
  g: CanvasRenderingContext2D,
  sup: Superficie,
  cx: number,
  cy: number,
  tangent: Eje,
  down: Eje,
  sCaja0: number,
  sCaja1: number,
  lejos: number,
) {
  const n = 36;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const s = sCaja0 + ((sCaja1 - sCaja0) * i) / n;
    const dentro = s >= sup.s0 && s <= sup.s1;
    const p = punto(cx, cy, tangent, down, s, sup.h, dentro ? olaEn(sup, s) : 0);
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  const fin = punto(cx, cy, tangent, down, sCaja1, sup.h, 0);
  const ini = punto(cx, cy, tangent, down, sCaja0, sup.h, 0);
  g.lineTo(fin.x + down.x * lejos, fin.y + down.y * lejos);
  g.lineTo(ini.x + down.x * lejos, ini.y + down.y * lejos);
  g.closePath();
  g.fill();
}

function reflejo(
  g: CanvasRenderingContext2D,
  sup: Superficie,
  cx: number,
  cy: number,
  tangent: Eje,
  down: Eje,
  color: string,
) {
  const ancho = sup.s1 - sup.s0;
  if (!(ancho > 4)) return;
  const pasos = sup.onda.length;
  const fondo = 10;
  g.beginPath();
  for (let i = 0; i < pasos; i++) {
    const s = sup.s0 + (ancho * i) / (pasos - 1);
    const p = punto(cx, cy, tangent, down, s, sup.h, olaEn(sup, s));
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  for (let i = pasos - 1; i >= 0; i--) {
    const s = sup.s0 + (ancho * i) / (pasos - 1);
    const p = punto(cx, cy, tangent, down, s, sup.h, olaEn(sup, s) - fondo);
    g.lineTo(p.x, p.y);
  }
  g.closePath();
  const origen = punto(cx, cy, tangent, down, (sup.s0 + sup.s1) / 2, sup.h, 0);
  const destino = punto(cx, cy, tangent, down, (sup.s0 + sup.s1) / 2, sup.h, -fondo);
  const grad = g.createLinearGradient(origen.x, origen.y, destino.x, destino.y);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(214, 228, 234, 0)');
  g.fillStyle = grad;
  g.fill();
}

/** 2 px, solo en los 6 px donde el agua toca el cristal. Sin línea de lado a lado. */
function menisco(
  g: CanvasRenderingContext2D,
  sup: Superficie,
  cx: number,
  cy: number,
  tangent: Eje,
  down: Eje,
  color: string,
) {
  const tramo = 6;
  const ancho = sup.contacto1 - sup.contacto0;
  if (!(ancho > tramo * 2)) return;
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.lineCap = 'round';
  const extremo = (desde: number, hasta: number) => {
    g.beginPath();
    const a = punto(cx, cy, tangent, down, desde, sup.h, olaEn(sup, desde));
    const b = punto(cx, cy, tangent, down, hasta, sup.h, olaEn(sup, hasta));
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  };
  extremo(sup.contacto0, sup.contacto0 + tramo);
  extremo(sup.contacto1 - tramo, sup.contacto1);
}

function sDeCaja(w: number, h: number, tangent: Eje): { s0: number; s1: number } {
  const cx = w / 2;
  const cy = h / 2;
  const esquinas = [
    [-cx, -cy],
    [cx, -cy],
    [cx, cy],
    [-cx, cy],
  ];
  let s0 = Infinity;
  let s1 = -Infinity;
  for (const [x, y] of esquinas) {
    const s = (x ?? 0) * tangent.x + (y ?? 0) * tangent.y;
    if (s < s0) s0 = s;
    if (s > s1) s1 = s;
  }
  return { s0, s1 };
}

/** El agua saliente llega a 4 px de desenfoque; la entrante sale de ahí. */
const BLUR_FUNDIDO = 4;

function filtro(px: number): string {
  return px > 0.05 ? `blur(${px}px)` : 'none';
}

function pintarCapa(
  g: CanvasRenderingContext2D,
  dpr: number,
  w: number,
  h: number,
  cuello: number,
  alfa: number,
  arriba: Superficie,
  abajo: Superficie,
  tinte: Tinte,
): void {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.filter = 'none';
  g.clearRect(0, 0, w, h);
  const cuerpo = queSeVea(tinte.arriba);
  const sen = Math.sin(alfa);
  const cos = Math.cos(alfa);
  const down = { x: sen, y: cos };
  const tangent = { x: cos, y: -sen };
  const cx = w / 2;
  const cy = h / 2;
  const alcance = Math.hypot(w, h);
  const cajaS = sDeCaja(w, h, tangent);
  const pintarBulbo = (sup: Superficie, superior: boolean) => {
    if (!sup.dibujar) return;
    g.save();
    g.beginPath();
    if (superior) g.rect(0, 0, w, cuello);
    else g.rect(0, cuello, w, h - cuello);
    g.clip();
    g.fillStyle = cuerpo;
    if (sup.lleno) g.fillRect(0, 0, w, h);
    else {
      rellenar(g, sup, cx, cy, tangent, down, cajaS.s0, cajaS.s1, alcance);
      reflejo(g, sup, cx, cy, tangent, down, queSeVea(tinte.reflejo));
      menisco(g, sup, cx, cy, tangent, down, queSeVea(tinte.menisco));
    }
    g.restore();
  };
  pintarBulbo(arriba, true);
  pintarBulbo(abajo, false);
}

function recortar(g: CanvasRenderingContext2D, mascara: CanvasImageSource, w: number, h: number): void {
  g.filter = 'none';
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(mascara, 0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

export function crearPincel(): (ctx: CanvasRenderingContext2D, p: Pintura, vista: VistaAgua) => void {
  const hoja = document.createElement('canvas');
  const g = hoja.getContext('2d');
  const capaSale = document.createElement('canvas');
  const gSale = capaSale.getContext('2d');
  const capaEntra = document.createElement('canvas');
  const gEntra = capaEntra.getContext('2d');
  return (ctx, p, vista) => {
    if (!g || !gSale || !gEntra) return;
    const w = p.caja.w;
    const h = p.caja.h;
    if (w < 2 || h < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pxW = Math.max(1, Math.round(w * dpr));
    const pxH = Math.max(1, Math.round(h * dpr));
    if (hoja.width !== pxW || hoja.height !== pxH) {
      hoja.width = pxW;
      hoja.height = pxH;
    }
    const tinte = TINTES[p.esquema];
    const cuello = vista.cuello * h;
    const cruce = vista.cruce;
    if (cruce) {
      if (capaSale.width !== pxW || capaSale.height !== pxH) {
        capaSale.width = pxW;
        capaSale.height = pxH;
      }
      if (capaEntra.width !== pxW || capaEntra.height !== pxH) {
        capaEntra.width = pxW;
        capaEntra.height = pxH;
      }
      pintarCapa(gSale, dpr, w, h, cuello, cruce.alfaViejo, cruce.viejoArriba, cruce.viejoAbajo, tinte);
      pintarCapa(gEntra, dpr, w, h, cuello, 0, cruce.nuevoArriba, cruce.nuevoAbajo, tinte);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.filter = 'none';
      g.clearRect(0, 0, w, h);
      g.imageSmoothingEnabled = true;
      const sale = 1 - cruce.u;
      const alfaViejo = opacidadFundido(sale);
      const alfaNuevo = opacidadFundido(cruce.u);
      if (alfaViejo > 0) {
        g.filter = filtro(BLUR_FUNDIDO * cruce.u);
        g.globalAlpha = alfaViejo;
        g.drawImage(capaSale, 0, 0, w, h);
      }
      if (alfaNuevo > 0) {
        g.filter = filtro(BLUR_FUNDIDO * sale);
        g.globalAlpha = alfaNuevo;
        g.drawImage(capaEntra, 0, 0, w, h);
      }
    } else {
      pintarCapa(g, dpr, w, h, cuello, vista.alfa, vista.arriba, vista.abajo, tinte);
    }
    recortar(g, p.geo.mascara, w, h);
    ctx.drawImage(hoja, p.caja.x, p.caja.y, w, h);
  };
}
