/** Los mismos px que geometria.ts. Aquí para no importar el módulo que llama a este. */
const FOTO_ANCHO = 446;
const FOTO_ALTO = 1024;
const CUELLO_FILA = 496.5;
const CUELLO_X = 223.5;

/**
 * Radio exterior del cuello, en px de la foto (446×1024).
 * El perfil medido se queda en 31.79; este valor es el que se edita.
 * El factor sale de los dos y lo siguen el torno, la máscara y el recorte.
 */
export const RADIO_CUELLO = 18;
const RADIO_CUELLO_MEDIDO = 31.79;
/**
 * Filas de la foto a cada lado del cuello. En el borde el factor es 1,
 * así que el bulbo no se mueve. No es un segundo ancho.
 */
const ALCANCE_CUELLO = 56;

/**
 * Interior del perfil en esa franja (fila, radio), en px de la foto.
 * Fuera de ella la máscara se deja como está.
 */
const INTERIOR_CUELLO: readonly number[] = [
  440.31, 36.35, 446.18, 31.71, 452.29, 27.38, 458.62, 23.39, 465.13, 19.68, 471.69, 16.07, 478.33, 12.62,
  485.23, 9.73, 492.51, 8.05, 499.97, 8.0, 507.24, 9.68, 514.09, 12.7, 520.57, 16.43, 526.96, 20.34, 533.35,
  24.25, 539.61, 28.35, 545.65, 32.78, 551.43, 37.54,
];

/** 1 fuera de la franja, RADIO_CUELLO / radio medido en el centro. */
export function factorCuello(fila: number): number {
  const t = Math.min(1, Math.abs(fila - CUELLO_FILA) / ALCANCE_CUELLO);
  const s = t * t * (3 - 2 * t);
  const k = RADIO_CUELLO / RADIO_CUELLO_MEDIDO;
  return k + (1 - k) * s;
}

function radioInterior(fila: number): number {
  const ultimo = INTERIOR_CUELLO.length - 2;
  const fila0 = INTERIOR_CUELLO[0] ?? 0;
  if (fila <= fila0) return INTERIOR_CUELLO[1] ?? 0;
  const filaN = INTERIOR_CUELLO[ultimo] ?? fila0;
  if (fila >= filaN) return INTERIOR_CUELLO[ultimo + 1] ?? 0;
  for (let i = 0; i < ultimo; i += 2) {
    const f0 = INTERIOR_CUELLO[i] ?? 0;
    const f1 = INTERIOR_CUELLO[i + 2] ?? f0;
    if (fila > f1) continue;
    const t = (fila - f0) / (f1 - f0 || 1);
    const r0 = INTERIOR_CUELLO[i + 1] ?? 0;
    const r1 = INTERIOR_CUELLO[i + 3] ?? r0;
    return r0 + t * (r1 - r0);
  }
  return INTERIOR_CUELLO[ultimo + 1] ?? 0;
}

/**
 * Abre el cuello de la máscara al hueco interior ya estrecho.
 * Las filas de los bulbos no se tocan.
 */
export function aplicarCuello(data: Uint8ClampedArray, ancho: number, alto: number): void {
  const escala = ancho / FOTO_ANCHO;
  const cx = CUELLO_X * escala;
  for (let y = 0; y < alto; y++) {
    const fila = ((y + 0.5) * FOTO_ALTO) / alto;
    if (Math.abs(fila - CUELLO_FILA) >= ALCANCE_CUELLO) continue;
    const medio = radioInterior(fila) * factorCuello(fila) * escala;
    const izq = cx - medio;
    const der = cx + medio;
    const base = y * ancho * 4;
    for (let x = 0; x < ancho; x++) {
      const o = base + x * 4;
      const v = x + 0.5 >= izq && x + 0.5 <= der ? 255 : 0;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
    }
  }
}

function medidaDe(img: CanvasImageSource): { ancho: number; alto: number } | null {
  if (img instanceof HTMLImageElement) return img.naturalWidth ? { ancho: img.naturalWidth, alto: img.naturalHeight } : null;
  if (img instanceof HTMLCanvasElement || img instanceof ImageBitmap) return { ancho: img.width, alto: img.height };
  return null;
}

/** La misma máscara, con el cuello ya aplicado, para el recorte del vidrio 3D. */
export function mascaraConCuello(img: CanvasImageSource): HTMLCanvasElement | null {
  const medida = medidaDe(img);
  if (!medida) return null;
  const { ancho, alto } = medida;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const foto = ctx.getImageData(0, 0, ancho, alto);
  aplicarCuello(foto.data, ancho, alto);
  ctx.putImageData(foto, 0, 0);
  return lienzo;
}
