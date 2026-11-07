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
  type SceneLight,
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

const CLOUD_W = 480;
const CLOUD_H = 228;
const CLOUD_FRAMES = 24;
const CLOUD_FPS = 5;
const FRAME_W = 96;
const FRAME_H = 512;
const SPLASH_W = 128;

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
const cloudSheet = load('/streams/cloud-atlas.webp');
let cloudClip: HTMLVideoElement | null = null;

function cloudVideo(): HTMLVideoElement {
  if (cloudClip) return cloudClip;
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = '/streams/cloud.webm';
  cloudClip = video;
  return video;
}

function cloudIndex(seconds: number, reduceMotion: boolean): number {
  if (reduceMotion || !Number.isFinite(seconds)) return 0;
  const loop = CLOUD_FRAMES / CLOUD_FPS;
  const t = ((seconds % loop) + loop) % loop;
  return Math.floor(t * CLOUD_FPS) % CLOUD_FRAMES;
}
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

/** Brillos, sombra de forma y rebote, recortados al vidrio. El negro del frente sigue siendo identidad en SCREEN. */
function gradeGlass(
  ctx: CanvasRenderingContext2D,
  jar: { x: number; y: number; w: number; h: number },
  grade: SceneLight,
): void {
  const g = scratch(jar.w, jar.h);
  if (!g || !plate) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.92;
    ctx.drawImage(front, jar.x, jar.y, jar.w, jar.h);
    ctx.restore();
    return;
  }
  const w = plate.width;
  const h = plate.height;
  g.drawImage(front, 0, 0, w, h);
  // El frente trae el interior en negro opaco. Si se multiplica o se pasa
  // en SCREEN, el rectángulo del frasco tapa la escena. Solo quedan los brillos.
  const pixels = g.getImageData(0, 0, w, h);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const lit = (data[i] ?? 0) * 0.3 + (data[i + 1] ?? 0) * 0.59 + (data[i + 2] ?? 0) * 0.11;
    data[i + 3] = lit < 18 ? 0 : Math.min(data[i + 3] ?? 0, Math.round(lit));
  }
  g.putImageData(pixels, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.4;
  g.fillStyle = grade.highlight;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.94;
  ctx.drawImage(plate, jar.x, jar.y, jar.w, jar.h);
  ctx.restore();

  const paintWash = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
    g.clearRect(0, 0, w, h);
    const wash = g.createLinearGradient(grade.key * w, h * 0.04, (1 - grade.key) * w, h * 0.72);
    wash.addColorStop(0, grade.gleam);
    wash.addColorStop(0.3, grade.ambient);
    wash.addColorStop(0.58, 'rgba(0,0,0,0)');
    wash.addColorStop(1, grade.shade);
    g.fillStyle = wash;
    g.fillRect(0, 0, w, h);
    g.save();
    g.globalCompositeOperation = 'screen';
    const bounce = g.createLinearGradient(0, h * 0.7, 0, h);
    bounce.addColorStop(0, 'rgba(0,0,0,0)');
    bounce.addColorStop(1, grade.bounce);
    g.fillStyle = bounce;
    g.fillRect(0, Math.round(h * 0.55), w, h);
    g.restore();
  };

  paintWash();
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(back, 0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(plate, jar.x, jar.y, jar.w, jar.h);
  ctx.restore();
}

/** Tapa baja y ancha: solo el borde de arriba del bulbo, el agua queda debajo. */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  jar: { x: number; y: number; w: number; h: number },
  frame: PhotoFrame,
): void {
  const width = jar.w * 1.72;
  const height = width * (CLOUD_H / CLOUD_W) * 0.72;
  const bottom = jar.y + jar.h * 0.15;
  const x = jar.x + jar.w / 2 - width / 2;
  const y = bottom - height;
  const video = cloudVideo();
  const loop = CLOUD_FRAMES / CLOUD_FPS;
  const t = frame.reduceMotion ? 0 : ((frame.cloudTime % loop) + loop) % loop;
  if (video.readyState >= 2) {
    if (Math.abs(video.currentTime - t) > 0.12) {
      try {
        video.currentTime = t;
      } catch {
        /* el vídeo aún no admite seek */
      }
    }
    ctx.drawImage(video, x, y, width, height);
    return;
  }
  if (!ready(cloudSheet)) return;
  const index = cloudIndex(frame.cloudTime, frame.reduceMotion);
  ctx.drawImage(cloudSheet, index * CLOUD_W, 0, CLOUD_W, CLOUD_H, x, y, width, height);
}

