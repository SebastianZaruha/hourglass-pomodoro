import { describe, expect, it } from 'vitest';

import { SandSimulation, TILT_LOD, TiltLod, CLASSIC_MODEL, getContent, type Vec2 } from '../src';

const at = (deg: number): Vec2 => ({
  x: Math.sin(deg / (180 / Math.PI)),
  y: Math.cos(deg / (180 / Math.PI)),
});
/** Escalones de 3° como los de MotionProcessor (simGravity). */
const fine = (deg: number): Vec2 => at(Math.round(deg / 3) * 3);

/**
 * Simula un giro: de `from` a `to` grados en `ms`, y luego quieto `holdMs`.
 * `cost` da el coste de la simulación en cada fotograma.
 */
function run(
  lod: TiltLod,
  from: number,
  to: number,
  ms: number,
  holdMs: number,
  cost: (deg: number) => number,
  start = 0,
) {
  const states: { t: number; active: boolean; g: Vec2 }[] = [];
  let simMs = 0;
  for (let t = 0; t <= ms + holdMs; t += 16) {
    const k = Math.min(1, t / ms);
    const deg = from + (to - from) * k;
    const g = lod.update(start + t, at(deg), fine(deg), simMs);
    simMs = lod.isActive ? cost(deg) / 3 : cost(deg);
    states.push({ t: start + t, active: lod.isActive, g });
  }
  return states;
}

describe('TiltLod (menos detalle solo en un giro fuerte, 1.8.9)', () => {
  it('móvil quieto o con poco giro: nunca se activa, aunque el móvil sea lento', () => {
    const lod = new TiltLod();
    // De pie, quieto, con fotogramas caros.
    expect(run(lod, 0, 0, 1000, 1000, () => 80).some((s) => s.active)).toBe(false);
    // Inclinación normal de la mano (25°).
    expect(run(lod, 0, 25, 500, 1000, () => 80, 3000).some((s) => s.active)).toBe(false);
  });

  it('de lado y quieto: calidad normal', () => {
    const lod = new TiltLod();
    // Ya estaba de lado (el reposo se toma ahí).
    const states = run(lod, 90, 90, 1000, 2000, () => 80);
    expect(states.some((s) => s.active)).toBe(false);
  });

  it('giro fuerte en un móvil que llega: no se activa', () => {
    const lod = new TiltLod();
    expect(run(lod, 0, 130, 600, 2000, () => 6).some((s) => s.active)).toBe(false);
  });

  it('giro fuerte en un móvil que no llega: se activa y se apaga unos segundos después de parar', () => {
    const lod = new TiltLod();
    const states = run(lod, 0, 130, 600, 5000, () => 60);
    const first = states.findIndex((s) => s.active);
    expect(first).toBeGreaterThan(0);
    // Solo después de girar al menos strongTiltDeg.
    const degAtFirst = (states[first]!.t / 600) * 130;
    expect(degAtFirst).toBeGreaterThanOrEqual(TILT_LOD.strongTiltDeg);
    // Sigue activo mientras gira y un rato después...
    const lastActive = states.map((s) => s.active).lastIndexOf(true);
    const offAt = states[lastActive + 1]!.t;
    expect(offAt).toBeGreaterThanOrEqual(600 + TILT_LOD.holdMs);
    expect(offAt).toBeLessThanOrEqual(600 + TILT_LOD.restMs + TILT_LOD.holdMs + 50);
    // ...y se apaga del todo.
    expect(states.at(-1)!.active).toBe(false);
  });

  it('activo: la gravedad de la simulación va en escalones de 10°; apagado, la fina', () => {
    const lod = new TiltLod();
    const states = run(lod, 0, 130, 600, 5000, () => 60);
    const active = states.filter((s) => s.active);
    const dirs = new Set(active.map((s) => Math.round(Math.atan2(s.g.x, s.g.y) * (180 / Math.PI))));
    for (const d of dirs) {
      // El primero es el escalón fino del que parte (sin salto); el resto, de 10 en 10.
      if (d !== dirs.values().next().value) expect(Math.abs(d % 10)).toBe(0);
    }
    // Menos cambios de dirección (= reordenaciones) que con escalones de 3°.
    expect(dirs.size).toBeLessThan(active.length);
    const end = states.at(-1)!;
    expect(end.g.x).toBeCloseTo(fine(130).x, 10);
    expect(end.g.y).toBeCloseTo(fine(130).y, 10);
  });

  it('de pie con el LOD activo la arena cae recta (10° divide 90°)', () => {
    const lod = new TiltLod();
    // Giro fuerte hacia un lado y vuelta a de pie sin parar.
    run(lod, 0, 120, 400, 0, () => 60);
    const states = run(lod, 120, 0, 400, 300, () => 60, 416);
    const last = states.at(-1)!;
    expect(last.active).toBe(true);
    expect(last.g.x).toBeCloseTo(0, 10);
    expect(last.g.y).toBeCloseTo(1, 10);
  });

  it('reset vuelve a la calidad normal', () => {
    const lod = new TiltLod();
    run(lod, 0, 130, 600, 0, () => 60);
    expect(lod.isActive).toBe(true);
    lod.reset();
    expect(lod.isActive).toBe(false);
    const g = fine(130);
    expect(lod.update(10_000, at(130), g, 60)).toBe(g);
  });

  it('con la gravedad en escalones de 10° la arena acaba en el mismo lado', () => {
    const content = getContent(null);
    const make = () => {
      const sim = new SandSimulation({
        profile: CLASSIC_MODEL.profile,
        cols: 61,
        slideChance: content.slideChance,
        fillRatio: content.fillRatio,
        seed: 7,
      });
      const half = Math.round(sim.totalGrains / 2);
      sim.arrange(half, sim.totalGrains - half);
      return sim;
    };
    const sideOf = (sim: SandSimulation) => {
      let right = 0;
      let left = 0;
      for (let i = 0; i < sim.cells.length; i++) {
        if (sim.cells[i] === 0) continue;
        if (i % sim.cols > sim.centerCol) right++;
        else if (i % sim.cols < sim.centerCol) left++;
      }
      return right / (right + left);
    };
    const normal = make();
    const coarse = make();
    const lod = new TiltLod({ ...TILT_LOD, heavyFrames: 1, heavyFrameMs: 0 });
    for (let f = 0; f < 400; f++) {
      const deg = Math.min(110, f * 4);
      normal.step(fine(deg));
      coarse.step(lod.update(f * 16, at(deg), fine(deg), 1));
    }
    expect(Math.abs(sideOf(coarse) - sideOf(normal))).toBeLessThan(0.05);
    expect(normal.countGrains()).toEqual(coarse.countGrains());
  });
});
