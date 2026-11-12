import { expect, test, type Page } from '@playwright/test';

import { falloEsperado } from './soporte/fallo';
import {
  ANCHOS,
  abrir,
  abrirMenu,
  asentarTamano,
  enLimpio,
  fijarAngulo,
  leerReloj,
  lienzoFrasco,
  mantener,
} from './soporte/escena';
import {
  colorMedio,
  contraste,
  huecoAguaMascara,
  pendienteSuperficie,
  peorCincoPorCiento,
  type Rgb,
} from './soporte/pendiente';

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

test('el texto del vidrio y del pie contrasta', async ({ browser }) => {
  test.setTimeout(360_000);
  const temas = ['lluvia', 'arena', 'clasico'] as const;
  const modos = ['claro', 'oscuro'] as const;
  const fallos: string[] = [];
  for (const tema of temas) {
    for (const modo of modos) {
      await enLimpio(browser, async (page) => {
        await abrir(page, { tema, modo, ancho: 1440, alto: 900 });
        await abrirMenu(page);
        const medidas: Array<[string, Medida]> = [
          ['elegido', await contrastePeor(page, '.control[aria-checked="true"]', 0.2)],
          ['libre', await contrastePeor(page, '.control[aria-checked="false"]', 0.2)],
          ['pie', await contrasteDe(page, '.pie-enlace')],
        ];
        await page.locator('.menu-cerrar').click();
        await page.locator('.sheet.open').waitFor({ state: 'hidden' });
        await page.hover('.app');
        await page.locator('a[href="/aviso-legal.html"]').click();
        await page.locator('.legal-dialog').waitFor({ state: 'visible' });
        const marco = page.frameLocator('.legal-dialog iframe');
        await marco.locator('p').first().waitFor();
        await page.waitForFunction(() => {
          const marcoHtml = document.querySelector('.legal-dialog iframe');
          if (!(marcoHtml instanceof HTMLIFrameElement)) return false;
          const raiz = marcoHtml.contentDocument?.documentElement;
          return Boolean(raiz && getComputedStyle(raiz).getPropertyValue('--tinta').trim());
        });
        medidas.push(['legal', await contrasteEnMarco(page, '.card p')]);
        medidas.push(['legal-suave', await contrasteEnMarco(page, '.lang')]);
        for (const [nombre, medida] of medidas) {
          // El velo blanco al 30 % sobre negro queda en rgb(77). Con la misma tinta
          // que la pastilla blanca del elegido, ese punto no llega a 4,5 (sección 3.8).
          const sueloDelVelo =
            nombre === 'libre' && medida.fondo.r < 90 && medida.fondo.g < 90 && medida.fondo.b < 90;
          const minimo = sueloDelVelo ? 2 : 4.5;
          if (medida.valor < minimo) {
            fallos.push(
              `${tema} ${modo} ${nombre} ${medida.valor.toFixed(2)} tinta ${rgbDe(medida.tinta)} fondo ${rgbDe(medida.fondo)}`,
            );
          }
        }
      });
    }
  }
  expect(fallos, fallos.join('\n')).toEqual([]);
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
  falloEsperado(7, 'el alto del menú está fijo y overflow:hidden corta la última fila');
  expect(cortes, cortes.join('\n')).toEqual([]);
});

test('el vídeo sigue al tema', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'oscuro', ancho: 1440, alto: 900 });
  await abrirMenu(page);
  await page.getByRole('radio', { name: 'Escena Arena' }).click();
  await mantener(page);
  const src = await page.evaluate(() => {
    const video = document.querySelector('.fondo video');
    return video instanceof HTMLVideoElement ? video.currentSrc : '';
  });
  expect(src.length, 'el vídeo no llegó a tener currentSrc').toBeGreaterThan(0);
  falloEsperado(6, 'React reutiliza el <video> y el navegador no llama a load()');
  expect(src, `currentSrc=${src}`).toContain('arena');
});

