/**
 * Frasco fotográfico en la web.
 *
 * Escena (HTML, detrás) → sombra de contacto y sombra de luz → jar-back →
 * refracción del fondo → material (textura × máscara × nivel) → chorro en
 * vídeo con alfa (o atlas) → brillos en SCREEN → nube delante del cristal,
 * más ancha que el bulbo. Las briznas van en HTML, por encima del pie.
 */
import {
  JAR_BOT_BOX,
  JAR_NECK_Y,
  JAR_TOP_BOX,
  SCENE_LIGHT,
  cloudIdle,
  dioramaPlacement,
  jarSurface,
  streamFrame,
  type MaterialId,
} from '@reloj/core';

type AmbientMod = typeof import('./ambient');
let ambientMod: AmbientMod | null = null;
let ambientLoading = false;

function ambientFor(id: MaterialId): AmbientMod | null {
  if (id !== 'miel' && id !== 'nieve') return null;
  if (!ambientMod && !ambientLoading) {
    ambientLoading = true;
    void import('./ambient').then((mod) => {
      ambientMod = mod;
      mod.preloadAmbient(id);
    });
  }
  return ambientMod;
}

const FRAME_W = 96;
const FRAME_H = 512;
const SPLASH_W = 128;
const SPLASH_H = 220;

type Kind = 'sand' | 'water' | 'honey' | 'snow';

const KIND: Record<MaterialId, Kind> = {
  arena: 'sand',
  lluvia: 'water',
  miel: 'honey',
  nieve: 'snow',
};

function load(src: string): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image;
}

const glassDir =
  typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches ? '/glass/' : '/glass/hi/';
const back = load(`${glassDir}jar-back.webp`);
const front = load(`${glassDir}jar-front-highlights.webp`);
const mask = load(`${glassDir}jar-interior-mask.webp`);
const shadow = load(`${glassDir}jar-shadow.webp`);
const cloud = load('/glass/cloud-real.webp');
const surfaceTex = load('/glass/tex-water-surface.webp');
const textures: Record<Kind, HTMLImageElement> = {
  sand: load('/glass/tex-sand.webp'),
  water: load('/glass/tex-water.webp'),
  honey: load('/glass/tex-honey.webp'),
  snow: load('/glass/tex-snow.webp'),
};
let atlases: Record<Kind, HTMLImageElement> | null = null;
let splashes: Record<Kind, HTMLImageElement> | null = null;

function ensureSheets(): void {
  if (atlases && splashes) return;
  atlases = {
    sand: load('/streams/sand-atlas.webp'),
    water: load('/streams/water-atlas.webp'),
    honey: load('/streams/honey-atlas.webp'),
    snow: load('/streams/snow-atlas.webp'),
  };
  splashes = {
    sand: load('/streams/sand-splash.webp'),
    water: load('/streams/water-splash.webp'),
    honey: load('/streams/honey-splash.webp'),
    snow: load('/streams/snow-splash.webp'),
  };
}

const videos = new Map<Kind, HTMLVideoElement>();

function streamVideo(kind: Kind): HTMLVideoElement {
  const existing = videos.get(kind);
  if (existing) return existing;
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  const webm = document.createElement('source');
  webm.src = `/streams/${kind}.webm`;
  webm.type = 'video/webm';
  video.appendChild(webm);
  const mp4 = document.createElement('source');
  mp4.src = `/streams/${kind}.mp4`;
  mp4.type = 'video/mp4; codecs="hvc1"';
  video.appendChild(mp4);
  video.load();
  videos.set(kind, video);
  return video;
}

function ready(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

export function jarLayersReady(): boolean {
  return ready(back) && ready(front) && ready(mask) && ready(shadow);
}

const blurs = new Map<string, HTMLCanvasElement>();
let maskAlpha: HTMLCanvasElement | null = null;

/** La máscara llega opaca (blanco = interior). destination-in usa el alfa. */
function lumenMask(): HTMLCanvasElement | null {
  if (maskAlpha) return maskAlpha;
  if (!ready(mask)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = mask.naturalWidth;
  canvas.height = mask.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(mask, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const cover = data[i] ?? 0;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = cover;
  }
  ctx.putImageData(image, 0, 0);
  maskAlpha = canvas;
  return canvas;
}

function blurredScene(photo: HTMLImageElement, key: string): HTMLCanvasElement | null {
  if (!ready(photo)) return null;
  const cached = blurs.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(photo.naturalWidth / 5));
  canvas.height = Math.max(2, Math.round(photo.naturalHeight / 5));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.filter = 'blur(8px)';
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
  blurs.set(key, canvas);
  return canvas;
}

let plate: HTMLCanvasElement | null = null;
let plateCtx: CanvasRenderingContext2D | null = null;

function scratch(w: number, h: number): CanvasRenderingContext2D | null {
  const width = Math.max(2, Math.round(w));
  const height = Math.max(2, Math.round(h));
  if (!plate || plate.width !== width || plate.height !== height) {
    plate = document.createElement('canvas');
    plate.width = width;
    plate.height = height;
    plateCtx = plate.getContext('2d');
  }
  if (plateCtx) {
    plateCtx.setTransform(1, 0, 0, 1, 0, 0);
    plateCtx.globalAlpha = 1;
    plateCtx.globalCompositeOperation = 'source-over';
    plateCtx.filter = 'none';
    plateCtx.clearRect(0, 0, width, height);
  }
  return plateCtx;
}

function clipFill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  surface: number,
  box: readonly [number, number, number, number],
  heap: number,
  wave: number,
): boolean {
  const ySurf = surface * h;
  const y0 = box[1] * h;
  const y1 = box[3] * h;
  if (ySurf >= y1 - 1) return false;
  ctx.beginPath();
  ctx.moveTo(0, y1);
  ctx.lineTo(w, y1);
  const steps = 28;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const bell = Math.sin(t * Math.PI);
    const yy = Math.max(y0, ySurf - heap * bell * h + wave * Math.sin(t * Math.PI * 2));
    ctx.lineTo(t * w, yy);
  }
  ctx.closePath();
  ctx.clip();
  return true;
}

