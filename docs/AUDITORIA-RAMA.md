# Auditoría de la rama `feature/web-escenas` (Hourglass web)

**Commit revisado:** `25fca17`, el último de la rama («Deja el agua y la arena a nivel del mundo al girar el frasco»). Son 9 commits sobre `main` (`4b39e74`).
**Fecha:** 12 nov 2026.
**Cómo lo he revisado:** solo he leído y ejecutado, en local y sin tocar el remoto.
- He leído todo `apps/web/src`.
- He compilado la versión de producción (`npm run web:build`) y la he servido con `vite preview`.
- La he recorrido con Chromium (Playwright): capturas, estilos calculados, giro del frasco, cambio de tema y tiempo por fotograma.
- He medido la máscara del frasco, los vídeos y las imágenes con Python y ffmpeg.

La vista previa de Vercel pide inicio de sesión, así que no he podido abrirla. Lo que muestro sale del build local del mismo commit, que es lo que sube Vercel.

**Evidencias** (en `auditoria-rama/`):

| Archivo | Qué enseña |
|---|---|
| `1440x900-lluvia-light-menu.png` | El menú sin desenfoque en producción |
| `390x844-lluvia-dark-menu.png` | Las pastillas teñidas del tema |
| `rot-sheet.png` | El agua inclinada mal frente a la arena bien |
| `switch-arena-dark.png` | Arena con el vídeo de Lluvia detrás |
| `scripts/*.js` | Los scripts para repetir cada medida |

---

## 0. Resumen: las 10 causas raíz

Casi nada de lo que «se rompe otra vez» es mala suerte. Son diez fallos de fondo, y cada uno explica varios síntomas.

| # | Causa raíz | Síntomas que explica | Dónde |
|---|---|---|---|
| 1 | **El build de producción borra el desenfoque.** El minificador de CSS (Lightning CSS 1.33, dentro de Vite 8) junta `backdrop-filter` y `-webkit-backdrop-filter` y se queda solo con el `-webkit-`. Chrome y Firefox no lo aplican: `backdropFilter` calculado = `none` en producción, y en `vite dev` sí sale `blur(32px)`. | El menú «no es vidrio», se lee mal y «vuelve a estar mal». El agente lo ve bien en `dev` y en producción está roto. El halo del reloj es una mancha sin desenfoque. | `styles.css:245-248` y `:234-235`; CSS compilado `dist/assets/index-*.css` |
| 2 | **Hay cuatro geometrías distintas del mismo frasco, y ninguna es la máscara real.** (a) El agua reconstruye el contorno a partir de la tabla de volumen, y sale el **radio al cuadrado** en vez del radio. (b) La arena usa el perfil `CLASSIC_MODEL`, que es más ancho que la foto. (c) El clic usa una fórmula inventada. (d) El «vidrio de reserva» son dos elipses. | El agua no toma la forma del frasco: cerca del cuello ocupa solo el 32-34 % del ancho real. La arena se recorta contra la máscara. | `fisica/agua.ts:38-54`, `useFrasco.ts:40-46` y `:65-72`, `dibujo.ts:75-85` |
| 3 | **El agua se calcula en un espacio estirado.** El ancho y el alto no usan la misma escala (1 unidad en x = 0,44 × ancho; 1 unidad en y = 1,0 × ancho), así que «perpendicular a la gravedad» sale torcido: **22,6° de error a 30°**, 21° a 45°, 15,7° a 60° y 0° solo a 90°. El test usa el mismo espacio estirado y por eso pasa. | El agua se inclina mal al girar, aunque «se arregló». | `fisica/agua.ts:104-106`, `:156-162`; `test/agua.test.mjs:30-36` |
| 4 | **La luz y el agua se pintan en el espacio del frasco, no en el del mundo.** El tinte cálido se pone encima de todo el frasco, agua incluida, con un `overlay` de hasta 0,95. Además, el reflejo y la luz de los granos giran con el frasco. | El agua parece marrón (en Lluvia oscuro, naranja `#ff8a2a` al 95 %). Los brillos se quedan en el lado equivocado al voltear. La lluvia del cuello cae en diagonal. | `dibujo.ts:39-66`, `luzAplicar.ts:47-73`, `granos.ts:67-84`, `contenido.ts:143-161` |
| 5 | **Cada color tiene tres copias y el CSS se pisa a sí mismo.** Por cada tema y modo están (a) `UiTema` en TS, con 13 campos de los que **solo se lee `barra`**, (b) las variables CSS de `temas/*.css` y (c) las de `:root` y `[data-scheme=dark]`. A eso se suman los `--vidrio-*` y las reglas `.vidrio .x`, que empatan en especificidad con `.chip.chip-on` y pierden por el orden del archivo. | La pastilla elegida sigue teñida (Lluvia oscuro `rgb(197,212,204)`, Arena oscuro `rgb(216,194,168)`). El botón de la app Android y la «×» también. Los tests de contraste miran valores que no se pintan. | `temas/*.ts`, `temas/*.css`, `styles.css:1-68`, `:257-274`, `:742-746`, `:1000`, `:629` |
| 6 | **El vídeo de fondo no cambia al cambiar de tema** si los dos modos son vídeo. React reutiliza el mismo `<video>` y solo cambia sus `<source>`, y el navegador ignora ese cambio si no se llama a `load()`. **Comprobado:** al pasar de Lluvia oscuro a Arena oscuro sigue sonando `lluvia-oscuro.webm`. | «No carga bien el fondo que debería» y el cambio de tema deja restos. | `fondo/Fondo.tsx:61-81` |
| 7 | **La colocación adivina en vez de medir.** `calcularLayout` fija el alto del menú (328-364 px en estrecho; `alto*0.42` en ancho) y el CSS pone `overflow: hidden`. El contenido mide más y se corta: 299/290 px a 1440×900, 277/264 a 1280×720 y 322/310 a 390×844, y mucho más con ciclos personalizados. La hora tiene su caja en JS y su tamaño de letra en CSS (vw/vh), sin relación entre ellos. Para subir el reloj hay **dos mecanismos** (`relajar` y `useClockLift`). | El menú corta la última fila, tiene scroll o pisa el reloj según el tamaño. Cada arreglo de uno rompe el otro. | `layout/calcularLayout.ts:45-52`, `:74`, `:82`; `hooks/useClockLift.ts`; `styles.css:568-569`, `:476-478`, `:895-897` |
| 8 | **No hay pruebas visuales ni de la salida de producción.** Hay 27 tests y todos pasan con el desenfoque roto, el agua torcida y el vídeo equivocado. Varios comprueban el texto fuente (una regex sobre `styles.css`), datos muertos (`modo.ui.hora`) o un desperdicio (que se precargue `tex-sand`). | Lo arreglado vuelve a romperse sin que nada avise. | `test/*.test.mjs` (detalle en la sección 3) |
| 9 | **La carga descarga de más y en el orden equivocado.** El precargado baja todos los formatos de cada fondo (AVIF+WebP+JPG y WebM+MP4), unos 0,4-0,6 MB redundantes. También baja `tex-sand.webp` (464 KB), **que no se usa en ningún sitio**, y la nube en WebM de 1,1 MB (4× el MP4) incluso en Arena y Clásico. El frasco necesita 456 KB de capas a 891×2048 antes de verse, y se procesan píxel a píxel en el hilo principal. | Es lento con internet malo y el fondo llega tarde. | `medios/assetLoader.ts:13-15`, `:54-78`; `frasco/activos.ts:37-60`, `:110-120` |
| 10 | **El bucle de dibujo es caro y en Lluvia no se duerme.** Arena y Clásico pintan **17.292 granos uno a uno** (`arc` + `fill` + un `fillStyle` en texto) en cada fotograma: unos 40 ms por fotograma en CPU (el presupuesto es 16,7). Al inclinar, se recoloca toda la arena en cada fotograma (`sim.arrange`), así que no hay avalancha, solo teletransporte. En Lluvia, la nube mantiene el bucle a 60 fps aunque no pase nada y lee 480×192 píxeles de la GPU en cada fotograma. | Va lento, y la arena «salta» al girar en vez de resbalar. | `granos.ts:90-123`, `useFrasco.ts:133-163`, `:195-206`, `nube.ts:35-38` |

