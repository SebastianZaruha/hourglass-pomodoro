import type { Pintura } from '../../../comun/frasco';
import type { Superficie, VistaAgua } from './modelo';

interface Tinte {
  readonly arriba: string;
  readonly abajo: string;
  readonly menisco: string;
  readonly reflejo: string;
}

/** Frío y transparente. El matiz se queda entre el azul y el verde, nunca en el marrón. */
const TINTES: Record<'claro' | 'oscuro', Tinte> = {
  claro: {
    arriba: 'rgba(214, 228, 234, 0.26)',
    abajo: 'rgba(201, 214, 220, 0.26)',
    menisco: 'rgba(196, 222, 238, 0.72)',
    reflejo: 'rgba(214, 228, 234, 0.2)',
  },
  oscuro: {
    arriba: 'rgba(160, 178, 188, 0.20)',
    abajo: 'rgba(150, 167, 177, 0.20)',
    menisco: 'rgba(176, 200, 214, 0.58)',
    reflejo: 'rgba(214, 228, 234, 0.2)',
  },
};

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

export function crearPincel(): (ctx: CanvasRenderingContext2D, p: Pintura, vista: VistaAgua) => void {
  const hoja = document.createElement('canvas');
  const g = hoja.getContext('2d');
  return (ctx, p, vista) => {
    if (!g) return;
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
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    const tinte = TINTES[p.esquema];
    const sen = Math.sin(vista.alfa);
    const cos = Math.cos(vista.alfa);
    const down = { x: sen, y: cos };
    const tangent = { x: cos, y: -sen };
    const mundo = { x: Math.sin(vista.angulo), y: Math.cos(vista.angulo) };
    const cx = w / 2;
    const cy = h / 2;
    const alcance = Math.hypot(w, h);
    const grad = g.createLinearGradient(
      cx - mundo.x * alcance,
      cy - mundo.y * alcance,
      cx + mundo.x * alcance,
      cy + mundo.y * alcance,
    );
    grad.addColorStop(0, tinte.arriba);
    grad.addColorStop(1, tinte.abajo);
    const cajaS = sDeCaja(w, h, tangent);
    const cuello = vista.cuello * h;
    const pintarBulbo = (sup: Superficie, superior: boolean) => {
      if (!sup.dibujar) return;
      g.save();
      g.beginPath();
      if (superior) g.rect(0, 0, w, cuello);
      else g.rect(0, cuello, w, h - cuello);
      g.clip();
      g.fillStyle = grad;
      if (sup.lleno) g.fillRect(0, 0, w, h);
      else {
        rellenar(g, sup, cx, cy, tangent, down, cajaS.s0, cajaS.s1, alcance);
        reflejo(g, sup, cx, cy, tangent, down, tinte.reflejo);
        menisco(g, sup, cx, cy, tangent, down, tinte.menisco);
      }
      g.restore();
    };
    pintarBulbo(vista.arriba, true);
    pintarBulbo(vista.abajo, false);
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(p.geo.mascara, 0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(hoja, p.caja.x, p.caja.y, w, h);
  };
}
