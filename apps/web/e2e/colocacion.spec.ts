import { expect, test } from '@playwright/test';

import { ANCHOS, abrir, abrirMenu, asentarTamano, mantener } from './soporte/escena';

test('el frasco no se mueve en ancho y cabe en estrecho', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900, arrancar: false });
  for (const tam of ANCHOS) {
    await asentarTamano(page, tam.ancho, tam.alto);
    const cerrado = await page.evaluate(() => window.__hg?.cajas?.frasco ?? null);
    const ancha = await page.getAttribute('.app', 'data-layout');
    await abrirMenu(page);
    const abierto = await page.evaluate(() => {
      const lienzo = document.querySelector('.lienzo');
      return {
        frasco: window.__hg?.cajas?.frasco ?? null,
        opacidad: lienzo ? Number(getComputedStyle(lienzo).opacity) : 1,
      };
    });
    expect(cerrado, tam.nombre).not.toBeNull();
    expect(abierto.frasco, tam.nombre).not.toBeNull();
    if (ancha === 'wide') {
      expect(abierto.frasco, tam.nombre).toEqual(cerrado);
    } else if (cerrado && abierto.frasco) {
      expect(cerrado.h, `${tam.nombre} cerrado`).toBeGreaterThanOrEqual(tam.alto * 0.3 - 1);
      if (abierto.opacidad >= 0.05) {
        expect(abierto.frasco.h, `${tam.nombre} abierto`).toBeGreaterThanOrEqual(tam.alto * 0.22 - 1);
      }
    }
    await page.locator('.menu-cerrar').click();
    await page.locator('.sheet.open').waitFor({ state: 'hidden' });
  }
});

test('cambiar de tema no mueve las cajas', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'oscuro', ancho: 1440, alto: 900, arrancar: false });
  await abrirMenu(page);
  const antes = await cajas(page);
  await page.getByRole('radio', { name: 'Escena Arena' }).click();
  await mantener(page);
  const despues = await cajas(page);
  expect(despues).toEqual(antes);
  await page.locator('.menu-cerrar').click();
  await asentarTamano(page, 390, 844);
  const estrecha = await cajas(page);
  await abrirMenu(page);
  await page.getByRole('radio', { name: 'Escena Clásico' }).click();
  await mantener(page);
  await page.locator('.menu-cerrar').click();
  await page.locator('.sheet.open').waitFor({ state: 'hidden' });
  await page.hover('.app');
  expect(await cajas(page)).toEqual(estrecha);
});

async function cajas(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rect = (sel: string) => {
      const nodo = document.querySelector(sel);
      if (!(nodo instanceof HTMLElement)) return null;
      const estilo = getComputedStyle(nodo);
      if (estilo.display === 'none' || Number(estilo.opacity) < 0.05) return null;
      const r = nodo.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    const frasco = window.__hg?.cajas?.frasco ?? null;
    return {
      frasco: frasco
        ? { x: Math.round(frasco.x), y: Math.round(frasco.y), w: Math.round(frasco.w), h: Math.round(frasco.h) }
        : null,
      reloj: rect('.reloj'),
      menu: rect('.sheet.open'),
    };
  });
}