**Por qué los arreglos no se quedan arreglados:**
- Cada síntoma tiene **varias fuentes de verdad**: geometría, colores y colocación.
- El agente comprueba en **`dev`**, que no es lo que se publica.
- Los tests verifican **la idea**, no **el píxel**.

El último commit, «agua a nivel del mundo», añadió un test que pasa porque usa la misma deformación que el código.

---

## 1. Mapa de la arquitectura actual

### 1.1 Módulos

```
apps/web/src/
  main.tsx              monta <App>, importa fuentes (5 pesos) + styles.css + 3 temas/*.css
  App.tsx (328)         compone todo; guarda tema, menú, legal, promo; calcula layout
  useSession / useSettings   tiempo y ajustes (envuelven el core) — bien
  hooks/
    useMedios           tamaño de ventana, oscuro del sistema, reducir movimiento, Save-Data
    useStageInput       clic / doble clic / rueda / teclado → funciones puras de stageClick
    useBotonMenu        visibilidad del botón del menú (3 s)
    useClockLift        mide en el DOM y sube el reloj ≤12 px (duplica `relajar`)
    useConsent          cookies
  layout/calcularLayout.ts   cajas: frasco, nube, reloj, menú, botón (px)
  temas/
    tipos.ts            Tema, ModoTema { fondo, luz, ui, granos }
    lluvia|arena|clasico.ts   datos por tema (luz + UiTema que no se usa)
    *.css               variables CSS por [data-tema][data-scheme] (lo que de verdad se pinta)
  fondo/Fondo.tsx + encuadre.ts   <picture> o <img poster> + <video>, encuadre «cover» con ancla
  medios/assetLoader.ts colores de reserva, cola de precarga, arranque del vídeo de la nube
  frasco/
    Lienzo.tsx → useFrasco.ts (282)   bucle único: máquina + física + dibujo
    maquina.ts + muelle.ts            ángulo y volteo (puro, con test)
    nivel.ts                          nivel = sandLevelForDuration × restante/duración
    fisica/agua.ts                    polígono del agua (contorno reconstruido)
    fisica/arena.ts                   gravedad y granos objetivo
    activos.ts                        carga jar-back, jar-front, jar-mask, nube.webp, tex-sand
    dibujo.ts → contenido.ts, luzAplicar.ts, luz.ts (sombra), nube.ts, granos.ts
  components/           SettingsSheet, TimeReadout, SiteFooter, CookieBanner, AndroidPromo,
                        LegalOverlay (iframe), Pausa, Icons
apps/web/legal/generar.mjs + legal/textos/*.html  → public/*.html + public/legal.css
```

### 1.2 Flujo de datos desde el tema

```
temaId (useState + localStorage)   scheme (ajuste o sistema)
            \                         /
             modo = tema.claro | tema.oscuro
   ┌──────────┬───────────┬──────────────┬──────────────┐
 modo.fondo  modo.luz    modo.granos     tema.nube      data-tema / data-scheme en .app
   │           │            │               │                     │
 <Fondo>    useFrasco ── dibujar() ── nube.ts               temas/*.css → --time, --halo,
 (img/vídeo) (sombra, vidrio,        (vídeo → canvas)         --ink, --pill, --chip-on…
             contenido, luz)                                   styles.css → --vidrio-* (global)
                                                               → reloj, menú, pie, banner,
 modo.ui.barra → <meta theme-color>  (los otros 12 campos de UiTema no se leen)   promo, legal
```

Hay **dos sistemas de color en paralelo**:
- La luz del lienzo sale de `modo.luz` (TS).
- La interfaz sale de las variables CSS.

Además, `UiTema` (TS) repite a mano los colores del CSS sin que nadie lo lea. El fondo de reserva sale de una tercera tabla, `COLORES`, indexada por URL (`assetLoader.ts:4-11`).

### 1.3 Cómo se dibuja

```
.app (fondo con degradado)
 └ .mundo (en pausa: filter blur 18px)
    ├ .fondo        <picture> o <img poster>+<video>  (DOM)
    ├ .escenario    role=button (clic, rueda)
    │   ├ canvas.lienzo  ← un único canvas 2D a pantalla completa, por fotograma:
    │   │     1 sombra (sin rotar)
    │   │     2 rotate(ángulo):  jar-back → contenido (hoja intermedia: granos|agua, destination-in máscara)
    │   │                         → aplicarLuz (hoja: degradado + foco, overlay; jar-front teñido, screen)
    │   │     3 nube (sin rotar; vídeo → canvas 480×192 → alphaFromBlack → drawImage ×2)
    │   └ .reloj (DOM)  .readout > .halo(backdrop-filter) + .time + .hint
    ├ SiteFooter, AndroidPromo(.vidrio)
 ├ #menu-button, .backdrop, .sheet.vidrio (fuera de .mundo)
 ├ Pausa, CookieBanner(.vidrio), LegalOverlay(.legal-dialog.vidrio + iframe)
```

