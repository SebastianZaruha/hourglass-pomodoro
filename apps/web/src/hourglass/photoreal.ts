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

const CLOUD_W = 480;
const CLOUD_H = 228;
const CLOUD_FRAMES = 24;
const CLOUD_FPS = 5;

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
    const yy = Math.max(y0, ySurf - heap * bell * h + meniscus * (1 - bell) * h + wave * Math.sin(t * Math.PI * 2));
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
  readonly rotation: number;
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
  let jarY = place.jar.y + sink;
  let footY = place.footY;
  let sceneY = place.scene.y;
  if (viewH > viewW) {
    const dy = viewH * 0.97 - (footY + sink);
    const shift = jarY + dy < 4 ? 4 - jarY : dy;
    jarY += shift;
    footY += shift;
    sceneY += shift;
  }
  return {
    jar: { x: place.jar.x, y: jarY, w: place.jar.w, h: place.jar.h },
    footX: place.footX,
    footY,
    scene: { ...place.scene, y: sceneY },
  };
}

/**
 * Vídeo sobre negro (sin alfa real): el alfa sale de la luminancia y el negro
 * se quita del color. Listo para la próxima nube de Sebastián.
 */
function alphaFromBlack(data: Uint8ClampedArray): void {
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

function softenCloudEdges(data: Uint8ClampedArray, width: number, height: number): void {
  for (let y = 0; y < height; y++) {
    const yIn = Math.min(y / (height * 0.16), (height - 1 - y) / (height * 0.14));
    for (let x = 0; x < width; x++) {
      const xIn = Math.min(x / (width * 0.14), (width - 1 - x) / (width * 0.22));
      const t = Math.max(0, Math.min(1, Math.min(xIn, yIn)));
      const fade = t * t * (3 - 2 * t);
      const i = (y * width + x) * 4 + 3;
      data[i] = Math.round((data[i] ?? 0) * fade);
    }
  }
}

let cloudBuf: HTMLCanvasElement | null = null;

/** Tapa baja y ancha: se apoya en el capuchón, el agua queda debajo. */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  jar: { x: number; y: number; w: number; h: number },
  frame: PhotoFrame,
): void {
  const width = jar.w * 1.72;
  const height = width * (CLOUD_H / CLOUD_W) * 0.72;
  const bottom = jar.y + jar.w * 0.06;
  const x = jar.x + jar.w / 2 - width / 2;
  const y = bottom - height;
  const video = cloudVideo();
  const loop = CLOUD_FRAMES / CLOUD_FPS;
  const t = frame.reduceMotion ? 0 : ((frame.cloudTime % loop) + loop) % loop;
  if (!cloudBuf) {
    cloudBuf = document.createElement('canvas');
    cloudBuf.width = CLOUD_W;
    cloudBuf.height = CLOUD_H;
  }
  const g = cloudBuf.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  g.clearRect(0, 0, CLOUD_W, CLOUD_H);
  if (video.readyState >= 2) {
    if (Math.abs(video.currentTime - t) > 0.12) {
      try {
        video.currentTime = t;
      } catch {
        /* el vídeo aún no admite seek */
      }
    }
    g.drawImage(video, 0, 0, CLOUD_W, CLOUD_H);
  } else if (ready(cloudSheet)) {
    const index = cloudIndex(frame.cloudTime, frame.reduceMotion);
    g.drawImage(cloudSheet, index * CLOUD_W, 0, CLOUD_W, CLOUD_H, 0, 0, CLOUD_W, CLOUD_H);
  } else return;
  const pixels = g.getImageData(0, 0, CLOUD_W, CLOUD_H);
  const data = pixels.data;
  const corner = data[3] ?? 0;
  const cornerLuma = ((data[0] ?? 0) + (data[1] ?? 0) + (data[2] ?? 0)) / 3;
  if (corner > 200 && cornerLuma < 28) alphaFromBlack(data);
  softenCloudEdges(data, CLOUD_W, CLOUD_H);
  g.putImageData(pixels, 0, 0);
  ctx.drawImage(cloudBuf, x, y, width, height);
}

export function drawPhotoreal(ctx: CanvasRenderingContext2D, frame: PhotoFrame): boolean {
  if (!jarLayersReady()) return false;
  const photo = document.querySelector<HTMLImageElement>('.scene-photo');
  const imageW = photo?.naturalWidth || 1920;
  const imageH = photo?.naturalHeight || 1080;
  const place = placedPhotoJar(frame.viewW, frame.viewH, imageW, imageH, frame.id);
  const jar = place.jar;
  const light = SCENE_LIGHT[frame.id];
  const grade = frame.id === 'lluvia' ? { ...light, dx: -light.dx, key: 1 - light.key } : light;
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
    if (frame.id === 'nieve') {
    ctx.filter = 'blur(34px)';
    ctx.fillStyle = 'rgba(58, 78, 104, 0.34)';
    ctx.beginPath();
    ctx.ellipse(footX + grade.dx * jar.w * 0.12, footY + jar.w * 0.045, jar.w * 0.9, jar.w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(42, 58, 78, 0.32)';
    ctx.beginPath();
    ctx.ellipse(footX, footY + jar.w * 0.012, jar.w * 0.2, jar.w * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
  } else {
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
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grade.caustic;
  ctx.beginPath();
  ctx.ellipse(footX - grade.dx * jar.w * 0.35, footY + jar.h * 0.006, jar.w * 0.24, Math.max(4, jar.w * 0.02), 0, 0, Math.PI * 2);
  ctx.fill();
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
    const paintBulb = (surface: number, box: readonly [number, number, number, number]) => {
      g.save();
      if (!clipFill(g, plate!.width, plate!.height, surface, box, heap, wave * plate!.height, meniscus)) {
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
  const count = frame.reduceMotion ? 4 : 12;
  const t = frame.reduceMotion ? 0 : frame.streamTime;
  for (let i = 0; i < count; i++) {
    const seed = i * 9.73 + 0.4;
    const speed = 1.35 + ((i * 13) % 8) * 0.22;
    const travel = frame.reduceMotion ? 0.12 + (i % 5) * 0.17 : ((t * speed + seed) % 1 + 1) % 1;
    const y = from + span * Math.min(travel, 0.97);
    const x = center + Math.sin(seed * 1.6) * 8 + (frame.reduceMotion ? 0 : Math.sin(seed + travel * 5) * 2.2);
    const len = 11 + (i % 5) * 3.2;
    const wide = 0.7 + (i % 3) * 0.25;
    ctx.save();
    ctx.translate(x, y);
    const streak = ctx.createLinearGradient(0, -len, 0, len * 0.35);
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(0.35, 'rgba(210, 232, 238, 0.18)');
    streak.addColorStop(0.72, 'rgba(186, 220, 228, 0.55)');
    streak.addColorStop(1, 'rgba(255,255,255,0.8)');
    ctx.fillStyle = streak;
    ctx.beginPath();
    ctx.ellipse(0, 0, wide, len, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!frame.reduceMotion && travel > 0.9) {
      const k = (travel - 0.9) / 0.1;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.strokeStyle = 'rgba(214, 232, 236, 0.95)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, to, 2.5 + k * 11, 1.1 + k * 2.4, 0, 0, Math.PI * 2);
      ctx.stroke();
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
    if (id === 'lluvia') cloudVideo();
    ambientFor(id);
  }, 1600);
}
