import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('la rueda no gira ni arranca, y el giro solo sigue si ya corría', async () => {
  const { mod, cleanup } = await bundle(
    `export { giroArranca, ruedaGiraFrasco, vueltaArranca } from './src/stageClick.ts';
     export { pasoFrasco } from './src/frasco/maquina.ts';\n`,
  );
  try {
    assert.equal(mod.ruedaGiraFrasco(), false);
    assert.equal(mod.vueltaArranca(), false);
    assert.equal(mod.giroArranca('running'), true);
    assert.equal(mod.giroArranca('idle'), false);
    assert.equal(mod.giroArranca('paused'), false);
    assert.equal(mod.giroArranca('finished'), false);

    let estado = {
      fase: 'volteando',
      angulo: Math.PI - 0.02,
      velocidad: 0.4,
      objetivo: Math.PI,
      reinicio: true,
    };
    let paso = { estado, volteoCompletado: false };
    for (let i = 0; i < 30 && paso.estado.reinicio; i++) {
      paso = mod.pasoFrasco(paso.estado, { tipo: 'quieto', dt: 1 / 60, reducir: false });
      assert.equal(paso.volteoCompletado, false);
    }
    assert.equal(paso.estado.reinicio, false);
    assert.equal(paso.estado.angulo, 0);
  } finally {
    cleanup();
  }
});

test('el agua en reposo sigue la duración y el nivel no salta en un fotograma', async () => {
  const { mod, cleanup } = await bundle(
    `export { volumenAgua, pasoNivel } from './src/frasco/nivel.ts';\n`,
  );
  try {
    const cinco = mod.volumenAgua(5 * 60_000, 5 * 60_000);
    const largo = mod.volumenAgua(180 * 60_000, 180 * 60_000);
    assert.ok(cinco.arriba > 0.3 && cinco.arriba < 0.5, `5 min → ${cinco.arriba}`);
    assert.ok(Math.abs(cinco.abajo - (1 - cinco.arriba)) < 1e-9);
    assert.ok(largo.arriba > 0.98, `180 min → ${largo.arriba}`);
    assert.ok(Math.abs(cinco.arriba - largo.arriba) > 0.4);

    const paso = mod.pasoNivel(0.2, 0.9, 0.016);
    assert.ok(paso > 0.2 && paso < 0.32, `un fotograma no puede saltar: ${paso}`);
    let nivel = 0.2;
    for (let i = 0; i < 90; i++) nivel = mod.pasoNivel(nivel, 0.9, 0.016);
    assert.ok(Math.abs(nivel - 0.9) < 0.01, `no llega: ${nivel}`);
  } finally {
    cleanup();
  }
});

test('al cerrar la vuelta el agua de abajo pasa arriba y la nube no se apaga', async () => {
  const { mod, cleanup } = await bundle(
    `export { volumenTrasCanje } from './src/frasco/nivel.ts';
     export { opacidadNube, opacidadNubeEnVuelta } from './src/frasco/nube.ts';\n`,
  );
  try {
    const canje = mod.volumenTrasCanje(0.22, 0.78);
    assert.equal(canje.visible, true);
    assert.equal(canje.arriba, 0.78);
    assert.equal(canje.abajo, 0.22);
    assert.ok(canje.abajo > 0);

    assert.equal(mod.opacidadNube(Math.PI / 2), 0);
    assert.equal(mod.opacidadNubeEnVuelta(Math.PI / 2, true), 1);
    assert.equal(mod.opacidadNubeEnVuelta(Math.PI / 2, false), 0);
  } finally {
    cleanup();
  }
});