### 1.4 Carga

1. `index.html` → JS de 323 KB (106 KB gzip) y CSS de 57 KB, del que 35 KB son 30 `@font-face`.
2. Al montar, `Fondo` pide el fondo activo y `cargarActivos` pide siempre `jar-back` (313 KB), `jar-front` (112 KB), `jar-mask` (31 KB) y `nube.webp` (28 KB), también en Arena y Clásico.
   - `jar-front`, la máscara y el póster de la nube pasan por un bucle de píxeles en el hilo principal (`getImageData`, 891×2048 = 1,8 M píxeles cada capa del frasco).
3. Con Arena o Clásico: `tex-sand.webp`, 464 KB que no se usan.
4. Al terminar `load`, en un hueco libre, se inyectan 17-18 `<link rel=prefetch>`: de 1,2 a 2,0 MB por tema (sección 4).
5. Con Lluvia activa, tras `requestIdleCallback`, se pone `nube.webm` (1,1 MB) en el vídeo de la nube.

---

## 2. Por áreas: qué hace, qué falla y por qué

### 2.1 Menú, vidrio y paneles (cookies, app Android, legal)

**Qué hace.** Un `.vidrio` único: velo de `rgba(255,255,255,.06)` en claro y `rgba(0,0,0,.22)` en oscuro, más `backdrop-filter: blur(32px) brightness(1.06) saturate(1.08)` (`styles.css:240-255`). Lo usan `.sheet`, `.banner`, `.app-promo` y `.legal-dialog`.

**Defectos:**
1. **No hay desenfoque en producción** (causa 1). Lo he medido en Chromium:
   - Con `vite preview`: `getComputedStyle(.sheet).backdropFilter = "none"` y `.halo = "none"`.
   - Con `vite dev`: `blur(32px) brightness(1.06) saturate(1.08)` y `blur(18px)`.
   - En el CSS compilado solo queda `-webkit-backdrop-filter`.
   - Lo he reproducido con Lightning CSS 1.33:
     - `.a{backdrop-filter:X;-webkit-backdrop-filter:X}` → `.a{-webkit-backdrop-filter:X}`
     - Escribir solo `backdrop-filter:X` → salen los dos, bien.

   Resultado: en Chrome y Firefox el menú es un velo del 6 % sobre las rocas, y los textos «Arena», «Clásico» y «Cycles» no se leen (`1440x900-lluvia-light-menu.png`).
2. **Las pastillas elegidas llevan color del tema.** `.vidrio .chip-on` (`styles.css:270`, especificidad 0,2,0) empata con `.chip.chip-on` (`:742`, 0,2,0), y gana el último del archivo. Colores medidos:

   | Tema y modo | Pastilla elegida (`chipOn`) |
   |---|---|
   | Lluvia oscuro | `rgb(197,212,204)` (verde azulado) |
   | Arena oscuro | `rgb(216,194,168)` (beige) |
   | Clásico oscuro | `rgb(196,174,148)` |

   Con `.pref-row .pill:not(.pill-fill)` (`:703`, 0,3,0) pasa algo parecido: gana a `.vidrio .pill`.
3. **Otros botones sin vidrio:**
   - `.sheet-close` usa `var(--track)` (`:629`), con tinte del tema.
   - El botón «Descargar» del popup Android usa `var(--pill)` (`:1000`).
   - `.app-promo-dismiss:hover` usa `--track` (`:1023`).
4. **El panel legal tiene tres tintes encima:**
   - El fondo de `.legal-overlay` es `rgba(24,16,10,.28)`, marrón (`styles.css:927`).
   - `public/legal.css:3-19` fija colores verdes (`--link:#2f6f62`, `--line:#d5deda`…) y sigue el `prefers-color-scheme` del sistema, no el modo elegido en la app.
   - `LegalOverlay.tsx:73-79` copia algunas variables al iframe, pero `--link` no existe en la app y se queda verde.
5. **Tooltips globales:** `button[aria-label]::after` (`styles.css:280-303`).
   - Salen en todos los botones, también en la pastilla de escena («Escena Arena» encima de «Single session» en `switch-arena-dark.png`).
   - `.sheet` tiene `overflow: hidden`, así que los tooltips de la última fila se cortan.
   - El texto «Escena» está escrito en español en la interfaz inglesa (`SettingsSheet.tsx:90, 97`).
6. **El contenido se corta** (causa 7): `.sheet{overflow:hidden; max-height:min(640px, 100dvh - 5.5rem)}` (`styles.css:568-569`), y además `maxHeight: caja.h` en línea (`SettingsSheet.tsx:67`). Hay tres límites de alto distintos.
7. **CSS muerto que confunde.** Unas 200 líneas de selectores que ya no existen en el JSX:
   - `.stage`, `.side`, `.scene`, `.glass-frame`, `.glass-canvas`, `.grabber`, `.pause-*` y todo el bloque `.intro-*`.
   - Las variables `--sheet`, `--shadow` y `--sheet-edge`, que se definen en 7 bloques y nadie usa.

   Son `styles.css:108-147`, `387-454`, `636-645` y `1102-1188`.

**Por qué vuelve a romperse:**
- Cada ronda añade otra regla más específica (`.vidrio .x`) en lugar de quitar la original.
- Hay tres juegos de variables para el mismo papel: `--pill`, `--chip-on`, `--mode-on`, `--vidrio-pastilla-on`…
- Nadie mira el CSS compilado.

### 2.2 Reloj: colores y halo

**Qué hace:**
- `.time` en peso 200, color `var(--time)`. Es `#4a4038` (marrón gris) en el modo claro de los tres temas y `#f3ece4` en el oscuro de los tres (`temas/*.css`).
- El halo es `.halo` con `background: var(--halo)` (crema `rgba(255,252,246,.7)` o casi negro), `backdrop-filter: blur(18px)` y una máscara radial (`styles.css:227-238`).

**Defectos:**
1. Sin `backdrop-filter` (causa 1), el halo es **una mancha crema u oscura** de opacidad `0,6 × 0,7`, sin desenfoque. Se ve en `390x844-*.png` como una elipse clara detrás de los números.
2. El color de la hora no sale de la escena. El mismo marrón sirve para Lluvia (fría y verde) y para Arena (cálida), y el halo crema es igual en todos.
3. La caja del halo cambia de tamaño según el layout:
   - En ancho, `.readout` tiene `transform` y hace de contenedor del `position:absolute`.
   - En estrecho no lo tiene, y el halo toma la caja `.reloj` entera.

   Son `styles.css:463-466` y `TimeReadout.tsx:37`.
