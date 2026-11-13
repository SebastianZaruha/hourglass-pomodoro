import { expect, test, type Page } from '@playwright/test';

import { falloEsperado } from './soporte/fallo';
import {
  ANCHOS,
  abrir,
  abrirMenu,
  asentarTamano,
  fijarAngulo,
  leerReloj,
  lienzoFrasco,
  mantener,
} from './soporte/escena';
import { colorMedio, huecoAguaMascara, pendienteSuperficie, type Rgb } from './soporte/pendiente';

test('el vidrio calculado lleva desenfoque', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  await abrirMenu(page);
  const vidrio = await page.evaluate(
    () => getComputedStyle(document.querySelector('.sheet.vidrio') as Element).backdropFilter,
  );
  expect(vidrio, `.vidrio → ${vidrio}`).toContain('blur(');
});

test('el fondo de los controles no tiene matiz', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'oscuro', ancho: 1440, alto: 900 });
  await abrirMenu(page);
  const fondos = await page.evaluate(() => {
    const leer = (sel: string) => {
      const nodo = document.querySelector(sel);
      if (!nodo) return null;
      return { sel, fondo: getComputedStyle(nodo).backgroundColor };
    };
    return [
      leer('.control[aria-checked="true"]'),
      leer('.control[aria-checked="false"]'),
      leer('.control[aria-pressed="true"]'),
      leer('.menu-cerrar'),
    ];
  });
  for (const item of fondos) expect(item, 'falta un control').not.toBeNull();
  for (const item of fondos) {
    const rgb = parseRgb(item?.fondo ?? '');
    expect(rgb, item?.fondo).not.toBeNull();
    if (!rgb) continue;
    expect(Math.abs(rgb.r - rgb.g), `${item?.sel} ${item?.fondo}`).toBeLessThan(3);
    expect(Math.abs(rgb.g - rgb.b), `${item?.sel} ${item?.fondo}`).toBeLessThan(3);
  }
});

test('el menú no recorta contenido', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  await abrirMenu(page);
  const cortes: string[] = [];
  for (const tam of ANCHOS) {
    await asentarTamano(page, tam.ancho, tam.alto);
    const medida = await page.evaluate(() => {
      const hoja = document.querySelector('.sheet.open');
      if (!(hoja instanceof HTMLElement)) return null;
      return { scroll: hoja.scrollHeight, cliente: hoja.clientHeight };
    });
    if (!medida) throw new Error(`${tam.nombre}: el menú no está abierto`);
    if (medida.scroll > medida.cliente + 1) {
      cortes.push(`${tam.nombre}: scroll ${medida.scroll} > cliente ${medida.cliente}`);
    }
  }
  expect(cortes, cortes.join('\n')).toEqual([]);
  await page.getByRole('radio', { name: 'Ciclos' }).click();
  await page.getByRole('radio', { name: 'Personalizado' }).click();
  await page.clock.runFor(80);
  const ciclos: string[] = [];
  for (const tam of ANCHOS) {
    if (tam.alto < 600) continue;
    await asentarTamano(page, tam.ancho, tam.alto);
    const medida = await page.evaluate(() => {
      const hoja = document.querySelector('.sheet.open');
      if (!(hoja instanceof HTMLElement)) return null;
      return { scroll: hoja.scrollHeight, cliente: hoja.clientHeight };
    });
    if (!medida) throw new Error(`${tam.nombre}: el menú de ciclos no está abierto`);
    if (medida.scroll > medida.cliente + 1) {
      ciclos.push(`${tam.nombre}: scroll ${medida.scroll} > cliente ${medida.cliente}`);
    }
  }
  expect(ciclos, ciclos.join('\n')).toEqual([]);
});

test('el vídeo sigue al tema', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'oscuro', ancho: 1440, alto: 900 });
  await abrirMenu(page);
  await page.getByRole('radio', { name: 'Escena Arena' }).click();
  await mantener(page);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const video = document.querySelector('.fondo video');
        return video instanceof HTMLVideoElement ? video.currentSrc : '';
      }),
    )
    .toContain('arena');
});

