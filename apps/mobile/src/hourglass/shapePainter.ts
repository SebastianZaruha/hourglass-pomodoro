/**
 * Pintor de la lluvia y de la miel.
 *
 * No lee la rejilla de granos. Cada fotograma:
 *   1. Cierra un polígono con la superficie que calculó el core y lo rellena
 *      (el recorte del vidrio hace el bulbo).
 *   2. Dibuja unas pocas rayas o gotas cuya fase no depende de la duración.
 *   3. Si es lluvia, sella la nube con círculos ya difuminados (una textura
 *      hecha una vez, con grano horneado). No hay desenfoque por fotograma.
 *
 * En reposo el motor no llama a `paint`: la foto se queda.
 */
import {
  writeCloud,
  writeFlakes,
  writeLiquidSurface,
  writeRibbons,
  type CloudPuff,
  type ContentPalette,
  type FlakeMark,
  type FlowPose,
  type HourglassProfile,
  type RibbonMark,
  type ShapeMaterial,
  type SurfacePoint,
  type Vec2,
} from '@reloj/core';
import {
  AlphaType,
  ClipOp,
  ColorType,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
  type ImageInfo,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkPicture,
  type SkPictureRecorder,
  type SkRect,
} from '@shopify/react-native-skia';

import { Platform } from 'react-native';

import type { HourglassTheme } from '../theme/theme';
import { safeDispose } from './disposal';
import type { HourglassLayout } from './layout';

const SURFACE_N = 28;

export interface ShapeFrame {
  readonly pose: FlowPose;
  /** Ciclos del chorro y de la onda. El motor lo congela al pausar. */
  readonly phase: number;
  /** Temblor de la nube, 0 en reposo. */
  readonly drift: number;
  readonly reduceMotion: boolean;
  readonly ribbons: number;
  readonly puffs: number;
  readonly waves: boolean;
}

export class ShapePainter {
  private readonly recorder: SkPictureRecorder;
  private readonly bounds: SkRect;
  private readonly srcRect: SkRect;
  private readonly body: SkPaint;
  private readonly honeyTop: SkPaint;
  private readonly lip: SkPaint;
  private readonly streak: SkPaint;
  private readonly drop: SkPaint;
  private readonly cloud: SkPaint;
  private readonly cloudHi: SkPaint;
  private readonly cloudRgb: Rgb3;
  private readonly cloudHiRgb: Rgb3;
  private readonly puffPaint: SkPaint;
  private readonly puff: SkImage | null;
  private readonly ownsPuff: boolean;
  private readonly shade: SkImage | null;
  private readonly streakImage: SkImage | null;
  private readonly dropImage: SkImage | null;
  private readonly surface: SurfacePoint[] = Array.from({ length: SURFACE_N }, () => ({ x: 0, y: 0 }));
  private readonly flakes: FlakeMark[] = Array.from({ length: 16 }, () => ({
    x: 0,
    t: 0,
    r: 0,
    alpha: 0,
  }));
  private readonly ribbons: RibbonMark[] = Array.from({ length: 16 }, () => ({
    x: 0,
    t: 0,
    len: 0,
    alpha: 0,
  }));
  private readonly puffs: CloudPuff[] = Array.from({ length: 12 }, () => ({
    x: 0,
    y: 0,
    r: 0,
    alpha: 0,
    shade: 0,
  }));
  private readonly color = new Float32Array(4);
  private disposed = false;

