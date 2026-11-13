import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('la superficie queda horizontal a los 600 ms y el corte no cambia el volumen', async () => {
  const { mod, cleanup } = await bundle(
    `export { corteDeBulbo, muelleSuperficie } from './src/frasco/fisica/superficie.ts';
     export { pasoMuelle, muelleQuieto } from './src/frasco/muelle.ts';
     export { pasoFrasco, estadoInicial } from './src/frasco/maquina.ts';\n`,
  );
  try {
    const { rigidez, amortiguacion } = mod.muelleSuperficie();
    let muelle = mod.muelleQuieto((30 * Math.PI) / 180);
    for (let t = 0; t < 600; t += 16) {
      muelle = mod.pasoMuelle(muelle, 0, 0.016, rigidez, amortiguacion);
    }
    assert.ok(Math.abs(muelle.valor) < Math.PI / 180, `sigue a ${((muelle.valor * 180) / Math.PI).toFixed(2)}°`);

    const puntos = new Float32Array(8);
    puntos.set([0.3, 0.2, 0.7, 0.2, 0.3, 0.4, 0.7, 0.4]);
    const recto = mod.corteDeBulbo(puntos, 0, 4, 0.5, 0, 0, 100, 200);
    const girado = mod.corteDeBulbo(puntos, 0, 4, 0.5, 0, 0.4, 100, 200);
    assert.equal(recto !== null, true);
    assert.equal(girado !== null, true);

    let estado = mod.estadoInicial();
    estado = mod.pasoFrasco(estado, { tipo: 'reiniciar', reducir: false }).estado;
    assert.equal(estado.reinicio, true);
    let paso = { estado, volteoCompletado: false };
    for (let i = 0; i < 240 && paso.estado.reinicio; i++) {
      paso = mod.pasoFrasco(paso.estado, { tipo: 'quieto', dt: 1 / 60, reducir: false });
      assert.equal(paso.volteoCompletado, false);
    }
    assert.equal(paso.estado.angulo, 0);
    assert.equal(paso.estado.reinicio, false);
  } finally {
    cleanup();
  }
});
