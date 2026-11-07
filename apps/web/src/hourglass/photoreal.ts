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
  type MaterialId,
} from '@reloj/core';

type AmbientMod = typeof import('./ambient');
let ambientMod: AmbientMod | null = null;
let ambientLoading = false;

function ambientFor(id: MaterialId): AmbientMod | null {
  // Miel y nieve están ocultas: la abeja y el zorro no se piden.
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

const CLOUD_W = 1100;
const CLOUD_H = 438;
const CLOUD_FPS = 24;

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
const cloudPoster = load('/streams/cloud-poster.png');
let cloudFront: HTMLVideoElement | null = null;
let cloudBack: HTMLVideoElement | null = null;
let cloudFrontMask: HTMLVideoElement | null = null;
let cloudBackMask: HTMLVideoElement | null = null;

const safariCloud =
  typeof navigator !== 'undefined' &&
  /safari/i.test(navigator.userAgent) &&
  !/chrome|chromium|crios|android|edg/i.test(navigator.userAgent);

function makeCloudVideo(src: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = src;
  return video;
}

function cloudClip(which: 'front' | 'back'): HTMLVideoElement {
  const existing = which === 'front' ? cloudFront : cloudBack;
  if (existing) return existing;
  const video = makeCloudVideo(safariCloud ? '/streams/cloud-color.mp4' : '/streams/cloud.webm');
  const mask = safariCloud ? makeCloudVideo('/streams/cloud-mask.mp4') : null;
  if (which === 'front') {
    cloudFront = video;
    cloudFrontMask = mask;
  } else {
    cloudBack = video;
    cloudBackMask = mask;
  }
  return video;
}

function cloudMask(which: 'front' | 'back'): HTMLVideoElement | null {
  cloudClip(which);
  return which === 'front' ? cloudFrontMask : cloudBackMask;
}

function seekCloud(video: HTMLVideoElement, time: number): void {
  if (Math.abs(video.currentTime - time) > 0.08) {
    try {
      video.currentTime = time;
    } catch {
      /* el vídeo aún no admite seek */
    }
  }
}
const surfaceTex = load('/glass/tex-water-surface.webp');
const textures: Record<Kind, HTMLImageElement> = {
  sand: load('/glass/tex-sand.webp'),
  water: load('/glass/tex-water.webp'),
  honey: load('/glass/tex-honey.webp'),
  snow: load('/glass/tex-snow.webp'),
};
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
  meniscus: number,
  tilt = 0,
  heightOff = 0,
): boolean {
  const ySurf = (surface + heightOff) * h;
  const y0 = box[1] * h;
  const y1 = box[3] * h;
  if (ySurf >= y1 - 1 && Math.abs(tilt) < 0.08) return false;
  const gx = Math.sin(tilt);
  const gy = Math.cos(tilt);
  if (Math.abs(tilt) < 0.004) {
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(w, y1);
    const steps = 28;
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const bell = Math.sin(t * Math.PI);
      const yy = Math.max(y0, ySurf - heap * bell * h + meniscus * (1 - bell) * h + wave * Math.sin(t * Math.PI * 2));
      ctx.lineTo(t * w, yy);
    }
    ctx.closePath();
    ctx.clip();
    return true;
  }
  const depth = Math.min(y1 - y0, Math.max(0, y1 - (surface * h)));
  if (depth < 1 && Math.abs(gy) > 0.2) return false;
  if (Math.abs(gy) < 0.18) {
    const frac = Math.min(1, Math.max(0.04, depth / Math.max(1, y1 - y0)));
    const xSplit = gx > 0 ? w * (1 - frac) : w * frac;
    ctx.beginPath();
    if (gx > 0) ctx.rect(xSplit, y0, w - xSplit, y1 - y0);
    else ctx.rect(0, y0, xSplit, y1 - y0);
    ctx.clip();
    return true;
  }
  const lowY = gy >= 0 ? y1 : y0;
  const yBase = gy >= 0 ? lowY - depth : lowY + depth;
  const slope = gx / gy;
  ctx.beginPath();
  if (gy >= 0) {
    ctx.moveTo(0, y1);
    ctx.lineTo(w, y1);
  } else {
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
  }
  const steps = 32;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const bell = Math.sin(t * Math.PI);
    const x = t * w;
    let y = yBase + heightOff * h - (x - w / 2) * slope;
    y += -heap * bell * h + meniscus * (1 - bell) * h + wave * Math.sin(t * Math.PI * 2);
    ctx.lineTo(x, Math.max(y0 - 2, Math.min(y1 + 2, y)));
  }
  ctx.closePath();
  ctx.clip();
  return true;
}