test('la superficie del agua queda a menos de 1°', async ({ page }) => {
  // En CI la lectura de los cuatro ángulos roza los 3 min. El tope de la
  // suite es 180 s y un segundo de más cierra el navegador a medias.
  test.setTimeout(360_000);
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  const medidas: { pedido: number; grados: number; columnas: number; texto: string }[] = [];
  for (const grados of [0, 30, 45, 60]) {
    await fijarAngulo(page, grados);
    // El borde azul salta ±2° entre fotogramas. La mediana es el nivel quieto
    // (en CI, a 0°, era 0,1°). Una sola lectura a veces pasa de 1° y tumba
    // el test antes de la marca del agua inclinada.
    const lecturas: { grados: number; columnas: number; texto: string }[] = [];
    for (let i = 0; i < 5; i += 1) {
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
      lecturas.push({
        grados: usada.grados,
        columnas: usada.columnas,
        texto: `${grados}° → ${usada.grados.toFixed(1)}° (arriba ${arriba.grados.toFixed(1)}°/${arriba.columnas}, abajo ${abajo.grados.toFixed(1)}°/${abajo.columnas})`,
      });
    }
    const orden = [...lecturas].sort((a, b) => Math.abs(a.grados) - Math.abs(b.grados));
    const media = orden[Math.floor(orden.length / 2)];
    if (!media) throw new Error(`sin lectura a ${grados}°`);
    medidas.push({
      pedido: grados,
      grados: media.grados,
      columnas: media.columnas,
      texto: `${media.texto} · lecturas ${lecturas.map((l) => l.grados.toFixed(1)).join(', ')}`,
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

test('el contraste del reloj en cada tema y modo', async ({ browser }) => {
  test.setTimeout(360_000);
  const temas = ['lluvia', 'arena', 'clasico'] as const;
  const modos = ['claro', 'oscuro'] as const;
  const tamanos = [
    { ancho: 1440, alto: 900 },
    { ancho: 390, alto: 844 },
  ] as const;
  for (const tema of temas) {
    for (const modo of modos) {
      for (const tam of tamanos) {
        await enLimpio(browser, async (page) => {
          await abrir(page, { tema, modo, ancho: tam.ancho, alto: tam.alto, arrancar: false });
          const muestra = await contrasteReloj(page);
          const texto = `${tema} ${modo} ${tam.ancho} dígitos ${muestra.digitos.toFixed(2)} · pista ${muestra.pista.toFixed(2)}`;
          // Clásico oscuro en 390 apoya el reloj en el suelo claro y en 1440
          // en el muro negro. Ningún gris entra en la banda en los dos fondos.
          // El elegido cumple la banda en el muro; aquí solo se impide aclararlo.
          const sueloClasico = tema === 'clasico' && modo === 'oscuro' && tam.ancho === 390;
          if (sueloClasico) {
            expect(muestra.digitos, texto).toBeGreaterThan(1);
            expect(muestra.digitos, texto).toBeLessThan(1.6);
            expect(muestra.pista, texto).toBeGreaterThan(1.1);
            expect(muestra.pista, texto).toBeLessThan(1.9);
          } else {
            expect(muestra.digitos, texto).toBeGreaterThanOrEqual(2.5);
            expect(muestra.digitos, texto).toBeLessThanOrEqual(4);
            expect(muestra.pista, texto).toBeGreaterThanOrEqual(3);
            expect(muestra.pista, texto).toBeLessThanOrEqual(5);
          }
        });
      }
    }
  }
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
  falloEsperado(7, 'en pausa el botón lleva hidden y la clase is-paused lo oculta');
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
  falloEsperado(7, 'el pie estrecho no cabe y «Automático» se corta con puntos suspensivos');
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
  falloEsperado(10, 'en Lluvia la nube mantiene el bucle despierto (unos 35 fotogramas en 2 s)');
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
  falloEsperado(10, '17.292 granos con arc+fill rondan los 40 ms por fotograma');
  expect(mediana, `mediana ${mediana.toFixed(1)} ms sobre ${orden.length} fotogramas`).toBeLessThanOrEqual(8);
});

test('la precarga no pide tex-sand ni dos formatos del mismo fondo', async ({ page }) => {
  await abrir(page, { tema: 'lluvia', modo: 'claro', ancho: 1440, alto: 900 });
  await page.clock.runFor(3000);
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="prefetch"]')].map((nodo) => (nodo as HTMLLinkElement).href),
  );
  expect(hrefs.length, 'no apareció ningún prefetch').toBeGreaterThan(0);
  falloEsperado(9, 'se precargan tex-sand (no se pinta) y todos los formatos de cada fondo');
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

interface Medida {
  readonly valor: number;
  readonly tinta: Rgb;
  readonly fondo: Rgb;
}

function rgbDe({ r, g, b }: Rgb): string {
  return `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
}

function medidaDe(tinta: Rgb, fondos: readonly Rgb[]): Medida {
  const pares = fondos.map((fondo) => ({ fondo, valor: contraste(tinta, fondo) }));
  pares.sort((a, b) => a.valor - b.valor);
  const i = Math.min(pares.length - 1, Math.floor((pares.length - 1) * 0.05));
  const peor = pares[i];
  if (!peor) throw new Error('sin muestras de contraste');
  return { valor: peor.valor, tinta, fondo: peor.fondo };
}

async function contrasteEnMarco(page: Page, selector: string): Promise<Medida> {
  const nodo = page.frameLocator('.legal-dialog iframe').locator(selector).first();
  const caja = await nodo.boundingBox();
  if (!caja) throw new Error(`no hay ${selector} en el panel legal`);
  const color = await nodo.evaluate((el) => getComputedStyle(el).color);
  const tinta = parseRgb(color);
  if (!tinta) throw new Error(`sin color legal en ${selector}: ${color}`);
  await nodo.evaluate((el) => {
    el.style.color = 'transparent';
  });
  const png = await page.screenshot({
    clip: { x: caja.x, y: caja.y, width: Math.max(1, caja.width), height: Math.max(1, caja.height) },
    animations: 'disabled',
  });
  return medidaDe(tinta, await muestrasPng(page, png.toString('base64')));
}

async function contrastePeor(page: Page, selector: string, recorte: number): Promise<Medida> {
  const nodos = page.locator(selector);
  const total = await nodos.count();
  let peor: Medida | null = null;
  for (let i = 0; i < total; i += 1) {
    const medida = await contrasteDe(page, nodos.nth(i), recorte);
    if (!peor || medida.valor < peor.valor) peor = medida;
  }
  if (!peor) throw new Error(`no hay ${selector}`);
  return peor;
}

async function contrasteDe(
  page: Page,
  nodo: ReturnType<Page['locator']> | string,
  recorte = 0,
): Promise<Medida> {
  const objetivo = typeof nodo === 'string' ? page.locator(nodo).first() : nodo;
  const caja = await objetivo.boundingBox();
  if (!caja) throw new Error('no hay caja del control');
  const color = await objetivo.evaluate((el) => getComputedStyle(el).color);
  const tinta = parseRgb(color);
  if (!tinta) throw new Error(`sin color: ${color}`);
  await objetivo.evaluate((el) => {
    el.style.color = 'transparent';
  });
  const mx = caja.width * recorte;
  const my = caja.height * recorte;
  const png = await page.screenshot({
    clip: {
      x: caja.x + mx,
      y: caja.y + my,
      width: Math.max(1, caja.width - mx * 2),
      height: Math.max(1, caja.height - my * 2),
    },
    animations: 'disabled',
  });
  return medidaDe(tinta, await muestrasPng(page, png.toString('base64')));
}

async function muestrasPng(page: Page, b64: string): Promise<Rgb[]> {
  const planos = await page.evaluate(async (datos) => {
    const img = new Image();
    img.src = `data:image/png;base64,${datos}`;
    await img.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = img.width;
    lienzo.height = img.height;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return [] as number[];
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
    const salida: number[] = [];
    for (let i = 0; i < px.length; i += 16) salida.push(px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0);
    return salida;
  }, b64);
  const muestras: Rgb[] = [];
  for (let i = 0; i + 2 < planos.length; i += 3) {
    muestras.push({ r: planos[i] ?? 0, g: planos[i + 1] ?? 0, b: planos[i + 2] ?? 0 });
  }
  if (muestras.length < 4) throw new Error('sin píxeles de fondo');
  return muestras;
}

async function contrasteReloj(page: Page): Promise<{ digitos: number; pista: number }> {
  const caja = await page.locator('.readout').boundingBox();
  if (!caja) throw new Error('no hay .readout');
  const colores = await page.evaluate(() => {
    const hora = document.querySelector('.time');
    const app = document.querySelector('.app');
    if (!(hora instanceof Element) || !(app instanceof Element)) return null;
    const pistaNodo = document.querySelector('.hint');
    const pista = pistaNodo instanceof Element ? getComputedStyle(pistaNodo).color : '';
    return {
      digitos: getComputedStyle(hora).color,
      pista: pista || getComputedStyle(app).getPropertyValue('--pista').trim(),
    };
  });
  if (!colores) throw new Error('no hay color de reloj');
  await page.addStyleTag({ content: '.time,.hint{color:transparent !important}' });
  const png = await page.screenshot({
    clip: { x: caja.x, y: caja.y, width: caja.width, height: caja.height },
    animations: 'disabled',
  });
  const fondos = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = img.width;
    lienzo.height = img.height;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return [] as number[];
    ctx.drawImage(img, 0, 0);
    const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
    const planos: number[] = [];
    const x0 = Math.floor(lienzo.width * 0.2);
    const x1 = Math.floor(lienzo.width * 0.8);
    const y0 = Math.floor(lienzo.height * 0.15);
    const y1 = Math.floor(lienzo.height * 0.75);
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * lienzo.width + x) * 4;
        planos.push(datos[i] ?? 0, datos[i + 1] ?? 0, datos[i + 2] ?? 0);
      }
    }
    return planos;
  }, png.toString('base64'));
  const tintaDigitos = parseRgb(colores.digitos) ?? { r: 0, g: 0, b: 0 };
  const tintaPista = parseRgb(colores.pista) ?? tintaDigitos;
  if (fondos.length < 24) throw new Error('sin píxeles detrás del reloj');
  const muestras: Rgb[] = [];
  for (let i = 0; i + 2 < fondos.length; i += 3) {
    muestras.push({ r: fondos[i] ?? 0, g: fondos[i + 1] ?? 0, b: fondos[i + 2] ?? 0 });
  }
  return {
    digitos: peorCincoPorCiento(muestras.map((fondo) => contraste(tintaDigitos, fondo))),
    pista: peorCincoPorCiento(muestras.map((fondo) => contraste(tintaPista, fondo))),
  };
}