4. `test/temas.test.mjs:60-74` comprueba `modo.ui.hora`, que no se pinta. El color real es `--time`.

### 2.3 Colocación (ancho y estrecho)

**Qué hace:**
- `calcularLayout(ancho, alto, menuAbierto)` es pura y no depende del tema. Bien.
- En ancho: el frasco mide `alto*0.7` con el pie en (0,3·ancho, 0,8·alto), y el reloj va en x = 0,56·ancho, a la altura del frasco.
- En estrecho: el reloj va abajo, el menú sube desde abajo y el frasco se encoge en el hueco que queda.

**Defectos:**
1. **El menú no se mide** (causa 7). `menuAlto` está fijo: `Math.min(364, Math.max(328, alto*0.42))` en estrecho (`calcularLayout.ts:82`) y `min(alto*0.42, …)` en ancho (`:74`). En `main` se mide el panel real y se pasa como `--menu-pad` (`main App.tsx:266-276`). Por eso allí no se corta.
2. **Dos fuentes para la hora:** su caja en JS (`relojAlto = max(168, frasco.h*0.34)`) y su letra en CSS (`clamp(2.7rem, min(6.8vw,14vh), 7.25rem)`). Si cambia una, la otra no se entera.
3. **Dos mecanismos para subir el reloj** con el mismo tope de 12 px: `relajar` (`calcularLayout.ts:45-52`) y `useClockLift` (mide el DOM, `useClockLift.ts:27-28`). Se suman.
4. El pie del frasco está escrito dos veces: `0.979` en `App.tsx:189` y `JAR_FOOT_Y = 0.9787` en la tabla.
5. Hay unos 45 números mágicos sin nombre en `calcularLayout.ts` (0.3, 0.8, 0.7, 0.34, 0.56, 0.36, 22, 48, 0.84, 0.54, 0.4…).
6. El encuadre del fondo en estrecho (`encuadre.ts`) apoya el ancla en el pie. En Lluvia a 390×844 el orbe queda cortado en el borde y el frasco «flota» sobre el agua (`390x844-lluvia-light.png`). El ancla se pensó para ancho.

### 2.4 Frasco: dibujo y luz

**Qué hace:** se dibuja `jar-back`, encima el contenido y luego `aplicarLuz`: una hoja con degradado y foco recortada al vidrio, en modo `overlay`, y `jar-front` teñido en modo `screen`. Todo **dentro de `rotate(ángulo)`** (`dibujo.ts:39-66`).

**Defectos:**
1. **La luz gira con el frasco.** La dirección `luz.direccion` debería ser la de la escena (el mundo), pero se aplica en coordenadas del frasco. Al voltearlo, el brillo cálido pasa al lado contrario de la lámpara.
2. **El tinte tapa el contenido.** El `overlay` de `aplicarLuz` cubre la hoja entera, agua y arena incluidas, con `alpha = min(0.95, 0.32 + fuerzaTinte·0.72)`:

   | Tema y modo | Tinte | Alpha del overlay |
   |---|---|---|
   | Lluvia claro | `#ffe0b0` | 0,84 |
   | Lluvia oscuro | `#ff8a2a` | 0,95 |

   **Esta es la causa del agua marrón** (`luzAplicar.ts:47-73`).
3. Hay 58 números mágicos en `luzAplicar.ts` (0.62, 0.55, 0.34, 0.3, 0.2, 0.22, 0.42, 0.7…) que mezclan geometría y estilo.
4. `vidrioDeReserva` (`dibujo.ts:75-85`) pinta dos elipses mientras no llegan los 456 KB de capas. Con conexión lenta se ve un frasco falso.

### 2.5 Agua: forma, inclinación y chorro

**Qué hace.** `fisica/agua.ts` hace lo siguiente:
1. Reconstruye un contorno de 36×2 puntos por bulbo a partir de `jarTable.json`, una tabla de [y, volumen acumulado].
2. Busca por bisección la recta perpendicular a la gravedad que deja el «área» pedida.
3. Recorta con Sutherland-Hodgman y convierte a la foto con `aFoto`.

Después, `contenido.ts` rellena el polígono con un degradado fijo y lo pasa por la máscara real (`destination-in`).

**Defectos verificados:**
1. **El contorno no es el del frasco.** `contorno()` usa como radio `dV/dy` (`agua.ts:48`). En un cuerpo de revolución `dV/dy ∝ r²`, así que lo que se dibuja es **r²**, no r. Lo he medido contra `jar-mask.webp`:

   | y (foto) | Medio ancho del agua | Medio ancho real (máscara) | Relación |
   |---|---|---|---|
   | 0,092 | 0,335 | 0,385 | 0,87 |
   | 0,279 | 0,313 | 0,371 | 0,84 |
   | 0,341 | 0,171 | 0,275 | **0,62** |
   | 0,403 | 0,046 | 0,143 | **0,32** |
   | 0,569 | 0,050 | 0,148 | **0,34** |
   | 0,891 | 0,347 | 0,391 | 0,89 |

   Con `sqrt(dV/dy)` coincide con la máscara al milímetro (0,385; 0,437; 0,429; 0,372; 0,275; 0,143). La máscara después solo puede **recortar**, no rellenar. Por eso el agua no llega al cristal en los hombros ni en el cuello. El truco de r² hace que «área 2D = volumen» con el frasco derecho, pero deforma la figura.
2. **El espacio está estirado** (causa 3). `aFoto` (`:156-162`) usa `medioAncho = 0,44·W` para x y `alto = 1,0·W` para y. La normal real en píxeles es `(sinθ/0,44, cosθ)`, y el error sobre la horizontal del mundo queda así:

   | Ángulo | 10° | 20° | 30° | 45° | 60° | 90° | 120° | 150° |
   |---|---|---|---|---|---|---|---|---|
   | Error | 11,8° | 19,5° | **22,6°** | 21,2° | 15,7° | 0° | −15,7° | −22,6° |

   Se confirma en `rot-sheet.png`: con 30°, 60° y 150° la superficie del agua está inclinada, y la arena (rejilla de celdas cuadradas) queda horizontal.
