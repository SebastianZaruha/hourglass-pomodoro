/**
 * Una sola lectura de la máscara. La rejilla es la forma del agua, de la
 * arena y del clic: cada celda mira el centro del píxel y entra si pasa de
 * la mitad de blanco.
 */

export const REJILLA_COLUMNAS = 110;
export const REJILLA_FILAS = 252;

export interface Geometria {
  readonly columnas: number;
  readonly filas: number;
  /** 1 si el centro de la celda está dentro del cristal. */
  readonly celdas: Uint8Array;
  /** Celdas interiores de cada fila. */
  readonly anchos: Uint16Array;
  readonly cuelloFila: number;
  /** Puntos interiores en 0..1, empaquetados x, y. Arriba primero. */
  readonly puntos: Float32Array;
  /** Índice de par (x, y) donde empiezan los puntos del bulbo de abajo. */
  readonly inicioAbajo: number;
  readonly puntosArriba: number;
  readonly puntosAbajo: number;
}

export function desdeLuminancia(luma: Uint8Array, ancho: number, alto: number): Geometria {
  const columnas = REJILLA_COLUMNAS;
  const filas = REJILLA_FILAS;
  const celdas = new Uint8Array(columnas * filas);
  const anchos = new Uint16Array(filas);
  for (let fila = 0; fila < filas; fila++) {
    const y = Math.min(alto - 1, Math.floor(((fila + 0.5) * alto) / filas));
    let cuenta = 0;
    for (let col = 0; col < columnas; col++) {
      const x = Math.min(ancho - 1, Math.floor(((col + 0.5) * ancho) / columnas));
      if ((luma[y * ancho + x] ?? 0) > 127) {
        celdas[fila * columnas + col] = 1;
        cuenta++;
      }
    }
    anchos[fila] = cuenta;
  }

  let primera = -1;
  let ultima = -1;
  for (let fila = 0; fila < filas; fila++) {
    if (anchos[fila] === 0) continue;
    if (primera < 0) primera = fila;
    ultima = fila;
  }
  let minimo = Number.POSITIVE_INFINITY;
  for (let fila = Math.max(0, primera); fila <= ultima; fila++) {
    const cuenta = anchos[fila] ?? 0;
    if (cuenta > 0 && cuenta < minimo) minimo = cuenta;
  }
  const estrechas: number[] = [];
  for (let fila = Math.max(0, primera); fila <= ultima; fila++) {
    if ((anchos[fila] ?? 0) === minimo) estrechas.push(fila);
  }
  const cuelloFila = estrechas[Math.floor(estrechas.length / 2)] ?? 0;

  let arriba = 0;
  let abajo = 0;
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      if (celdas[fila * columnas + col] !== 1) continue;
      if (fila < cuelloFila) arriba++;
      else if (fila > cuelloFila) abajo++;
    }
  }
  const puntos = new Float32Array((arriba + abajo) * 2);
  let ia = 0;
  let ib = arriba * 2;
  for (let fila = 0; fila < filas; fila++) {
    if (fila === cuelloFila) continue;
    const y = (fila + 0.5) / filas;
    for (let col = 0; col < columnas; col++) {
      if (celdas[fila * columnas + col] !== 1) continue;
      const x = (col + 0.5) / columnas;
      const destino = fila < cuelloFila ? ia : ib;
      puntos[destino] = x;
      puntos[destino + 1] = y;
      if (fila < cuelloFila) ia += 2;
      else ib += 2;
    }
  }

  return {
    columnas,
    filas,
    celdas,
    anchos,
    cuelloFila,
    puntos,
    inicioAbajo: arriba,
    puntosArriba: arriba,
    puntosAbajo: abajo,
  };
}

/**
 * La fila de la rejilla contra la fila entera de la foto, en fracción del
 * ancho. Sirve para el tope del 2 %.
 */
export function diferenciaDeFilas(
  luma: Uint8Array,
  ancho: number,
  alto: number,
  geo: Geometria,
): { readonly maxima: number; readonly cuelloEsElMinimo: boolean } {
  let maxima = 0;
  let minimo = Number.POSITIVE_INFINITY;
  let filaMinima = 0;
  let alguna = false;
  for (let fila = 0; fila < geo.filas; fila++) {
    const y = Math.min(alto - 1, Math.floor(((fila + 0.5) * alto) / geo.filas));
    let llenos = 0;
    const filaPx = y * ancho;
    for (let x = 0; x < ancho; x++) if ((luma[filaPx + x] ?? 0) > 127) llenos++;
    if (llenos === 0) continue;
    alguna = true;
    const foto = llenos / ancho;
    const rejilla = (geo.anchos[fila] ?? 0) / geo.columnas;
    const delta = Math.abs(foto - rejilla);
    if (delta > maxima) maxima = delta;
    if (llenos < minimo) {
      minimo = llenos;
      filaMinima = fila;
    }
  }
  const anchoCuello = geo.anchos[geo.cuelloFila] ?? 0;
  const fotoEnCuello = (() => {
    const y = Math.min(alto - 1, Math.floor(((geo.cuelloFila + 0.5) * alto) / geo.filas));
    let n = 0;
    for (let x = 0; x < ancho; x++) if ((luma[y * ancho + x] ?? 0) > 127) n++;
    return n;
  })();
  return {
    maxima,
    cuelloEsElMinimo: alguna && anchoCuello > 0 && anchoCuello <= (geo.anchos[filaMinima] ?? 0) && fotoEnCuello <= minimo + ancho * 0.02,
  };
}

export function dentroDeCelda(geo: Geometria, u: number, v: number): boolean {
  const col = Math.floor(u * geo.columnas);
  const fila = Math.floor(v * geo.filas);
  if (col < 0 || fila < 0 || col >= geo.columnas || fila >= geo.filas) return false;
  return geo.celdas[fila * geo.columnas + col] === 1;
}
