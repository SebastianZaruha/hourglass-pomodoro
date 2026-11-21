// @ts-nocheck — el módulo llega con índices sin comprobar. No se reescribe su cálculo.
// Entorno de reflejos sacado de la propia escena: la foto (desenfocada) proyectada detrás
// del frasco y en espejo delante, más dos softboxes del color de la luz de la escena.
// Se genera en float (HDR) para que los brillos pasen de 1 y luego va a PMREM.
import { DataTexture, DataUtils, EquirectangularReflectionMapping, HalfFloatType, LinearFilter, PMREMGenerator, RGBAFormat, type WebGLRenderTarget, type WebGLRenderer } from 'three';

export type Modo = 'claro' | 'oscuro';
export interface OpcionesEntorno {
  /** Foto, póster del vídeo o canvas de la escena. null = estudio neutro. */
  fuente: CanvasImageSource | null;
  modo: Modo;
  /** Estudio (Clásico): fondo uniforme y softboxes más marcados. */
  estudio: boolean;
  /** Tinte de la luz (#rrggbb). Si falta, se saca de los píxeles más claros de la foto. */
  tinte?: string;
  /** Solo para afinar (depurar): pisa valores de AJUSTES. */
  ajuste?: Partial<AjusteEntorno>;
}

/** Lo que marca el borde y los brillos. Elegido con capturas (verificacion/variantes-h2.mjs). */
export interface AjusteEntorno {
  /** Banderas negras: centro y medio ancho de la banda (rad desde «justo detrás»), cuánto oscurecen y ganancia. */
  banderaCentro: number; banderaAncho: number; banderaFuerza: number; banderaGanancia: number;
  /** Multiplica la fuerza de los softboxes. */
  softbox: number;
  /** Borde del softbox: 0 = difuso (hito 1), 1 = recortado (estudio de producto). */
  softboxCorte: number;
  /** Brillo de la foto reflejada (estudio: fondo de papel). */
  base: number;
  /** Línea de luz fina por detrás (contraluz): perfila la silueta por dentro. */
  contraluz: number;
}

// Hito 1: claro { 0.95, 0.42, 0.85, 1.6, 1, 0, 1, 0 }, oscuro { 0.95, 0.42, 0.75, 1.6, 1, 0, 1, 0 },
// estudio igual con softboxes ×1.5 y base 0.9.
const AJUSTES: Record<'claro' | 'oscuro' | 'estudioClaro' | 'estudioOscuro', AjusteEntorno> = {
  claro: { banderaCentro: 0.7, banderaAncho: 0.38, banderaFuerza: 0.97, banderaGanancia: 2.3, softbox: 1, softboxCorte: 0, base: 1, contraluz: 0 },
  oscuro: { banderaCentro: 0.95, banderaAncho: 0.42, banderaFuerza: 0.75, banderaGanancia: 1.6, softbox: 1, softboxCorte: 0, base: 1, contraluz: 0 },
  estudioClaro: { banderaCentro: 0.72, banderaAncho: 0.4, banderaFuerza: 0.98, banderaGanancia: 2.5, softbox: 1.25, softboxCorte: 0.75, base: 0.92, contraluz: 1.0 },
  estudioOscuro: { banderaCentro: 0.95, banderaAncho: 0.4, banderaFuerza: 0.8, banderaGanancia: 1.8, softbox: 1.2, softboxCorte: 0.75, base: 0.85, contraluz: 1.8 },
};