3. **El test valida el error.** `test/agua.test.mjs:30-36` gira los puntos en coordenadas de foto normalizadas (0..1 en cada eje), que es el mismo espacio estirado, y comprueba que la «banda» mide < 0,02. Por eso pasa.
4. **Lluvia del cuello:** `lluvia()` pinta 7 trazos en la hoja del frasco (`contenido.ts:143-161`), que va dentro del `rotate`. Al inclinar caen en el eje del frasco, no en vertical. `cuelloMojado` usa el mismo espacio estirado.
5. **Colores escritos a mano en el dibujo** (`contenido.ts:108-115` y `136`), en contra de la regla 2 de la especificación.
6. `lineaMenisco` mete un apaño: limita `gy` a 0,08 (`agua.ts:222-225`) y busca el radio por el punto más cercano.

**Lo que ya existe y sirve:**
- `public/frasco/jar-mask.webp` (891×2048, 31 KB) es la **máscara real del interior**. Coincide con `jar-back` en tamaño y proporción (0,43506) y cubre del 3,03 % al 95,46 % del alto.
- Ya se carga y se convierte en canal alfa (`activos.ts:50-60`). Solo se usa al final como recorte.

### 2.6 Arena

**Qué hace:** usa `SandSimulation` del core, con 161 columnas × 371 filas y **17.292 granos**.
- En reposo, la arena se coloca según el tiempo.
- En marcha, `syncSandToTarget` + `step`.
- Inclinada, ejecuta `sim.arrange(...)` **en cada fotograma** (`useFrasco.ts:137-139`).

**Defectos:**
1. **El perfil de la rejilla no es la foto.** `CLASSIC_MODEL.profile` es más ancho que la máscara:

   | y (frasco) | Rejilla | Máscara | Diferencia |
   |---|---|---|---|
   | 0,081 | 0,425 | 0,37 | +15 % |
   | 0,162 | 0,488 | 0,44 | +11 % |
   | 0,404 | 0,202 | 0,116 | **+74 %** |
   | 0,566 | 0,134 | 0,174 | |

   La arena que cae fuera de la máscara se recorta. Lo dibujado no es lo simulado y el cuello visual no coincide con el de la rejilla.
2. **Inclinar no es física.** `arrange` recoloca toda la arena en su sitio final en cada fotograma, ordenando las 17 k celdas por la nueva gravedad. Sale un teletransporte y no avalanchas, aunque la especificación (6.3) pedía avalanchas.
3. **La luz de los granos gira con el frasco** (`teñirGrano` usa `nx, ny` locales, `granos.ts:67-84`).
4. **Coste** (sección 4): un `arc` + `fill` y un `fillStyle` en texto por grano (`granos.ts:103-122`). En el móvil, con DPR 2-3, la hoja intermedia mide W·DPR, pero los granos tienen el tamaño de su celda: de ahí el aspecto de bloques.

### 2.7 Nube (vídeo)

**Qué hace:**
- Usa `nube.webm` (VP9 `gbrp`, 1,1 MB) o `nube.mp4` (276 KB).
- Cada fotograma nuevo se dibuja en un canvas de 480×192, se lee con `getImageData`, pasa por `alphaFromBlack` y se pinta dos veces (una copia detrás al 38 %) (`nube.ts:22-41`, `:72-99`).
- Se apaga según el ángulo y sube al inclinar.

**Defectos:**
1. **El bucle no se duerme.** Mientras la nube se reproduce, `seguir` siempre es cierto (`useFrasco.ts:197-206`): 60 fps de canvas a pantalla completa aunque nada cambie (35 callbacks en 2 s con el reloj parado, medido). Además hay una lectura de GPU a CPU en cada fotograma de vídeo.
2. **El bucle del vídeo no es limpio.** La diferencia media entre el último y el primer fotograma es 1,69, frente a 0,27 entre dos fotogramas seguidos (6×). Hay un pequeño salto en cada vuelta de 6 s.
3. **El fotograma oscuro y la vibración: no los he podido reproducir sin GPU.**
   - Hipótesis comprobable para el fotograma oscuro: al volver al principio, el navegador puede dar un fotograma no decodificado (negro), y `alphaFromBlack` lo vuelve transparente durante un fotograma.
   - Para la vibración: la caja de la nube sale de cálculos con decimales y se repinta cada fotograma, así que se redondea distinto según el subpíxel.
   - Cómo verificarlo: grabar con `requestVideoFrameCallback` y registrar `readyState`, `currentTime` y el alfa medio de `clave` en cada fotograma.

   El póster coincide con el primer fotograma del vídeo (diferencia media de 2/255), así que no es él.
4. **Estado global del módulo** (`nube.ts:5-9`): `clave`, `ultimoTiempo` y `asiento` se comparten entre montajes y el asiento se mide una sola vez.
5. Números mágicos: 0,11, 0,62, 0,08, 0,84, 0,12, 0,38 y `Math.sin(Math.PI/5)`.

### 2.8 Cambio de tema

**Qué hace:** `setTemaId` → nuevo `modo` → `Fondo` y `Lienzo` reciben otras props. `useFrasco` relee `vivo.current` en cada fotograma, y `pedir.current()` lo despierta en cada render (`useFrasco.ts:56-58`).

**Defectos:**
1. **El vídeo no cambia entre dos temas oscuros** (causa 6, comprobado). Lluvia oscuro → Arena oscuro: `<source>` = `arena-oscuro.*` pero `currentSrc = lluvia-oscuro.webm`, con opacidad 1. Se ve la escena de Lluvia con la arena dentro del frasco (`switch-arena-dark.png`). Se arregla con `key={fondo.webm}` en el `<video>` o con `video.load()`.
2. El estado del tema está repartido entre `useState` (App), `localStorage`, `data-tema`, `vivo.current` (`useFrasco`), los globales de módulo (`nube.ts`, la hoja de `contenido.ts`, la placa de `luzAplicar.ts`) y una firma en texto (`useFrasco.ts:124`). No hay una función «aplicar tema» que lo cambie todo a la vez.
3. `assetLoader.ts:76` (`activo !== 'lluvia'`) es un caso especial por tema fuera de la configuración del tema.

### 2.9 Carga y rendimiento de red

