/**
 * Reloj de la corrección 1b. No son referencias.
 * HG_FASE=antes|despues elige la carpeta.
 * No entra en `playwright test` si HG_FASE no está puesta (el nombre no es *.spec.ts).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { test, type Page } from '@playwright/test';

import { MODOS, TEMAS, abrir, enLimpio } from './soporte/escena';

const fase = process.env.HG_FASE === 'antes' ? 'antes' : 'despues';
const carpeta = path.resolve(import.meta.dirname, 'fase-1b', fase);
const tamanos = [
  { nombre: '1440x900', ancho: 1440, alto: 900 },
  { nombre: '390x844', ancho: 390, alto: 844 },
] as const;

async function guardar(page: Page, nombre: string): Promise<void> {
  const destino = path.join(carpeta, nombre);
  mkdirSync(path.dirname(destino), { recursive: true });
  await page.screenshot({ path: destino, animations: 'disabled' });
}

test('reloj parado en los seis escenarios', async ({ browser }) => {
  test.setTimeout(360_000);
  for (const tema of TEMAS) {
    for (const modo of MODOS) {
      for (const tam of tamanos) {
        await enLimpio(browser, async (page) => {
          await abrir(page, { tema, modo, ancho: tam.ancho, alto: tam.alto, arrancar: false });
          await guardar(page, `${tema}-${modo}-${tam.nombre}.png`);
        });
      }
    }
  }
});
