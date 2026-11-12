import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('el volteo termina en 0 y el canje no salta', async () => {
  const { mod, cleanup } = await bundle(
    `export { estadoInicial, pasoFrasco, continuidadVolteo } from './src/frasco/maquina.ts';
     export { arrastreSuprimeClic, ruedaAjustaTiempo } from './src/stageClick.ts';\n`,
  );
  try {
    let estado = mod.estadoInicial();
    estado = mod.pasoFrasco(estado, { tipo: 'arrastrar', angulo: Math.PI * 0.7, dt: 1 / 60 }).estado;
    let paso = mod.pasoFrasco(estado, { tipo: 'soltar', reducir: false });
    estado = paso.estado;
    let completado = paso.volteoCompletado;
    for (let i = 0; i < 240 && !completado; i++) {
      paso = mod.pasoFrasco(estado, { tipo: 'quieto', dt: 1 / 60, reducir: false });
      estado = paso.estado;
      completado = paso.volteoCompletado;
    }
    assert.equal(completado, true);
    assert.ok(Math.abs(estado.angulo) < 1e-6);
    assert.equal(estado.fase, 'reposo');

    for (const [x, y] of [
      [0.2, -0.4],
      [-0.1, 0.3],
      [0, 0.5],
    ]) {
      const { antes, despues } = mod.continuidadVolteo(x, y);
      assert.ok(Math.abs(antes.x - despues.x) < 1e-9);
      assert.ok(Math.abs(antes.y - despues.y) < 1e-9);
    }

    assert.equal(mod.arrastreSuprimeClic(0.01), false);
    assert.equal(mod.arrastreSuprimeClic(0.2), true);
    assert.equal(mod.ruedaAjustaTiempo('idle', false), true);
    assert.equal(mod.ruedaAjustaTiempo('running', false), false);
    assert.equal(mod.ruedaAjustaTiempo('paused', false), false);
    assert.equal(mod.ruedaAjustaTiempo('idle', true), false);
  } finally {
    cleanup();
  }
});

test('por debajo del umbral el frasco vuelve y no reinicia', async () => {
  const { mod, cleanup } = await bundle(
    "export { estadoInicial, pasoFrasco } from './src/frasco/maquina.ts';\n",
  );
  try {
    let estado = mod.estadoInicial();
    estado = mod.pasoFrasco(estado, { tipo: 'arrastrar', angulo: 0.2, dt: 1 / 60 }).estado;
    let paso = mod.pasoFrasco(estado, { tipo: 'soltar', reducir: false });
    assert.equal(paso.volteoCompletado, false);
    estado = paso.estado;
    for (let i = 0; i < 240 && estado.fase !== 'reposo'; i++) {
      paso = mod.pasoFrasco(estado, { tipo: 'quieto', dt: 1 / 60, reducir: false });
      assert.equal(paso.volteoCompletado, false);
      estado = paso.estado;
    }
    assert.equal(estado.fase, 'reposo');
    assert.ok(Math.abs(estado.angulo) < 1e-6);
  } finally {
    cleanup();
  }
});