Ver la sección 4. Resumen de defectos, todos en `medios/assetLoader.ts` y `frasco/activos.ts`:
1. `urlsDeFondo` precarga **todos los formatos** (`:54-65`). El navegador solo usará uno.
2. `ARENA_TEXTURA` (`tex-sand.webp`, 464 KB) se precarga y se descarga, pero ningún código la pinta. `activos.arena` solo se comprueba para no volver a pedirla.
3. `NUBE_VIDEO` es el WebM de 1,1 MB (4× el MP4) y se precarga también en Arena y Clásico (`:76`).
4. `nube.webp` y las tres capas del frasco se piden siempre, aunque la nube solo exista en Lluvia.
5. Las capas del frasco miden 891×2048. En pantalla el frasco mide unos 630 px de alto a 1440×900 (1.260 con DPR 2) y unos 355 px en el móvil.
6. Tres bucles de píxeles sobre 1,8 M píxeles en el hilo principal al cargar (`activos.ts:37-60`).
7. El efecto de precarga (`App.tsx:87-91`) vuelve a inyectar `<link>` en cada cambio de tema o modo.
8. Los archivos `jar-shadow.webp`, `tex-water.webp` y `tex-agua.webp` están en `public/` y no se usan.

### 2.10 Idiomas

Hay tres fuentes de textos:
- `messagesFor` del core: el menú.
- `copy.ts`: 11 ternarios `es ? … : …`.
- Textos escritos en español en los componentes:
  - `Pausa.tsx:9`: «En pausa».
  - `SettingsSheet.tsx:90, 97`: «Escena».
  - `SettingsSheet.tsx:300`: «Activado» y «Silencio».

En inglés, el pie a lo estrecho muestra «Cookies» dos veces (`copy.ts:50, 54`). El botón de idioma ha vuelto (`SettingsSheet.tsx:286-294`), pero la pausa y la escena siguen en español en la interfaz inglesa.

### 2.11 Pie de página: ocultarse solo

**Qué hace:** `useBotonMenu` devuelve `visible` (3 s sin moverse). El pie y el botón reciben `is-on`.

**Defecto:** `.app:hover .menu-btn` y `.app:hover .site-footer` ponen `opacity: 1` (`styles.css:515`, `:862`). Como `.app` ocupa toda la pantalla, **con el ratón dentro de la ventana nunca se ocultan**: el temporizador de 3 s no sirve de nada. Solo se ocultan al salir de la ventana. En pantallas táctiles quedan siempre a 0,9 (`:526-531`). Dos mecanismos para lo mismo.

### 2.12 Páginas legales

1. **El generador va en círculo.** `legal/generar.mjs:63-69` **lee** `public/*.html` (su propia salida), escribe `legal/textos/*.html` (que en realidad son JSON) y vuelve a escribir `public/*.html`. Si editas `textos/`, el cambio no llega a ningún sitio: la fuente de verdad sigue siendo la salida.
2. `legal.css` tiene sus propios colores verdes y su propio modo oscuro por `prefers-color-scheme` (ver 2.1).

---

## 3. Tests: qué hay y qué falta

`npm test` en `apps/web`: **27 de 27 en verde** (1,2 s). ESLint está limpio.

| Archivo | Qué comprueba de verdad | Qué se le escapa |
|---|---|---|
| `agua.test.mjs` | El signo de la gravedad; que la «banda» de la superficie sea < 0,02 **en coordenadas de foto normalizadas**; el volumen dibujado ≈ el pedido (±1 %) **en el área del contorno r²** | La forma real del frasco y la horizontal en píxeles. Valida la misma deformación que el código |
| `frasco.test.mjs` | Que el volteo termina en 0 y la continuidad de un punto girado 180° | Que el fotograma de antes y el de después sean iguales en píxeles |
| `nivel.test.mjs` | Nivel proporcional al tiempo; `topCount` de la simulación = objetivo | Lo que se ve tras la máscara |
| `layout.test.mjs` | Que las cajas no se solapan; que la hora sube al abrir el menú | El alto real del menú y de la hora (no hay DOM) |
| `reloj-contraste.test.mjs` | El contraste de `--time` sobre píxeles del fondo (bien); que **el texto de `styles.css` contiene** `.vidrio .pill-fill … color: var(--pill-ink)` (regex) | La cascada real: gana `.chip.chip-on`. Y el CSS **compilado** |
| `temas.test.mjs` | Contraste de `modo.ui.*`, la luz de Clásico y la migración «claro → clásico» | `modo.ui.hora` y `pista` no se pintan; el color real es `--time` |
| `carga.test.mjs` | El orden de la cola de precarga; nada de vídeo con Save-Data; **que se precargue `tex-sand`** | Bytes totales, formatos duplicados y que `tex-sand` no se usa |
| `consent`, `gtag-queue`, `android-promo`, `stage-click` | Lógica pura: bien | — |

**Sin cubrir:**
- **No hay ni una prueba visual.**
- Nada prueba el build de producción.
- Nada prueba el cambio de tema con vídeo.
- Nada prueba el frasco girado en píxeles, el desenfoque calculado, si el menú se corta o el tamaño de la descarga.

En `packages/core` hay 250 tests con un 98 % de cobertura, y está bien.

---

## 4. Rendimiento

### 4.1 Bundle (`npm run web:build`, Vite 8.3.5)

| Archivo | Tamaño | gzip |
|---|---|---|
| `index-*.js` | 322,8 KB | 106,2 KB |
| `index-*.css` | 57,0 KB | 24,2 KB |
| Fuentes Manrope | 5 pesos × 6 subconjuntos (woff2 + woff) | Solo baja latin, unos 14 KB por peso |

- **JS por origen:** react-dom es el grueso (620 KB de fuente sin minificar). Del core, `sim` 50 KB, `session` 17 KB e `i18n` 13 KB. `jarTable.json` mete 10 KB en el bundle.
- **CSS:** 35 KB de los 57 son 30 `@font-face`, y bloquean el primer pintado. Con 2-3 pesos y solo latin bajaría a unos 8 KB.

### 4.2 Imágenes y vídeos (`apps/web/public`)

| Recurso | Peso | Comentario |
|---|---|---|
| `frasco/jar-back.webp` 891×2048 | 313 KB | Necesario antes de ver el frasco; demasiado grande para 355-630 px de alto |
| `frasco/jar-front.webp` | 112 KB | Se procesa píxel a píxel al cargar |
| `frasco/jar-mask.webp` | 31 KB | **Máscara real del interior**; se infrautiliza |
| `frasco/tex-sand.webp` 1024² | 464 KB | **No se usa**, pero se descarga y se precarga |
| `frasco/tex-water.webp`, `tex-agua.webp`, `jar-shadow.webp` | 107 + 9 + 6 KB | No se usan |
| `nube/nube.webm` (VP9 gbrp) | **1.145 KB** | 4× el MP4; es el que eligen Chrome y Firefox |
| `nube/nube.mp4` | 276 KB | |
| `nube/nube.webp` | 28 KB | Se descarga en todos los temas |
| `fondos/*.avif` | 1,5-24 KB | Bien |
| `fondos/*.webp` | 8-117 KB | |
| `fondos/arena-oscuro.webm` / `.mp4` | 167 / 222 KB | 1280×720, 11,5 s |
| `fondos/lluvia-oscuro.webm` / `.mp4` | 77 / 91 KB | 1280×720, 2 s |

