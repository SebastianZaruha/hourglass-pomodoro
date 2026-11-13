import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, type Browser, type Page } from '@playwright/test';

declare global {
  interface Window {
    __HG_PRUEBA__?: boolean;
    __hg?: {
      fijarAngulo: (grados: number) => void;
      cajas: {
        frasco: { x: number; y: number; w: number; h: number };
        reloj: { x: number; y: number; w: number; h: number };
        menu: { x: number; y: number; w: number; h: number };
        botonMenu: { x: number; y: number; w: number; h: number };
        nube: { x: number; y: number; w: number; h: number };
      } | null;
    };
  }
}

/** Misma huella que `BANNER_VERSION` en `src/cookies.ts` (texto español actual). */
export const VERSION_BANNER = '5f29f1d4';

export const INICIO_MS = Date.parse('2026-11-12T12:00:00.000Z');

export const TEMAS = ['lluvia', 'arena', 'clasico'] as const;
export const MODOS = ['claro', 'oscuro'] as const;

export type Tema = (typeof TEMAS)[number];
export type Modo = (typeof MODOS)[number];

/** Tamaños de la sección 5. 844×390 es el móvil horizontal. */
export const ANCHOS = [
  { nombre: '390x844', ancho: 390, alto: 844 },
  { nombre: '600x900', ancho: 600, alto: 900 },
  { nombre: '820x1180', ancho: 820, alto: 1180 },
  { nombre: '1024x768', ancho: 1024, alto: 768 },
  { nombre: '1440x900', ancho: 1440, alto: 900 },
  { nombre: '844x390', ancho: 844, alto: 390 },
] as const;

/**
 * Alturas del barrido. La especificación dice «5 altos» y no los enumera:
 * son las cinco alturas distintas de la tabla de la sección 3.11.
 */
export const ALTOS_BARRIDO = [390, 768, 844, 900, 1180] as const;

export const CARPETA = path.resolve(import.meta.dirname, '../punto-de-partida');

export interface Opciones {
  readonly tema: Tema;
  readonly modo: Modo;
  readonly ancho: number;
  readonly alto: number;
  readonly lang?: 'es' | 'en';
  /** Banner de cookies visible. */
  readonly cookies?: boolean;
  /** Aviso de la app Android visible. */
  readonly promo?: boolean;
  /** Deja las transiciones de la app. El resto de pruebas las apaga. */
  readonly transiciones?: boolean;
  /** Tema guardado. Por defecto sigue al modo (claro → light). */
  readonly ajuste?: 'light' | 'dark' | 'system';
  /** Sin pulsar empezar: el reloj se queda en 05:00 y el bucle puede dormirse. */
  readonly arrancar?: boolean;
}

const marcas = new WeakMap<Page, number>();

/** Cada escena con su reloj. Un mismo contexto no acepta dos `clock.install`. */
export async function enLimpio(browser: Browser, fn: (page: Page) => Promise<void>): Promise<void> {
  const contexto = await browser.newContext({
    locale: 'es-ES',
    timezoneId: 'UTC',
    deviceScaleFactor: 1,
    viewport: { width: 1440, height: 900 },
  });
  const page = await contexto.newPage();
  try {
    await fn(page);
  } finally {
    await contexto.close();
  }
}

export async function abrir(page: Page, op: Opciones): Promise<void> {
  await page.setViewportSize({ width: op.ancho, height: op.alto });
  await page.addInitScript(prepararAlmacen, {
    tema: op.tema,
    scheme: op.ajuste ?? (op.modo === 'oscuro' ? 'dark' : 'light'),
    lang: op.lang ?? 'es',
    cookies: op.cookies === true,
    promo: op.promo === true,
    bannerVersion: VERSION_BANNER,
    at: INICIO_MS,
  });
  await page.clock.install({ time: new Date(INICIO_MS) });
  await page.goto('/');
  await assertProduccion(page);
  await esperarFondo(page);
  if (!op.transiciones) {
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none !important;animation:none !important}',
    });
  }
  // Pasa la entrada y el temporizador del botón del menú antes de empezar,
  // con el bucle dormido: así no se pintan miles de fotogramas.
  await page.clock.runFor(3200);
  await page.evaluate(() => document.fonts.ready);
  if (op.arrancar !== false) {
    await page.locator('.escenario').focus();
    await page.keyboard.press('Space');
    const startedAt = await page.evaluate(() => Date.now());
    marcas.set(page, startedAt + 30_000);
    await mantener(page);
    const visible = (await page.locator('.time').innerText()).trim();
    expect(visible, 'el reloj congelado tiene que mostrar 04:30 de 05:00').toBe('04:30');
  } else {
    marcas.set(page, await page.evaluate(() => Date.now()));
    await pausarVideos(page);
  }
  if (!op.cookies) {
    await expect(page.locator('.banner'), 'las capturas de escena no llevan el banner').toHaveCount(0);
  }
}

