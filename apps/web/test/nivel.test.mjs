import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('con un minuto el nivel es proporcional al tiempo que queda', async () => {
  const { mod, cleanup } = await bundle(
    `export { nivelDesdeTiempo, nivelAbajo } from './src/frasco/nivel.ts';
     export { granosObjetivo, gravedadDelAngulo } from './src/frasco/fisica/arena.ts';
     export { SandSimulation, CLASSIC_MODEL, GRAVITY_DOWN } from '@reloj/core';\n`,
  );
  try {
    const lleno = mod.nivelDesdeTiempo(60_000, 60_000);
    assert.ok(lleno > 0);
    for (const [resta, fraccion] of [
      [59_000, 59 / 60],
      [30_000, 0.5],
      [1_000, 1 / 60],
      [0, 0],
    ]) {
      const nivel = mod.nivelDesdeTiempo(60_000, resta);
      assert.ok(Math.abs(nivel / lleno - fraccion) < 1e-9, `resta ${resta}`);
    }
    assert.equal(mod.nivelDesdeTiempo(60_000, 0), 0);
    assert.ok(Math.abs(mod.nivelAbajo(60_000, 60_000) - (1 - lleno)) < 1e-9);

    const sim = new mod.SandSimulation({ profile: mod.CLASSIC_MODEL.profile, cols: 41, seed: 4 });
    const total = sim.totalGrains;
    for (const resta of [59_000, 30_000, 1_000, 0]) {
      const objetivo = mod.granosObjetivo(total, 60_000, resta);
      sim.arrange(objetivo, Math.max(0, total - objetivo), mod.GRAVITY_DOWN);
      assert.equal(sim.topCount, objetivo);
      const inclinada = mod.gravedadDelAngulo(0.6);
      for (let i = 0; i < 24; i++) sim.step(inclinada);
      for (let i = 0; i < 24; i++) sim.step(mod.GRAVITY_DOWN);
      assert.equal(sim.topCount, objetivo, `tras inclinar a ${resta}`);
    }
  } finally {
    cleanup();
  }
});