/** Muelle corto del agua: el ángulo sigue la gravedad y la altura se asienta. */
const slosh = {
  angle: 0,
  vel: 0,
  height: 0,
  hVel: 0,
  prevRot: 0,
  ready: false,
  moving: false,
  last: 0,
};

export function waterSloshMoving(): boolean {
  return slosh.moving;
}

function stepWaterSlosh(rotation: number, frozen: boolean): { angle: number; height: number } {
  const now = performance.now();
  const dt = Math.min(0.05, slosh.last ? (now - slosh.last) / 1000 : 1 / 60);
  slosh.last = now;
  if (!slosh.ready) {
    slosh.angle = rotation;
    slosh.prevRot = rotation;
    slosh.ready = true;
    slosh.moving = false;
    return { angle: rotation, height: 0 };
  }
  const raw = rotation - slosh.prevRot;
  if (Math.abs(raw) > 2.2) slosh.angle += raw;
  slosh.prevRot = rotation;
  if (frozen) {
    slosh.angle = rotation;
    slosh.vel = 0;
    slosh.height = 0;
    slosh.hVel = 0;
    slosh.moving = false;
    return { angle: rotation, height: 0 };
  }
  const acc = 58 * (rotation - slosh.angle) - 7.2 * slosh.vel;
  slosh.vel += acc * dt;
  slosh.angle += slosh.vel * dt;
  slosh.hVel += raw * 0.015;
  slosh.hVel += (42 * (0 - slosh.height) - 7.4 * slosh.hVel) * dt;
  slosh.height = Math.max(-0.03, Math.min(0.03, slosh.height + slosh.hVel * dt));
  slosh.moving =
    Math.abs(slosh.vel) > 0.02 ||
    Math.abs(slosh.angle - rotation) > 0.012 ||
    Math.abs(slosh.hVel) > 0.004 ||
    Math.abs(slosh.height) > 0.0015;
  return { angle: slosh.angle, height: slosh.height };
}

/** Luz neutra de Claro: sin el sol de las dunas. */
const PLAIN_LIGHT: SceneLight = {
  dx: 0.06,
  key: 0.58,
  highlight: '#fff8ee',
  shade: 'rgba(48, 42, 36, 0.2)',
  ambient: 'rgba(255, 250, 244, 0.26)',
  gleam: 'rgba(255, 252, 248, 0.5)',
  bounce: 'rgba(232, 222, 208, 0.18)',
  caustic: 'rgba(255, 244, 230, 0.1)',
  shadow: 'rgba(62, 50, 40, 0.22)',
  filter: 'brightness(1.03) contrast(1.02) saturate(0.92)',
};

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
  readonly rotation: number;
  /** Claro: el mismo frasco, sin foto ni luz de las dunas. */
  readonly plain?: boolean;
  /** Arena: granos y caída de la simulación de main, recortados a la máscara. */
  readonly grains?: {
    readonly image: CanvasImageSource;
    readonly cols: number;
    readonly rows: number;
    readonly x: ArrayLike<number>;
    readonly y: ArrayLike<number>;
    readonly size: ArrayLike<number>;
    readonly tone: ArrayLike<number>;
    readonly count: number;
    readonly lut: Uint8ClampedArray;
    readonly noise: CanvasImageSource;
  };
}

