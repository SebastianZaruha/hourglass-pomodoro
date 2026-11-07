import { describe, expect, it } from 'vitest';
import anchors from '../src/shape/anchors-ground.json';
import {
  CLASSIC_MODEL,
  CLOUD_TEMPLATE,
  HONEY,
  RAIN,
  SAND,
  SandSimulation,
  bulbVolume,
  flowPose,
  progressOf,
  surfaceU,
  writeCloud,
  writeLiquidSurface,
  writeFlakes,
  writeRibbons,
  FLAKE_CAP,
  SNOW,
  coverFrame,
  groundContact,
  type CloudPuff,
  type RibbonMark,
  type SurfacePoint,
} from '../src';

const profile = CLASSIC_MODEL.profile;

describe('progreso → pose', () => {
  it('p es el tiempo transcurrido y no depende de contar granos', () => {
    expect(progressOf(60_000, 60_000)).toBe(0);
    expect(progressOf(0, 60_000)).toBe(1);
    expect(progressOf(15_000, 60_000)).toBeCloseTo(0.75);
    expect(progressOf(Number.NaN, 60_000)).toBe(0);
    expect(progressOf(10, 0)).toBe(0);
  });

  it('arriba y abajo suman 1, y el chorro solo corre de pie', () => {
    const start = flowPose({
      remainingMs: 60_000,
      durationMs: 60_000,
      gravityX: 0,
      gravityY: 1,
      running: false,
    });
    expect(start.top).toBe(1);
    expect(start.bottom).toBe(0);
    expect(start.flowing).toBe(false);
    expect(start.slope).toBe(0);

    const mid = flowPose({
      remainingMs: 30_000,
      durationMs: 60_000,
      gravityX: 0.2,
      gravityY: 1,
      running: true,
    });
    expect(mid.top + mid.bottom).toBeCloseTo(1);
    expect(mid.flowing).toBe(true);
    expect(mid.slope).toBeCloseTo(0.2);

    const flat = flowPose({
      remainingMs: 30_000,
      durationMs: 60_000,
      gravityX: 1,
      gravityY: 0.1,
      running: true,
    });
    expect(flat.flowing).toBe(false);
  });

  it('un reloj de 5 min y uno de 60 min a la mitad tienen el mismo nivel', () => {
    const short = flowPose({
      remainingMs: 2.5 * 60_000,
      durationMs: 5 * 60_000,
      gravityX: 0,
      gravityY: 1,
      running: true,
    });
    const long = flowPose({
      remainingMs: 30 * 60_000,
      durationMs: 60 * 60_000,
      gravityX: 0,
      gravityY: 1,
      running: true,
    });
    expect(short.top).toBeCloseTo(long.top);
    expect(short.bottom).toBeCloseTo(long.bottom);
  });
});

