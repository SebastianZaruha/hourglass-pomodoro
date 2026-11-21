import type { SessionSnapshot } from '@reloj/core';
import type { ComponentType, RefObject } from 'react';

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
  /**
   * Solo con el frasco 3D: `matriz` lleva de px de la ventana a la hoja del vidrio
   * (que gira con él) y `cuello` es el pivote en px de la ventana. Lo usa quien
   * pinta en el mundo, como el agua, para que su superficie siga horizontal.
   */
  readonly pantalla?: {
    readonly matriz: DOMMatrixReadOnly;
    readonly cuello: { readonly x: number; readonly y: number };
    /** Caja del fondo (cover anclado) en px de la ventana: el mundo del agua. Hito 2. */
    readonly fondo?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
    /** Escala de la pose (intro). 1 de pie. Hito 2. */
    readonly escala?: number;
  };
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
        /** Arena y Clásico. Si falta, el navegador usa el WebP. */
        readonly avif?: string;
        /** Reserva de Lluvia cuando no hay AVIF. */
        readonly jpg?: string;
        readonly estrecho?: { readonly webp: string; readonly avif?: string; readonly jpg?: string };
      }
    | {
        readonly tipo: 'video';
        readonly webm: string;
        readonly mp4: string;
        readonly poster: string;
        /** Cruce entre dos copias para que el bucle corto no muestre el corte. */
        readonly fundido?: boolean;
      };
  readonly ancla: { readonly x: number; readonly y: number; readonly tope?: number };
  readonly reserva: string;
  readonly barra: string;
  readonly reloj: { readonly digitos: string; readonly pista: string };
  readonly tinta: string;
  readonly vidrio: { readonly velo: string; readonly saturacion: number };
  readonly luz: { readonly direccion: number; readonly tinte: string; readonly fuerza: number };
  readonly sombra: { readonly color: string; readonly opacidad: number };
  /**
   * Solo para el frasco 3D. `pie`: dónde apoya el ancla del fondo ('bulbo' en la
   * duna de Arena; si falta, la base). `estudio`: reflejos de estudio en vez de la
   * foto (Clásico). `tinte`: color de la luz de la escena (#rrggbb).
   */
  readonly frasco3d?: {
    readonly pie?: 'bulbo' | 'base';
    readonly estudio?: boolean;
    readonly tinte?: string;
  };
}

/** Lienzo al montar el frasco dibujado. La geometría de la foto llega en la vuelta 6. */
export interface MedidaLienzo {
  readonly ancho: number;
  readonly alto: number;
}

/** Lo que una escena puede poner encima del frasco. Solo recibe opacidad, nunca el ángulo. */
export interface PropsEncima {
  readonly caja: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Lo escribe el frasco. 1 de pie, 0 a partir de 50°, también en la media vuelta. */
  readonly opacidad: RefObject<number>;
  readonly reducir: boolean;
  readonly oscuro: boolean;
}

export interface Escena {
  readonly id: 'lluvia' | 'arena' | 'clasico';
  readonly nombre: { readonly es: string; readonly en: string };
  readonly relojAlto: boolean;
  readonly claro: Aspecto;
  readonly oscuro: Aspecto;
  readonly Encima?: ComponentType<PropsEncima>;
  crearContenido(medida: MedidaLienzo, esquema: 'claro' | 'oscuro'): Contenido;
}
