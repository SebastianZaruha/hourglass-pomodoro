import type { FondoTema, IdTema, ModoTema, Tema } from '../temas/tipos';

export const NUBE_VIDEO = '/nube/nube.webm';
export const NUBE_VIDEO_MP4 = '/nube/nube.mp4';

export interface Red {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

/** Ahorro de datos o una red 2G o 3G: no se adelantan los vídeos. */
export function conexionAhorro(red: Red | null | undefined): boolean {
  if (!red) return false;
  if (red.saveData) return true;
  const tipo = red.effectiveType;
  return tipo === 'slow-2g' || tipo === '2g' || tipo === '3g';
}

export function colorDeFondo(modo: Pick<ModoTema, 'reserva'>): string {
  return modo.reserva;
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
  if (fondo.tipo === 'foto') return unicos([fondo.avif ?? fondo.src]);
  if (ahorro) return unicos([fondo.poster]);
  return unicos([fondo.webm]);
}

export function urlsPrefetch(
  temas: readonly Tema[],
  activo: IdTema,
  scheme: 'light' | 'dark',
  ahorro: boolean,
): string[] {
  const fondos = colaDeFondos(temas, activo, scheme).flatMap((fondo) => urlsDeFondo(fondo, ahorro));
  const tema = temas.find((item) => item.id === activo);
  if (tema?.adelantarNube && !ahorro) fondos.push(NUBE_VIDEO);
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
