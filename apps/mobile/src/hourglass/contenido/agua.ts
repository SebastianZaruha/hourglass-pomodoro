/**
 * Agua de Lluvia. El modelo vive en el core; aquí solo se pinta.
 * El path del vidrio, los paints y el shader de la foto se crean una vez.
 * Cada fotograma solo nace el shader de uniforms (Skia no lo deja reutilizar)
 * y el picture, que el bucle libera.
 */
import {
  crearModeloAgua,
  muestraOla,
  outlinePoints,
  type EntradaAgua,
  type HourglassModel,
  type LineaAgua,
  type PuntoPlano,
  type VistaAgua,
} from '@reloj/core';
import {
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  StrokeCap,
  Skia,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';

import { disposeLater, safeDispose } from '../disposal';
import type { HourglassLayout } from '../layout';
import type { ShaderSet } from '../resources';
import { PARALLAX, marcoFoto } from '../staticLayers';
import { UniformPacker } from '../shaders/uniforms';
import type { MotionSource } from '../types';
import type { OpcionesPintor } from './arena';
import type { EntradaMotor, MotorContenido } from './tipos';

const GOTAS = 4;
const INTERVALO_GOTA = 0.14;
const VELOCIDAD_GOTA = 520;
const LARGO_HILO = 16;
const FADE_GOTAS = 0.2;
/** Hilos del chorro. En claro se ven; en oscuro siguen blancos y finos. */
const GOTA_CLARA = '#2e2e2e';
const ALFA_GOTA_CLARA = 0.32;
const GROSOR_GOTA_CLARA = 0.8;
const GOTA_OSCURA = '#ffffff';
const ALFA_GOTA_OSCURA = 0.22;
const GROSOR_GOTA_OSCURA = 0.6;

export function crearAgua(opts: { readonly model: HourglassModel; readonly layout: HourglassLayout }): AguaContenido {
  return new AguaMotor(opts.model, opts.layout);
}

export interface AguaContenido extends MotorContenido {
  ponerPintor(opts: OpcionesPintor): void;
}

function poligono(model: HourglassModel, layout: HourglassLayout, arriba: boolean): PuntoPlano[] {
  const pts = outlinePoints(model.profile, 64, true);
  const der: PuntoPlano[] = [];
  for (const p of pts) {
    if (arriba ? p.y <= 0.02 : p.y >= -0.02) {
      der.push({ x: layout.cx + p.x * layout.halfW, y: layout.cy + p.y * layout.halfH });
    }
  }
  const out = der.slice();
  for (let i = der.length - 1; i >= 0; i--) {
    const p = der[i]!;
    out.push({ x: layout.cx * 2 - p.x, y: p.y });
  }
  return out;
}

class AguaMotor implements AguaContenido {
  private readonly modelo = crearModeloAgua();
  private readonly layout: HourglassLayout;
  private vista: VistaAgua;
  private shaders: ShaderSet | null = null;
  private packer: UniformPacker | null = null;
  private recorder = Skia.PictureRecorder();
  private readonly bounds;
  private readonly frasco;
  private readonly aguaPaint: SkPaint = Skia.Paint();
  private readonly gotaPaint: SkPaint = Skia.Paint();
  private foto: SkImage | null = null;
  private anclaY = 1;
  private fondo: SkShader | null = null;
  private readonly matriz = Skia.Matrix();
  private readonly uniforms = {
    uSen: 0,
    uCs: 1,
    uSplit: 0,
    uHA: 0,
    uHB: 0,
    uSA0: 0,
    uSA1: 1,
    uSB0: 0,
    uSB1: 1,
    uRA: 1,
    uRB: 1,
    uDibA: 0,
    uDibB: 0,
    uOA0: [0, 0, 0, 0],
    uOA1: [0, 0, 0, 0],
    uOB0: [0, 0, 0, 0],
    uOB1: [0, 0, 0, 0],
    uParallax: [0, 0],
  };
  private alfaGota = ALFA_GOTA_OSCURA;
  /** Se rellena en cada paso. El modelo no se queda con ella. */
  private readonly entrada = {
    dt: 0,
    ahora: 0,
    theta: 0,
    durationMs: 0,
    remainingMs: 0,
    corriendo: false,
    pausa: false,
    enGiro: false,
    reposo: false,
  };
  private readonly gx = new Float32Array(GOTAS);
  private readonly gy = new Float32Array(GOTAS);
  private readonly gv = new Float32Array(GOTAS);
  private readonly gviva = new Uint8Array(GOTAS);
  private pendiente = 0;
  private fade = 0;
  private theta = 0;
  private thetaPintado = Number.NaN;
  hayQuePintar = true;
  simMs = 0;
  revision = 0;

  constructor(model: HourglassModel, layout: HourglassLayout) {
    this.layout = layout;
    this.bounds = Skia.XYWHRect(0, 0, layout.width, layout.height);
    this.frasco = Skia.XYWHRect(layout.gridX, layout.gridY, layout.halfW * 2, layout.halfH * 2);
    this.modelo.fijarContorno(poligono(model, layout, true), poligono(model, layout, false));
    this.vista = this.modelo.paso({
      dt: 0,
      ahora: 0,
      theta: 0,
      durationMs: 0,
      remainingMs: 0,
      corriendo: false,
      pausa: true,
      enGiro: false,
      reposo: false,
    });
    this.gotaPaint.setAntiAlias(true);
    this.gotaPaint.setStyle(PaintStyle.Stroke);
    this.gotaPaint.setStrokeWidth(GROSOR_GOTA_OSCURA);
    this.gotaPaint.setStrokeCap(StrokeCap.Round);
    this.gotaPaint.setColor(Skia.Color(GOTA_OSCURA));
    this.uniforms.uSplit = layout.cy;
  }

  ponerPintor(opts: OpcionesPintor): void {
    const claro = opts.theme.scheme !== 'dark';
    this.alfaGota = claro ? ALFA_GOTA_CLARA : ALFA_GOTA_OSCURA;
    this.gotaPaint.setStrokeWidth(claro ? GROSOR_GOTA_CLARA : GROSOR_GOTA_OSCURA);
    this.gotaPaint.setColor(Skia.Color(claro ? GOTA_CLARA : GOTA_OSCURA));
    this.shaders = opts.shaders;
    this.packer = new UniformPacker(opts.shaders.agua);
    this.anclaY = opts.anclaY;
    if (opts.foto !== this.foto) {
      if (this.fondo) disposeLater([this.fondo]);
      this.fondo = null;
      this.foto = opts.foto;
      this.fondo = this.crearFondo();
    }
    this.revision += 1;
    this.hayQuePintar = true;
  }

  private crearFondo(): SkShader {
    const foto = this.foto;
    if (!foto) return Skia.Shader.MakeColor(Skia.Color('rgba(0, 0, 0, 0)'));
    const marco = marcoFoto(foto.width(), foto.height(), this.layout.width, this.layout.height, this.anclaY);
    const m = this.matriz;
    m.identity();
    m.scale(marco.escala, marco.escala);
    m.translate(marco.x, marco.y);
    return foto.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None, m);
  }

  paso(e: EntradaMotor): boolean {
    if (e.soloVaciar) return false;
    const entrada = this.entrada;
    entrada.dt = e.dt;
    entrada.ahora = performance.now();
    entrada.theta = Math.atan2(e.gravedadSuave.x, e.gravedadSuave.y);
    entrada.durationMs = e.reposo ? e.durationMs : e.snap.durationMs;
    entrada.remainingMs = e.reposo ? e.durationMs : e.snap.remainingMs;
    entrada.corriendo = e.snap.status === 'running';
    entrada.pausa = e.snap.status === 'paused';
    entrada.enGiro = e.enGiro;
    entrada.reposo = e.reposo;
    this.vista = this.modelo.paso(entrada);
    this.theta = entrada.theta;
    this.moverGotas(entrada);
    const v = this.vista;
    this.hayQuePintar =
      v.sigue ||
      this.fade > 0.02 ||
      v.llenado !== null ||
      Math.abs(v.theta - this.thetaPintado) > 1e-4 ||
      Math.abs(v.phi) > 0.0005;
    return v.sigue || this.fade > 0.02 || v.llenado !== null;
  }

  pintar(motion: MotionSource): SkPicture {
    const canvas = this.recorder.beginRecording(this.bounds);
    const fondo = this.fondo;
    const packer = this.packer;
    const effect = this.shaders?.agua;
    if (fondo && packer && effect) {
      this.llenarUniforms(motion);
      const shader = effect.makeShaderWithChildren(packer.pack(this.uniforms), [fondo]);
      this.aguaPaint.setShader(shader);
      canvas.save();
      canvas.clipPath(this.layout.innerPath, ClipOp.Intersect, true);
      canvas.drawRect(this.frasco, this.aguaPaint);
      this.dibujarGotas(canvas);
      canvas.restore();
      this.aguaPaint.setShader(null);
      safeDispose(shader);
    }
    this.thetaPintado = this.vista.theta;
    this.hayQuePintar = false;
    return this.recorder.finishRecordingAsPicture();
  }

  alVoltear(motivo: 'reinicio' | 'fase'): void {
    this.modelo.alVoltear(motivo);
    this.hayQuePintar = true;
  }

  destruir(): void {
    this.modelo.destruir();
    const fondo = this.fondo;
    this.fondo = null;
    disposeLater([fondo, this.aguaPaint, this.gotaPaint, this.recorder, this.matriz]);
  }

  private llenarUniforms(motion: MotionSource): void {
    const u = this.uniforms;
    const v = this.vista;
    u.uSen = Math.sin(v.alfa);
    u.uCs = Math.cos(v.alfa);
    copiarOnda(v.arriba.onda, u.uOA0, u.uOA1);
    copiarOnda(v.abajo.onda, u.uOB0, u.uOB1);
    u.uHA = v.arriba.h;
    u.uHB = v.abajo.h;
    u.uSA0 = v.arriba.s0;
    u.uSA1 = v.arriba.s1;
    u.uSB0 = v.abajo.s0;
    u.uSB1 = v.abajo.s1;
    u.uRA = v.arriba.rango;
    u.uRB = v.abajo.rango;
    u.uDibA = v.arriba.dibujar ? 1 : 0;
    u.uDibB = v.abajo.dibujar ? 1 : 0;
    u.uParallax[0] = -motion.tilt.x * PARALLAX.background;
    u.uParallax[1] = -motion.tilt.y * PARALLAX.background;
  }

  private moverGotas(e: EntradaAgua): void {
    const cortar = !e.corriendo || this.vista.cortarGotas;
    if (cortar) this.fade = Math.max(0, this.fade - e.dt / FADE_GOTAS);
    else this.fade = Math.min(1, this.fade + e.dt / FADE_GOTAS);
    if (!cortar && e.corriendo && this.fade > 0.8) {
      this.pendiente += e.dt;
      while (this.pendiente >= INTERVALO_GOTA) {
        this.pendiente -= INTERVALO_GOTA;
        this.nacer();
      }
    }
    if (cortar) return;
    const sen = Math.sin(e.theta);
    const cs = Math.cos(e.theta);
    for (let i = 0; i < GOTAS; i++) {
      if (!this.gviva[i]) continue;
      this.gv[i] = (this.gv[i] ?? 0) + 1600 * e.dt;
      const vel = VELOCIDAD_GOTA + (this.gv[i] ?? 0);
      this.gx[i] = (this.gx[i] ?? 0) + sen * vel * e.dt;
      this.gy[i] = (this.gy[i] ?? 0) + cs * vel * e.dt;
      if (this.fuera(this.gx[i] ?? 0, this.gy[i] ?? 0)) this.gviva[i] = 0;
    }
  }

  private nacer(): void {
    for (let i = 0; i < GOTAS; i++) {
      if (this.gviva[i]) continue;
      this.gviva[i] = 1;
      this.gx[i] = this.layout.cx;
      this.gy[i] = this.layout.cy;
      this.gv[i] = 0;
      return;
    }
  }

  private fuera(x: number, y: number): boolean {
    const v = this.vista;
    const sen = Math.sin(v.alfa);
    const cs = Math.cos(v.alfa);
    const proj = x * sen + y * cs;
    const s = x * cs - y * sen;
    const linea = y >= this.layout.cy ? v.abajo : v.arriba;
    if (!linea.dibujar) return Math.hypot(x - this.layout.cx, y - this.layout.cy) > this.layout.halfH;
    return proj > linea.h + muestraOla(linea.onda, s, linea.s0, linea.s1) + 4;
  }

  private dibujarGotas(canvas: SkCanvas): void {
    if (this.fade <= 0.02) return;
    const sen = Math.sin(this.theta);
    const cs = Math.cos(this.theta);
    this.gotaPaint.setAlphaf(this.alfaGota * this.fade);
    for (let i = 0; i < GOTAS; i++) {
      if (!this.gviva[i]) continue;
      const x = this.gx[i] ?? 0;
      const y = this.gy[i] ?? 0;
      canvas.drawLine(x - sen * LARGO_HILO, y - cs * LARGO_HILO, x, y, this.gotaPaint);
    }
  }
}

function copiarOnda(onda: Float64Array, a: number[], b: number[]): void {
  for (let i = 0; i < 4; i++) a[i] = onda[i] ?? 0;
  for (let i = 0; i < 4; i++) b[i] = onda[4 + i] ?? 0;
}