const W = 256, H = 128;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function muestras(fuente: CanvasImageSource | null): { px: Float32Array; w: number; h: number; claro: [number, number, number] } {
  const w = 48, h = 28; // tamaño diminuto = desenfoque gratis y barato en cualquier navegador
  const px = new Float32Array(w * h * 3);
  let claro: [number, number, number] = [1, 0.97, 0.93];
  if (!fuente) { px.fill(0.5); return { px, w, h, claro }; }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  try { ctx.drawImage(fuente, 0, 0, w, h); } catch { px.fill(0.5); return { px, w, h, claro }; }
  const d = ctx.getImageData(0, 0, w, h).data;
  const lum: { l: number; i: number }[] = [];
  for (let i = 0; i < w * h; i++) {
    px[i * 3] = lin(d[i * 4] / 255); px[i * 3 + 1] = lin(d[i * 4 + 1] / 255); px[i * 3 + 2] = lin(d[i * 4 + 2] / 255);
    lum.push({ l: 0.2126 * px[i * 3] + 0.7152 * px[i * 3 + 1] + 0.0722 * px[i * 3 + 2], i });
  }
  // Color de la luz = media del 6 % más claro, normalizado a su canal mayor.
  lum.sort((a, b) => b.l - a.l);
  const n = Math.max(1, Math.floor(lum.length * 0.06));
  let r = 0, g = 0, b = 0;
  for (let k = 0; k < n; k++) { const i = lum[k].i; r += px[i * 3]; g += px[i * 3 + 1]; b += px[i * 3 + 2]; }
  const m = Math.max(r, g, b, 1e-6);
  claro = [r / m, g / m, b / m];
  return { px, w, h, claro };
}

