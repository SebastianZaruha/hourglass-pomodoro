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

export interface UiTema {
  readonly tinta: string;
  readonly tintaSuave: string;
  readonly hora: string;
  readonly pista: string;
  readonly pausa: string;
  readonly menu: string;
  readonly menuSolido: string;
  readonly borde: string;
  readonly pastilla: string;
  readonly pastillaTinta: string;
  readonly pie: string;
  readonly halo: string;
  readonly barra: string;
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
    }
  | { readonly tipo: 'video'; readonly webm: string; readonly mp4: string; readonly poster: string };

export interface ModoTema {
  readonly fondo: FondoTema;
  readonly luz: Luz;
  readonly ui: UiTema;
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
}

export function modoDe(tema: Tema, scheme: 'light' | 'dark'): ModoTema {
  return scheme === 'dark' ? tema.oscuro : tema.claro;
}
