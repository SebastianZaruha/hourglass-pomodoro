import assert from 'node:assert/strict';

import { test } from 'node:test';

import { bundle } from './bundle.mjs';

const FUENTE = `
  export { calcularLayout, esAncha, seSolapan, entradaDe } from './src/layout/calcularLayout.ts';
`;

const TABLA = [
  [390, 844, false],
  [600, 900, false],
  [820, 1180, false],
  [1024, 768, true],
  [1440, 900, true],
  [844, 390, true],
  [960, 900, false],
  [1100, 820, true],
];

function solapaAlguno(mod, layout, ancho, alto, menu) {
  const piezas = [['frasco', layout.frasco]];
  if (layout.relojVisible) piezas.push(['reloj', layout.reloj]);
  if (menu) piezas.push(['menú', layout.menu]);
  if (layout.aviso.h > 1) piezas.push(['aviso', layout.aviso]);
  if (!menu) piezas.push(['pie', layout.pie]);
  if (!menu) piezas.push(['botón', layout.botonMenu]);
  const textos = [];
  for (const [nombre, caja] of piezas) {
    if (caja.x < -1 || caja.y < -1 || caja.x + caja.w > ancho + 1 || caja.y + caja.h > alto + 1) {
      textos.push(`${nombre} se sale`);
    }
    for (const [otro, b] of piezas) {
      if (otro <= nombre) continue;
      if (mod.seSolapan(caja, b)) textos.push(`${nombre} solapa ${otro}`);
    }
  }
  return textos;
}

test('la tabla 3.11 elige la disposición y no hay solapes', async () => {
  const { mod, cleanup } = await bundle(FUENTE);
  try {
    for (const [ancho, alto, ancha] of TABLA) {
      for (const menu of [false, true]) {
        for (const aviso of [0, 72]) {
          const entrada = mod.entradaDe(ancho, alto, menu, { altoAviso: menu ? 0 : aviso, altoMenu: 300 });
          const layout = mod.calcularLayout(entrada);
          assert.equal(layout.ancha, ancha, `${ancho}×${alto}`);
          const mal = solapaAlguno(mod, layout, ancho, alto, menu);
          assert.deepEqual(mal, [], `${ancho}×${alto} menú ${menu} aviso ${aviso}: ${mal.join(', ')}`);
          if (!menu && aviso > 0) {
            assert.ok(Math.abs(layout.aviso.x - 12) < 1, `${ancho}×${alto} aviso en ${layout.aviso.x}`);
            const esperado = ancha ? 320 : ancho - 24;
            assert.ok(Math.abs(layout.aviso.w - esperado) < 1, `${ancho}×${alto} aviso ${layout.aviso.w}`);
          }
        }
      }
    }
  } finally {
    cleanup();
  }
});

test('en ancha el frasco no se mueve y en estrecha el reloj sube', async () => {
  const { mod, cleanup } = await bundle(FUENTE);
  try {
    for (const [ancho, alto, ancha] of TABLA) {
      const cerrado = mod.calcularLayout(mod.entradaDe(ancho, alto, false, { altoMenu: 300 }));
      const abierto = mod.calcularLayout(mod.entradaDe(ancho, alto, true, { altoMenu: 300 }));
      if (ancha) {
        assert.deepEqual(cerrado.frasco, abierto.frasco, `${ancho}×${alto}`);
        assert.deepEqual(cerrado.nube, abierto.nube, `${ancho}×${alto}`);
        if (alto < 560) assert.equal(abierto.relojVisible, false, `${ancho}×${alto} el reloj se desvanece`);
      } else {
        assert.ok(abierto.reloj.y < cerrado.reloj.y, `${ancho}×${alto} la hora sube`);
        assert.ok(abierto.frasco.y <= cerrado.frasco.y, `${ancho}×${alto} el frasco sube`);
        if (abierto.frascoVisible) assert.ok(abierto.frasco.h >= alto * 0.22 - 1);
        assert.ok(cerrado.frasco.h >= alto * 0.3 - 1, `${ancho}×${alto} cerrado ${cerrado.frasco.h}`);
      }
    }
    assert.equal(mod.esAncha(mod.entradaDe(700, 390, false)), false, '700×390 se queda estrecha');
    assert.equal(mod.esAncha(mod.entradaDe(844, 390, false)), true, '844×390 sigue ancha');
    const a = mod.calcularLayout(mod.entradaDe(1440, 900, false));
    const b = mod.calcularLayout(mod.entradaDe(1440, 900, false));
    assert.deepEqual(a, b);
  } finally {
    cleanup();
  }
});

test('el barrido de 360 a 1920 no solapa las cajas', async () => {
  const { mod, cleanup } = await bundle(FUENTE);
  try {
    const altos = [390, 768, 844, 900, 1180];
    const fallos = [];
    for (let ancho = 360; ancho <= 1920; ancho += 20) {
      for (const alto of altos) {
        for (const menu of [false, true]) {
          const entrada = mod.entradaDe(ancho, alto, menu, { altoAviso: menu ? 0 : 72, altoMenu: 300, altoPie: 48 });
          const layout = mod.calcularLayout(entrada);
          const mal = solapaAlguno(mod, layout, ancho, alto, menu);
          if (!menu && layout.aviso.h > 1) {
            const esperado = layout.ancha ? 320 : ancho - 24;
            if (Math.abs(layout.aviso.x - 12) > 1 || Math.abs(layout.aviso.w - esperado) > 1) {
              mal.push(`aviso ${Math.round(layout.aviso.x)},${Math.round(layout.aviso.w)}`);
            }
          }
          if (mal.length) fallos.push(`${ancho}×${alto} ${menu ? 'menú' : 'cerrado'}: ${mal.join(', ')}`);
        }
      }
    }
    assert.deepEqual(fallos, [], fallos.slice(0, 12).join('\n'));
  } finally {
    cleanup();
  }
});