export interface PhotoFrame {
  readonly id: MaterialId;
  readonly top: number;
  readonly bottom: number;
  readonly phase: number;
  readonly streamTime: number;
  readonly cloudTime: number;
  readonly running: boolean;
  readonly paused: boolean;
  readonly reduceMotion: boolean;
  readonly viewW: number;
  readonly viewH: number;
}

export function drawPhotoreal(ctx: CanvasRenderingContext2D, frame: PhotoFrame): boolean {
  if (!jarLayersReady()) return false;
  const photo = document.querySelector<HTMLImageElement>('.scene-photo');
  const imageW = photo?.naturalWidth || 1920;
  const imageH = photo?.naturalHeight || 1080;
  const place = dioramaPlacement(frame.viewW, frame.viewH, imageW, imageH, frame.id, true);
  const sink = place.jar.h * 0.016;
  const jar = { ...place.jar, y: place.jar.y + sink };
  const grade = SCENE_LIGHT[frame.id];
  const kind = KIND[frame.id];
  const liquid = kind === 'water' || kind === 'honey';
  const heap = kind === 'sand' ? 0.045 : kind === 'snow' ? 0.032 : 0;

  ctx.clearRect(0, 0, frame.viewW, frame.viewH);
  ambientFor(frame.id)?.drawAmbient(ctx, frame, jar, 'behind');

  const footX = place.footX;
  const footY = place.footY;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 8, 4, 0.72)';
  ctx.beginPath();
  ctx.ellipse(footX, footY + 2, jar.w * 0.22, Math.max(4, jar.w * 0.028), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 14, 8, 0.38)';
  ctx.beginPath();
  ctx.ellipse(
    footX + grade.dx * jar.w,
    footY + jar.h * 0.02,
    jar.w * 0.55,
    Math.max(8, jar.w * 0.07),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grade.caustic;
  ctx.beginPath();
  ctx.ellipse(footX - grade.dx * jar.w * 0.3, footY + jar.h * 0.008, jar.w * 0.22, Math.max(4, jar.w * 0.02), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (ready(shadow)) ctx.drawImage(shadow, jar.x, jar.y, jar.w, jar.h);
  ctx.drawImage(back, jar.x, jar.y, jar.w, jar.h);

  const g = scratch(jar.w, jar.h);
  if (g && plate) {
    const blur = photo ? blurredScene(photo, frame.id) : null;
    if (blur) {
      g.save();
      g.translate(plate.width / 2, plate.height / 2);
      g.scale(1.045, 1.05);
      g.translate(-plate.width / 2 - grade.dx * 14, -plate.height / 2);
      const scene = place.scene;
      g.drawImage(
        blur,
        (scene.x - jar.x) * (plate.width / jar.w),
        (scene.y - jar.y) * (plate.height / jar.h),
        scene.w * (plate.width / jar.w),
        scene.h * (plate.height / jar.h),
      );
      g.restore();
      const alphaMask = lumenMask();
      if (alphaMask) {
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(alphaMask, 0, 0, plate.width, plate.height);
        g.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.drawImage(plate, jar.x, jar.y, jar.w, jar.h);
        ctx.restore();
      }
    }

    g.clearRect(0, 0, plate.width, plate.height);
    const tex = textures[kind];
    const topY = jarSurface('top', frame.top);
    const botY = jarSurface('bot', frame.bottom);
    const wave = liquid && !frame.reduceMotion ? Math.sin(frame.phase * 2.2) * 0.012 : 0;
    const drift = liquid && !frame.reduceMotion ? Math.sin(frame.phase * 0.45) * plate.width * 0.04 : 0;
    const paintBulb = (surface: number, box: readonly [number, number, number, number]) => {
      g.save();
      if (!clipFill(g, plate!.width, plate!.height, surface, box, heap, wave * plate!.height)) {
        g.restore();
        return;
      }
      if (ready(tex)) {
        g.drawImage(tex, drift, 0, plate!.width, plate!.height);
        if (drift > 2) g.drawImage(tex, drift - plate!.width, 0, plate!.width, plate!.height);
      }
      if (liquid && ready(surfaceTex)) {
        const y = surface * plate!.height;
        g.drawImage(surfaceTex, 0, y - 10, plate!.width, 22);
      }
      g.restore();
    };
    paintBulb(topY, JAR_TOP_BOX);
    paintBulb(botY, JAR_BOT_BOX);
    const cut = lumenMask();
    g.globalCompositeOperation = 'destination-in';
    if (cut) g.drawImage(cut, 0, 0, plate.width, plate.height);
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = kind === 'water' ? 0.8 : kind === 'honey' ? 0.94 : kind === 'snow' ? 0.96 : 1;
    ctx.drawImage(plate, jar.x, jar.y, jar.w, jar.h);
    ctx.restore();
  }

  const from = jar.y + JAR_NECK_Y * jar.h;
  const to = jar.y + jarSurface('bot', Math.max(frame.bottom, 0.015)) * jar.h;
  drawStream(ctx, kind, jar.x + jar.w / 2, from, Math.max(from + 12, to), frame);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.92;
  ctx.drawImage(front, jar.x, jar.y, jar.w, jar.h);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = grade.gleam;
  const lit = grade.dx < 0 ? 0.68 : 0.32;
  ctx.beginPath();
  ctx.ellipse(jar.x + jar.w * lit, jar.y + jar.h * 0.18, jar.w * 0.07, jar.h * 0.045, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (frame.id === 'lluvia' && frame.top > 0.04 && ready(cloud)) {
    const idle = cloudIdle(frame.cloudTime, !frame.reduceMotion);
    const width = jar.w * (1.35 + 0.45 * frame.top);
    const height = width * (cloud.naturalHeight / cloud.naturalWidth);
    const cx = jar.x + jar.w / 2;
    const cy = jar.y + jar.h * 0.2;
    ctx.save();
    ctx.translate(cx + idle.x * 3.2, cy + idle.y * 2.4);
    ctx.scale(idle.scale, idle.scale);
    ctx.globalAlpha = 0.62 + 0.38 * frame.top;
    ctx.drawImage(cloud, -width / 2, -height * 0.58, width, height);
    ctx.restore();
  }

  ambientFor(frame.id)?.drawAmbient(ctx, frame, jar, 'front');
  return true;
}

function drawStream(
  ctx: CanvasRenderingContext2D,
  kind: Kind,
  center: number,
  from: number,
  to: number,
  frame: PhotoFrame,
): void {
  const span = to - from;
  if (!(span > 6) || frame.top < 0.02 || !frame.running) return;
  const flowing = frame.running && !frame.paused;
  const video = streamVideo(kind);
  if (flowing && !frame.reduceMotion) {
    if (video.paused) void video.play().catch(() => undefined);
  } else {
    video.pause();
    if (frame.reduceMotion) video.currentTime = 0;
  }
  const width = kind === 'honey' ? 54 : kind === 'sand' ? 46 : kind === 'snow' ? 72 : 56;
  const x = center - width / 2;
  const useVideo = !frame.reduceMotion && video.readyState >= 2 && video.videoWidth > 0;
  ensureSheets();
  const sheet = atlases?.[kind];
  const splash = splashes?.[kind];
  ctx.save();
  if (useVideo) {
    ctx.drawImage(video, x, from, width, span);
  } else if (sheet && ready(sheet)) {
    const index = streamFrame(frame.streamTime, frame.reduceMotion);
    ctx.drawImage(sheet, index * FRAME_W, 0, FRAME_W, FRAME_H, x, from, width, span);
  }
  if (splash && ready(splash)) {
    const index = streamFrame(frame.streamTime, frame.reduceMotion || !flowing);
    const srcH = kind === 'honey' ? 70 : SPLASH_H;
    const sw = kind === 'honey' ? 42 : 48;
    const sh = kind === 'honey' ? 26 : 22;
    ctx.drawImage(splash, index * SPLASH_W, 0, SPLASH_W, srcH, center - sw / 2, to - sh * 0.7, sw, sh);
  }
  ctx.restore();
}

/** Precarga la capa grande del frasco y el chorro del material visible. */
export function preloadJar(id: MaterialId): void {
  const kind = KIND[id];
  const hrefs = [
    `${glassDir}jar-back.webp`,
    `${glassDir}jar-front-highlights.webp`,
    `/glass/tex-${kind}.webp`,
  ];
  for (const href of hrefs) {
    if (document.querySelector(`link[data-jar="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = href.endsWith('.webm') ? 'video' : 'image';
    link.href = href;
    link.dataset.jar = href;
    document.head.appendChild(link);
  }
  window.setTimeout(() => {
    ensureSheets();
    streamVideo(kind);
    ambientFor(id);
  }, 1600);
}