/** Vuelve el reloj a 04:30 y pinta un fotograma. */
export async function mantener(page: Page): Promise<void> {
  const marca = marcas.get(page);
  if (marca === undefined) throw new Error('Esta página no tiene la marca de las 04:30.');
  await page.clock.setFixedTime(new Date(marca));
  await page.clock.runFor(280);
  await pausarVideos(page);
}

export async function asentarTamano(page: Page, ancho: number, alto: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  const limite = Date.now() + 8_000;
  while (Date.now() < limite) {
    const listo = await page.evaluate(
      ({ ancho: w, alto: h }) =>
        window.innerWidth === w && window.innerHeight === h && (window.__hg?.cajas?.frasco.w ?? 0) > 0,
      { ancho, alto },
    );
    if (listo) break;
    await page.clock.runFor(50);
  }
  await mantener(page);
}

export async function abrirMenu(page: Page): Promise<void> {
  await page.hover('.app');
  await page.locator('#menu-button').click();
  await page.locator('.sheet.open').waitFor({ state: 'visible' });
  await mantener(page);
}

export async function fijarAngulo(page: Page, grados: number): Promise<void> {
  const hayGancho = await page.evaluate((g) => {
    if (!window.__hg) return false;
    window.__hg.fijarAngulo(g);
    return true;
  }, grados);
  if (!hayGancho) throw new Error('window.__hg no está: la bandera no se puso antes de cargar.');
  await mantener(page);
}

export async function pausarVideos(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const video of document.querySelectorAll('video')) {
      try {
        if (video.readyState >= 1) video.currentTime = 0.5;
      } catch {
        // Sin metadatos todavía.
      }
      video.pause();
    }
  });
}

export async function leerReloj(page: Page): Promise<{ visible: string; hablado: string }> {
  return page.evaluate(() => ({
    visible: document.querySelector('.time')?.textContent?.trim() ?? '',
    hablado: (document.querySelector('.sr-only')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

export async function captura(page: Page, nombre: string): Promise<string> {
  const destino = path.join(CARPETA, nombre);
  mkdirSync(path.dirname(destino), { recursive: true });
  await page.screenshot({ path: destino, animations: 'disabled' });
  return destino;
}

export async function lienzoFrasco(page: Page): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const crudo = await page.evaluate(() => {
    const cajas = window.__hg?.cajas;
    const canvas = document.querySelector('canvas');
    if (!cajas || !(canvas instanceof HTMLCanvasElement)) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const x = Math.max(0, Math.round(cajas.frasco.x));
    const y = Math.max(0, Math.round(cajas.frasco.y));
    const w = Math.round(cajas.frasco.w);
    const h = Math.round(cajas.frasco.h);
    const img = ctx.getImageData(x, y, w, h);
    return { data: Array.from(img.data), w, h };
  });
  if (!crudo) throw new Error('No se pudo leer el lienzo del frasco.');
  return { data: Uint8ClampedArray.from(crudo.data), w: crudo.w, h: crudo.h };
}

function prepararAlmacen(datos: {
  tema: string;
  scheme: 'light' | 'dark' | 'system';
  lang: string;
  cookies: boolean;
  promo: boolean;
  bannerVersion: string;
  at: number;
}): void {
  window.__HG_PRUEBA__ = true;
  localStorage.setItem('hourglass-web/escena', datos.tema);
  localStorage.setItem(
    'hourglass-web/ajustes',
    JSON.stringify({
      version: 5,
      lastDurationMs: 5 * 60 * 1000,
      theme: datos.scheme,
      language: datos.lang,
      sound: false,
      sessionMode: 'single',
      updatedAt: 0,
    }),
  );
  if (!datos.cookies) {
    localStorage.setItem(
      'hourglass-web/cookies',
      JSON.stringify({ choice: 'rejected', at: datos.at, bannerVersion: datos.bannerVersion }),
    );
  }
  if (!datos.promo) localStorage.setItem('hourglass-web/android-promo', '1');
}

async function assertProduccion(page: Page): Promise<void> {
  const src = await page.locator('script[type="module"]').first().getAttribute('src');
  if (!src || !/\/assets\/index-/.test(src)) {
    throw new Error(`La página no es el build de producción (${src ?? 'sin script'}).`);
  }
}

async function esperarFondo(page: Page): Promise<void> {
  const limite = Date.now() + 20_000;
  while (Date.now() < limite) {
    const listo = await page.evaluate(() => {
      const img = document.querySelector('.fondo img');
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
    });
    if (listo) return;
    await page.clock.runFor(200);
  }
  throw new Error('El fondo no llegó a cargarse en el preview de producción.');
}
