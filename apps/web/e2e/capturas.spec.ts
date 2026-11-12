import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import {
  ANCHOS,
  CARPETA,
  MODOS,
  TEMAS,
  abrir,
  abrirMenu,
  asentarTamano,
  captura,
  enLimpio,
  fijarAngulo,
  mantener,
} from './soporte/escena';

/**
 * Punto de partida, no referencias. Cada png es el build de producción
 * de 25fca17 para que se vea desde dónde se parte.
 */

for (const tema of TEMAS) {
  for (const modo of MODOS) {
    test(`parado ${tema} ${modo}`, async ({ page }) => {
      await abrir(page, { tema, modo, ancho: 1440, alto: 900 });
      for (const tam of ANCHOS) {
        await asentarTamano(page, tam.ancho, tam.alto);
        await captura(page, `parado/${tema}-${modo}-${tam.nombre}.png`);
      }
    });

    test(`menú ${tema} ${modo}`, async ({ page }) => {
      await abrir(page, { tema, modo, ancho: 1440, alto: 900 });
      await abrirMenu(page);
      for (const tam of ANCHOS) {
        await asentarTamano(page, tam.ancho, tam.alto);
        await captura(page, `menu/${tema}-${modo}-${tam.nombre}.png`);
      }
    });
  }
}

test('menú de ciclos personalizados', async ({ browser }) => {
  for (const tema of TEMAS) {
    for (const modo of MODOS) {
      await enLimpio(browser, async (page) => {
        await abrir(page, { tema, modo, ancho: 1440, alto: 900 });
        await abrirMenu(page);
        await page.getByRole('radio', { name: 'Ciclos' }).click();
        await page.getByRole('radio', { name: 'Personalizado' }).click();
        await mantener(page);
        await captura(page, `menu-ciclos/${tema}-${modo}-1440x900.png`);
        await asentarTamano(page, 390, 844);
        await captura(page, `menu-ciclos/${tema}-${modo}-390x844.png`);
      });
    }
  }
});

test('panel legal', async ({ browser }) => {
  for (const tema of TEMAS) {
    for (const modo of MODOS) {
      for (const tam of [
        { nombre: '1440x900', ancho: 1440, alto: 900 },
        { nombre: '390x844', ancho: 390, alto: 844 },
      ] as const) {
        await enLimpio(browser, async (page) => {
          await abrir(page, { tema, modo, ancho: tam.ancho, alto: tam.alto });
          await page.hover('.app');
          await page.locator('a[href="/aviso-legal.html"]').click();
          await page.locator('.legal-dialog').waitFor({ state: 'visible' });
          await mantener(page);
          await captura(page, `legal/${tema}-${modo}-${tam.nombre}.png`);
          if (tam.ancho === 1440 && tema === 'lluvia') {
            const marco = page.frameLocator('iframe');
            await marco.locator('body').evaluate((cuerpo) => {
              const nodo = cuerpo.ownerDocument.scrollingElement ?? cuerpo;
              nodo.scrollTop = 480;
            });
            await mantener(page);
            await captura(page, `legal/${tema}-${modo}-${tam.nombre}-scroll.png`);
          }
        });
      }
    }
  }
});

test('pausa', async ({ browser }) => {
  for (const tema of TEMAS) {
    for (const modo of MODOS) {
      await enLimpio(browser, async (page) => {
        await abrir(page, { tema, modo, ancho: 1440, alto: 900 });
        await page.locator('.escenario').focus();
        await page.keyboard.press('Space');
        await mantener(page);
        await captura(page, `pausa/${tema}-${modo}-1440x900.png`);
        await asentarTamano(page, 390, 844);
        await captura(page, `pausa/${tema}-${modo}-390x844.png`);
      });
    }
  }
});

test('giro del frasco', async ({ browser }) => {
  const angulos = [0, 30, 45, 60, 150];
  for (const tema of ['lluvia', 'arena'] as const) {
    for (const modo of MODOS) {
      await enLimpio(browser, async (page) => {
        await abrir(page, { tema, modo, ancho: 1440, alto: 900 });
        for (const grados of angulos) {
          await fijarAngulo(page, grados);
          const caja = await page.evaluate(() => window.__hg?.cajas?.frasco ?? null);
          if (!caja) throw new Error('sin caja del frasco');
          const archivo = path.join(CARPETA, `giro/${tema}-${modo}-${grados}.png`);
          mkdirSync(path.dirname(archivo), { recursive: true });
          const x = Math.max(0, Math.floor(caja.x - 12));
          const y = Math.max(0, Math.floor(caja.y - 12));
          await page.screenshot({
            path: archivo,
            animations: 'disabled',
            clip: {
              x,
              y,
              width: Math.min(1440 - x, Math.ceil(caja.w + 24)),
              height: Math.min(900 - y, Math.ceil(caja.h + 24)),
            },
          });
        }
      });
    }
  }
});

test('cambio de tema en oscuro', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'oscuro', ancho: 1440, alto: 900, transiciones: true });
  await abrirMenu(page);
  await captura(page, 'cambio/1-lluvia.png');
  await page.getByRole('radio', { name: 'Escena Arena' }).click();
  await page.clock.runFor(180);
  await captura(page, 'cambio/2-mitad-arena.png');
  await page.clock.runFor(400);
  await captura(page, 'cambio/3-arena.png');
  await page.getByRole('radio', { name: 'Escena Clásico' }).click();
  await page.clock.runFor(180);
  await captura(page, 'cambio/4-mitad-clasico.png');
  await page.clock.runFor(400);
  await captura(page, 'cambio/5-clasico.png');
});

test('banner de cookies y aviso Android', async ({ browser }) => {
  await enLimpio(browser, async (page) => {
    await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900, cookies: true });
    await captura(page, 'cookies/lluvia-claro-1440x900.png');
    await asentarTamano(page, 390, 844);
    await captura(page, 'cookies/lluvia-claro-390x844.png');
  });
  await enLimpio(browser, async (page) => {
    await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900, promo: true });
    await page.locator('.app-promo').waitFor({ state: 'visible' });
    await mantener(page);
    await captura(page, 'android/lluvia-claro-1440x900.png');
    await asentarTamano(page, 390, 844);
    await captura(page, 'android/lluvia-claro-390x844.png');
  });
});

test('subconjunto a densidad 2', async ({ browser }) => {
  for (const tam of [
    { nombre: '1440x900', ancho: 1440, alto: 900 },
    { nombre: '390x844', ancho: 390, alto: 844 },
  ] as const) {
    const contexto = await browser.newContext({
      viewport: { width: tam.ancho, height: tam.alto },
      deviceScaleFactor: 2,
      locale: 'es-ES',
      timezoneId: 'UTC',
    });
    const page = await contexto.newPage();
    await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: tam.ancho, alto: tam.alto });
    await captura(page, `dpr2/lluvia-claro-${tam.nombre}.png`);
    await contexto.close();
  }
});