  constructor(
    private readonly layout: HourglassLayout,
    profile: HourglassProfile,
    theme: HourglassTheme,
    palette: ContentPalette,
    readonly material: ShapeMaterial,
    sprites?: { puff?: SkImage | null; shade?: SkImage | null; streak?: SkImage | null; drop?: SkImage | null },
  ) {
    this.profile = profile;
    this.recorder = Skia.PictureRecorder();
    this.bounds = Skia.XYWHRect(0, 0, layout.width, layout.height);
    const size = 72;
    this.srcRect = Skia.XYWHRect(0, 0, size, size);
    const body = mean(palette);
    const exposure = theme.sand.exposure;
    this.body = fillPaint(body, 0.96 * exposure);
    this.honeyTop = fillPaint(mix(body, [255, 236, 196], 0.18), 0.94);
    this.lip = Skia.Paint();
    this.lip.setAntiAlias(true);
    this.lip.setStyle(PaintStyle.Stroke);
    this.lip.setStrokeWidth(1.6);
    this.lip.setStrokeCap(StrokeCap.Round);
    this.lip.setColor(rgba(mix(body, [255, 250, 240], 0.72), 0.75));
    this.streak = Skia.Paint();
    this.streak.setAntiAlias(true);
    this.streak.setStyle(PaintStyle.Stroke);
    this.streak.setStrokeCap(StrokeCap.Round);
    this.drop = fillPaint(body, 0.9);
    this.cloudRgb = mix(body, [248, 250, 252], 0.28);
    this.cloudHiRgb = mix(body, [255, 252, 247], 0.62);
    this.cloud = fillPaint(this.cloudRgb, 1);
    this.cloudHi = fillPaint(this.cloudHiRgb, 1);
    this.puffPaint = Skia.Paint();
    this.puffPaint.setAntiAlias(true);
    // La imagen no se compone en Skia web. Ahí el copo es un degradado.
    this.ownsPuff = !sprites?.puff;
    this.puff = sprites?.puff ?? (material.cloud && Platform.OS !== 'web' ? makePuff(size) : null);
    this.shade = sprites?.shade ?? null;
    this.streakImage = sprites?.streak ?? null;
    this.dropImage = sprites?.drop ?? null;
  }

  paint(frame: ShapeFrame): SkPicture {
    if (this.disposed) throw new Error('ShapePainter usado después de dispose()');
    const canvas = this.recorder.beginRecording(this.bounds);
    const { layout, material } = this;
    const pose = frame.pose;
    const wave = frame.waves && !frame.reduceMotion && pose.flowing ? material.waves : 0;
    canvas.save();
    canvas.clipPath(layout.innerPath, ClipOp.Intersect, true);

    const bottomFill = pose.bottom * material.fullFraction;
    const topFill = pose.top * material.fullFraction;
    if (!material.cloud) {
      this.fillPool(canvas, false, topFill, pose.slope, material.mound, wave, frame.phase, this.honeyTop);
    }
    this.fillPool(canvas, true, bottomFill, pose.slope, material.mound * 0.35, wave, frame.phase, this.body);

    if (pose.flowing && !frame.reduceMotion) this.drawRibbon(canvas, frame);
    else if (pose.flowing) this.drawRibbon(canvas, { ...frame, phase: 0 });

    if (material.cloud) this.drawCloud(canvas, topFill, pose.slope, frame);

    canvas.restore();
    return this.recorder.finishRecordingAsPicture();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    safeDispose(this.body);
    safeDispose(this.honeyTop);
    safeDispose(this.lip);
    safeDispose(this.streak);
    safeDispose(this.drop);
    safeDispose(this.cloud);
    safeDispose(this.cloudHi);
    safeDispose(this.puffPaint);
    if (this.ownsPuff) safeDispose(this.puff);
    safeDispose(this.recorder);
  }

  private fillPool(
    canvas: SkCanvas,
    bottom: boolean,
    fill: number,
    slope: number,
    mound: number,
    wave: number,
    phase: number,
    paint: SkPaint,
  ): void {
    const n = writeLiquidSurface(
      this.profile,
      !bottom,
      fill,
      slope,
      mound,
      wave,
      phase * this.material.waveSpeed,
      this.surface,
    );
    if (n < 2) return;
    const { layout } = this;
    const b = Skia.PathBuilder.Make();
    try {
      const first = this.toPx(this.surface[0]!.x, this.surface[0]!.y);
      b.moveTo(first.x, first.y);
      for (let i = 1; i < n; i++) {
        const p = this.toPx(this.surface[i]!.x, this.surface[i]!.y);
        b.lineTo(p.x, p.y);
      }
      const endY = bottom ? layout.cy + layout.halfH * 1.08 : layout.cy;
      const last = this.toPx(this.surface[n - 1]!.x, this.surface[n - 1]!.y);
      b.lineTo(last.x, endY);
      b.lineTo(first.x, endY);
      b.close();
      const path = b.build();
      canvas.drawPath(path, paint);
      // El brillo de la superficie va encima del relleno.
      const lip = Skia.PathBuilder.Make();
      try {
        lip.moveTo(first.x, first.y);
        for (let i = 1; i < n; i++) {
          const p = this.toPx(this.surface[i]!.x, this.surface[i]!.y);
          lip.lineTo(p.x, p.y);
        }
        const lipPath = lip.build();
        canvas.drawPath(lipPath, this.lip);
        lipPath.dispose();
      } finally {
        lip.dispose();
      }
      path.dispose();
    } finally {
      b.dispose();
    }
  }

