/**
 * Abeja (miel) y visita de invierno (nieve).
 *
 * Los archivos solo se piden cuando ese material está elegido. No hay
 * nada si el reloj no corre o si se pide reducir el movimiento.
 */
import {
  freshVisitClock,
  stepVisit,
  visitEnvelope,
  type MaterialId,
  type Visit,
  type VisitClock,
} from '@reloj/core';

interface Shot {
  readonly id: MaterialId;
  readonly viewW: number;
  readonly viewH: number;
  readonly running: boolean;
  readonly paused: boolean;
  readonly reduceMotion: boolean;
}

type Sprite = HTMLImageElement;

function load(src: string): Sprite {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image;
}

let beeA: Sprite | null = null;
let beeB: Sprite | null = null;
let fox: Sprite | null = null;
let robin: Sprite | null = null;
let veil: Sprite | null = null;

const clocks = new Map<MaterialId, VisitClock>();

function clockFor(id: MaterialId): VisitClock {
  let clock = clocks.get(id);
  if (!clock) {
    clock = freshVisitClock();
    clocks.set(id, clock);
  }
  return clock;
}

function ready(image: Sprite | null): image is Sprite {
  return !!image && image.complete && image.naturalWidth > 0;
}

export function preloadAmbient(id: MaterialId): void {
  if (id === 'miel' && !beeA) {
    beeA = load('/ambient/bee-a.webp');
    beeB = load('/ambient/bee-b.webp');
  }
  if (id === 'nieve' && !fox) {
    fox = load('/ambient/fox.webp');
    robin = load('/ambient/robin.webp');
    veil = load('/ambient/snow-veil.webp');
  }
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

let lastMs = 0;

export function drawAmbient(
  ctx: CanvasRenderingContext2D,
  frame: Shot,
  jar: { x: number; y: number; w: number; h: number },
  layer: 'behind' | 'front',
): void {
  const id = frame.id;
  if (id !== 'miel' && id !== 'nieve') return;
  preloadAmbient(id);
  const enabled = frame.running && !frame.reduceMotion && !frame.paused;
  const prev = clockFor(id);
  let next = prev;
  if (layer === 'behind') {
    const nowMs = performance.now();
    const dt = lastMs > 0 ? Math.min(0.05, (nowMs - lastMs) / 1000) : 0;
    lastMs = nowMs;
    next = stepVisit(prev, dt, enabled, enabled);
    clocks.set(id, next);
  }
  const visit = next.active;
  if (!visit || !enabled) return;
  const now = next.elapsed;
  const env = visitEnvelope(visit, now);
  if (env <= 0) return;
  if (id === 'miel') drawBee(ctx, frame, jar, visit, now, env, layer);
  else drawSnow(ctx, frame, jar, visit, now, env, layer);
}

function wing(now: number): Sprite | null {
  return Math.floor(now * 28) % 2 === 0 ? beeA : beeB;
}

function drawBee(
  ctx: CanvasRenderingContext2D,
  frame: Shot,
  jar: { x: number; y: number; w: number; h: number },
  visit: Visit,
  now: number,
  env: number,
  layer: 'behind' | 'front',
): void {
  const sprite = wing(now);
  if (!ready(sprite)) return;
  const u = (now - visit.start) / visit.dur;
  if (visit.kind === 0) {
    const depth = 0.42 + visit.seed * 0.5;
    const far = depth < 0.72;
    if ((far && layer !== 'behind') || (!far && layer !== 'front')) return;
    const dir = visit.seed > 0.5 ? 1 : -1;
    const x = dir > 0 ? -80 + ease(u) * (frame.viewW + 160) : frame.viewW + 80 - ease(u) * (frame.viewW + 160);
    const y = frame.viewH * (0.18 + visit.seed * 0.28) + Math.sin(u * Math.PI) * 36;
    paintSprite(ctx, sprite, x, y, 28 + depth * 26, env * (far ? 0.7 : 0.9), far ? 1.4 : 0, dir < 0);
    return;
  }
  if (layer !== 'front') return;
  const landX = jar.x + jar.w * 0.62;
  const landY = jar.y + jar.h * 0.22;
  let x = landX;
  let y = landY;
  let landed = false;
  if (u < 0.35) {
    const t = ease(u / 0.35);
    x = -40 + (landX + 40) * t;
    y = frame.viewH * 0.15 + (landY - frame.viewH * 0.15) * t;
  } else if (u > 0.72) {
    const t = ease((u - 0.72) / 0.28);
    x = landX + t * (frame.viewW + 60 - landX);
    y = landY - t * 80;
  } else landed = true;
  if (landed) {
    ctx.save();
    ctx.fillStyle = 'rgba(40, 30, 16, 0.28)';
    ctx.beginPath();
    ctx.ellipse(landX + 6, landY + 14, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  paintSprite(ctx, sprite, x, y, 34, env, 0, false);
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  frame: Shot,
  jar: { x: number; y: number; w: number; h: number },
  visit: Visit,
  now: number,
  env: number,
  layer: 'behind' | 'front',
): void {
  const u = (now - visit.start) / visit.dur;
  if (visit.kind === 0) {
    if (layer !== 'behind') return;
    const animal = visit.seed > 0.5 ? fox : robin;
    if (!ready(animal)) return;
    const side = visit.seed > 0.5 ? 0.16 : 0.84;
    const hide = side < 0.5 ? -36 : 36;
    let slide = 0;
    if (u < 0.28) slide = ease(u / 0.28);
    else if (u > 0.72) slide = 1 - ease((u - 0.72) / 0.28);
    else slide = 1;
    const x = frame.viewW * side + hide * (1 - slide);
    const y = frame.viewH * 0.42;
    paintSprite(ctx, animal, x, y, 46, env * 0.85, 1.1, side > 0.5);
    return;
  }
  if (layer !== 'front' || !ready(veil)) return;
  const travel = -frame.viewW * 0.2 + ease(u) * frame.viewW * 1.3;
  ctx.save();
  ctx.globalAlpha = env * 0.45;
  ctx.drawImage(veil, travel, jar.y + jar.h * 0.72, frame.viewW * 0.7, 90);
  ctx.restore();
}

function paintSprite(
  ctx: CanvasRenderingContext2D,
  image: Sprite,
  x: number,
  y: number,
  height: number,
  alpha: number,
  blur: number,
  flip: boolean,
): void {
  const width = height * (image.naturalWidth / image.naturalHeight);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}