describe('superficie del líquido', () => {
  it('el bulbo tiene volumen y la superficie es monótona', () => {
    expect(bulbVolume(profile)).toBeGreaterThan(0.2);
    const bottom = [0.2, 0.5, 0.9].map((f) => surfaceU(profile, f, false));
    expect(bottom[0]!).toBeGreaterThan(bottom[1]!);
    expect(bottom[1]!).toBeGreaterThan(bottom[2]!);
    const top = [0.2, 0.5, 0.9].map((f) => surfaceU(profile, f, true));
    expect(top[0]!).toBeLessThan(top[1]!);
    expect(top[1]!).toBeLessThan(top[2]!);
  });

  it('vacío no dibuja superficie; lleno se acerca al cuello abajo', () => {
    const into: SurfacePoint[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
    expect(writeLiquidSurface(profile, false, 0, 0, 0, 0, 0, into)).toBe(0);
    expect(surfaceU(profile, 1, false)).toBeLessThan(0.05);
    expect(surfaceU(profile, 0, true)).toBe(0);
  });

  it('la cúpula de la miel sube el centro sin cambiar el volumen pedido', () => {
    const into: SurfacePoint[] = Array.from({ length: 9 }, () => ({ x: 0, y: 0 }));
    writeLiquidSurface(profile, false, 0.5, 0, HONEY.mound, 0, 0, into);
    const mid = into[4]!.y;
    const edge = into[0]!.y;
    expect(mid).toBeLessThan(edge);
  });
});

describe('coste frente a la arena', () => {
  it('la pose es mucho más barata que un paso del autómata', () => {
    const sim = new SandSimulation({
      profile,
      cols: 121,
      seed: 1,
      slideChance: SAND.slideChance,
      fillRatio: SAND.fillRatio,
    });
    sim.arrange(Math.round(sim.totalGrains * 0.7), sim.totalGrains - Math.round(sim.totalGrains * 0.7));
    const busyN = 12;
    const t0 = performance.now();
    for (let i = 0; i < busyN; i++) sim.step({ x: 0.95, y: 0.3 });
    const sandBusyMs = (performance.now() - t0) / busyN;
    const calmN = 30;
    const t1 = performance.now();
    for (let i = 0; i < calmN; i++) sim.step({ x: 0, y: 1 });
    const sandCalmMs = (performance.now() - t1) / calmN;
    const poses = 400;
    const t2 = performance.now();
    for (let i = 0; i < poses; i++) {
      flowPose({ remainingMs: 30_000, durationMs: 60_000, gravityX: 0.2, gravityY: 1, running: true });
      surfaceU(profile, 0.5, false);
    }
    const poseMs = (performance.now() - t2) / poses;
    expect(sandBusyMs).toBeGreaterThan(sandCalmMs);
    expect(poseMs).toBeLessThan(sandCalmMs);
  });
});

describe('chorro continuo y nube', () => {
  it('la fase recorre el cuello igual, sin saber la duración', () => {
    const into: RibbonMark[] = Array.from({ length: 8 }, () => ({ x: 0, t: 0, len: 0, alpha: 0 }));
    writeRibbons(0.25, RAIN.ribbonCount, into);
    const first = into[0]!.t;
    writeRibbons(1.25, RAIN.ribbonCount, into);
    expect(into[0]!.t).toBeCloseTo(first);
    expect(RAIN.ribbonSpeed).toBeGreaterThan(HONEY.ribbonSpeed);
    expect(RAIN.ribbonCount).toBeGreaterThan(0);
  });

  it('la nube encoge y se apaga cuando no queda nada arriba', () => {
    const into: CloudPuff[] = Array.from({ length: CLOUD_TEMPLATE.length }, () => ({
      x: 0,
      y: 0,
      r: 0,
      alpha: 0,
      shade: 0,
    }));
    const full = writeCloud(1, 0, 0, into);
    const fullR = into[0]!.r;
    const half = writeCloud(0.4, 0, 0, into);
    expect(full).toBe(CLOUD_TEMPLATE.length);
    expect(half).toBe(full);
    expect(into[0]!.r).toBeLessThan(fullR);
    expect(writeCloud(0, 0, 0, into)).toBe(0);
    expect(RAIN.cloud).toBe(true);
    expect(HONEY.cloud).toBe(false);
    expect(SNOW.flakes).toBe(true);
    expect(SAND.kind).toBe('granular');
  });

  it('los copos tienen un tope fijo y un ciclo los repite', () => {
    const into = Array.from({ length: 24 }, () => ({ x: 0, t: 0, r: 0, alpha: 0 }));
    expect(writeFlakes(0.2, 40, into)).toBe(FLAKE_CAP);
    const first = into[3]!.t;
    writeFlakes(1.2, FLAKE_CAP, into);
    expect(into[3]!.t).toBeCloseTo(first);
    expect(writeFlakes(0.2, 4, into)).toBe(4);
  });
});

describe('el frasco se apoya en la hierba', () => {
  it('el contacto sale del JSON, no de un número escrito en el código', () => {
    const snow = groundContact('nieve', true);
    const file = (anchors.scenes as Record<string, { contact: { x: number; y: number } }>)['nieve-h'];
    expect(snow).toEqual(file?.contact);
    expect(groundContact('arena', false).y).toBeGreaterThan(0.5);
  });

  it('el punto de hierba de la foto cae en el pie y la foto cubre la vista', () => {
    const contact = groundContact('arena', false);
    const frame = coverFrame(390, 844, 1080, 1920, 195, 640, contact.x, contact.y);
    const scale = frame.w / 1080;
    const footX = frame.x + contact.x * 1080 * scale;
    const footY = frame.y + contact.y * 1920 * scale;
    expect(footX).toBeCloseTo(195);
    expect(footY).toBeCloseTo(640);
    expect(frame.x).toBeLessThanOrEqual(0.01);
    expect(frame.y).toBeLessThanOrEqual(0.01);
    expect(frame.x + frame.w).toBeGreaterThanOrEqual(390 - 0.01);
    expect(frame.y + frame.h).toBeGreaterThanOrEqual(844 - 0.01);
  });
});