  private drawRibbon(canvas: ReturnType<SkPictureRecorder['beginRecording']>, frame: ShapeFrame): void {
    if (this.material.flakes) {
      this.drawFlakes(canvas, frame);
      return;
    }
    const count = Math.max(1, Math.round(this.material.ribbonCount * frame.ribbons));
    const n = writeRibbons(frame.phase * this.material.ribbonSpeed, count, this.ribbons);
    const { layout } = this;
    const g = frameGravity(frame.pose.slope);
    const travel = layout.halfH * 0.62;
    const neckY = layout.cy + g.y * layout.halfH * 0.02;
    for (let i = 0; i < n; i++) {
      const mark = this.ribbons[i]!;
      const along = mark.t * travel;
      const side = mark.x * layout.halfW * 0.07;
      const x = layout.cx + g.x * along - g.y * side;
      const y = neckY + g.y * along + g.x * side;
      if (this.material.look === 'miel' && this.dropImage) {
        const r = layout.cell * (3.2 + mark.len * 5);
        this.drop.setAlphaf(0.55 + 0.4 * mark.alpha);
        canvas.drawImageRect(
          this.dropImage,
          Skia.XYWHRect(0, 0, this.dropImage.width(), this.dropImage.height()),
          Skia.XYWHRect(x - r, y - r, r * 2, r * 2),
          this.drop,
        );
      } else if (this.material.look === 'lluvia' && this.streakImage) {
        const len = layout.halfH * mark.len * 1.4;
        const thick = Math.max(2, layout.cell * 0.7);
        this.streak.setAlphaf(0.35 + 0.55 * mark.alpha);
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((Math.atan2(g.x, g.y) * 180) / Math.PI, 0, 0);
        canvas.drawImageRect(
          this.streakImage,
          Skia.XYWHRect(0, 0, this.streakImage.width(), this.streakImage.height()),
          Skia.XYWHRect(-thick / 2, -len, thick, len),
          this.streak,
        );
        canvas.restore();
      } else if (this.material.look === 'miel') {
        const r = layout.cell * (2.1 + mark.len * 4);
        this.color[0] = 0.78;
        this.color[1] = 0.55;
        this.color[2] = 0.22;
        this.color[3] = 0.55 + 0.4 * mark.alpha;
        this.drop.setColor(this.color);
        canvas.drawCircle(x, y, r, this.drop);
      } else {
        const len = layout.halfH * mark.len;
        this.streak.setStrokeWidth(Math.max(1, layout.cell * 0.55));
        this.color[0] = 0.62;
        this.color[1] = 0.7;
        this.color[2] = 0.74;
        this.color[3] = 0.25 + 0.55 * mark.alpha;
        this.streak.setColor(this.color);
        canvas.drawLine(
          x - g.x * len,
          y - g.y * len,
          x + g.x * len * 0.15,
          y + g.y * len * 0.15,
          this.streak,
        );
      }
    }
  }

  private drawFlakes(canvas: SkCanvas, frame: ShapeFrame): void {
    const count = Math.max(1, Math.round(this.material.ribbonCount * frame.ribbons));
    const n = writeFlakes(frame.phase * this.material.ribbonSpeed, count, this.flakes);
    const { layout } = this;
    const g = frameGravity(frame.pose.slope);
    const travel = layout.halfH * 0.7;
    for (let i = 0; i < n; i++) {
      const mark = this.flakes[i]!;
      const along = mark.t * travel;
      const side = mark.x * layout.halfW * 0.1;
      const x = layout.cx + g.x * along - g.y * side;
      const y = layout.cy + g.y * along + g.x * side;
      const r = Math.max(1.2, layout.cell * mark.r * 0.9);
      this.color[0] = 0.95;
      this.color[1] = 0.97;
      this.color[2] = 0.98;
      this.color[3] = 0.35 + 0.55 * mark.alpha;
      this.drop.setColor(this.color);
      canvas.drawCircle(x, y, r, this.drop);
    }
  }

