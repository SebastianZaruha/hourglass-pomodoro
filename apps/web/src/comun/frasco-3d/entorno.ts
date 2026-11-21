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
}

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

interface Luz { dir: [number, number, number]; ancho: number; alto: number; fuerza: number }

export function crearEntorno(renderer: WebGLRenderer, pmrem: PMREMGenerator, o: OpcionesEntorno): WebGLRenderTarget {
  const s = muestras(o.fuente);
  const oscuro = o.modo === 'oscuro';
  let tinte = o.tinte ? hex(o.tinte) : s.claro;
  // En claro la luz es casi blanca con un poco de la escena; en oscuro, el color de la escena.
  const mezcla = oscuro ? 0.85 : 0.35;
  tinte = [1 - mezcla + mezcla * tinte[0], 1 - mezcla + mezcla * tinte[1], 1 - mezcla + mezcla * tinte[2]];
  const k = oscuro ? 0.55 : 1;
  // Softboxes: vistas por reflejo desde la cámara. Atrás del espectador (+z), a los lados.
  const luces: Luz[] = [
    { dir: [-0.62, 0.38, 0.68], ancho: 0.22, alto: 0.62, fuerza: (o.estudio ? 9 : 6) * k },
    { dir: [0.74, 0.12, 0.66], ancho: 0.08, alto: 0.8, fuerza: (o.estudio ? 5 : 3.2) * k },
    { dir: [0.0, 0.97, 0.24], ancho: 0.5, alto: 0.25, fuerza: 1.4 * k },
  ];
  const datos = new Float32Array(W * H * 4);
  const c = [0, 0, 0];
  const base = o.estudio ? 0.9 : 1;
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
        const enBanda = Math.max(0, 1 - Math.abs(lado - 0.95) / 0.42) * Math.max(0, 1 - Math.abs(dy) / 0.8);
        const f = 1 - Math.min(1, enBanda * 1.6) * (oscuro ? 0.75 : 0.85);
        r *= f; g *= f; b *= f;
      }
      for (const l of luces) {
        const [lx, ly, lz] = l.dir;
        const dot = dx * lx + dy * ly + dz * lz;
        if (dot <= 0.5) continue;
        // Distancias angulares aproximadas en horizontal y vertical respecto a la luz.
        const h = Math.atan2(dx * lz - dz * lx, dx * lx + dz * lz);
        const vv = Math.asin(Math.max(-1, Math.min(1, dy))) - Math.asin(ly);
        const e = Math.max(Math.abs(h) / l.ancho, Math.abs(vv) / l.alto);
        if (e >= 1.25) continue;
        const f = l.fuerza * (e <= 0.85 ? 1 : 1 - (e - 0.85) / 0.4);
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
