import type { FondoTema, IdTema, Tema } from '../temas/tipos';

/** Color plano que se pinta al instante, antes de la foto o el vídeo. */
const COLORES: Record<string, string> = {
  '/fondos/lluvia-claro.webp': '#c5cdc8',
  '/fondos/lluvia-oscuro.webp': '#2c2824',
  '/fondos/arena-claro.webp': '#e4c7a4',
  '/fondos/arena-oscuro.webp': '#3a2618',
  '/fondos/clasico-claro.webp': '#e8dfd4',
  '/fondos/clasico-oscuro.webp': '#2a2422',
};

export const NUBE_VIDEO = '/nube/nube.webm';
export const ARENA_TEXTURA = '/frasco/tex-sand.webp';
export const NUBE_VIDEO_MP4 = '/nube/nube.mp4';

export interface Red {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

/** Ahorro de datos o una red 2G: no se adelantan los vídeos. */
export function conexionAhorro(red: Red | null | undefined): boolean {
  if (!red) return false;
  if (red.saveData) return true;
  return red.effectiveType === '2g' || red.effectiveType === 'slow-2g';
}

export function colorDeFondo(fondo: FondoTema): string {
  if (fondo.tipo === 'degradado') return '#e7dfd3';
  const clave = fondo.tipo === 'foto' ? fondo.src : fondo.poster;
  return COLORES[clave] ?? '#d9d3cb';
}

/**
 * Primero el otro modo del tema activo, luego los otros temas en el mismo
 * modo, y al final el modo que queda. El fondo que ya se ve no entra.
 */
export function colaDeFondos(temas: readonly Tema[], activo: IdTema, scheme: 'light' | 'dark'): FondoTema[] {
  const tema = temas.find((item) => item.id === activo) ?? temas[0];
  if (!tema) return [];
  const otroModo = scheme === 'dark' ? tema.claro.fondo : tema.oscuro.fondo;
  const mismo: FondoTema[] = [];
  const cruzado: FondoTema[] = [];
  for (const item of temas) {
    if (item.id === activo) continue;
    mismo.push(scheme === 'dark' ? item.oscuro.fondo : item.claro.fondo);
    cruzado.push(scheme === 'dark' ? item.claro.fondo : item.oscuro.fondo);
  }
  return [otroModo, ...mismo, ...cruzado];
}

/** URLs de un fondo. Con ahorro no van los vídeos, solo el póster. */
export function urlsDeFondo(fondo: FondoTema, ahorro: boolean): string[] {
  if (fondo.tipo === 'degradado') return [];
  if (fondo.tipo === 'foto') {
    return unicos([fondo.estrecho?.avif, fondo.estrecho?.webp, fondo.avif, fondo.src, fondo.jpg]);
  }
  return unicos([
    fondo.poster,
    fondo.estrecho?.avif,
    fondo.estrecho?.webp,
    ...(ahorro ? [] : [fondo.webm, fondo.mp4]),
  ]);
}

export function urlsPrefetch(
  temas: readonly Tema[],
  activo: IdTema,
  scheme: 'light' | 'dark',
  ahorro: boolean,
): string[] {
  const fondos = colaDeFondos(temas, activo, scheme).flatMap((fondo) => urlsDeFondo(fondo, ahorro));
  const tema = temas.find((item) => item.id === activo);
  if (tema && tema.contenido !== 'arena') fondos.push(ARENA_TEXTURA);
  if (activo !== 'lluvia' && !ahorro) fondos.push(NUBE_VIDEO);
  return unicos(fondos);
}

function unicos(urls: readonly (string | undefined)[]): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

interface Ventana {
  readonly document: Document;
  readonly requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  readonly setTimeout: Window['setTimeout'];
  readonly addEventListener: Window['addEventListener'];
}

/** Después de cargar, y en un hueco, pide el resto con prioridad baja. */
export function prefetchEnReposo(urls: readonly string[], win: Ventana = window): void {
  const lanzar = () => {
    const correr = () => {
      for (const url of urls) {
        const link = win.document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = url.endsWith('.webm') || url.endsWith('.mp4') ? 'video' : 'image';
        win.document.head.appendChild(link);
      }
    };
    if (win.requestIdleCallback) win.requestIdleCallback(correr, { timeout: 2500 });
    else win.setTimeout(correr, 400);
  };
  if (win.document.readyState === 'complete') lanzar();
  else win.addEventListener('load', lanzar, { once: true });
}

/** El vídeo de la nube solo pide bytes cuando Lluvia está activa y hay red. */
export function activarNube(video: HTMLVideoElement, activa: boolean, ahorro: boolean): void {
  if (!activa || ahorro) {
    video.pause();
    return;
  }
  if (!video.getAttribute('src')) {
    video.preload = 'auto';
    video.src = NUBE_VIDEO;
    video.addEventListener(
      'error',
      () => {
        if (video.src.endsWith('nube.mp4')) return;
        video.src = NUBE_VIDEO_MP4;
      },
      { once: true },
    );
  }
  if (video.paused) void video.play().catch(() => undefined);
}