  private drawCloud(canvas: SkCanvas, fill: number, slope: number, frame: ShapeFrame): void {
    const image = this.puff;
    const drift = frame.reduceMotion ? 0 : frame.drift;
    const n = Math.round(writeCloud(fill, slope, drift, this.puffs) * frame.puffs);
    const { layout } = this;
    const anchorY = layout.cy - layout.halfH * 0.52;
    for (let i = 0; i < n; i++) {
      const puff = this.puffs[i]!;
      const r = puff.r * layout.halfW * 1.15;
      if (!(r > 1)) continue;
      const x = layout.cx + puff.x * layout.halfW * 0.72;
      const y = anchorY + puff.y * layout.halfH * 0.34;
      const rgb = puff.shade > 0.9 ? this.cloudHiRgb : this.cloudRgb;
      const a = Math.min(1, puff.alpha);
      const dest = Skia.XYWHRect(x - r, y - r, r * 2, r * 2);
      const sprite = puff.shade < 0.7 && this.shade ? this.shade : image;
      if (sprite) {
        const paint = puff.shade > 0.9 ? this.cloudHi : this.cloud;
        paint.setAlphaf(a);
        canvas.drawImageRect(
          sprite,
          Skia.XYWHRect(0, 0, sprite.width(), sprite.height()),
          dest,
          paint,
        );
      } else {
        const shader = Skia.Shader.MakeRadialGradient(
          { x, y },
          Math.max(1, r),
          [rgba(rgb, a), rgba(rgb, 0)],
          [0.2, 1],
          TileMode.Clamp,
        );
        this.puffPaint.setShader(shader);
        canvas.drawOval(dest, this.puffPaint);
        this.puffPaint.setShader(null);
        safeDispose(shader);
      }
    }
  }

  private toPx(x: number, y: number): { x: number; y: number } {
    const { layout } = this;
    return { x: layout.cx + x * layout.halfW, y: layout.cy + y * layout.halfH };
  }

  private readonly profile: HourglassProfile;
}

function frameGravity(slope: number): Vec2 {
  const sx = slope;
  const len = Math.hypot(sx, 1);
  return { x: sx / len, y: 1 / len };
}

function mean(palette: ContentPalette): Rgb3 {
  const tones = palette.grainTones;
  const c = [0, 0, 0];
  for (const tone of tones) {
    c[0] += tone[0]!;
    c[1] += tone[1]!;
    c[2] += tone[2]!;
  }
  const n = Math.max(1, tones.length);
  return [c[0] / n, c[1] / n, c[2] / n];
}

type Rgb3 = [number, number, number];

function mix(a: Rgb3, b: readonly number[], t: number): Rgb3 {
  return [a[0] + (b[0]! - a[0]) * t, a[1] + (b[1]! - a[1]) * t, a[2] + (b[2]! - a[2]) * t];
}

function rgba(rgb: Rgb3, a: number): Float32Array {
  return new Float32Array([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, a]);
}

function fillPaint(rgb: Rgb3, alpha: number): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(rgba(rgb, alpha));
  return paint;
}

/** Círculo suave con un poco de grano. Se crea una vez por pintor. */
function makePuff(size: number): SkImage | null {
  const px = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      let alpha = Math.exp(-d * d * 2.15);
      if (d > 1) alpha = 0;
      const n = ((x * 13 + y * 47) % 17) / 17;
      alpha *= 0.84 + 0.16 * n;
      const a = Math.round(Math.min(1, alpha) * 255);
      const o = (y * size + x) * 4;
      // Premultiplicado: sin esto, Skia en la web no pinta el copo.
      px[o] = a;
      px[o + 1] = a;
      px[o + 2] = a;
      px[o + 3] = a;
    }
  }
  const info: ImageInfo = {
    width: size,
    height: size,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Premul,
  };
  const data = Skia.Data.fromBytes(px);
  const image = Skia.Image.MakeImage(info, data, size * 4);
  safeDispose(data);
  return image;
}
