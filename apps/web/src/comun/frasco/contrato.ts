import type { SessionSnapshot } from '@reloj/core';

/** Forma del hueco del frasco. La única. Sale de jar-mask.webp (vuelta 6). */
export interface GeometriaFrasco {
  /** Alto/ancho de la caja de la foto: 1024/446. */
  readonly aspecto: number;
  /** Ventana interior simétrica alrededor del cuello, en fracciones de la foto (0..1). */
  readonly ventana: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
  /** Radio interior (0..1 del medio ancho de la ventana) a la altura y ∈ [-1, 1] de la ventana. */
  radio(y: number): number;
  /** Máscara real (no simétrica) para recortar lo que se pinta. Blanco = dentro. */
  readonly mascara: CanvasImageSource;
  /** Puntos interiores de cada bulbo. Pares x,y en fracción de la foto. */
  readonly puntos: { readonly arriba: Float32Array; readonly abajo: Float32Array };
  /** Fila del cuello, en fracción de la foto. */
  readonly cuelloY: number;
}

export type FaseGiro = 'reposo' | 'arrastre' | 'volviendo' | 'volteo';

export interface EntradaPaso {
  readonly ahora: number;
  readonly dt: number;
  readonly angulo: number;
  readonly velocidad: number;
  readonly fase: FaseGiro;
  readonly snap: SessionSnapshot;
  readonly reducir: boolean;
}

export interface Pintura {
  readonly caja: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly angulo: number;
  readonly esquema: 'claro' | 'oscuro';
  readonly geo: GeometriaFrasco;
}

export interface Contenido {
  /** Avanza la física. Devuelve true si algo se sigue moviendo (el bucle no se duerme). */
  paso(e: EntradaPaso): boolean;
  /** Pinta en coordenadas del mundo, entre el vidrio de detrás y el de delante. */
  pintar(ctx: CanvasRenderingContext2D, p: Pintura): void;
  /**
   * En el fotograma en que el volteo llega a 180° y el ángulo vuelve a 0.
   * El reinicio publicado hace esta llamada dos veces: la primera coloca la
   * arena con el vidrio aún a 180°; la segunda gira la rejilla y el ángulo
   * vuelve a 0. El fotograma de antes y el de después se ven iguales.
   */
  alVoltear(motivo: 'reinicio' | 'fase', snap: SessionSnapshot): void;
  /** Al cambiar de escena: suelta todo. No queda nada vivo. */
  destruir(): void;
}

export interface Aspecto {
  readonly fondo:
    | { readonly tipo: 'degradado'; readonly css: string }
    | {
        readonly tipo: 'foto';
        readonly webp: string;
        readonly avif: string;
        readonly estrecho?: { readonly webp: string; readonly avif: string };
      }
    | { readonly tipo: 'video'; readonly webm: string; readonly mp4: string; readonly poster: string };
  readonly ancla: { readonly x: number; readonly y: number };
  readonly reserva: string;
  readonly barra: string;
  readonly reloj: { readonly digitos: string; readonly pista: string };
  readonly tinta: string;
  readonly vidrio: { readonly velo: string; readonly saturacion: number };
  readonly luz: { readonly direccion: number; readonly tinte: string; readonly fuerza: number };
  readonly sombra: { readonly color: string; readonly opacidad: number };
}

/** Lienzo al montar el frasco dibujado. La geometría de la foto llega en la vuelta 6. */
export interface MedidaLienzo {
  readonly ancho: number;
  readonly alto: number;
}

export interface Escena {
  readonly id: 'lluvia' | 'arena' | 'clasico';
  readonly nombre: { readonly es: string; readonly en: string };
  readonly relojAlto: boolean;
  readonly claro: Aspecto;
  readonly oscuro: Aspecto;
  crearContenido(medida: MedidaLienzo, esquema: 'claro' | 'oscuro'): Contenido;
}