function bilineal(s: { px: Float32Array; w: number; h: number }, u: number, v: number, out: number[]) {
  const x = Math.min(s.w - 1.001, Math.max(0, u * s.w - 0.5));
  const y = Math.min(s.h - 1.001, Math.max(0, v * s.h - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const a = s.px[(y0 * s.w + x0) * 3 + c], b = s.px[(y0 * s.w + x0 + 1) * 3 + c];
    const d = s.px[((y0 + 1) * s.w + x0) * 3 + c], e = s.px[((y0 + 1) * s.w + x0 + 1) * 3 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
}

type V3 = [number, number, number];
interface Luz { dir: V3; ancho: number; alto: number; fuerza: number; derecha: V3; arriba: V3 }

/** Ejes del softbox: derecha = horizontal del mundo ⟂ a la luz; arriba = lo que queda. */
function luz(dir: V3, ancho: number, alto: number, fuerza: number): Luz {
  const n = Math.hypot(...dir); const d: V3 = [dir[0] / n, dir[1] / n, dir[2] / n];
  // derecha = (0,1,0) × d, normalizado
  let r: V3 = [d[2], 0, -d[0]]; const m = Math.hypot(...r) || 1; r = [r[0] / m, r[1] / m, r[2] / m];
  // arriba = d × derecha
  const u: V3 = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
  return { dir: d, ancho, alto, fuerza, derecha: r, arriba: u };
}

export function crearEntorno(renderer: WebGLRenderer, pmrem: PMREMGenerator, o: OpcionesEntorno): WebGLRenderTarget {
  const s = muestras(o.fuente);
  const oscuro = o.modo === 'oscuro';
  const a: AjusteEntorno = { ...AJUSTES[o.estudio ? (oscuro ? 'estudioOscuro' : 'estudioClaro') : oscuro ? 'oscuro' : 'claro'], ...o.ajuste };
  let tinte = o.tinte ? hex(o.tinte) : s.claro;
  // En claro la luz es casi blanca con un poco de la escena; en oscuro, el color de la escena.
  const mezcla = oscuro ? 0.85 : 0.35;
  tinte = [1 - mezcla + mezcla * tinte[0], 1 - mezcla + mezcla * tinte[1], 1 - mezcla + mezcla * tinte[2]];
  const k = oscuro ? 0.55 : 1;
  // Softboxes: vistas por reflejo desde la cámara. Atrás del espectador (+z), a los lados.
  const luces: Luz[] = [
    luz([-0.62, 0.38, 0.68], 0.22, 0.62, (o.estudio ? 9 : 6) * k * a.softbox),
    luz([0.74, 0.12, 0.66], 0.08, 0.8, (o.estudio ? 5 : 3.2) * k * a.softbox),
    luz([0.0, 0.97, 0.24], 0.5, 0.25, 1.4 * k),
  ];
  const datos = new Float32Array(W * H * 4);
  const c = [0, 0, 0];
  const base = a.base;
  // Caída del borde del softbox: de 0,85→1,25 (difuso) a 0,97→1,03 (recortado).
  const e0 = 0.85 + 0.12 * a.softboxCorte, e1 = 1.25 - 0.22 * a.softboxCorte;
  for (let j = 0; j < H; j++) {
    const th = ((j + 0.5) / H - 0.5) * Math.PI;
    for (let i = 0; i < W; i++) {
      const ph = ((i + 0.5) / W - 0.5) * 2 * Math.PI;
      const dx = Math.cos(ph) * Math.cos(th), dy = Math.sin(th), dz = Math.sin(ph) * Math.cos(th);
      // Foto proyectada en un plano detrás (−z) y en espejo delante (+z), algo más oscura.
      const zz = Math.max(0.25, Math.abs(dz));
      const u = 0.5 + (dx / zz) * 0.35, v = 0.5 - (dy / zz) * 0.45;
      bilineal(s, u, v, c);
      const espejo = dz > 0 ? 0.75 : 1;
      let r = c[0] * espejo * base, g = c[1] * espejo * base, b = c[2] * espejo * base;
      if (dy < -0.15) { const f = 0.75; r *= f; g *= f; b *= f; } // suelo algo más oscuro
      // Banderas negras de estudio detrás y a los lados: en el vidrio dibujan el borde oscuro
      // fino junto a la silueta (reflejo a 55-75° de incidencia), como en una foto de producto.
      if (dz < 0) {
        const lado = Math.atan2(Math.abs(dx), -dz); // 0 = justo detrás
        const enBanda = Math.max(0, 1 - Math.abs(lado - a.banderaCentro) / a.banderaAncho) * Math.max(0, 1 - Math.abs(dy) / 0.8);
        const f = 1 - Math.min(1, enBanda * a.banderaGanancia) * a.banderaFuerza;
        r *= f; g *= f; b *= f;
        // Contraluz: dos tiras de luz finas justo detrás, a los lados (perfilan la silueta por dentro).
        if (a.contraluz > 0) {
          const t = Math.max(0, 1 - Math.abs(lado - 0.32) / 0.07) * Math.max(0, 1 - Math.abs(dy) / 0.7);
          if (t > 0) { const q = a.contraluz * t * t; r += q * tinte[0]; g += q * tinte[1]; b += q * tinte[2]; }
        }
      }
      for (const l of luces) {
        const [lx, ly, lz] = l.dir;
        const dot = dx * lx + dy * ly + dz * lz;
        if (dot <= 0.5) continue;
        // Distancias angulares en el plano tangente de la luz (hito 1 usaba longitud/latitud:
        // cerca del polo el softbox de arriba salía como un triángulo en la cúpula).
        const [rx, ry, rz] = l.derecha, [ux, uy, uz] = l.arriba;
        const h = Math.atan2(dx * rx + dy * ry + dz * rz, dot);
        const vv = Math.atan2(dx * ux + dy * uy + dz * uz, dot);
        const e = Math.max(Math.abs(h) / l.ancho, Math.abs(vv) / l.alto);
        if (e >= e1) continue;
        const f = l.fuerza * (e <= e0 ? 1 : 1 - (e - e0) / (e1 - e0));
        r += f * tinte[0]; g += f * tinte[1]; b += f * tinte[2];
      }
      const p = (j * W + i) * 4;
      datos[p] = r; datos[p + 1] = g; datos[p + 2] = b; datos[p + 3] = 1;
    }
  }
  // Half float: filtrable en todos los navegadores (float32 lineal falta en muchos móviles y en Safari).
  const medio = new Uint16Array(datos.length);
  for (let i = 0; i < datos.length; i++) medio[i] = DataUtils.toHalfFloat(Math.min(datos[i], 65000));
  const tex = new DataTexture(medio, W, H, RGBAFormat, HalfFloatType);
  tex.mapping = EquirectangularReflectionMapping;
  tex.magFilter = tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  void renderer;
  return rt;
}