**Lo que se precarga en segundo plano** (calculado con `urlsPrefetch`):

| Tema | Total | Formatos redundantes |
|---|---|---|
| Lluvia | 1,2 MB | ~0,5 MB |
| Arena | 1,7-2,0 MB | ~0,4-0,6 MB |
| Clásico | 2,0 MB | ~0,6 MB |

Lluvia precarga además `tex-sand`, y Arena y Clásico `nube.webm`.

**Lo que retrasa ver la escena:**
- El CSS con las fuentes.
- El JS de 106 KB gzip.
- Después, el frasco espera 456 KB de capas y tres bucles de 1,8 M píxeles en el hilo principal.

El fondo activo sí sale primero, y con un color de reserva.

### 4.3 Coste por fotograma (medido)

Chromium sin GPU (raster por software), 1440×900, reloj en marcha. Es el tiempo de JS + comandos de canvas dentro del callback de `requestAnimationFrame`:

| Tema | DPR 1, mediana / p95 | DPR 2, mediana / p95 | Con el reloj parado |
|---|---|---|---|
| Arena | 39,1 / 43,9 ms | 40,8 / 44,2 ms | se duerme (bien) |
| Clásico | 40,2 / 49,0 ms | 39,1 / 41,7 ms | se duerme |
| Lluvia | 10,5 / 13,9 ms | 15,7 / 22,9 ms | **no se duerme**: 35 fotogramas en 2 s con el reloj parado |

Las cifras sin GPU son pesimistas en valor absoluto, pero el reparto es claro:
- En Arena el coste lo pone `pintarGranos`: 17 k `arc` + `fill` + un `fillStyle` en texto, `granos.ts:103-122`.
- Le siguen `aplicarLuz` con 2 hojas a tamaño de frasco y 4 `drawImage` con modos de mezcla, y el `destination-in` de la máscara.
- Al inclinar se suma `sim.arrange` por fotograma.

**Cómo bajarlo:**
- Pintar los granos en un `ImageData` (un píxel por celda, `paintCells` ya existe en `granos.ts:35-49`) y escalarlo una vez.
- Que la luz de los granos sea un degradado encima, no un cálculo por grano.

---

## 5. Arquitectura recomendada: lo más simple, con una sola fuente de verdad

### 5.1 Principios

1. **Una geometría:** la máscara real `jar-mask.webp`. Nada de contornos reconstruidos ni perfiles distintos.
2. **Un objeto por tema y modo** que lo defina todo: fondo, luz, contenido y tokens de interfaz. El CSS **sale** de ese objeto, no al revés.
3. **Una función de colocación que recibe medidas**, no que las adivina.
4. **Dibujar en el espacio del mundo** todo lo que depende de la gravedad o de la luz. Solo el vidrio gira.
5. **Probar el píxel en el build de producción**, no la idea.

### 5.2 Tokens y temas

```ts
// temas/tipos.ts — lo único que cambia entre temas
interface ModoTema {
  fondo: Fondo;                 // { poster, avif?, webp, video?: { webm, mp4 } }
  colorReserva: string;         // sustituye a COLORES por URL
  luz: Luz;                     // dirección EN EL MUNDO, tinte, brillo…
  contenido: { tipo: 'agua' | 'arena'; color: string; opacidad: number };
  ui: { tinta: string; tintaSuave: string; hora: string; pista: string; halo: string; barra: string };
}
```

- `aplicarTema(app, modo)` escribe `--tinta`, `--hora`, `--halo`… como variables en `.app`. Es **la única** fuente. Se borran `temas/*.css` y el `:root` de colores, y desaparecen `UiTema` en TS duplicado, `--pill`, `--chip-on`, `--mode-on`, `--track`, `--sheet`, `--shadow` y `--sheet-edge`.
- **El vidrio son tokens globales, sin color de tema:** `--vidrio-blur: 32px`, `--vidrio-velo-claro: rgba(255,255,255,.06)`, `--vidrio-velo-oscuro: rgba(0,0,0,.22)`, `--vidrio-borde`, `--vidrio-pastilla`, `--vidrio-pastilla-on`.
- **Un único componente de superficie**, `.vidrio`. Los controles de dentro tienen **un solo** estilo base (`.control`, `.control[aria-checked=true]`), sin variantes `.chip`/`.pill`/`.choice` con fondos propios. Se borran las reglas que compiten.
- En CSS solo `backdrop-filter` (sin el `-webkit-` a mano: lo añade Lightning CSS). Y en `vite.config.ts` se fijan los navegadores objetivo (`css.lightningcss.targets` o `browserslist`) para que la salida sea predecible.

### 5.3 Colocación

```ts
calcularLayout({ ancho, alto, menuAbierto, altoMenu, altoReloj }) → Layout
```

- `altoMenu` y `altoReloj` se **miden** con `ResizeObserver` sobre el panel y la hora, como hace `main` con `--menu-pad`, y se pasan a la función pura.
- Se borran `relajar`, `useClockLift` y `overflow: hidden`. Si no cabe, el panel hace scroll de verdad, y el layout garantiza que cabe en los tamaños probados.
- El tamaño de letra de la hora sale del layout (una variable `--hora-px`), no de `vw/vh` aparte.
- Los números mágicos pasan a constantes con nombre en un único `layout/medidas.ts`.

### 5.4 Frasco

```
mundo (sin rotar)                          frasco (rotate θ)
─────────────────                          ─────────────────
1 sombra                                   2 jar-back
3 contenido:                               5 jar-front (reflejos) + luz
  - hoja del tamaño del frasco en pantalla
  - agua: rellenar el semiplano "debajo de la recta horizontal y = h(θ, volumen)"
          EN PANTALLA, luego destination-in con la MÁSCARA GIRADA θ
  - arena: ImageData de la rejilla (1 px/celda), escalada y girada,
           destination-in con la máscara girada
4 chorro / lluvia del cuello (vertical, en el mundo)
6 nube (sin rotar)
```

