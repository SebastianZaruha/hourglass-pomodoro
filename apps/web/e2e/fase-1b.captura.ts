/**
 * Reloj sin halo, a 1440×900. No son referencias.
 * HG_FASE tiene que estar puesta para que Playwright coja este archivo.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { test, type Page } from '@playwright/test';

import { MODOS, TEMAS, abrir, enLimpio } from './soporte/escena';

const carpeta = path.resolve(import.meta.dirname, 'fase-1b', 'despues');

async function guardar(page: Page, nombre: string): Promise<void> {
  const destino = path.join(carpeta, nombre);
  mkdirSync(path.dirname(destino), { recursive: true });
  await page.screenshot({ path: destino, animations: 'disabled' });
}

test('reloj parado a 1440x900', async ({ browser }) => {
  for (const tema of TEMAS) {
    for (const modo of MODOS) {
      await enLimpio(browser, async (page) => {
        await abrir(page, { tema, modo, ancho: 1440, alto: 900, arrancar: false });
        await guardar(page, `${tema}-${modo}-1440x900.png`);
      });
    }
  }
});