test('la superficie del agua queda a menos de 1°', async ({ page }) => {
  // En CI la lectura de los cuatro ángulos roza los 3 min. El tope de la
  // suite es 180 s y un segundo de más cierra el navegador a medias.
  test.setTimeout(360_000);
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  const medidas: { pedido: number; grados: number; columnas: number; texto: string }[] = [];
  for (const grados of [0, 30, 45, 60]) {
    await fijarAngulo(page, grados);
    await page.clock.runFor(180);
    const { data, w, h } = await lienzoFrasco(page);
    const mascara = await mascaraEnFrasco(page, w, h, grados);
    const arriba = pendienteSuperficie(
      data,
      w,
      h,
      { x: w * 0.2, y: h * 0.08, w: w * 0.6, h: h * 0.38 },
      mascara,
      'azul',
    );
    const abajo = pendienteSuperficie(
      data,
      w,
      h,
      { x: w * 0.2, y: h * 0.55, w: w * 0.6, h: h * 0.35 },
      mascara,
      'azul',
    );
    const usada = arriba.columnas >= 8 ? arriba : abajo;
    medidas.push({
      pedido: grados,
      grados: usada.grados,
      columnas: usada.columnas,
      texto: `${grados}° → ${usada.grados.toFixed(1)}° (arriba ${arriba.grados.toFixed(1)}°/${arriba.columnas}, abajo ${abajo.grados.toFixed(1)}°/${abajo.columnas})`,
    });
  }
  const detalle = medidas.map((m) => m.texto).join('\n');
  const recto = medidas.find((m) => m.pedido === 0);
  expect(recto?.columnas ?? 0, detalle).toBeGreaterThanOrEqual(8);
  expect(Math.abs(recto?.grados ?? Number.NaN), detalle).toBeLessThan(1);
  falloEsperado(3, 'el agua se calcula en un espacio estirado: a 30° el error ronda los 22°');
  for (const medida of medidas.filter((m) => m.pedido !== 0)) {
    expect(medida.columnas, detalle).toBeGreaterThanOrEqual(8);
    expect(Math.abs(medida.grados), detalle).toBeLessThan(1);
  }
});

test('el agua llega a la máscara', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  await fijarAngulo(page, 0);
  const jar = await lienzoFrasco(page);
  const mask = await mascaraEscalada(page, jar.w, jar.h);
  const hueco = huecoAguaMascara(jar.data, mask, jar.w, jar.h);
  expect(hueco.filas, 'la máscara no cubre el bulbo de arriba').toBeGreaterThan(8);
  falloEsperado(2, 'el contorno del agua es r² y no llega al cristal: el hueco pasa de 2 px');
  expect(
    hueco.hueco,
    `hueco ${hueco.hueco} px · contraste borde ${hueco.contraste.toFixed(1)} · ${hueco.filas} filas`,
  ).toBeLessThan(2);
});

test('el agua no sale marrón', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'oscuro', ancho: 1440, alto: 900 });
  await fijarAngulo(page, 0);
  const { data, w, h } = await lienzoFrasco(page);
  const mascara = await mascaraEnFrasco(page, w, h, 0);
  const recorte = new Uint8ClampedArray(data);
  for (let i = 0; i < mascara.length; i += 4) {
    if ((mascara[i] ?? 0) < 140) recorte[i + 3] = 0;
  }
  const color = colorMedio(recorte, w, h, { x: w * 0.34, y: h * 0.18, w: w * 0.32, h: h * 0.2 });
  expect(color.n, 'sin píxeles de agua').toBeGreaterThan(8);
  // Centro del agua en Lluvia oscuro, 25fca17: rgb(152,169,177), matiz ~198°.
  // Entra en 180-215. El tinte cálido no vuelve marrón ese punto, así que
  // esta comprobación no se marca como fallo esperado.
  expect(
    color.matiz,
    `matiz ${color.matiz.toFixed(1)} rgb(${color.r.toFixed(0)},${color.g.toFixed(0)},${color.b.toFixed(0)})`,
  ).toBeGreaterThanOrEqual(180);
  expect(color.matiz).toBeLessThanOrEqual(215);
  expect(color.r, 'R ≤ B').toBeLessThanOrEqual(color.b);
});

test('el reloj no tiene halo ni fondo', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900, arrancar: false });
  const estilos = await page.evaluate(() => {
    const leer = (sel: string) => {
      const nodo = document.querySelector(sel);
      if (!(nodo instanceof Element)) return null;
      const estilo = getComputedStyle(nodo);
      return {
        sel,
        sombra: estilo.textShadow,
        desenfoque: estilo.backdropFilter,
        fondo: estilo.backgroundColor,
        caja: estilo.boxShadow,
      };
    };
    return {
      halo: document.querySelector('.halo') !== null,
      nodos: ['.reloj', '.readout', '.time', '.hint'].map(leer),
    };
  });
  expect(estilos.halo, 'queda un elemento .halo').toBe(false);
  for (const nodo of estilos.nodos) {
    expect(nodo, 'falta una pieza del reloj').not.toBeNull();
    expect(nodo?.sombra, nodo?.sel).toBe('none');
    expect(nodo?.desenfoque, nodo?.sel).toBe('none');
    expect(nodo?.caja, nodo?.sel).toBe('none');
    expect(nodo?.fondo, nodo?.sel).toBe('rgba(0, 0, 0, 0)');
  }
});

