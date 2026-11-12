/**
 * Superficie del agua: una recta perpendicular a la gravedad, a la altura
 * que deja el volumen pedido. En reposo se le suma un menisco fijo; el
 * vaivén lo frena el muelle, no esta función.
 */
import { cajaBulbo, filasBulbo } from '../jarTabla';

export interface Punto {
  readonly x: number;
  readonly y: number;
}

export interface Superficie {
  readonly gravedad: Punto;
  readonly corte: number;
  readonly menisco: number;
}

const MUESTRAS = 36;

function volumenEn(filas: readonly (readonly [number, number])[], y: number): number {
  const primero = filas[0];
  const ultimo = filas[filas.length - 1];
  if (!primero || !ultimo) return 0;
  if (y <= primero[0]) return primero[1];
  if (y >= ultimo[0]) return ultimo[1];
  for (let i = 1; i < filas.length; i++) {
    const a = filas[i - 1];
    const b = filas[i];
    if (!a || !b || y < a[0] || y > b[0]) continue;
    const t = (y - a[0]) / (b[0] - a[0] || 1);
    return a[1] + (b[1] - a[1]) * t;
  }
  return ultimo[1];
}

/** Contorno del bulbo en coordenadas locales: x −1..1, y 0 (borde alto) .. 1 (borde bajo). */
function contorno(bulbo: 'arriba' | 'abajo'): Punto[] {
  const filas = filasBulbo(bulbo);
  const box = cajaBulbo(bulbo);
  const alto = box[3] - box[1] || 1;
  const radios: number[] = [];
  for (let i = 0; i < MUESTRAS; i++) {
    const t = i / (MUESTRAS - 1);
    const antes = box[1] + alto * Math.max(0, t - 0.5 / MUESTRAS);
    const despues = box[1] + alto * Math.min(1, t + 0.5 / MUESTRAS);
    const dy = Math.abs(despues - antes) / alto || 1 / MUESTRAS;
    radios.push(Math.abs(volumenEn(filas, antes) - volumenEn(filas, despues)) / (2 * dy));
  }
  const maximo = Math.max(...radios, 1e-6);
  const derecha = radios.map((radio, i) => ({ x: radio / maximo, y: i / (MUESTRAS - 1) }));
  const izquierda = [...derecha].reverse().map((punto) => ({ x: -punto.x, y: punto.y }));
  return [...derecha, ...izquierda];
}

const CONTORNOS = {
  arriba: contorno('arriba'),
  abajo: contorno('abajo'),
} as const;

function producto(normal: Punto, punto: Punto): number {
  return normal.x * punto.x + normal.y * punto.y;
}

function areaDe(puntos: readonly Punto[]): number {
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    if (!a || !b) continue;
    suma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(suma) / 2;
}

/** Recorte de Sutherland–Hodgman. El líquido es lo que cae a favor de la gravedad. */
export function recortar(poligono: readonly Punto[], gravedad: Punto, corte: number): Punto[] {
  const salida: Punto[] = [];
  for (let i = 0; i < poligono.length; i++) {
    const actual = poligono[i];
    const siguiente = poligono[(i + 1) % poligono.length];
    if (!actual || !siguiente) continue;
    const dentroActual = producto(gravedad, actual) >= corte - 1e-9;
    const dentroSiguiente = producto(gravedad, siguiente) >= corte - 1e-9;
    if (dentroActual && dentroSiguiente) {
      salida.push(siguiente);
      continue;
    }
    const den = producto(gravedad, {
      x: siguiente.x - actual.x,
      y: siguiente.y - actual.y,
    });
    const t = Math.abs(den) < 1e-9 ? 0 : (corte - producto(gravedad, actual)) / den;
    const cruce = {
      x: actual.x + (siguiente.x - actual.x) * t,
      y: actual.y + (siguiente.y - actual.y) * t,
    };
    if (dentroActual && !dentroSiguiente) salida.push(cruce);
    else if (!dentroActual && dentroSiguiente) salida.push(cruce, siguiente);
  }
  return salida;
}

function gravedadDe(angulo: number): Punto {
  return { x: Math.sin(angulo), y: Math.cos(angulo) };
}

const AREAS = {
  arriba: areaDe(CONTORNOS.arriba),
  abajo: areaDe(CONTORNOS.abajo),
};

function fraccion(bulbo: 'arriba' | 'abajo', gravedad: Punto, corte: number): number {
  const total = AREAS[bulbo];
  if (total <= 0) return 0;
  return areaDe(recortar(CONTORNOS[bulbo], gravedad, corte)) / total;
}

