// Tipos públicos del módulo "agua de vidrio".
//
// Espacios de coordenadas (importante):
//  - "frasco": las coordenadas de tus polígonos, fijas, con el frasco de pie.
//  - "mundo": píxeles CSS del canvas (x a la derecha, y hacia abajo). Lo que ves.
//    La gravedad vive aquí: el agua siempre "cae" hacia +y del mundo.
//  La matriz de EstadoAgua convierte frasco → mundo (rotación + posición + escala).

/** Polígono plano: [x0, y0, x1, y1, ...]. Cerrado implícitamente. */
export type Poligono = ArrayLike<number>;

/** Matriz afín 2D. Vale un DOMMatrix o un objeto propio con estos 6 números. */
export interface Matriz2D {
  a: number; b: number; c: number; d: number; e: number; f: number;
}

/** Imagen o vídeo de fondo, el mismo que ves detrás del canvas. */
export type FuenteFondo = HTMLImageElement | HTMLVideoElement;

export interface OpcionesAgua {
  /** Interior del vidrio de cada bulbo, en coordenadas del frasco. [0] = arriba (de pie), [1] = abajo. */
  bulbos: readonly [Poligono, Poligono];
  /** Punto del cuello donde nacen las gotas, en coordenadas del frasco. */
  cuello: { x: number; y: number };
  /** Se llama cuando una gota toca el agua. u = 0..1 a lo largo de la línea de agua (izq → der). */
  alCaerGota?: (bulbo: 0 | 1, u: number, fuerza: number) => void;
  /** Cuánto se reduce el fondo antes de desenfocarlo (4 = un cuarto). Más alto = más borroso y más barato. */
  reduccion?: number;
  /** Si el fondo es un vídeo, cuántas veces por segundo como mucho se copia (15 por defecto). Copiar un frame es lo más caro del módulo. */
  fpsVideo?: number;
  /**
   * Refracción 2D del fondo dentro del agua (lupa y desvío por la ola). true por defecto.
   * false: el fondo borroso va recto, sin lupa ni desvío. Para cuando ya refracta otro vidrio
   * (el frasco 3D): así no se suman dos refracciones. Velo, borde, brillos y gotas no cambian.
   */
  refraccion?: boolean;
}

/** Estado de un bulbo en este frame. Lo calcula el modelo de la app. */
export interface EstadoBulbo {
  /** y del mundo (px CSS) de la superficie media del agua. Si está por debajo del bulbo, no se pinta. */
  nivel: number;
  /**
   * Alturas de la ola en px, positivo hacia ARRIBA, medidas en vertical del mundo.
   * Se reparten a distancias iguales sobre la línea de agua en reposo (horizontal del mundo),
   * de la pared izquierda (índice 0) a la derecha (último). Vale cualquier longitud ≥ 2 (la app usa 32).
   */
  alturas: ArrayLike<number>;
}

export interface EstadoAgua {
  /** Frasco → mundo. Incluye la rotación (±180°), el pivote y la escala. */
  matriz: Matriz2D;
  bulbos: readonly [EstadoBulbo, EstadoBulbo];
  /** 0..1. Opacidad del frasco (fundido de la media vuelta del reinicio). */
  opacidad: number;
  /** px. Desenfoque extra del frasco durante la media vuelta (0 = nada). */
  desenfoque: number;
}

export interface EstadoGotas {
  /** 0..1. 0 = no caen gotas (pausa, frasco tumbado...). 1 = chorro máximo. */
  caudal: number;
  /** ms desde el frame anterior. */
  dt: number;
}

export interface AguaVidrio {
  /** Llama al montar y cuando cambie el tamaño del canvas (px CSS). */
  redimensionar(ancho: number, alto: number): void;
  /** Llama al cargar la imagen, al cambiar de fondo, y cada frame si es un vídeo (es barato si no hay frame nuevo). */
  actualizarFondo(fuente: FuenteFondo): void;
  /** Pinta el agua de los dos bulbos. Antes de pintarGotas. */
  pintarAgua(ctx: CanvasRenderingContext2D, estado: EstadoAgua): void;
  /** Mueve y pinta las gotas del cuello. Usa la superficie que calculó pintarAgua en este frame. */
  pintarGotas(ctx: CanvasRenderingContext2D, gotas: EstadoGotas): void;
  destruir(): void;
}
