/**
 * Mide píxeles. No usa la fórmula del agua: si el detector y el frasco
 * compartieran la cuenta, el test no vería el error.
 */

export interface Zona {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Punto {
  readonly x: number;
  readonly y: number;
}

export interface Pendiente {
  readonly grados: number;
  readonly columnas: number;
  readonly puntos: readonly Punto[];
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function luminancia(r: number, g: number, b: number, a: number): number {
  if (a < 8) return 0;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) * (a / 255);
}

/** Ángulo de la frontera más fuerte dentro de la zona, respecto a la horizontal. */
export function pendienteSuperficie(
  data: Uint8ClampedArray,
  ancho: number,
  alto: number,
  zona: Zona,
  mascara?: Uint8ClampedArray,
  senal: 'luma' | 'azul' = 'luma',
): Pendiente {
  const puntos: Punto[] = [];
  const x0 = limitar(Math.round(zona.x), 0, ancho - 1);
  const x1 = limitar(Math.round(zona.x + zona.w), 0, ancho - 1);
  const y0 = limitar(Math.round(zona.y), 1, alto - 2);
  const y1 = limitar(Math.round(zona.y + zona.h), 1, alto - 2);
  const paso = Math.max(1, Math.round((x1 - x0) / 80));
  for (let x = x0; x <= x1; x += paso) {
    let mejor = 0;
    let mejorY = -1;
    for (let y = y0 + 2; y <= y1 - 2; y += 1) {
      if (mascara && !interior(mascara, ancho, alto, x, y)) continue;
      const salto = Math.abs(valor(data, ancho, x, y + 2, senal) - valor(data, ancho, x, y - 2, senal));
      if (salto > mejor) {
        mejor = salto;
        mejorY = y;
      }
    }
    if (mejorY >= 0 && mejor >= 6) puntos.push({ x, y: mejorY });
  }
  if (puntos.length < 8) return { grados: Number.NaN, columnas: puntos.length, puntos };
  const primera = recta(puntos);
  const residuos = puntos.map((p) => Math.abs(p.y - (primera.origen + primera.pendiente * p.x)));
  const tope = Math.max(3, mediana(residuos) * 3);
  const limpios = puntos.filter((_, i) => (residuos[i] ?? 0) <= tope);
  const usados = limpios.length >= 8 ? limpios : puntos;
  const final = recta(usados);
  return {
    grados: (Math.atan(final.pendiente) * 180) / Math.PI,
    columnas: usados.length,
    puntos: usados,
  };
}

export function matiz(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Color medio de los píxeles opacos de la zona. */
export function colorMedio(
  data: Uint8ClampedArray,
  ancho: number,
  alto: number,
  zona: Zona,
): { r: number; g: number; b: number; matiz: number; n: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const x0 = limitar(Math.round(zona.x), 0, ancho - 1);
  const x1 = limitar(Math.round(zona.x + zona.w), 0, ancho - 1);
  const y0 = limitar(Math.round(zona.y), 0, alto - 1);
  const y1 = limitar(Math.round(zona.y + zona.h), 0, alto - 1);
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const i = (y * ancho + x) * 4;
      const a = data[i + 3] ?? 0;
      if (a < 40) continue;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      n += 1;
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0, matiz: 0, n: 0 };
  const mr = r / n;
  const mg = g / n;
  const mb = b / n;
  return { r: mr, g: mg, b: mb, matiz: matiz(mr, mg, mb), n };
}

/**
 * Hueco, en píxeles, entre el borde de la máscara y el agua que hay debajo
 * de la superficie. No usa el contorno del frasco: compara el color del
 * centro de cada fila con el del borde interior de la máscara.
 */
export function huecoAguaMascara(
  jar: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  ancho: number,
  alto: number,
): { hueco: number; filas: number; contraste: number } {
  let peor = 0;
  let filas = 0;
  let contraste = 0;
  const y0 = Math.round(alto * 0.16);
  const y1 = Math.round(alto * 0.44);
  for (let y = y0; y <= y1; y += 2) {
    let izquierda = -1;
    let derecha = -1;
    for (let x = 0; x < ancho; x += 1) {
      const cobertura = mask[(y * ancho + x) * 4] ?? 0;
      if (cobertura <= 140) continue;
      if (izquierda < 0) izquierda = x;
      derecha = x;
    }
    if (izquierda < 0 || derecha - izquierda < 12) continue;
    const centroX = Math.round((izquierda + derecha) / 2);
    const centro = pixel(jar, ancho, centroX, y);
    const borde = pixel(jar, ancho, Math.min(derecha, izquierda + 2), y);
    const salto = distancia(centro, borde);
    if (salto > contraste) contraste = salto;
    filas += 1;
    if (salto < 8) continue;
    let aguaIzq = izquierda;
    for (let x = izquierda; x <= centroX; x += 1) {
      if (distancia(pixel(jar, ancho, x, y), centro) < salto * 0.45) {
        aguaIzq = x;
        break;
      }
    }
    let aguaDer = derecha;
    for (let x = derecha; x >= centroX; x -= 1) {
      if (distancia(pixel(jar, ancho, x, y), centro) < salto * 0.45) {
        aguaDer = x;
        break;
      }
    }
    peor = Math.max(peor, Math.min(aguaIzq - izquierda, derecha - aguaDer));
  }
  return { hueco: peor, filas, contraste };
}

export function contraste(tinta: Rgb, fondo: Rgb): number {
  const clara = Math.max(luminanciaRelativa(tinta), luminanciaRelativa(fondo));
  const oscura = Math.min(luminanciaRelativa(tinta), luminanciaRelativa(fondo));
  return (clara + 0.05) / (oscura + 0.05);
}

/** El peor 5 %: el contraste que solo supera una de cada veinte muestras. */
export function peorCincoPorCiento(valores: readonly number[]): number {
  if (valores.length === 0) return Number.NaN;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.floor((orden.length - 1) * 0.05));
  return orden[i] ?? Number.NaN;
}

function luminanciaRelativa({ r, g, b }: Rgb): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function interior(mascara: Uint8ClampedArray, ancho: number, alto: number, x: number, y: number): boolean {
  const radio = 6;
  for (const dy of [-radio, 0, radio]) {
    for (const dx of [-radio, 0, radio]) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) return false;
      if ((mascara[(yy * ancho + xx) * 4] ?? 0) < 140) return false;
    }
  }
  return true;
}

function pixel(data: Uint8ClampedArray, ancho: number, x: number, y: number): Rgb {
  const i = (y * ancho + x) * 4;
  return { r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 };
}

function distancia(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function valor(
  data: Uint8ClampedArray,
  ancho: number,
  x: number,
  y: number,
  senal: 'luma' | 'azul' = 'luma',
): number {
  const i = (y * ancho + x) * 4;
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  const a = data[i + 3] ?? 0;
  if (senal === 'azul') return b - r;
  return luminancia(r, g, b, a);
}

function recta(puntos: readonly Punto[]): { origen: number; pendiente: number } {
  const n = puntos.length;
  let sx = 0;
  let sy = 0;
  for (const p of puntos) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const p of puntos) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  const pendiente = den === 0 ? 0 : num / den;
  return { origen: my - pendiente * mx, pendiente };
}

function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  if (orden.length % 2 === 1) return orden[medio] ?? 0;
  return ((orden[medio - 1] ?? 0) + (orden[medio] ?? 0)) / 2;
}

function limitar(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