function groundShadowAmount(rotation: number): number {
  const upright = Math.min(1, Math.abs(Math.cos(rotation)));
  return upright * upright * (3 - 2 * upright);
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

function drawSnowLip(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  jarW: number,
): void {
  const snow = textures.snow;
  if (!ready(snow)) return;
  const w = Math.max(8, Math.round(jarW));
  const h = Math.max(8, Math.round(jarW * 0.28));
  const g = scratch(w, h);
  if (!g || !plate) return;
  g.drawImage(snow, 0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  const puffs: readonly [number, number, number][] = [
    [0.5, 0.58, 0.22],
    [0.34, 0.66, 0.14],
    [0.66, 0.64, 0.13],
    [0.44, 0.74, 0.09],
    [0.6, 0.76, 0.08],
    [0.28, 0.72, 0.07],
  ];
  for (const [sx, sy, rad] of puffs) {
    const gx = sx * w;
    const gy = sy * h;
    const grd = g.createRadialGradient(gx, gy, 0, gx, gy, rad * w);
    grd.addColorStop(0, 'rgba(255,255,255,0.45)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(gx - rad * w, gy - rad * w, rad * w * 2, rad * w * 2);
  }
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.drawImage(plate, footX - w / 2, footY - h * 0.15, w, h);
  ctx.restore();
}

/** Frasco en el lienzo. En vertical el pie baja hasta rozar el reloj, que va debajo. */
export function placedPhotoJar(
  viewW: number,
  viewH: number,
  imageW: number,
  imageH: number,
  id: MaterialId,
): {
  jar: { x: number; y: number; w: number; h: number };
  footX: number;
  footY: number;
  scene: { x: number; y: number; w: number; h: number };
} {
  const place = dioramaPlacement(viewW, viewH, imageW, imageH, id, true, id === 'lluvia');
  const sink = place.jar.h * 0.016;
  let jarX = place.jar.x;
  let jarY = place.jar.y + sink;
  let footX = place.footX;
  let footY = place.footY;
  let sceneX = place.scene.x;
  let sceneY = place.scene.y;
  if (viewH > viewW && id === 'lluvia') {
    const jar = { x: jarX, y: jarY, w: place.jar.w, h: place.jar.h };
    const cloud = portraitCloudBox(jar);
    const groupTop = Math.min(cloud.y, cloud.y - cloud.height * 0.04);
    const groupBottom = jar.y + jar.h;
    const groupLeft = Math.min(jar.x, cloud.x - cloud.width * 0.08);
    const groupRight = Math.max(jar.x + jar.w, cloud.x + cloud.width);
    const dy = (viewH - (groupBottom - groupTop)) / 2 - groupTop;
    const dx = (viewW - (groupRight - groupLeft)) / 2 - groupLeft;
    jarX += dx;
    jarY += dy;
    footX += dx;
    footY += dy;
    sceneX += dx;
    sceneY += dy;
  }
  return {
    jar: { x: jarX, y: jarY, w: place.jar.w, h: place.jar.h },
    footX,
    footY,
    scene: { ...place.scene, x: sceneX, y: sceneY },
  };
}

/** El borde de abajo tapa el remate y un 12 % del bulbo de arriba. */
function cloudCoverY(jar: { y: number; h: number }, height: number): number {
  const bulbTop = JAR_TOP_BOX[1];
  const bulbSpan = JAR_TOP_BOX[3] - JAR_TOP_BOX[1];
  return jar.y + jar.h * (bulbTop + 0.12 * bulbSpan) - height;
}

function cloudAspect(): number {
  const video = cloudFront;
  if (video && video.videoWidth > 0 && video.videoHeight > 0) return video.videoHeight / video.videoWidth;
  return CLOUD_H / CLOUD_W;
}

/** Caja de la nube delantera, la misma que pinta `drawCloud`. */
function portraitCloudBox(jar: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const width = jar.w * 1.9;
  const height = width * cloudAspect();
  return {
    x: jar.x + jar.w / 2 - width / 2,
    y: cloudCoverY(jar, height),
    width,
    height,
  };
}

/**
 * Vídeo sobre negro (sin alfa real): el alfa sale de la luminancia y el negro
 * se quita del color. Listo para la próxima nube de Sebastián.
 */
/** Clave de negro a alfa. La nube publicada ya viene recortada; esto queda para el fuente. */
export function alphaFromBlack(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const luma = ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3;
    const alpha = Math.max(0, Math.min(255, (luma - 6) * 1.55));
    if (alpha > 8) {
      const lift = 255 / alpha;
      data[i] = Math.min(255, Math.round((data[i] ?? 0) * lift));
      data[i + 1] = Math.min(255, Math.round((data[i + 1] ?? 0) * lift));
      data[i + 2] = Math.min(255, Math.round((data[i + 2] ?? 0) * lift));
    } else {
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
    data[i + 3] = alpha;
  }
}

/** Tapa baja: el borde de abajo cubre el remate y un poco del bulbo de arriba. */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  jar: { x: number; y: number; w: number; h: number },
  frame: PhotoFrame,
): void {
  const width = jar.w * 1.9;
  const height = width * cloudAspect();
  const x = jar.x + jar.w / 2 - width / 2;
  const y = cloudCoverY(jar, height);
  const clip = cloudClip('front');
  const loop = clip.duration && Number.isFinite(clip.duration) && clip.duration > 0.4 ? clip.duration : 286 / CLOUD_FPS;
  const t = frame.reduceMotion ? 0 : ((frame.cloudTime % loop) + loop) % loop;
  const paint = (
    which: 'front' | 'back',
    time: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    alpha: number,
    mirror: boolean,
  ) => {
    const video = cloudClip(which);
    const mask = cloudMask(which);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (mirror) {
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    }
    if (!frame.reduceMotion && video.readyState >= 2 && (!mask || mask.readyState >= 2)) {
      seekCloud(video, time);
      if (mask) {
        seekCloud(mask, time);
        const g = scratch(dw, dh);
        if (g && plate) {
          g.drawImage(video, 0, 0, plate.width, plate.height);
          const color = g.getImageData(0, 0, plate.width, plate.height);
          g.drawImage(mask, 0, 0, plate.width, plate.height);
          const matte = g.getImageData(0, 0, plate.width, plate.height);
          const cd = color.data;
          const md = matte.data;
          for (let i = 0; i < cd.length; i += 4) cd[i + 3] = md[i] ?? 0;
          g.putImageData(color, 0, 0);
          ctx.drawImage(plate, dx, dy, dw, dh);
        }
      } else ctx.drawImage(video, dx, dy, dw, dh);
    } else if (ready(cloudPoster)) {
      ctx.drawImage(cloudPoster, dx, dy, dw, dh);
    }
    ctx.restore();
  };
  paint('back', t + loop * 0.5, x - width * 0.06, y - height * 0.06, width * 0.68, height * 0.68, 0.42, true);
  paint('front', t, x, y, width, height, 1, false);
}

export function drawPhotoreal(ctx: CanvasRenderingContext2D, frame: PhotoFrame): boolean {
  if (!jarLayersReady()) return false;
  const photo = document.querySelector<HTMLImageElement>('.scene-photo');
  const imageW = photo?.naturalWidth || 1920;
  const imageH = photo?.naturalHeight || 1080;
  const place = placedPhotoJar(frame.viewW, frame.viewH, imageW, imageH, frame.id);
  const jar = place.jar;
  const light = frame.plain ? PLAIN_LIGHT : SCENE_LIGHT[frame.id];
  const grade = !frame.plain && frame.id === 'lluvia' ? { ...light, dx: -light.dx, key: 1 - light.key } : light;
  const kind = KIND[frame.id];
  const heap = kind === 'sand' ? 0.074 : kind === 'snow' ? 0.06 : 0;
  const meniscus = kind === 'honey' ? 0.022 : kind === 'water' ? 0.008 : 0;

  ctx.clearRect(0, 0, frame.viewW, frame.viewH);
  ambientFor(frame.id)?.drawAmbient(ctx, frame, jar, 'behind');
  const footX = place.footX;
  const footY = place.footY;
  const bury = frame.id === 'nieve' ? jar.w * 0.028 : 0;
  const shadowAmt = groundShadowAmount(frame.rotation);
  if (shadowAmt > 0.004) {
    ctx.save();
    ctx.globalAlpha = shadowAmt;
    const lean = grade.dx * jar.w * (frame.plain ? 0.035 : 0.09);
    ctx.filter = frame.plain ? 'blur(18px)' : 'blur(14px)';
    ctx.fillStyle = frame.plain ? 'rgba(72, 60, 48, 0.26)' : grade.shadow;
    ctx.beginPath();
    ctx.ellipse(
      footX + lean,
      footY + jar.w * 0.01,
      jar.w * (frame.plain ? 0.26 : 0.3),
      Math.max(5, jar.w * (frame.plain ? 0.038 : 0.046)),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.filter = 'none';
    ctx.fillStyle = frame.plain ? 'rgba(42, 34, 28, 0.5)' : 'rgba(10, 8, 6, 0.78)';
    ctx.beginPath();
    ctx.ellipse(footX, footY + 1, jar.w * 0.145, Math.max(2.4, jar.w * 0.015), 0, 0, Math.PI * 2);
    ctx.fill();
    if (!frame.plain) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = shadowAmt * 0.7;
      ctx.fillStyle = grade.caustic;
      ctx.beginPath();
      ctx.ellipse(footX - lean * 0.35, footY + 2, jar.w * 0.16, Math.max(3, jar.w * 0.012), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const pivotX = jar.x + jar.w / 2;
  const pivotY = jar.y + jar.h / 2;
  ctx.save();
  if (frame.rotation) {
    ctx.translate(pivotX, pivotY);
    ctx.rotate(frame.rotation);
    ctx.translate(-pivotX, -pivotY);
  }

  ctx.save();
  ctx.filter = grade.filter;
  if (ready(shadow)) ctx.drawImage(shadow, jar.x, jar.y, jar.w, jar.h);
  ctx.drawImage(back, jar.x, jar.y, jar.w, jar.h);
  ctx.filter = 'none';
  ctx.restore();

  const g = scratch(jar.w, jar.h);
  if (g && plate) {
    const blur = !frame.plain && photo ? blurredScene(photo, frame.id) : null;
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
        ctx.globalAlpha = kind === 'water' ? 0.08 : 0.22;
        ctx.drawImage(plate, jar.x, jar.y, jar.w, jar.h);
        ctx.restore();
      }
    }

    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, plate.width, plate.height);
    const grains = kind === 'sand' ? frame.grains : undefined;
    if (grains) {
      g.imageSmoothingEnabled = false;
      g.drawImage(grains.image, 0, 0, plate.width, plate.height);
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = 0.18;
      const pattern = g.createPattern(grains.noise, 'repeat');
      if (pattern) {
        g.fillStyle = pattern;
        g.fillRect(0, 0, plate.width, plate.height);
      }
      g.restore();
      g.imageSmoothingEnabled = true;
      const cellW = plate.width / grains.cols;
      const cellH = plate.height / grains.rows;
      for (let i = 0; i < grains.count; i++) {
        const px = grains.x[i] ?? 0;
        const py = grains.y[i] ?? 0;
        const size = grains.size[i] ?? 0.3;
        const tone = grains.tone[i] ?? 1;
        const x = (px / grains.cols) * plate.width;
        const y = (py / grains.rows) * plate.height;
        const radius = Math.max(0.8, size * cellW * 1.15);
        const l = tone * 3;
        g.fillStyle = `rgb(${grains.lut[l] ?? 200}, ${grains.lut[l + 1] ?? 170}, ${grains.lut[l + 2] ?? 130})`;
        g.beginPath();
        g.ellipse(x, y, radius, Math.max(radius, size * cellH * 0.9), 0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
    const tex = textures[kind];
    const topY = jarSurface('top', frame.top * 0.84);
    const botY = jarSurface('bot', frame.bottom);
    const wave = kind === 'honey' && !frame.reduceMotion ? Math.sin(frame.phase * 2.2) * 0.004 : 0;
    const liquid = kind === 'water' ? stepWaterSlosh(frame.rotation, frame.reduceMotion || frame.paused) : null;
    const paintBulb = (surface: number, box: readonly [number, number, number, number]) => {
      g.save();
      if (!clipFill(g, plate!.width, plate!.height, surface, box, heap, wave * plate!.height, meniscus, liquid?.angle ?? 0, liquid?.height ?? 0)) {
        g.restore();
        return;
      }
      if (kind === 'water') {
        const y0 = surface * plate!.height;
        const grad = g.createLinearGradient(0, y0, 0, box[1] * plate!.height + box[3] * plate!.height);
        grad.addColorStop(0, 'rgba(226, 242, 244, 0.16)');
        grad.addColorStop(0.55, 'rgba(150, 198, 206, 0.28)');
        grad.addColorStop(1, 'rgba(110, 176, 188, 0.34)');
        g.fillStyle = grad;
        g.fillRect(0, y0, plate!.width, plate!.height);
        g.globalAlpha = 0.9;
        g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, y0);
        g.lineTo(plate!.width, y0);
        g.stroke();
        g.globalAlpha = frame.reduceMotion ? 0.12 : 0.1 + 0.04 * Math.sin(frame.phase * 1.2);
        g.fillStyle = 'rgba(230, 250, 255, 0.9)';
        g.beginPath();
        g.ellipse(plate!.width * 0.42, y0 + plate!.height * 0.08, plate!.width * 0.16, plate!.height * 0.03, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      } else if (ready(tex)) {
        g.drawImage(tex, 0, 0, plate!.width, plate!.height);
      }
      if (kind === 'honey' && ready(surfaceTex)) {
        const y = surface * plate!.height;
        g.drawImage(surfaceTex, 0, y - 10, plate!.width, 22);
      }
      g.restore();
    };
    paintBulb(topY, JAR_TOP_BOX);
    paintBulb(botY, JAR_BOT_BOX);
    }
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
  if (kind !== 'sand') drawStream(ctx, kind, jar.x + jar.w / 2, from, Math.max(from + 12, to), frame);

  gradeGlass(ctx, jar, grade);
  if (frame.id === 'nieve') drawSnowLip(ctx, footX, footY + bury, jar.w);

  ambientFor(frame.id)?.drawAmbient(ctx, frame, jar, 'front');
  ctx.restore();

  if (frame.id === 'lluvia' && frame.top > 0.04) {
    const away = Math.min(1, Math.abs(frame.rotation) / (Math.PI * 0.5));
    ctx.save();
    ctx.globalAlpha = 1 - away * 0.78;
    ctx.translate(0, -jar.h * 0.3 * away);
    drawCloud(ctx, jar, frame);
    ctx.restore();
  }
  return true;
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  center: number,
  from: number,
  to: number,
  frame: PhotoFrame,
): void {
  const span = to - from;
  const count = frame.reduceMotion ? 2 : 5;
  const t = frame.reduceMotion ? 0 : frame.streamTime;
  for (let i = 0; i < count; i++) {
    const seed = i * 9.73 + 0.4;
    const speed = 3.2 + ((i * 13) % 5) * 0.48;
    const travel = frame.reduceMotion ? 0.18 + (i % 4) * 0.2 : ((t * speed + seed) % 1 + 1) % 1;
    const y = from + span * Math.min(travel, 0.97);
    const x = center + Math.sin(seed * 1.6) * 4;
    const len = 20 + (i % 4) * 5;
    const wide = 0.16 + (i % 3) * 0.04;
    ctx.save();
    ctx.translate(x, y);
    const streak = ctx.createLinearGradient(0, -len, 0, len * 0.15);
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    streak.addColorStop(0.84, 'rgba(255,255,255,0.26)');
    streak.addColorStop(1, 'rgba(255,255,255,0.34)');
    ctx.fillStyle = streak;
    ctx.beginPath();
    ctx.ellipse(0, 0, wide, len, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!frame.reduceMotion && travel > 0.93) {
      const k = (travel - 0.93) / 0.07;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.16;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(x, to, 0.7 + k * 1.8, 0.28 + k * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

const STREAM_SPEED: Record<Kind, number> = { water: 140, honey: 36, sand: 110, snow: 70 };
const STREAM_WIDTH: Record<Kind, number> = { water: 10, honey: 26, sand: 14, snow: 20 };

/** Columna de textura que baja cada fotograma. La pausa deja el tiempo quieto. */
function drawStream(
  ctx: CanvasRenderingContext2D,
  kind: Kind,
  center: number,
  from: number,
  to: number,
  frame: PhotoFrame,
): void {
  const span = to - from;
  if (!(span > 6) || frame.top < 0.02) return;
  if (!frame.running && !frame.paused) return;
  if (kind === 'water') {
    drawRain(ctx, center, from, to, frame);
    return;
  }
  const t = frame.reduceMotion ? 0 : frame.streamTime;
  const live = !frame.reduceMotion;
  const base = STREAM_WIDTH[kind];
  const tex = textures[kind];
  ctx.save();
  ctx.beginPath();
  const steps = 28;
  const edge = (i: number, side: number) => {
    const u = i / steps;
    const y = from + span * u;
    const wave = live ? Math.sin(u * 8.5 + t * 2.6) * 0.16 + Math.sin(u * 2.4 - t * 1.3) * 0.07 : 0;
    const w = base * (frame.reduceMotion ? 0.7 : 1 + wave);
    const x = center + (live ? Math.sin(u * 5.5 + t * 1.8) * base * 0.18 : 0);
    return { x: x + side * w * 0.5, y };
  };
  for (let i = 0; i <= steps; i++) {
    const p = edge(i, -1);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  for (let i = steps; i >= 0; i--) {
    const p = edge(i, 1);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.clip();
  if (ready(tex)) {
    const tile = Math.max(24, base * 3.2);
    const offset = live ? (t * STREAM_SPEED[kind]) % tile : 0;
    ctx.globalAlpha = kind === 'honey' ? 0.92 : 0.88;
    for (let y = from - tile + offset; y < to; y += tile) {
      ctx.drawImage(tex, center - base * 1.4, y, base * 2.8, tile + 1);
    }
  }
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const gleam = live ? Math.sin(t * 3.1) * base * 0.15 : 0;
  ctx.fillRect(center - 1.2 + gleam, from, kind === 'honey' ? 3.5 : 2, span);
  ctx.restore();

  const ripple = live ? 0.55 + 0.45 * Math.sin(t * 5.5) : 0.7;
  ctx.save();
  ctx.globalAlpha = 0.28 + ripple * 0.22;
  ctx.fillStyle = kind === 'honey' ? 'rgba(226, 160, 60, 0.85)' : kind === 'snow' ? 'rgba(230, 236, 242, 0.9)' : kind === 'sand' ? 'rgba(196, 154, 90, 0.8)' : 'rgba(190, 214, 220, 0.75)';
  ctx.beginPath();
  ctx.ellipse(center, to, base * (1.3 + ripple * 0.55), Math.max(3, base * 0.28), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if ((kind === 'sand' || kind === 'snow') && !frame.reduceMotion) {
    const count = kind === 'sand' ? 26 : 16;
    ctx.save();
    ctx.fillStyle = kind === 'sand' ? 'rgba(214, 176, 112, 0.9)' : 'rgba(236, 242, 246, 0.92)';
    for (let i = 0; i < count; i++) {
      const seed = i * 12.9898;
      const speed = 0.42 + (i % 6) * 0.07;
      const travel = ((t * speed + seed) % 1 + 1) % 1;
      const along = from + span * travel;
      const sway = Math.sin(seed * 2.1 + travel * 7.5) * base * 0.85;
      const landed = travel > 0.9;
      const spread = landed ? ((travel - 0.9) / 0.1) * (kind === 'snow' ? 18 : 12) : 0;
      const x = center + sway * (1 - (landed ? (travel - 0.9) * 4 : 0)) + Math.sin(seed) * spread;
      const y = landed ? to - (1 - (travel - 0.9) / 0.1) * 8 : along;
      const radius = (kind === 'sand' ? 1.15 : 1.7) + (i % 3) * 0.35;
      ctx.globalAlpha = landed ? 0.35 + (1 - (travel - 0.9) / 0.1) * 0.4 : 0.4 + 0.45 * (1 - travel);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Precarga la capa grande del frasco y el chorro del material visible. Una vez por escena. */
let primedJar: string | null = null;
export function preloadJar(id: MaterialId): void {
  const kind = KIND[id];
  const token = `${glassDir}${kind}`;
  if (primedJar === token) return;
  primedJar = token;
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
    if (id === 'lluvia') {
      cloudClip('front');
      cloudClip('back');
    }
    ambientFor(id);
  }, 1600);
}
