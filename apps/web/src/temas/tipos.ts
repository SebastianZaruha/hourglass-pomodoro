/** Luz de un modo. El dibujo solo lee estos números: no pregunta qué tema es. */
export interface SombraLuz {
  readonly color: string;
  readonly opacidad: number;
  readonly desenfoque: number;
  readonly inclinacion: number;
}

export interface NubeLuz {
  readonly brillo: number;
  readonly saturacion: number;
  readonly tinte: string;
}

export interface Luz {
  readonly direccion: number;
  readonly tinte: string;
  readonly fuerzaTinte: number;
  readonly brillo: number;
  readonly reflejos: number;
  readonly brilloBorde: number;
  readonly sombra: SombraLuz;
  readonly nube: NubeLuz;
}

export interface RelojTema {
  readonly digitos: string;
  readonly pista: string;
}

/** Tinta de lo que no es vidrio (pie, botón del menú). El vidrio lleva su propio blanco. */
export interface UiTema {
  readonly tinta: string;
  readonly tintaSuave: string;
  readonly velo: string;
  readonly borde: string;
  /** Brillo interior, arriba. */
  readonly brillo: string;
  /** Sombra exterior, suave. */
  readonly sombra: string;
  /** Sombra del texto, para leerlo sin velo. */
  readonly sombraTexto: string;
  /** Saturación del fondo tras el vidrio. Arena la baja para no teñir de caramelo. */
  readonly saturacion: number;
}

export interface FotoEstrecha {
  readonly webp: string;
  readonly avif?: string;
}

export type FondoTema =
  | { readonly tipo: 'degradado' }
  | {
      readonly tipo: 'foto';
      /** WebP. Si hay `jpg`, el `<img>` usa ese y el WebP va en un `<source>`. */
      readonly src: string;
      readonly avif?: string;
      readonly jpg?: string;
      readonly ancho?: number;
      readonly alto?: number;
      /** Versión más chica para pantallas estrechas. */
      readonly estrecho?: FotoEstrecha;
    }
  | {
      readonly tipo: 'video';
      readonly webm: string;
      readonly mp4: string;
      readonly poster: string;
      readonly estrecho?: FotoEstrecha;
    };

export interface ModoTema {
  readonly fondo: FondoTema;
  /** Color plano mientras no llega la foto o el vídeo. */
  readonly reserva: string;
  readonly luz: Luz;
  readonly reloj: RelojTema;
  readonly ui: UiTema;
  /** theme-color del navegador. */
  readonly barra: string;
  readonly granos: 'clara' | 'oscura';
}

export type IdTema = 'lluvia' | 'arena' | 'clasico';
export type ContenidoTema = 'agua' | 'arena';

export interface Tema {
  readonly id: IdTema;
  readonly nombre: string;
  readonly contenido: ContenidoTema;
  readonly claro: ModoTema;
  readonly oscuro: ModoTema;
  readonly anclaSuelo: { readonly x: number; readonly y: number };
  /** Lluvia lleva nube. El resto del código solo mira este flag. */
  readonly nube: boolean;
  /**
   * La precarga de hoy (causa 9) pide la textura de arena si el contenido
   * no es arena, y el vídeo de la nube si el tema no es Lluvia.
   * El campo guarda ese comportamiento hasta la fase de carga.
   */
  readonly adelantarArena: boolean;
  readonly adelantarNube: boolean;
  /** En ancha, el reloj se centra en la columna. Lluvia y Arena lo dejan arriba. */
  readonly relojCentrado: boolean;
}

export function modoDe(tema: Tema, scheme: 'light' | 'dark'): ModoTema {
  return scheme === 'dark' ? tema.oscuro : tema.claro;
}
