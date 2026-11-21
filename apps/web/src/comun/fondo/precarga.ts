import type { Aspecto } from '../frasco';

interface Red {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

/** Save-Data, 2G o 3G: ni precarga ni vídeo. Se queda el póster. */
export function ahorraDatos(): boolean {
  const red = (navigator as Navigator & { readonly connection?: Red }).connection;
  if (!red) return false;
  if (red.saveData) return true;
  const tipo = red.effectiveType;
  return tipo === 'slow-2g' || tipo === '2g' || tipo === '3g';
}

/**
 * Un solo formato por fondo: AVIF en las fotos, póster y WebM en el vídeo.
 * El MP4 y el WebP ancho no se piden por adelantado.
 */
export function direccionesDePrecarga(aspecto: Aspecto): readonly string[] {
  const fondo = aspecto.fondo;
  if (fondo.tipo === 'foto') {
    const urls = [fondo.avif];
    if (fondo.estrecho) urls.push(fondo.estrecho.avif);
    return urls;
  }
  if (fondo.tipo === 'video') return [fondo.poster, fondo.webm];
  return [];
}

/** Después de `load`, y en un hueco, pide el resto con prioridad baja. */
export function precargarFondos(urls: readonly string[]): void {
  if (urls.length === 0 || ahorraDatos()) return;
  const lanzar = () => {
    const correr = () => {
      for (const url of urls) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = url.endsWith('.webm') || url.endsWith('.mp4') ? 'video' : 'image';
        document.head.appendChild(link);
      }
    };
    if (window.requestIdleCallback) window.requestIdleCallback(correr, { timeout: 2500 });
    else window.setTimeout(correr, 400);
  };
  if (document.readyState === 'complete') lanzar();
  else window.addEventListener('load', lanzar, { once: true });
}
