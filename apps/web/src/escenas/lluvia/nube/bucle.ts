import { engancharReproduccion, silenciar } from '../../../comun/fondo';

/** Los dos últimos segundos se cruzan con el principio, para que el bucle no salte. */
const CRUCE_S = 2;
/** Por debajo de esto el fondo negro del clip (y el ruido del códec) no se pinta. */
const SUELO = 28;

interface Par {
  readonly activo: HTMLVideoElement;
  readonly espera: HTMLVideoElement;
}

function tamano(lienzo: HTMLCanvasElement): { w: number; h: number } | null {
  const rect = lienzo.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (lienzo.width !== w || lienzo.height !== h) {
    lienzo.width = w;
    lienzo.height = h;
  }
  return { w, h };
}

/** El negro del archivo pasa a alfa. El blanco de la nube se queda. */
function claveNegra(datos: Uint8ClampedArray): void {
  for (let i = 0; i < datos.length; i += 4) {
    const r = datos[i] ?? 0;
    const g = datos[i + 1] ?? 0;
    const b = datos[i + 2] ?? 0;
    const m = r > g ? r : g;
    const pico = m > b ? m : b;
    datos[i + 3] = pico <= SUELO ? 0 : Math.min(255, Math.round(((pico - SUELO) * 255) / (255 - SUELO)));
  }
}

function leer(ctx: CanvasRenderingContext2D, fuente: CanvasImageSource, w: number, h: number): ImageData | null {
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(fuente, 0, 0, w, h);
  const foto = ctx.getImageData(0, 0, w, h);
  claveNegra(foto.data);
  return foto;
}

function fundir(abajo: ImageData, arriba: ImageData, t: number): ImageData {
  const salida = new ImageData(abajo.width, abajo.height);
  const a = abajo.data;
  const b = arriba.data;
  const o = salida.data;
  const u = 1 - t;
  for (let i = 0; i < o.length; i += 4) {
    const pa = (a[i + 3] ?? 0) * u;
    const pb = (b[i + 3] ?? 0) * t;
    const s = pa + pb;
    o[i + 3] = Math.min(255, s);
    if (s < 1) continue;
    o[i] = ((a[i] ?? 0) * pa + (b[i] ?? 0) * pb) / s;
    o[i + 1] = ((a[i + 1] ?? 0) * pa + (b[i + 1] ?? 0) * pb) / s;
    o[i + 2] = ((a[i + 2] ?? 0) * pa + (b[i + 2] ?? 0) * pb) / s;
  }
  return salida;
}

/** Póster con el mismo recorte de negro, para cuando no hay vídeo. */
export function pintarPoster(lienzo: HTMLCanvasElement, src: string): () => void {
  const img = new Image();
  let vivo = true;
  img.onload = () => {
    if (!vivo) return;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    const caja = tamano(lienzo);
    if (!ctx || !caja) return;
    const foto = leer(ctx, img, caja.w, caja.h);
    if (foto) ctx.putImageData(foto, 0, 0);
  };
  img.src = src;
  return () => {
    vivo = false;
  };
}

/**
 * Dos vídeos y un lienzo con alfa. El segundo empieza dos segundos antes
 * del final y se cruza: el bucle no salta a un fotograma negro.
 */
export function engancharBucle(
  a: HTMLVideoElement,
  b: HTMLVideoElement,
  lienzo: HTMLCanvasElement,
): () => void {
  let vivo = true;
  let cruzando = false;
  let par: Par = { activo: a, espera: b };
  silenciar(a);
  silenciar(b);
  b.pause();
  const soltarA = engancharReproduccion(a);
  let raf = 0;

  // La nube nace con opacity 0 y el ciclo la vuelve a apagar. Con el padre
  // invisible, Chrome, Firefox y Safari dejan de entregar
  // requestVideoFrameCallback y a veces pausan el vídeo. El callback no se
  // rearma y el lienzo se queda en el póster o en el primer fotograma.
  // El rAF sigue, y si está pausado se le vuelve a pedir play() mudo.
  const reanudar = (video: HTMLVideoElement) => {
    if (document.hidden || !video.paused || video.ended) return;
    silenciar(video);
    void video.play().catch(() => undefined);
  };

  const cuadro = () => {
    if (!vivo) return;
    const { activo, espera } = par;
    reanudar(activo);
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    const caja = ctx ? tamano(lienzo) : null;
    const duracion = activo.duration;
    // currentTime 0 y en pausa es el póster. No se copia: se vería una foto fija.
    const marco = activo.readyState >= 2 && (activo.currentTime > 0 || !activo.paused);
    if (ctx && caja && marco) {
      const queda = duracion > 0 ? duracion - activo.currentTime : CRUCE_S;
      if (!cruzando && duracion > 0 && queda < CRUCE_S && queda > 0) {
        cruzando = true;
        espera.currentTime = 0;
        silenciar(espera);
        void espera.play().catch(() => undefined);
      }
      if (cruzando) reanudar(espera);
      const base = leer(ctx, activo, caja.w, caja.h);
      if (base && cruzando && espera.readyState >= 2 && (espera.currentTime > 0 || !espera.paused)) {
        const encima = leer(ctx, espera, caja.w, caja.h);
        const t = Math.min(1, Math.max(0, 1 - queda / CRUCE_S));
        if (encima) ctx.putImageData(fundir(base, encima, t), 0, 0);
        else ctx.putImageData(base, 0, 0);
      } else if (base) ctx.putImageData(base, 0, 0);

      if (cruzando && (queda <= 0.05 || activo.ended)) {
        activo.pause();
        par = { activo: espera, espera: activo };
        cruzando = false;
      }
    }
    raf = requestAnimationFrame(cuadro);
  };

  raf = requestAnimationFrame(cuadro);
  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
    soltarA();
    a.pause();
    b.pause();
  };
}
