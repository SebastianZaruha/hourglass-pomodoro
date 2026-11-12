/**
 * Hoja de la fase 1, no son referencias.
 * HG_FASE=antes|despues elige la carpeta.
 * No entra en `playwright test` (el nombre no es *.spec.ts).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { test, type Page } from '@playwright/test';

import { MODOS, TEMAS, abrir, abrirMenu, asentarTamano, enLimpio, mantener } from './soporte/escena';

const fase = process.env.HG_FASE === 'antes' ? 'antes' : 'despues';
const carpeta = path.resolve(import.meta.dirname, 'fase-1', fase);
const tamanos = [
  { nombre: '1440x900', ancho: 1440, alto: 900 },
  { nombre: '390x844', ancho: 390, alto: 844 },
] as const;

async function guardar(page: Page, nombre: string): Promise<void> {
  const destino = path.join(carpeta, nombre);
  mkdirSync(path.dirname(destino), { recursive: true });
  await page.screenshot({ path: destino, animations: 'disabled' });
}

test('menú abierto', async ({ browser }) => {
  for (const tema of TEMAS) {
    for (const modo of MODOS) {
      await enLimpio(browser, async (page) => {
        await abrir(page, { tema, modo, ancho: 1440, alto: 900 });
        await abrirMenu(page);
        for (const tam of tamanos) {
          await asentarTamano(page, tam.ancho, tam.alto);
          await guardar(page, `menu/${tema}-${modo}-${tam.nombre}.png`);
        }
      });
    }
  }
});

test('cookies, aviso y panel legal', async ({ browser }) => {
  for (const tema of TEMAS) {
    for (const modo of MODOS) {
      for (const tam of tamanos) {
        await enLimpio(browser, async (page) => {
          await abrir(page, { tema, modo, ancho: tam.ancho, alto: tam.alto, cookies: true });
          await guardar(page, `cookies/${tema}-${modo}-${tam.nombre}.png`);
        });
        await enLimpio(browser, async (page) => {
          await abrir(page, { tema, modo, ancho: tam.ancho, alto: tam.alto, promo: true });
          await page.locator('.app-promo').waitFor({ state: 'visible' });
          await mantener(page);
          await guardar(page, `aviso/${tema}-${modo}-${tam.nombre}.png`);
        });
        await enLimpio(browser, async (page) => {
          await abrir(page, { tema, modo, ancho: tam.ancho, alto: tam.alto });
          await page.hover('.app');
          await page.locator('a[href="/aviso-legal.html"]').click();
          await page.locator('.legal-dialog').waitFor({ state: 'visible' });
          await mantener(page);
          await guardar(page, `legal/${tema}-${modo}-${tam.nombre}.png`);
        });
      }
    }
  }
});
