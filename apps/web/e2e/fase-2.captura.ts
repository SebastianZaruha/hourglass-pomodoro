/**
 * Colocación, menú abierto y cerrado. No son referencias.
 * HG_FASE tiene que estar puesta. HG_FASE2 elige antes o despues.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { test, type Page } from '@playwright/test';

import { abrir, abrirMenu, enLimpio } from './soporte/escena';

const momento = process.env.HG_FASE2 === 'despues' ? 'despues' : 'antes';
const carpeta = path.resolve(import.meta.dirname, 'fase-2', momento);

const ESCENAS = [
  { tema: 'lluvia', modo: 'oscuro' },
  { tema: 'clasico', modo: 'claro' },
] as const;

const TAMANOS = [
  { nombre: '1440x900', ancho: 1440, alto: 900 },
  { nombre: '1024x768', ancho: 1024, alto: 768 },
  { nombre: '768x1024', ancho: 768, alto: 1024 },
  { nombre: '390x844', ancho: 390, alto: 844 },
  { nombre: '844x390', ancho: 844, alto: 390 },
] as const;

async function guardar(page: Page, nombre: string): Promise<void> {
  mkdirSync(carpeta, { recursive: true });
  await page.screenshot({ path: path.join(carpeta, nombre), animations: 'disabled' });
}

test('colocacion con el menu abierto y cerrado', async ({ browser }) => {
  test.setTimeout(600_000);
  for (const escena of ESCENAS) {
    for (const tam of TAMANOS) {
      await enLimpio(browser, async (page) => {
        await abrir(page, {
          tema: escena.tema,
          modo: escena.modo,
          ancho: tam.ancho,
          alto: tam.alto,
          arrancar: false,
        });
        await page.hover('.app');
        await guardar(page, `${escena.tema}-${escena.modo}-${tam.nombre}-cerrado.png`);
        await abrirMenu(page);
        await guardar(page, `${escena.tema}-${escena.modo}-${tam.nombre}-abierto.png`);
      });
    }
  }
});
