import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('la superficie sigue el mundo y el chorro para si el cuello queda en seco', async () => {
  const { mod, cleanup } = await bundle(
    `export { anguloNivel, cuelloMojado, superficieAgua } from './src/frasco/fisica/agua.ts';\n`,
  );
  try {
    assert.equal(mod.anguloNivel(0.4, 0), 0.4);
    const derecha = mod.superficieAgua('abajo', 0.4, mod.anguloNivel(0.5, 0));
    const izquierda = mod.superficieAgua('abajo', 0.4, mod.anguloNivel(-0.5, 0));
    assert.ok(derecha.gravedad.x > 0);
    assert.ok(izquierda.gravedad.x < 0);
    assert.equal(mod.cuelloMojado(0.4, 0), true);
    assert.equal(mod.cuelloMojado(0.12, Math.PI / 2), false);
  } finally {
    cleanup();
  }
});

test('la superficie es horizontal en el mundo y el agua cae al lado bajo', async () => {
  const { mod, cleanup } = await bundle(
    `export { lineaDeCorte, poligonoLiquido, centroide } from './src/frasco/fisica/agua.ts';
     export { gravedadDelAngulo } from './src/frasco/fisica/arena.ts';
     export { despegueNube } from './src/frasco/nube.ts';\n`,
  );
  try {
    const mundo = (punto, angulo) => {
      const dx = punto.x - 0.5;
      const dy = punto.y - 0.5;
      const c = Math.cos(angulo);
      const s = Math.sin(angulo);
      return { x: 0.5 + dx * c - dy * s, y: 0.5 + dx * s + dy * c };
    };
    for (const angulo of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI]) {
      const g = mod.gravedadDelAngulo(angulo);
      const pantalla = {
        x: g.x * Math.cos(angulo) - g.y * Math.sin(angulo),
        y: g.x * Math.sin(angulo) + g.y * Math.cos(angulo),
      };
      assert.ok(Math.abs(pantalla.x) < 1e-6 && Math.abs(pantalla.y - 1) < 1e-6, `gravedad ${angulo}`);
      for (const bulbo of ['arriba', 'abajo']) {
        const corte = mod.lineaDeCorte(bulbo, 0.45, angulo).map((punto) => mundo(punto, angulo));
        assert.ok(corte.length >= 2, `${bulbo} ${angulo} sin corte`);
        const ys = corte.map((punto) => punto.y);
        const banda = Math.max(...ys) - Math.min(...ys);
        assert.ok(banda < 0.02, `${bulbo} ${angulo.toFixed(2)} banda ${banda.toFixed(3)}`);
        const lleno = mod.centroide(
          mod.poligonoLiquido(bulbo, 0.45, angulo).map((punto) => mundo(punto, angulo)),
        );
        const bulboCentro = mod.centroide(
          mod.poligonoLiquido(bulbo, 1, 0).map((punto) => mundo(punto, angulo)),
        );
        assert.ok(
          lleno.y > bulboCentro.y + 0.01,
          `${bulbo} ${angulo.toFixed(2)} centro ${lleno.y.toFixed(3)} vs ${bulboCentro.y.toFixed(3)}`,
        );
      }
    }
    assert.equal(mod.despegueNube(0, 200), 0);
    assert.ok(mod.despegueNube(Math.PI / 4, 200) > 100);
    assert.ok(mod.despegueNube((3 * Math.PI) / 4, 200) > 100);
  } finally {
    cleanup();
  }
});

test('el agua guarda el volumen al inclinar el frasco', async () => {
  const { mod, cleanup } = await bundle("export { volumenDibujado } from './src/frasco/fisica/agua.ts';\n");
  try {
    const angulos = [0, Math.PI / 6, Math.PI / 2, (150 * Math.PI) / 180];
    for (const bulbo of ['arriba', 'abajo']) {
      for (const volumen of [0, 0.1, 0.37, 0.5, 1]) {
        for (const angulo of angulos) {
          const medido = mod.volumenDibujado(bulbo, volumen, angulo);
          assert.ok(
            Math.abs(medido - volumen) <= 0.01,
            `${bulbo} vol ${volumen} ang ${angulo.toFixed(2)} → ${medido}`,
          );
        }
      }
    }
  } finally {
    cleanup();
  }
});