test('el texto hablado coincide con 04:30', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  const ahora = await page.evaluate(() => Date.now());
  // Un re-render a mitad del minuto deja los segundos viejos en el aria.
  await page.clock.setFixedTime(new Date(ahora - 28_000));
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.clock.runFor(40);
  await page.clock.setFixedTime(new Date(ahora));
  await page.clock.runFor(280);
  const marcha = await leerReloj(page);
  expect(marcha.visible, marcha.hablado).toBe('04:30');
  falloEsperado(8, 'el aria se queda con los segundos de un fotograma anterior (04:30 frente a 4:58)');
  expect(marcha.hablado, marcha.hablado).toContain('5 minutos');
  expect(marcha.hablado, marcha.hablado).not.toMatch(/segundos/);
});

test('en pausa el hablado dice minutos y segundos', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  await page.locator('.escenario').focus();
  await page.keyboard.press('Space');
  await mantener(page);
  const pausa = await leerReloj(page);
  expect(pausa.visible, pausa.hablado).toBe('04:30');
  expect(pausa.hablado, pausa.hablado).toMatch(/4 minutos y 30 segundos|4 minutos 30 segundos/);
  expect(pausa.hablado).not.toMatch(/58/);
});

test('el botón del menú sigue en pausa', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  await page.locator('.escenario').focus();
  await page.keyboard.press('Space');
  await mantener(page);
  await page.hover('.app');
  await expect(page.locator('#menu-button')).toBeVisible();
  await page.locator('#menu-button').click();
  await expect(page.locator('.sheet.open')).toBeVisible();
});

test('el pie y los controles no se cortan desde 360 px', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 360, alto: 740, ajuste: 'system' });
  await abrirMenu(page);
  const cortes = await page.evaluate(() => {
    const mal: string[] = [];
    const mira = (nodo: Element) => {
      if (!(nodo instanceof HTMLElement)) return;
      const estilo = getComputedStyle(nodo);
      if (estilo.display === 'none' || estilo.visibility === 'hidden') return;
      // El envoltorio del tooltip es más ancho que el botón a propósito:
      // el texto completo vive en el popup, y el botón se mide aparte.
      if (nodo.classList.contains('ayuda')) return;
      if (nodo.scrollWidth > nodo.clientWidth + 1) {
        mal.push(
          `${nodo.tagName}.${nodo.className}: ${nodo.scrollWidth}>${nodo.clientWidth} «${nodo.textContent?.trim().slice(0, 40)}»`,
        );
      }
    };
    document
      .querySelectorAll(
        '.sheet.open button, .sheet.open span, .site-footer, .site-footer a, .site-footer button',
      )
      .forEach(mira);
    return mal;
  });
  expect(cortes, cortes.join('\n')).toEqual([]);
});

test('en reposo no se piden fotogramas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__HG_PRUEBA__ = true;
    localStorage.setItem('hourglass-web/escena', 'lluvia');
    localStorage.setItem('hourglass-web/android-promo', '1');
    localStorage.setItem(
      'hourglass-web/cookies',
      JSON.stringify({ choice: 'rejected', at: Date.now(), bannerVersion: '5f29f1d4' }),
    );
    localStorage.setItem(
      'hourglass-web/ajustes',
      JSON.stringify({
        version: 5,
        lastDurationMs: 300000,
        theme: 'light',
        language: 'es',
        sound: false,
        sessionMode: 'single',
      }),
    );
  });
  await page.goto('/');
  const src = await page.locator('script[type="module"]').first().getAttribute('src');
  if (!src || !/\/assets\/index-/.test(src)) {
    throw new Error(`La página no es el build de producción (${src ?? 'sin script'}).`);
  }
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const muestras: number[] = [];
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      original((t) => {
        muestras.push(t);
        cb(t);
      });
    (window as unknown as { __muestras: number[] }).__muestras = muestras;
  });
  await page.waitForTimeout(2000);
  const n = await page.evaluate(
    () => (window as unknown as { __muestras?: number[] }).__muestras?.length ?? 0,
  );
  expect(n, `${n} fotogramas en 2 s con el reloj parado`).toBe(0);
});