export function drawPhotoreal(ctx: CanvasRenderingContext2D, frame: PhotoFrame): boolean {
  if (!jarLayersReady()) return false;
  const photo = document.querySelector<HTMLImageElement>('.scene-photo');
  const imageW = photo?.naturalWidth || 1920;
  const imageH = photo?.naturalHeight || 1080;
  const place = dioramaPlacement(frame.viewW, frame.viewH, imageW, imageH, frame.id, true, frame.id === 'lluvia');
  const sink = place.jar.h * 0.016;
  const jar = { ...place.jar, y: place.jar.y + sink };
  const light = SCENE_LIGHT[frame.id];
  const grade = frame.id === 'lluvia' ? { ...light, dx: -light.dx, key: 1 - light.key } : light;
  const kind = KIND[frame.id];
  const liquid = kind === 'water' || kind === 'honey';
  const heap = kind === 'sand' ? 0.045 : kind === 'snow' ? 0.032 : 0;

  ctx.clearRect(0, 0, frame.viewW, frame.viewH);
  ambientFor(frame.id)?.drawAmbient(ctx, frame, jar, 'behind');

  const footX = place.footX;
  const footY = place.footY;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 6, 4, 0.55)';
  ctx.beginPath();
  ctx.ellipse(footX, footY + 2, jar.w * 0.2, Math.max(4, jar.w * 0.026), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grade.shadow;
  ctx.beginPath();
  ctx.ellipse(
    footX + grade.dx * jar.w,
    footY + jar.h * 0.012,
    jar.w * (0.42 + Math.abs(grade.dx)),
    Math.max(7, jar.w * 0.055),
    grade.dx * 0.35,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grade.caustic;
  ctx.beginPath();
  ctx.ellipse(footX - grade.dx * jar.w * 0.35, footY + jar.h * 0.006, jar.w * 0.24, Math.max(4, jar.w * 0.02), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.filter = grade.filter;
  if (ready(shadow)) ctx.drawImage(shadow, jar.x, jar.y, jar.w, jar.h);
  ctx.drawImage(back, jar.x, jar.y, jar.w, jar.h);
  ctx.filter = 'none';
  ctx.restore();

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

  gradeGlass(ctx, jar, grade);

  if (frame.id === 'lluvia' && frame.top > 0.04) drawCloud(ctx, jar, frame);

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
  const width = kind === 'honey' ? 62 : kind === 'sand' ? 44 : kind === 'snow' ? 78 : 40;
  const x = center - width / 2;
  const useVideo = !frame.reduceMotion && video.readyState >= 2 && video.videoWidth > 0;
  ensureSheets();
  const sheet = atlases?.[kind];
  const splash = splashes?.[kind];
  const tint = SCENE_LIGHT[frame.id].highlight;
  ctx.save();
  if (useVideo) {
    drawTinted(ctx, video, 0, 0, video.videoWidth, video.videoHeight, x, from, width, span, tint);
  } else if (sheet && ready(sheet)) {
    const index = streamFrame(frame.streamTime, frame.reduceMotion);
    drawTinted(ctx, sheet, index * FRAME_W, 0, FRAME_W, FRAME_H, x, from, width, span, tint);
  }
  if (splash && ready(splash)) {
    const index = streamFrame(frame.streamTime, frame.reduceMotion || !flowing);
    const box =
      kind === 'honey'
        ? { srcH: 56, sw: 46, sh: 30 }
        : kind === 'sand'
          ? { srcH: 48, sw: 44, sh: 16 }
          : kind === 'snow'
            ? { srcH: 52, sw: 60, sh: 20 }
            : { srcH: 40, sw: 40, sh: 14 };
    drawTinted(
      ctx,
      splash,
      index * SPLASH_W,
      0,
      SPLASH_W,
      box.srcH,
      center - box.sw / 2,
      to - box.sh * 0.65,
      box.sw,
      box.sh,
      tint,
    );
  }
  ctx.restore();
}

let tintCanvas: HTMLCanvasElement | null = null;
let tintCtx: CanvasRenderingContext2D | null = null;

/** Tiñe el bucle con la luz de la escena sin pintar los píxeles transparentes. */
function drawTinted(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  color: string,
): void {
  const w = Math.max(2, Math.round(dw));
  const h = Math.max(2, Math.round(dh));
  if (!tintCanvas || tintCanvas.width !== w || tintCanvas.height !== h) {
    tintCanvas = document.createElement('canvas');
    tintCanvas.width = w;
    tintCanvas.height = h;
    tintCtx = tintCanvas.getContext('2d');
  }
  const g = tintCtx;
  if (!g || !tintCanvas) {
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.18;
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  ctx.drawImage(tintCanvas, dx, dy);
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
    if (id === 'lluvia') cloudVideo();
    ambientFor(id);
  }, 1600);
}
