import { alphaFromBlack } from './alpha';

export interface Activos {
  readonly dorso: HTMLImageElement | null;
  readonly frente: HTMLCanvasElement | null;
  readonly mascara: HTMLCanvasElement | null;
  readonly sombra: HTMLImageElement | null;
  readonly arena: HTMLImageElement | null;
  readonly agua: HTMLImageElement | null;
  readonly superficie: HTMLImageElement | null;
  readonly nubePoster: HTMLCanvasElement | null;
  readonly nubeVideo: HTMLVideoElement | null;
}

const vacio = (): Activos => ({
  dorso: null,
  frente: null,
  mascara: null,
  sombra: null,
  arena: null,
  agua: null,
  superficie: null,
  nubePoster: null,
  nubeVideo: null,
});

function imagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function aLienzo(img: HTMLImageElement, teñir: (data: Uint8ClampedArray) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const imagenDatos = ctx.getImageData(0, 0, canvas.width, canvas.height);
  teñir(imagenDatos.data);
  ctx.putImageData(imagenDatos, 0, 0);
  return canvas;
}

function mascaraDesde(img: HTMLImageElement): HTMLCanvasElement {
  return aLienzo(img, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const cobertura = data[i] ?? 0;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = cobertura;
    }
  });
}

function videoNube(): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('playsinline', '');
  return video;
}

/** Una sola carga. Si falta una capa, el dibujo usa el póster o el vidrio de reserva. */
export function cargarActivos(alListo: () => void): Activos {
  const activos = vacio();
  const destino = activos as {
    -readonly [K in keyof Activos]: Activos[K];
  };
  destino.nubeVideo = videoNube();

  void imagen('/frasco/jar-back.webp')
    .then((img) => {
      destino.dorso = img;
      alListo();
    })
    .catch(() => undefined);
  void imagen('/frasco/jar-front.webp')
    .then((img) => {
      destino.frente = aLienzo(img, alphaFromBlack);
      alListo();
    })
    .catch(() => undefined);
  void imagen('/frasco/jar-mask.webp')
    .then((img) => {
      destino.mascara = mascaraDesde(img);
      alListo();
    })
    .catch(() => undefined);
  void imagen('/nube/nube.webp')
    .then((img) => {
      destino.nubePoster = aLienzo(img, alphaFromBlack);
      alListo();
    })
    .catch(() => undefined);
  return activos;
}

const arenaPedida = new WeakSet<Activos>();

/** La textura de arena solo hace falta en Arena y Clásico. */
export function cargarArena(activos: Activos, alListo: () => void): void {
  if (activos.arena || arenaPedida.has(activos)) return;
  arenaPedida.add(activos);
  const destino = activos as { -readonly [K in keyof Activos]: Activos[K] };
  void imagen('/frasco/tex-sand.webp')
    .then((img) => {
      destino.arena = img;
      alListo();
    })
    .catch(() => undefined);
}