test('al girar, el fotograma cabe en 8 ms', async ({ page }) => {
  // Sin reloj de Playwright: performance.now tiene que ser el de verdad.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__HG_PRUEBA__ = true;
    localStorage.setItem('hourglass-web/escena', 'arena');
    localStorage.setItem('hourglass-web/android-promo', '1');
    localStorage.setItem(
      'hourglass-web/cookies',
      JSON.stringify({ choice: 'rejected', at: Date.now(), bannerVersion: '5f29f1d4' }),
    );
    localStorage.setItem(
      'hourglass-web/ajustes',
      JSON.stringify({
        version: 5,
        lastDurationMs: 300000,
        theme: 'light',
        language: 'es',
        sound: false,
        sessionMode: 'single',
      }),
    );
  });
  await page.goto('/');
  const src = await page.locator('script[type="module"]').first().getAttribute('src');
  if (!src || !/\/assets\/index-/.test(src)) {
    throw new Error(`La página no es el build de producción (${src ?? 'sin script'}).`);
  }
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const tiempos: number[] = [];
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      original((t) => {
        const inicio = performance.now();
        cb(t);
        tiempos.push(performance.now() - inicio);
      });
    (window as unknown as { __tiempos: number[] }).__tiempos = tiempos;
    window.__hg?.fijarAngulo(30);
  });
  await page.waitForTimeout(1500);
  const tiempos = await page.evaluate(() => (window as unknown as { __tiempos?: number[] }).__tiempos ?? []);
  const orden = [...tiempos].sort((a, b) => a - b);
  expect(orden.length, 'el bucle no llegó a pintar con el frasco girado').toBeGreaterThan(8);
  const mediana = orden[Math.floor(orden.length / 2)] ?? Number.NaN;
  expect(mediana, `mediana ${mediana.toFixed(1)} ms sobre ${orden.length} fotogramas`).toBeLessThanOrEqual(8);
});

test('la precarga no pide tex-sand ni dos formatos del mismo fondo', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  await page.clock.runFor(3000);
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="prefetch"]')].map((nodo) => (nodo as HTMLLinkElement).href),
  );
  expect(hrefs.length, 'no apareció ningún prefetch').toBeGreaterThan(0);
  expect(
    hrefs.some((href) => href.includes('tex-sand')),
    hrefs.join('\n'),
  ).toBe(false);
  const porBase = new Map<string, string[]>();
  for (const href of hrefs) {
    const limpio = href.split('?')[0] ?? href;
    const base = limpio.replace(/\.(avif|webp|jpe?g|webm|mp4)$/i, '');
    const lista = porBase.get(base) ?? [];
    lista.push(limpio);
    porBase.set(base, lista);
  }
  const repetidos = [...porBase.values()].filter((lista) => new Set(lista).size > 1);
  expect(repetidos, 'formatos repetidos').toEqual([]);
});

function parseRgb(texto: string): Rgb | null {
  const hex = texto.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    return {
      r: Number.parseInt(hex[1].slice(0, 2), 16),
      g: Number.parseInt(hex[1].slice(2, 4), 16),
      b: Number.parseInt(hex[1].slice(4, 6), 16),
    };
  }
  const partes = texto.match(/[\d.]+/g)?.map(Number) ?? [];
  if (partes.length < 3) return null;
  const alpha = partes[3] ?? 1;
  if (alpha === 0) return { r: 0, g: 0, b: 0 };
  return { r: partes[0] ?? 0, g: partes[1] ?? 0, b: partes[2] ?? 0 };
}

async function mascaraEnFrasco(page: Page, w: number, h: number, grados: number): Promise<Uint8ClampedArray> {
  const crudo = await page.evaluate(
    async ({ w: ancho, h: alto, grados: g }) => {
      const img = new Image();
      img.src = '/frasco/jar-mask.webp';
      await img.decode();
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext('2d');
      if (!ctx) return null;
      ctx.translate(ancho / 2, alto / 2);
      ctx.rotate((g * Math.PI) / 180);
      ctx.drawImage(img, -ancho / 2, -alto / 2, ancho, alto);
      return Array.from(ctx.getImageData(0, 0, ancho, alto).data);
    },
    { w, h, grados },
  );
  if (!crudo) throw new Error('No se pudo leer jar-mask.webp.');
  return Uint8ClampedArray.from(crudo);
}

async function mascaraEscalada(page: Page, w: number, h: number): Promise<Uint8ClampedArray> {
  return mascaraEnFrasco(page, w, h, 0);
}
