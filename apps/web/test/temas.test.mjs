import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundle } from './bundle.mjs';

test('el texto del menú contrasta al menos 4.5 a 1 en cada tema y modo', async () => {
  const { mod, cleanup } = await bundle(
    `export { TEMAS } from './src/temas/index.ts';
     export { contraste } from './src/temas/contraste.ts';\n`,
  );
  try {
    for (const tema of mod.TEMAS) {
      for (const [modo, papel] of [
        [tema.claro, '#ffffff'],
        [tema.oscuro, '#000000'],
      ]) {
        const relacion = mod.contraste(modo.ui.tinta, papel);
        assert.ok(relacion >= 4.5, `${tema.id} ${relacion.toFixed(2)}`);
      }
    }
    assert.deepEqual(
      mod.TEMAS.map((tema) => tema.id),
      ['lluvia', 'arena', 'clasico'],
    );
  } finally {
    cleanup();
  }
});

test('clásico apoya el frasco en el suelo del estudio y lo ilumina desde arriba a la izquierda', async () => {
  const { mod, cleanup } = await bundle(
    `export { clasico } from './src/temas/clasico.ts';
     export { vectorLuz } from './src/frasco/alpha.ts';
     export { teñirGrano } from './src/frasco/granos.ts';\n`,
  );
  try {
    assert.ok(mod.clasico.anclaSuelo.y > 0.74 && mod.clasico.anclaSuelo.y < 0.9);
    for (const modo of [mod.clasico.claro, mod.clasico.oscuro]) {
      assert.equal(modo.fondo.tipo, 'foto');
      assert.match(modo.fondo.src, /\.webp$/);
      assert.match(modo.fondo.avif, /\.avif$/);
      assert.match(modo.fondo.jpg, /\.jpg$/);
      assert.ok(modo.luz.direccion < -20 && modo.luz.direccion > -70);
      const dir = mod.vectorLuz(modo.luz.direccion);
      assert.ok(dir.x < 0 && dir.y < 0, 'la luz llega desde arriba a la izquierda');
      assert.ok(modo.luz.sombra.inclinacion > 0, 'la sombra cae hacia la derecha');
    }
    assert.ok(mod.clasico.oscuro.luz.brillo < mod.clasico.claro.luz.brillo);
    assert.ok(mod.clasico.oscuro.luz.fuerzaTinte > mod.clasico.claro.luz.fuerzaTinte);
    const base = [210, 186, 150];
    const claro = mod.teñirGrano(...base, -0.2, -0.2, mod.clasico.claro.luz);
    const oscuro = mod.teñirGrano(...base, -0.2, -0.2, mod.clasico.oscuro.luz);
    const sombra = mod.teñirGrano(...base, 0.3, 0.3, mod.clasico.oscuro.luz);
    const suma = (rgb) => rgb[0] + rgb[1] + rgb[2];
    assert.ok(suma(oscuro) < suma(claro), 'el estudio oscuro apaga la arena');
    assert.ok(suma(sombra) < suma(oscuro), 'el lado contrario al foco queda más oscuro');
    assert.ok(oscuro[0] / oscuro[2] > claro[0] / claro[2], 'el foco cálido tiñe la arena');
  } finally {
    cleanup();
  }
});

test('la hora y la pista se leen sobre el muro claro', async () => {
  const { mod, cleanup } = await bundle(
    `export { clasico } from './src/temas/clasico.ts';
     export { arena } from './src/temas/arena.ts';
     export { contraste } from './src/temas/contraste.ts';\n`,
  );
  try {
    // Muro claro de estudio, sin halo. La banda real la mide Playwright.
    const casos = [
      [mod.clasico.claro, '#e7dfd3'],
      [mod.arena.claro, '#dcc19f'],
    ];
    for (const [modo, muro] of casos) {
      assert.ok(mod.contraste(modo.reloj.digitos, muro) >= 3, modo.reloj.digitos);
      assert.ok(mod.contraste(modo.reloj.pista, muro) >= 4.5, modo.reloj.pista);
    }
  } finally {
    cleanup();
  }
});

test('un claro guardado pasa a clásico y lo desconocido a lluvia', async () => {
  const { mod, cleanup } = await bundle("export { escenaGuardada } from './src/temas/index.ts';\n");
  try {
    assert.equal(mod.escenaGuardada('claro'), 'clasico');
    assert.equal(mod.escenaGuardada('arena'), 'arena');
    assert.equal(mod.escenaGuardada('miel'), 'lluvia');
    assert.equal(mod.escenaGuardada(null), 'lluvia');
  } finally {
    cleanup();
  }
});
