import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { ALTOS_BARRIDO, abrir, abrirMenu, enLimpio } from './soporte/escena';

/**
 * De 360 a 1920 px, de 20 en 20, con las cinco alturas de la tabla 3.11.
 * Menú cerrado, menú abierto y aviso Android visible.
 */
test('barrido sin solapes', async ({ browser }) => {
  test.setTimeout(600_000);
  const fallos: string[] = [];
  const anchos: number[] = [];
  for (let ancho = 360; ancho <= 1920; ancho += 20) anchos.push(ancho);

  await enLimpio(browser, async (page) => {
    await abrir(page, {
      tema: 'lluvia',
      modo: 'claro',
      ancho: 1440,
      alto: 900,
      arrancar: false,
    });
    fallos.push(...(await barrer(page, anchos, 'cerrado')));
  });

  await enLimpio(browser, async (page) => {
    await abrir(page, {
      tema: 'lluvia',
      modo: 'claro',
      ancho: 1440,
      alto: 900,
      arrancar: false,
    });
    await abrirMenu(page);
    fallos.push(...(await barrer(page, anchos, 'menú')));
  });

  await enLimpio(browser, async (page) => {
    await abrir(page, {
      tema: 'lluvia',
      modo: 'claro',
      ancho: 1440,
      alto: 900,
      arrancar: false,
      promo: true,
    });
    await page.locator('.app-promo').waitFor({ state: 'visible' });
    fallos.push(...(await barrer(page, anchos, 'aviso')));
  });

  const salida = path.resolve(import.meta.dirname, 'salida');
  mkdirSync(salida, { recursive: true });
  writeFileSync(path.join(salida, 'barrido.txt'), fallos.join('\n') + '\n', 'utf8');
  expect(fallos.length, `${fallos.length} solapes. Los primeros:\n${fallos.slice(0, 24).join('\n')}`).toBe(0);
});

async function barrer(page: Page, anchos: readonly number[], estado: string): Promise<string[]> {
  const fallos: string[] = [];
  for (const ancho of anchos) {
    for (const alto of ALTOS_BARRIDO) {
      await page.setViewportSize({ width: ancho, height: alto });
      await page.clock.runFor(40);
      const choques = await page.evaluate(
        ({ ancho: w, alto: h, estado: nombre }) => {
          const caja = (nodo: Element | null) => {
            if (!(nodo instanceof HTMLElement)) return null;
            const estilo = getComputedStyle(nodo);
            if (
              estilo.display === 'none' ||
              estilo.visibility === 'hidden' ||
              Number(estilo.opacity) < 0.05
            ) {
              return null;
            }
            const r = nodo.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return null;
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          };
          const frasco = window.__hg?.cajas?.frasco ?? null;
          const piezas: { nombre: string; caja: { x: number; y: number; w: number; h: number } }[] = [];
          if (frasco) piezas.push({ nombre: 'frasco', caja: frasco });
          const reloj = caja(document.querySelector('.reloj'));
          if (reloj) piezas.push({ nombre: 'reloj', caja: reloj });
          const menu = caja(document.querySelector('.sheet.open'));
          if (menu) piezas.push({ nombre: 'menú', caja: menu });
          const aviso = caja(document.querySelector('.app-promo'));
          if (aviso) piezas.push({ nombre: 'aviso', caja: aviso });
          const pie = caja(document.querySelector('.site-footer'));
          if (pie) piezas.push({ nombre: 'pie', caja: pie });
          const textos: string[] = [];
          const solapan = (
            a: { x: number; y: number; w: number; h: number },
            b: { x: number; y: number; w: number; h: number },
          ) => a.x + a.w > b.x + 1 && b.x + b.w > a.x + 1 && a.y + a.h > b.y + 1 && b.y + b.h > a.y + 1;
          for (let i = 0; i < piezas.length; i += 1) {
            const a = piezas[i];
            if (!a) continue;
            if (
              a.caja.x < -1 ||
              a.caja.y < -1 ||
              a.caja.x + a.caja.w > w + 1 ||
              a.caja.y + a.caja.h > h + 1
            ) {
              textos.push(`${nombre} ${w}×${h}: ${a.nombre} se sale`);
            }
            for (let j = i + 1; j < piezas.length; j += 1) {
              const b = piezas[j];
              if (!b) continue;
              if (solapan(a.caja, b.caja)) textos.push(`${nombre} ${w}×${h}: ${a.nombre} solapa ${b.nombre}`);
            }
          }
          return textos;
        },
        { ancho, alto, estado },
      );
      fallos.push(...choques);
    }
  }
  return fallos;
}