function rango(bulbo: 'arriba' | 'abajo', gravedad: Punto): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const punto of CONTORNOS[bulbo]) {
    const valor = producto(gravedad, punto);
    if (valor < min) min = valor;
    if (valor > max) max = valor;
  }
  return { min, max };
}

/**
 * Busca el corte cuya área es el volumen pedido. El menisco solo aparece
 * casi derecho: es un ribete, no un balanceo.
 */
export function superficieAgua(bulbo: 'arriba' | 'abajo', volumen: number, angulo: number): Superficie {
  const pedido = Math.min(1, Math.max(0, Number.isFinite(volumen) ? volumen : 0));
  const gravedad = gravedadDe(angulo);
  const { min, max } = rango(bulbo, gravedad);
  let bajo = min;
  let alto = max;
  for (let i = 0; i < 28; i++) {
    const medio = (bajo + alto) / 2;
    const tiene = fraccion(bulbo, gravedad, medio);
    if (tiene > pedido) bajo = medio;
    else alto = medio;
  }
  const quieto = Math.abs(Math.sin(angulo)) < 0.12;
  return { gravedad, corte: (bajo + alto) / 2, menisco: quieto ? 0.012 : 0 };
}

/** Fracción de área que deja la superficie. Es lo que mide el test. */
export function volumenDibujado(bulbo: 'arriba' | 'abajo', volumen: number, angulo: number): number {
  const superficie = superficieAgua(bulbo, volumen, angulo);
  return fraccion(bulbo, superficie.gravedad, superficie.corte);
}

function aFoto(bulbo: 'arriba' | 'abajo', punto: Punto): Punto {
  const box = cajaBulbo(bulbo);
  const centro = (box[0] + box[2]) / 2;
  const medioAncho = (box[2] - box[0]) / 2;
  const alto = box[3] - box[1];
  return { x: centro + punto.x * medioAncho, y: box[1] + punto.y * alto };
}

/**
 * Ángulo que hay que pasar al polígono, ya dentro del frasco girado,
 * para que la superficie quede horizontal en el mundo.
 * `residuo` es el retraso del muelle: en reposo es 0.
 */
export function anguloNivel(anguloFrasco: number, residuo: number): number {
  return anguloFrasco - residuo;
}

/** El cuello está bajo el agua. Si no, el chorro no puede salir. */
export function cuelloMojado(volumen: number, angulo: number): boolean {
  if (volumen <= 0.02) return false;
  const superficie = superficieAgua('arriba', volumen, angulo);
  return producto(superficie.gravedad, { x: 0, y: 1 }) >= superficie.corte - 1e-6;
}

/** Polígono del líquido en coordenadas de la foto (0..1), listo para pintar. */
export function poligonoLiquido(bulbo: 'arriba' | 'abajo', volumen: number, angulo: number): Punto[] {
  const superficie = superficieAgua(bulbo, volumen, angulo);
  const local = recortar(CONTORNOS[bulbo], superficie.gravedad, superficie.corte);
  return local.map((punto) => aFoto(bulbo, punto));
}

/** La línea de la superficie, ya en la foto, para el menisco. */
export function lineaMenisco(bulbo: 'arriba' | 'abajo', volumen: number, angulo: number): Punto[] {
  if (volumen <= 0.02 || volumen >= 0.98) return [];
  const superficie = superficieAgua(bulbo, volumen, angulo);
  const gy =
    Math.abs(superficie.gravedad.y) < 0.08
      ? Math.sign(superficie.gravedad.y || 1) * 0.08
      : superficie.gravedad.y;
  const derecha = CONTORNOS[bulbo].slice(0, MUESTRAS);
  const radioEn = (y: number) => {
    let mejor = derecha[0];
    let dist = Infinity;
    for (const punto of derecha) {
      const d = Math.abs(punto.y - y);
      if (d < dist) {
        dist = d;
        mejor = punto;
      }
    }
    return mejor?.x ?? 0;
  };
  const linea: Punto[] = [];
  for (let i = 0; i <= 28; i++) {
    const x = -1 + (2 * i) / 28;
    const y = (superficie.corte - superficie.gravedad.x * x) / gy;
    if (y < -0.02 || y > 1.02 || Math.abs(x) > radioEn(y) + 0.02) continue;
    linea.push(aFoto(bulbo, { x, y }));
  }
  return linea;
}