**Agua: nivel correcto con el frasco inclinado.** Se precalcula una vez, al cargar, el área de la máscara **girada** por debajo de cada altura:
- Una tabla 2D `ángulo (0..180°, cada 2°) × altura → área`, sacada de los píxeles de la máscara (~60×256 valores, o en un Worker).
- En cada fotograma, la altura de la superficie sale de interpolar en esa tabla.
- El agua toma la forma exacta del cristal porque **es** la máscara, y la superficie es horizontal en pantalla por construcción.
- Esto sustituye a `jarTable.json`, a `contorno`, `recortar`, `lineaDeCorte` y `lineaMenisco` (unas 250 líneas) y a sus apaños.

**Arena:**
- O se genera el perfil de la `SandSimulation` **a partir de la misma máscara** (una celda vale si la máscara está > 50 % en su centro), o se adapta el perfil a la máscara y se comprueba con un test (máximo un 2 % de diferencia por fila).
- Al inclinar: `sim.step(gravedad)` (física), no `arrange` en cada fotograma.

**Luz:**
- El degradado de la escena se pinta en el mundo, **por encima** del vidrio y recortado a la silueta (`jar-back` girado).
- El tinte de la escena **no** toca el agua. El agua tiene su propio `contenido.color` en el tema.

**Bucle:**
- Se duerme cuando no hay nada en movimiento.
- La nube: o un `<video>` en el DOM con máscara CSS (sin leer píxeles), o un vídeo con canal alfa ya preparado (WebM VP9 con alfa o HEVC con alfa). Así se quitan `alphaFromBlack` por fotograma y el bucle a 60 fps.

### 5.5 Fondo y carga

- `<video key={src}>`: un vídeo nuevo por fuente, con fundido sobre el póster.
- Precarga **un solo formato por recurso**, el que el navegador vaya a usar (`canPlayType`, AVIF con `<link rel=preload imagesrcset>`). Sin texturas sin usar.
- La nube solo en Lluvia, y en MP4 o un WebM más ligero (no `gbrp`).
- Capas del frasco a 1024 px de alto (~¼ de los bytes) más una versión a 2048 para DPR ≥ 2 en pantallas grandes. La máscara y `jar-front` se preparan con el alfa ya listo en el archivo, sin bucle en el hilo principal.
- Fuentes: 2-3 pesos, solo latin y latin-ext, con `font-display: swap`.
- Se borran `tex-sand`, `tex-water`, `tex-agua` y `jar-shadow` si no se usan.

### 5.6 Textos

- Un único sistema: los `messages` del core, con todo lo de `copy.ts`, «En pausa» y «Escena» incluidos.
- Las páginas legales: fuente **de verdad** en `legal/textos/{es,en}/*.md|html`. El generador lee **solo** de ahí y escribe en `public/`, y un test comprueba que `public/` está al día.

### 5.7 Pruebas visuales para que lo arreglado no se rompa

**Herramienta:** Playwright (`@playwright/test`) contra **`vite build && vite preview`**, nunca contra `dev`. Ese es el agujero de la causa 1.

**Determinismo:**
- Un parámetro de prueba (`?prueba=1`, solo en build de test) que:
  - congela el reloj (`page.clock.install({ time: … })` y `pauseAt`);
  - fija la semilla de la simulación (ya existe: `seed: 11`);
  - pausa los vídeos en un fotograma fijo (`currentTime = 0.5`; `video.pause()`);
  - desactiva las transiciones CSS (`* { transition: none !important; animation: none !important }` inyectado solo en test).
- Mismas fuentes (las de Fontsource, empaquetadas), `deviceScaleFactor` 1 y 2, `colorScheme` claro y oscuro.
- `toHaveScreenshot({ maxDiffPixelRatio: 0.002 })`, con imágenes de referencia aprobadas por Sebastián y guardadas en el repo.

**Matriz:**

| Eje | Valores |
|---|---|
| Tema | Lluvia, Arena, Clásico |
| Modo | claro, oscuro |
| Tamaño | 1440×900, 1280×720, 1024×768, 768×1024, 390×844, 480×360 |
| Estado | parado; menú abierto (sencillo y ciclos personalizados); en pausa; banner de cookies; popup Android; panel legal |
| Giro (pantallazo del frasco) | 0°, 30°, 90°, 150° (agua y arena) |
| Cambio de tema | Lluvia oscuro → Arena oscuro → Clásico oscuro, sin recargar |

**Comprobaciones que no son captura** (más baratas y que dicen *por qué* falla):
- `getComputedStyle('.sheet').backdropFilter` contiene `blur(` (falla hoy).
- El fondo de los controles de `.vidrio` no tiene tono: |R−G|, |G−B| < 3 (falla hoy).
- `.sheet.scrollHeight <= .sheet.clientHeight + 1` en todos los tamaños (falla hoy).
- `video.currentSrc` contiene el id del tema activo tras cambiarlo (falla hoy).
- Agua girada: en la captura del frasco a 30°, la frontera entre agua y aire, medida por columnas, tiene una pendiente < 1° (falla hoy: ~22°). Y el agua toca la máscara en los bordes: < 2 px de hueco entre la máscara y el agua bajo la superficie (falla hoy).
- Presupuesto de bytes: lo que se descarga hasta `load` en Lluvia claro es menor que X KB. La precarga no repite formatos.
- El CSS compilado contiene `backdrop-filter:` sin prefijo (un `grep` en `dist/`).

**Regla de trabajo:** un PR no entra si cambia una captura de referencia sin que Sebastián apruebe la nueva. Un cambio en el menú que mueva el frasco aparece como diferencia y se para.

---

## 6. Cómo repetir cada medida

```bash
cd /tmp/hgp && npm ci && npm run web:build
cd apps/web && npx vite preview --port 4173 &     # producción local
npx vite --port 5179 &                             # dev, para comparar
cd /workspace/proyectos/hourglass-review/auditoria-rama/scripts
# requiere playwright (npm i playwright@1) con chromium instalado
node dev.js      # backdropFilter: dev = blur(32px), preview = none
node aud.js      # 3 tamaños × 3 temas × 2 modos: capturas + estilos calculados
node rot.js      # giro 30/60/90/150° en Lluvia y Arena
node switch.js   # Lluvia oscuro → Arena oscuro: currentSrc sigue en lluvia
node perf2.js    # ms por fotograma y bucle dormido o no
```
