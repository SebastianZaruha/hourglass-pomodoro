# Hourglass web: especificación definitiva (v2)

**Para:** Sebastián · **Estado:** borrador, pendiente de tu aprobación · **Fecha:** 12 nov 2026
**Rama:** `feature/web-escenas` (commit de partida `25fca17`). Solo cambia `apps/web`. El core y la app móvil no se tocan.
**Sustituye a:** `ESPECIFICACION-WEB.md`. Si algo choca, manda este documento.
**Base:** `AUDITORIA-RAMA.md` (10 causas raíz medidas), `AUDITORIA-MAIN.md`, tu vídeo v4, la revisión de la preview en el navegador y tus decisiones de hoy.

Va ordenado así: primero por qué se rompía todo (1), luego las normas que lo impiden (2), después cómo debe verse y comportarse cada cosa (3), cómo se comprueba (4 y 5) y en qué orden se hace (6).

---

## 1. Por qué se rompía todo

Lo que volvía a romperse no era mala suerte. Tenía diez causas de fondo, y casi todas comparten un patrón: **la misma cosa estaba definida en varios sitios, y se comprobaba en un sitio que no es el que tú ves.**

| # | Qué pasaba | Qué veías tú |
|---|---|---|
| 1 | **El build de producción borraba el desenfoque.** El CSS ponía `backdrop-filter` y `-webkit-backdrop-filter` a la vez, y el minificador se quedaba solo con el segundo, que Chrome y Firefox ignoran. En `vite dev` sí había desenfoque, así que el agente lo veía bien. | El menú «no es vidrio» y no se lee. El halo del reloj es una mancha. Parece que «se arregló» y «se volvió a romper». |
| 2 | **Había cuatro dibujos distintos del mismo frasco.** El agua usaba un contorno calculado mal (el radio al cuadrado), la arena otro perfil más ancho que la foto, el clic una fórmula inventada y el frasco provisional dos elipses. La máscara real del interior ya estaba en el proyecto y solo se usaba para recortar al final. | El agua no llena el cristal: deja huecos en los hombros, en el cuello ocupa un tercio del ancho y abajo flota un óvalo. La arena se recorta contra la pared. |
| 3 | **El agua se calculaba en un espacio estirado** (el ancho y el alto con escalas distintas). «Horizontal» salía torcido hasta 22,6°. El test usaba el mismo espacio estirado, así que pasaba. | El agua se inclina mal al girar aunque «estaba arreglado». |
| 4 | **La luz y el agua se pintaban en el espacio del frasco, no en el del mundo.** El tinte cálido de la escena se pintaba encima de todo, agua incluida, al 84-95 %. | El agua parece marrón. Los brillos giran con el frasco y quedan en el lado contrario a la lámpara. |
| 5 | **Cada color tenía tres copias** (en TypeScript, en `temas/*.css` y en `styles.css`), y las reglas CSS se pisaban por especificidad y por orden. | Pastillas del menú teñidas, botones con color del tema, colores que «vuelven» tras arreglarlos. |
| 6 | **El vídeo de fondo no cambiaba entre dos temas que usan vídeo.** React reutilizaba el mismo `<video>` y el navegador ignora el cambio de fuente sin `load()`. | En Arena oscuro se ve el fondo de Lluvia. |
| 7 | **La colocación adivinaba en vez de medir.** La altura del menú era un número fijo, el tamaño de la hora estaba en CSS y su caja en JS, y había dos mecanismos para subir el reloj que se sumaban. | El menú corta la última fila, el reloj pisa el frasco en anchos intermedios o tapa el aviso de Android, el pie se corta. |
| 8 | **No había ni una prueba visual ni de la versión de producción.** Los 27 tests pasaban con el desenfoque roto, el agua torcida y el vídeo equivocado. | Nada avisaba antes de que lo vieras tú. |
| 9 | **La carga bajaba de más y en mal orden.** Todos los formatos de cada fondo, una textura de 464 KB que no se usa, la nube de 1,1 MB en todos los temas y capas del frasco de 2048 px procesadas píxel a píxel. | Lento con internet malo; el fondo llega tarde. |
| 10 | **El dibujo era caro y no se dormía.** 17.292 granos pintados uno a uno en cada fotograma (unos 40 ms, el presupuesto es 16,7). Al girar, la arena se recolocaba entera en cada fotograma, sin física. En Lluvia el bucle seguía a 60 fps sin hacer nada. | Tirones al girar, la arena se mueve como un bloque rígido, va lento. |

**Tres reglas que se sacan de aquí** y que ordenan todo lo demás:
1. **Cada cosa se define en un solo sitio** (color, geometría, posición).
2. **Se comprueba en el build de producción**, nunca en `dev`.
3. **Se prueba el píxel, no la idea.** Un test que usa la misma fórmula que el código no prueba nada.

---

## 2. Normas universales

Son obligatorias en todo el código de `apps/web`. Varias se comprueban solas (lint o test), para que no dependan de la memoria de nadie.

### N1. Una sola fuente de verdad por tema y modo

- Cada tema es **un archivo TypeScript** (`temas/lluvia.ts`, `temas/arena.ts`, `temas/clasico.ts`) con un objeto `claro` y otro `oscuro`.
- De esos objetos se **genera** todo lo demás:
  - las variables CSS (`--hora`, `--tinta`…), que `aplicarTema()` escribe en `.app`;
  - los colores del lienzo (agua, granos, luz);
  - el color de reserva del fondo;
  - el `<meta name="theme-color">`;
  - los tokens de las páginas legales (el generador legal importa los mismos objetos).
- **Se borran:** `temas/*.css`, los colores de `:root` y `[data-scheme=dark]`, `UiTema` duplicado, la tabla `COLORES` de `assetLoader.ts` y las variables `--pill`, `--chip-on`, `--mode-on`, `--track`, `--sheet`, `--shadow` y `--sheet-edge`.
- **Comprobación automática:** fuera de `temas/` y de `estilo/tokens.ts` no puede aparecer ningún color literal (`#…`, `rgb(…)`, `hsl(…)`), ni en TS ni en CSS (stylelint `color-no-hex` + una regla ESLint).

Forma del objeto (resumen; el tipo completo vive en `temas/tipos.ts`):

```ts
interface ModoTema {
  fondo: FondoTema;            // foto o vídeo + póster + miniatura borrosa en línea
  reserva: string;             // color mientras no llega nada
  luz: LuzMundo;               // dirección EN EL MUNDO, intensidad, brillo de borde, sombra
  contenido: ContenidoTema;    // agua { color, opacidad } o arena { tonos[], tamaño }
  reloj: { digitos: string; pista: string };
  ui: { tinta: string; tintaSuave: string; velo: string; veloBrillo: number; borde: string };
  barra: string;               // theme-color del navegador
}
```

### N2. Tokens de diseño globales

Lo que **no** cambia entre temas vive una sola vez en `estilo/tokens.ts` (y de ahí sale `tokens.css`):
- espacios: 4, 8, 12, 16, 24, 32, 48 px;
- radios: panel 28 px, control 999 px (cápsula), botón redondo 50 %;
- tipografía: Manrope 200 (dígitos) y 400 / 500 (texto); tamaños de texto 13, 15, 17, 22 px;
- duraciones: rápida 160 ms, normal 360 ms, lenta 620 ms; una sola curva `cubic-bezier(0.33, 0, 0.2, 1)`;
- vidrio: desenfoque, velo, borde (ver N3).

### N3. Un único vidrio

- Una sola clase, `.vidrio`, para **todas** las superficies: menú, cookies, aviso de la app Android y panel legal. No hay variantes.
- Una sola clase de control, `.control`, para todo lo que se pulsa dentro de un vidrio. El estado elegido es `[aria-checked=true]` o `[aria-pressed=true]`. Se borran `.chip`, `.pill`, `.choice`, `.mode-*` y sus fondos propios.
- Detalle en 3.8.

### N4. CSS sin peleas

- Especificidad máxima `0,2,0` (stylelint `selector-max-specificity`). Nada de `.vidrio .x` para «ganar» a otra regla: se borra la regla vieja.
- Cero `!important`.
- Cada componente tiene **su** archivo CSS junto a su `.tsx`, con un prefijo propio (`.menu-…`, `.reloj-…`). `styles.css` queda solo para el reset y el esqueleto.
- Se borra el CSS muerto (unas 200 líneas: `.stage`, `.side`, `.intro-*`, `.pause-*`, `.glass-*`…). Un test con la lista de selectores del JSX lo vigila.
- Los tooltips son un componente (`Tooltip`), no un `::after` global sobre todos los botones.

### N5. Solo `backdrop-filter` sin prefijo, y comprobación del build

- En el código fuente se escribe solo `backdrop-filter`. El prefijo `-webkit-` lo añade el compilador.
- `vite.config.ts` fija los navegadores objetivo (`css.lightningcss.targets`, equivalente a Chrome ≥ 111, Safari ≥ 16, Firefox ≥ 115) para que la salida sea predecible.
- `scripts/comprobar-dist.mjs` se ejecuta tras `vite build` y **falla** si en el CSS compilado alguna regla de `.vidrio` no tiene `backdrop-filter:` sin prefijo.
- stylelint prohíbe escribir `-webkit-backdrop-filter` a mano.

### N6. Una sola función de colocación, con medidas reales

- `layout/calcularLayout.ts` es **la única** que decide dónde va cada cosa. Es pura (datos de entrada → cajas), no conoce el tema y tiene tests.
- Recibe **medidas**, no las adivina: ancho y alto de la ventana, márgenes seguros, altura real del menú, del aviso Android, del banner de cookies y del pie, y las métricas de la fuente de los dígitos. Las mide `useMedidas()` con `ResizeObserver`.
- El tamaño de letra de la hora **sale** del layout (variable `--hora-px`). En CSS no hay `vw`/`vh` para la hora.
- Se borran `relajar`, `useClockLift`, el `overflow: hidden` del menú y los tres límites de alto distintos.
- Todos los números viven con nombre en `layout/medidas.ts`. Disposiciones y tabla en 3.11.

### N7. La física vive en el espacio del mundo y usa la máscara real

- **Una sola geometría del frasco:** `public/frasco/jar-mask.webp`. De ella salen el agua, el perfil de la arena, el cuello, el clic sobre el frasco y la silueta provisional.
- Se borran `jarTable.json`, `contorno`, `recortar`, `lineaDeCorte`, `lineaMenisco`, el perfil `CLASSIC_MODEL` en la web y `vidrioDeReserva`.
- Todo lo que depende de la gravedad o de la luz (superficie del agua, chorro, gotas, luz, sombra, brillo de los granos) se calcula en el **mundo**, en píxeles reales de pantalla con la misma escala en x y en y. Solo el vidrio gira.

### N8. Ningún caso especial por tema fuera de su configuración

- Prohibido `tema === 'lluvia'`, `id !== 'arena'`, `dark ? … : …` o similar fuera de `temas/`. Lo que cambie entre temas es un campo del tema (por ejemplo `nube: true`, `contenido.tipo: 'agua'`).
- Comprobación: una regla ESLint (`no-restricted-syntax`) y un `rg` en el test que debe dar cero.

### N9. Módulos pequeños

- Un archivo, una responsabilidad. Unas 200 líneas como máximo; funciones de 60 como máximo.
- Lógica pura separada del dibujo y de React. El dibujo solo pinta lo que le dan.
- Comentarios en español que explican el porqué.

### N10. Nada se da por arreglado sin prueba del build de producción

- Antes de cada commit se ejecutan los tests visuales contra `vite build` + `vite preview`.
- Un arreglo se da por hecho solo con la captura de producción delante (ver `AGENTS.md`).

---

## 3. Cada elemento: cómo debe verse, cómo se comporta y por qué

### 3.1 Temas y fondos

| Tema | Claro | Oscuro |
|---|---|---|
| **Lluvia** (por defecto) | Diorama de musgo y rocas con charco, luz de día difusa. `lluvia-claro.avif/webp` | Vídeo de 2 s en bucle, orbes cálidos. `lluvia-oscuro.webm/mp4` + póster |
| **Arena** | Diorama de rocas al sol. `arena-claro.avif/webp` | Vídeo de 11,5 s, orbes cálidos. `arena-oscuro.webm/mp4` + póster |
| **Clásico** | Estudio crema con luz suave (`hourglass-assets/clasico-nuevo/clasico-claro.jpg`) | Estudio carbón con un foco cálido (`clasico-nuevo/clasico-oscuro.jpg`) |

- Miel y nieve se **borran** del código, no solo se ocultan.
- El tema se guarda en `localStorage`. Si lo guardado no es válido, Lluvia. Un `claro` antiguo pasa a `clasico`.
- El modo es Automático (sigue al sistema), Claro u Oscuro.
- **Encuadre:** cada foto tiene un `anclaSuelo` (el punto donde se apoya el frasco). El fondo se encuadra para que ese punto caiga bajo la base del frasco **en todas las anchuras**. En estrecho se usa la versión estrecha de la foto (`*-estrecho`) con su propio ancla, para que el orbe no quede cortado y el frasco no flote.
- **Por qué:** el frasco tiene que parecer apoyado en la escena. Si el fondo se mueve con la ventana y el frasco no, «flota».

### 3.2 Reloj

**Dónde:** en ancho, arriba a la derecha, con la parte de arriba a la altura del bulbo superior. En estrecho, centrado justo debajo del frasco (como en la web publicada). Mismo sitio en los tres temas.

**Aspecto:**
- Dígitos en Manrope 200, cifras tabulares (no bailan al cambiar), sin tarjeta ni borde.
- Debajo, la pista («clic para empezar · rueda para cambiar el tiempo») en 15 px, peso 400.
- **Sin halo ni fondo de ningún tipo** (decisión de Sebastián, 12 nov 2026, en todos los escenarios). Nada detrás del reloj: ni desenfoque, ni velo, ni sombra, ni `text-shadow`. Se borra `reloj.halo`/`haloOpacidad` del tema y el elemento del halo.

**Paleta: discreta, «que se vea pero que no destaque»**

Criterio: tonos neutros (≤ 3 % de saturación) y **apagados**, más oscuros que la paleta anterior en todos los modos. En los modos claros (y en Lluvia claro, que es gris medio) un gris carbón suave; en los oscuros, un gris medio-claro tenue, claramente más oscuro que los casi blancos de antes. El color lo elige Sebastián: son dos valores por tema (`reloj.digitos`, `reloj.pista`) que se cambian editando una línea, sin tests de contraste. Valores de partida: Lluvia claro `#2E302F` · Lluvia oscuro `#8F8B86` · Arena claro `#4A4541` · Arena oscuro `#7E7A75` · Clásico claro `#5A5550` · Clásico oscuro `#86817B`.

**Por qué así:** Sebastián quiere un reloj presente pero sereno, que forme parte de la escena en vez de imponerse; el halo se veía como mancha. El único test del reloj comprueba que no tiene halo, sombra ni fondo.

**Comportamiento:**
- **Siempre visible.** No comparte la lógica de autoocultado del botón del menú.
- Al abrir el menú en ancho, sube lo justo (ver 3.11) con la transición lenta. En estrecho sube junto con el frasco.
- **Texto accesible sincronizado:** `formatearTiempo(restanteMs)` devuelve a la vez el texto visible y el hablado, con el mismo redondeo. En marcha, el texto hablado dice solo minutos («quedan 5 minutos» mientras se ve 04:30, porque se redondea hacia arriba igual que los minutos de la pantalla) y se anuncia al cambiar de minuto o de estado. En pausa o parado dice minutos y segundos exactamente como se ven. Nunca puede decir «4:58» si se ve «04:30».

### 3.3 Frasco: dibujo y luz

**Orden de pintado** (un solo canvas a pantalla completa):

```
mundo (sin girar)             frasco (gira θ)
1 sombra de contacto
                              2 vidrio trasero (jar-back)
3 contenido: agua o arena recortado por la máscara girada
4 chorro / gotas (verticales)
                              5 vidrio delantero (jar-front, reflejos)
6 luz de la escena sobre la silueta (degradado y brillo de borde)
7 nube (Lluvia; es un <video> del DOM encima del canvas, ver 3.7)
```

**Luz por tema y modo:**
- Cada modo define `luz.direccion` **en el mundo**: el ángulo hacia la fuente de luz de la foto (el sol o el orbe más cercano al frasco). Se mide en la foto y se revisa en la hoja de contacto.
- La luz es un degradado y un brillo de borde pintados **encima del vidrio y recortados a su silueta**. Como está en el mundo, al voltear el frasco el brillo se queda del lado de la lámpara.
- **La luz nunca cambia el matiz del contenido.** Puede aclararlo u oscurecerlo como mucho un 15 %, pero no teñirlo. El color del agua y de la arena sale solo de `contenido`.
- Sombra de contacto: centrada bajo la base, sin girar, con color, opacidad y desenfoque del tema.
- **Por qué:** el agua salía marrón porque el tinte naranja de la escena se pintaba encima al 95 %. Separar «luz del vidrio» de «color del contenido» lo hace imposible.

**Mientras carga:** en vez de dos elipses falsas se ve la silueta real del frasco (la máscara, 31 KB) con un vidrio neutro, y se sustituye con un fundido de 160 ms cuando llegan las capas.

### 3.4 Agua (Lluvia)

**Cómo se ve:**
- **Transparente, nunca marrón.** Un velo frío y neutro: claro `rgba(214, 228, 234, 0.26)`, oscuro `rgba(160, 178, 188, 0.20)`, con un oscurecimiento vertical del 6 % hacia el fondo (en el mundo). Matiz entre 180° y 215°, saturación ≤ 20 %.
- **Sin línea blanca.** La superficie no lleva trazo. Se distingue solo por el cambio de velo. Como mucho, un menisco de 2 px junto al cristal un 8 % más claro.
- **Llena el cristal exactamente,** pared con pared, en los hombros y en el cuello, porque su forma **es** la máscara.

**Cómo se calcula (método único):**
1. Al cargar, la máscara se reduce a una rejilla de unos 110 × 252 puntos interiores (centros de píxel con alfa > 50 %). De ahí salen también la línea del cuello (la fila más estrecha) y el reparto de puntos entre bulbo de arriba y de abajo.
2. La cantidad de agua de cada bulbo es una **fracción de su área** (número de puntos), sacada del tiempo: `fraccionArriba = restante / duración`. Se usa área y no volumen porque la arena (una rejilla 2D de celdas) cuenta igual: agua y arena se vacían al mismo ritmo visual.
3. En cada fotograma, para el ángulo actual, se giran los puntos de cada bulbo a coordenadas de pantalla (misma escala en x y en y) y se busca la altura del k-ésimo punto más bajo (selección rápida, O(n), menos de 0,5 ms). Esa altura es la superficie.
4. Se pinta en el mundo el semiplano «por debajo de la superficie» de cada bulbo, limitado por la línea del cuello (que sí gira con el frasco), y se recorta con la máscara girada (`destination-in`).
- **Resultado por construcción:** superficie horizontal respecto al mundo, agua apoyada en el lado bajo y forma exacta del vidrio a cualquier ángulo, también boca abajo.
- **Movimiento:** al girar, el ángulo de la superficie sigue a la gravedad con un muelle amortiguado (frecuencia unos 2 Hz, amortiguación 0,8). En reposo, a los 600 ms queda horizontal (< 1°) y sin vaivén. El volumen nunca cambia durante el movimiento.
- **Voltear:** al llegar a 180°, en el mismo fotograma se intercambian los bulbos y el ángulo vuelve a 0. El fotograma de antes y el de después son iguales.
- **Por qué:** sustituye unas 250 líneas de apaños que deformaban la forma (radio al cuadrado) y la inclinación (espacio estirado). Y el test puede comprobar el píxel: pendiente de la superficie y hueco contra la máscara.

### 3.5 Chorro y gotas

- **Lluvia:** del cuello cae un hilo de gotas, **vertical en el mundo**, hasta la superficie del agua de abajo. Gotas de 1,5 px de ancho y 6-14 px de largo, velocidades distintas (semilla fija), opacidad 0,35-0,6, color del agua un poco más claro. Al llegar a la superficie, una onda mínima de 1 fotograma. **Nunca** una línea blanca fija.
- **Arena y Clásico:** el chorro de granos del core (`StreamParticles`), también vertical en el mundo.
- Solo hay chorro con el reloj en marcha y el frasco a menos de 35° de la vertical. Se corta con una caída de 200 ms, no de golpe.
- **Por qué:** en tu vídeo el chorro era una línea blanca recta y estática; además, al inclinar caía en diagonal porque se pintaba dentro del giro.

### 3.6 Arena (Arena y Clásico)

**Cómo se ve:** granos como en la app móvil. Cada grano tiene uno de 6 tonos del tema, repartidos con semilla fija, con aspecto redondeado. Llenan el vidrio pared con pared.

**Cómo se calcula:**
- `SandSimulation` del core, sin cambios en el core. Lo que cambia es el **perfil**: se genera de la misma máscara (una celda es válida si la máscara está por encima del 50 % en su centro). Tolerancia: ≤ 2 % de diferencia por fila entre rejilla y máscara, con test.
- **Al inclinar hay física, no teletransporte:** `sim.step(gravedad)` con la gravedad girada, varios pasos por fotograma según el presupuesto (el `tiltLod` del core). Se borra el `sim.arrange` por fotograma. La arena resbala y cae en avalanchas.
- Después de un giro, los granos de arriba vuelven a cuadrar con el tiempo (test).

**Cómo se pinta (rápido):**
- Los granos se escriben en un `Uint32Array` de una imagen fuera de pantalla de `columnas × 3` por `filas × 3` píxeles: cada grano es un sello de 3 × 3 con las esquinas a media opacidad (parece redondo). Son unas 155.000 escrituras en un array, alrededor de 1 ms.
- Un `putImageData` y un solo `drawImage` escalado y girado al tamaño del frasco, recortado con la máscara.
- La luz de los granos es el degradado de la escena encima (3.3), no un cálculo por grano.
- **Por qué:** hoy son 17.292 `arc` + `fill` por fotograma (unos 40 ms). Con este método el coste del contenido baja por debajo de 3 ms.

### 3.7 Nube (Lluvia)

- Es un `<video>` en el DOM, encima del canvas, con `mix-blend-mode: screen`. Como el vídeo es una nube blanca sobre negro, el negro desaparece solo. **No se leen píxeles** y no hace falta `alphaFromBlack` por fotograma.
- **Sin marco oscuro:** con `screen`, un fotograma negro o sin decodificar es invisible. Mientras el vídeo no tenga datos se ve el póster con el mismo modo de mezcla.
- **Sin vibración:** la caja se coloca con `transform: translate3d()` en píxeles enteros y solo cambia cuando cambia el layout.
- **Bucle limpio:** el vídeo se vuelve a codificar con un fundido de 0,5 s entre el final y el principio, para que la vuelta no salte (hoy hay un salto 6 veces mayor que entre dos fotogramas seguidos).
- En oscuro, `filter: brightness(0.72) saturate(0.85)` desde el tema (más gris y apagada).
- Siempre derecha. Al girar el frasco, su opacidad depende solo del ángulo (1 a 0° → 0 a 50°) y vuelve al soltar.
- Solo existe si `tema.nube` es verdadero. Formatos: MP4 H.264 (≤ 300 KB) y un WebM VP9 normal (no `gbrp`, ≤ 300 KB).
- **Por qué:** quita el bucle a 60 fps que nunca se dormía, la lectura de la GPU en cada fotograma, el fotograma oscuro y el tembleque.

### 3.8 Vidrio (menú, cookies, aviso Android, panel legal)

Es **un** estilo. Lo único que hace que se vea distinto es lo que hay detrás.

| Propiedad | Valor | Por qué |
|---|---|---|
| Desenfoque | `backdrop-filter: blur(36px) saturate(1.1) brightness(var(--vidrio-brillo))` | Muy esmerilado: las luces del fondo se convierten en bokeh suave y el texto se lee. |
| Tinte | **Ninguno.** Velo blanco, sin color: claro `rgba(255,255,255,0.30)`, oscuro `rgba(255,255,255,0.07)` | El color lo pone el fondo, no el tema. |
| Brillo | claro 1,04 · oscuro 0,78 (acromático) | En oscuro, los orbes brillantes bajo el texto bajarían el contraste; atenuar sin teñir lo evita. |
| Borde | 1 px, claro `rgba(255,255,255,0.45)`, oscuro `rgba(255,255,255,0.14)` | Una línea de luz finísima que define el panel. |
| Radio | 28 px | Grande y suave. |
| Sombra | Ninguna (como mucho un brillo interior de 1 px) | Sin sombras pesadas. |
| Texto | `ui.tinta` del tema; contraste ≥ 4,5:1 medido en la captura | Legible sobre cualquier fondo. |
| Sin soporte de `backdrop-filter` | Velo al 85 % | Que nunca quede transparente e ilegible. |

**Controles dentro del vidrio (`.control`):**
- Cápsula de 40 px de alto (44 px en táctil), texto de 15 px.
- No elegido: fondo transparente, borde de 1 px con la tinta al 22 %, **texto con la misma tinta que el elegido** (sin bajar opacidad). Así lo no elegido se lee igual de bien.
- Elegido: fondo blanco al 72 % (claro) o al 18 % (oscuro), mismo borde, peso 500. Neutro, sin color del tema.
- Hover: fondo blanco al 10 %. Foco de teclado: anillo de 2 px con la tinta.
- **Nunca texto cortado con «…»** desde 360 px de ancho. «Automático» pasa a «Auto», con el valor completo en el tooltip.

### 3.9 Menú

**Contenido, en este orden:**
1. Escena: Lluvia · Arena · Clásico.
2. Sesión única · Ciclos.
3. Duraciones rápidas (5, 10, 15, 25, 45, 60) o ciclos predefinidos, y «Personalizado» (un solo `Stepper` alimentado por una lista).
4. Fila final: Modo (Auto / Claro / Oscuro), Idioma (Auto / ES / EN) y Sonido.

**Comportamiento:**
- Botón del menú abajo a la derecha. Aparece al mover el puntero y se oculta tras 3 s quieto o al salir el puntero de la ventana. En táctil aparece al tocar y se oculta a los 4 s. **También está disponible en pausa.**
- Se abre con una transición de 360 ms desde abajo. Escape o la «×» lo cierran.
- **Sin barra de scroll y sin cortar nada:** el layout mide su alto real y le hace sitio (3.11). Alto máximo: en estrecho `min(52 % del alto, 440 px)`; en ancho cabe bajo el reloj.
- Solo por debajo de 600 px de alto, y únicamente si el contenido no cabe (ciclos personalizados), el panel hace scroll interno sin barra visible y con un degradado abajo que indica que hay más. Es la única excepción.
- Tooltips propios (componente `Tooltip`) en los botones de icono; nunca se cortan.
- **Por qué:** el menú se cortaba porque su alto se adivinaba; ahora se mide.

### 3.10 Cookies, aviso Android y panel legal

- **Cookies:** vidrio, abajo centradas, justo encima del pie. En ancha miden 460 px; en estrecha, el ancho con 10 px de margen. Aparecen primero; el aviso Android solo puede salir cuando ya se ha decidido lo de las cookies. Nunca salen los dos a la vez. No mueven el frasco ni el reloj.
- **Aviso Android:** vidrio, abajo a la izquierda, a 12 px del borde, encima del pie. En ancha mide 320 px; en estrecha, el ancho con 12 px de margen. En estrecha el layout reserva su alto medido y el frasco y el reloj suben. En ancha, si toca el frasco, el frasco se aparta o se encoge; el aviso no se mueve. Se oculta con el menú abierto. El botón «Descargar» es un `.control` elegido (sin color del tema) y la «×» un `.control` redondo.
- **Panel legal:** diálogo de vidrio sobre la escena desenfocada.
  - La **cabecera** (título, ES/EN y «×») está **fuera** de la zona que hace scroll. El texto nunca pasa por debajo de ella; así siempre se lee.
  - La zona del texto empieza bajo la cabecera, con un desvanecido de 16 px arriba.
  - El documento se carga en un `iframe` con `?embed=1&tema=…&modo=…`. En modo embed, la página legal oculta su propia cabecera, tiene fondo transparente y usa los mismos tokens generados del tema. Sin verdes ni marrones antiguos.
  - Líneas de 70 caracteres como máximo, contraste ≥ 4,5:1.

### 3.11 Colocación: disposiciones, puntos de corte y tabla

**Entradas medidas:** `W`, `H`, márgenes seguros, `altoMenu`, `altoAviso` (solo el aviso Android, si está visible), `altoPie`, y las métricas de los dígitos (`anchoPorEm`, `altoBloquePorEm`, medidas una vez al cargar la fuente).

**Elegir disposición:**
- **Ancha** si `W ≥ 900` y `W / H ≥ 1,2` **y** el reloj cabe en la columna derecha con su tamaño mínimo (64 px) sin acercarse a menos de 32 px del frasco.
- **Estrecha** en cualquier otro caso.
- Esta regla de «cabe o no cabe» es la que quita el fallo de tu vídeo: en anchos intermedios ya no se fuerza la disposición ancha.

**Ancha** (`m = clamp(16, 2,5 % W, 40)`):

| Elemento | Posición y tamaño |
|---|---|
| Frasco | Alto `0,70 H` (ancho como máximo `0,34 W`). Centro en `x = 0,30 W`, base en `y = 0,80 H`. No se mueve al abrir el menú. Si el aviso Android lo toca, se aparta o se encoge un poco. |
| Nube | Sale del frasco: 1,72 × su ancho, con el borde de abajo a un 40 % del bulbo superior. |
| Columna derecha | De `x = 0,52 W` a `W − m`. |
| Reloj | Centrado en la columna. Arriba en `frasco.y + 0,06 · frasco.alto`. Letra `clamp(64, 0,13 H, 128)` px, limitada a lo que quepa en la columna con 32 px por lado. |
| Menú (abierto) | En la columna, ancho `min(440, columna)`, 24 px bajo el reloj. Si no cabe sobre el botón del menú, el reloj sube lo necesario (hasta `m`). Si aun así no cabe (alto < 560 px), el reloj se desvanece mientras el menú está abierto. |
| Botón del menú | 44 × 44, a `m` de la esquina inferior derecha. |
| Pie | Centrado abajo, a 12 px del borde. |
| Cookies | Centradas, encima del pie, 460 px. |
| Android | Abajo a la izquierda, a 12 px, 320 px, encima del pie. |

**Estrecha** (`m = 12`):

| Elemento | Menú cerrado | Menú abierto |
|---|---|---|
| Reserva de abajo | `altoPie + altoAviso + m` | `altoMenu + m + margen seguro` |
| Reloj | Centrado bajo el frasco, 16 px de separación. Letra `clamp(56, 0,17 W, 96)` px y ≤ `0,10 H` | Justo encima del menú (12 px). La letra puede bajar como mucho un 15 %, nunca por debajo de 48 px |
| Frasco + nube | Ocupan el resto de arriba, centrados. Alto del frasco `min(90 % del hueco, 0,56 H)`, ancho ≤ `0,42 W`. **Mínimo `0,30 H`** | Suben y se encogen con el hueco (como en la web publicada). **Mínimo `0,22 H`**; si no llega (pantallas de menos de 640 px de alto), el frasco y la nube se desvanecen mientras el menú está abierto |
| Menú | Fuera, debajo | Desde abajo, ancho `W − 24` (máximo 520, centrado), alto medido ≤ `min(0,52 H, 440)` |
| Pie | Centrado, una o dos líneas, nunca cortado | Oculto |
| Aviso Android | A 12 px del borde, a lo ancho menos el margen, encima del pie. El frasco y el reloj suben | Oculto |
| Botón del menú | 44 × 44 abajo a la derecha | Oculto (la «×» está en el panel) |

- Todos los cambios de posición se animan con la transición lenta (620 ms); con *reducir movimiento*, sin animación.
- Cambiar de tema **nunca** mueve ni cambia de tamaño nada.

**Qué disposición sale en cada tamaño del plan de tests:**

| Tamaño | Disposición | Nota |
|---|---|---|
| 390 × 844 (móvil) | Estrecha | Caso principal del móvil |
| 600 × 900 | Estrecha | |
| 820 × 1180 (tablet vertical) | Estrecha | |
| 1024 × 768 (tablet horizontal) | Ancha | |
| 1440 × 900 (portátil) | Ancha | |
| 844 × 390 (móvil horizontal) | Ancha, alto corto | El reloj se desvanece con el menú abierto |
| 960 × 900 | Estrecha (ratio 1,07) | Caso intermedio del vídeo |
| 1100 × 820 | Ancha si cabe; si no, estrecha | La regla «cabe o no cabe» decide |

**Test barrido:** de 360 a 1920 px de ancho en pasos de 20 y con 5 altos, ni el reloj, ni el menú, ni el aviso, ni el pie se solapan con el frasco ni entre sí, y nada se sale de la pantalla. El aviso Android queda a 12 px del borde: 320 px en ancha, y a lo ancho menos el margen en estrecha.

### 3.12 Pie de página

- Enlaces: Aviso legal · Privacidad · Cookies · App Android · Ajustes de cookies. «Cookies» solo una vez.
- Centrado en todas las anchuras; en estrecho puede ocupar dos líneas, nunca cortarse ni salirse.
- Texto de 13 px con la `tintaSuave` del tema, contraste ≥ 4,5:1 medido.
- **Se oculta igual que el botón del menú**: un solo hook (`useAutoocultar`) controla los dos. Se borran las reglas `.app:hover`, que impedían ocultarlos con el ratón dentro.

### 3.13 Idiomas

- Selector ES / EN / Auto en el menú; Auto sigue al navegador.
- **Un solo sistema de textos:** los `messages` del core. Todo lo de `copy.ts`, «En pausa», «Escena», «Activado» y «Silencio» pasa ahí. Ningún texto escrito a mano en los componentes (lo vigila un test).
- **Páginas legales bilingües:** la fuente de verdad está en `legal/textos/{es,en}/*.md`. El generador lee solo de ahí y escribe en `public/` con las mismas URL de siempre. Un test comprueba que `public/` está al día. El botón ES/EN del panel legal cambia de documento.

### 3.14 Cambio de tema y de modo

- **Todo cambia a la vez** en un fundido de 360 ms: fondo, frasco, contenido, nube, colores de la interfaz.
- El fondo nuevo se monta en una capa encima del viejo y pasa de opacidad 0 a 1; la vieja se retira al terminar. Cada fuente de vídeo es un `<video key={url}>` **nuevo** (nunca se reutiliza).
- El frasco: el último fotograma del tema anterior se copia a una imagen fuera de pantalla y se desvanece encima del nuevo durante los mismos 360 ms.
- Los colores de la interfaz tienen `transition` de 360 ms en color, fondo y borde.
- Una sola función, `cambiarTema()`, arranca todo con el mismo reloj. Con *reducir movimiento*, el cambio es instantáneo.
- **Por qué:** hoy el fondo salta, y entre dos temas oscuros ni siquiera cambiaba el vídeo.

### 3.15 Gestos y pausa

| Gesto | Efecto |
|---|---|
| Un clic / Espacio / Enter | Empieza, pausa o reanuda (espera 260 ms por si es doble clic) |
| **Doble clic** | **Reinicia y se queda parado** |
| Rueda (parado y menú cerrado) | Cambia la duración |
| Arrastrar el frasco | Lo gira; pasado el 45 % de media vuelta, se voltea al soltar |
| Escape | Cierra menú o panel legal |

**Pausa:**
- La escena (fondo, frasco, nube, reloj) se desenfoca con `filter: blur(18px)`.
- «En pausa» y la pista quedan nítidos encima.
- **El botón del menú y el pie siguen disponibles** (están fuera de la capa desenfocada). Se puede cambiar de tema en pausa.

### 3.16 Accesibilidad

- El escenario es un botón con nombre accesible que dice la acción («Empezar», «Pausar»…).
- Texto hablado del tiempo sincronizado con lo visible (3.2).
- Todo se puede usar con teclado; foco visible en todos los controles.
- Contraste medido en la captura de producción: texto ≥ 4,5:1, dígitos ≥ 3:1.
- *Reducir movimiento*: póster en vez de vídeo, sin fundidos ni animaciones de layout, el frasco se voltea sin animación.

### 3.17 Carga y rendimiento (presupuestos)

**Orden de carga:**
1. **Al instante:** cada tema lleva en su objeto una miniatura borrosa de su fondo (unos 32 px de ancho, menos de 1 KB, en línea). Se pinta en el primer fotograma, escalada y con `blur(20px)`.
2. **El reloj y el frasco funcionan sin esperar a ningún vídeo.** El reloj es DOM. El frasco usa la silueta de la máscara hasta tener sus capas.
3. El fondo activo: AVIF, o WebP si no hay AVIF, con tamaño según la pantalla (versión estrecha en móvil). Entra con un fundido sobre la miniatura.
4. Si el modo activo es vídeo: primero el póster y después el vídeo, con fundido.
5. **Después de `load` y en un hueco libre** (`requestIdleCallback`): se precargan los fondos de los otros temas y del otro modo, **un solo formato por recurso** (el que use este navegador).
6. **Con Save-Data o conexión lenta** (`effectiveType` 2g/3g): no se precarga nada y no se reproduce vídeo (se queda el póster).

**Archivos:**
- Imágenes en AVIF y WebP. Versión estrecha (≤ 960 px de ancho) para móvil.
- Vídeos de fondo: WebM VP9 y MP4 H.264, 1280 × 720 (960 × 540 en estrecho), 24 fps, ≤ 250 KB cada uno.
- Capas del frasco a 1024 px de alto, y a 2048 solo con DPR ≥ 2 y frasco de más de 700 px en pantalla. La máscara y `jar-front` vienen ya con el canal alfa preparado: sin bucles de píxeles en el hilo principal.
- Fuentes: Manrope 200, 400 y 500, solo latin, woff2, `font-display: swap`; se precarga la 200.
- Se borran `tex-sand.webp` (464 KB), `tex-water.webp`, `tex-agua.webp` y `jar-shadow.webp`.
- **Caché:** todo lo que se sirve con `Cache-Control: public, max-age=31536000, immutable` lleva el hash del contenido en el nombre (los recursos de `public/` se renombran con hash al construir, o pasan a importarse desde `src/`).

**Presupuestos (los comprueba el test):**

| Medida | Límite | Hoy |
|---|---|---|
| JS inicial (gzip) | ≤ 110 KB | 106 KB |
| CSS inicial (gzip) | ≤ 12 KB | 24 KB |
| Bytes hasta ver la escena, Lluvia claro, 1440 × 900 | ≤ 350 KB | ≈ 650-700 KB (estimado: JS, CSS con fuentes, fondo y 456 KB de capas del frasco) |
| Ídem en 390 × 844 | ≤ 250 KB | — |
| Precarga en segundo plano (todos los demás fondos) | ≤ 900 KB, sin formatos repetidos | 1,2-2,0 MB |
| LCP en Lighthouse móvil («Slow 4G») | ≤ 2,5 s | — |
| JS + canvas por fotograma al girar, Chromium sin GPU, 1440 × 900, DPR 1 | mediana ≤ 8 ms, p95 ≤ 14 ms | 40 / 49 ms |
| Ídem con el reloj en marcha | mediana ≤ 6 ms | 10-40 ms |
| Fotogramas pedidos con el reloj parado y nada moviéndose (2 s) | **0** en los tres temas | 35 en Lluvia |

- Un solo bucle `requestAnimationFrame`, que se duerme cuando no hay nada en movimiento.
- Con la pestaña oculta, vídeos en pausa y bucle parado.

---

## 4. Criterios de aceptación

Cada uno es comprobable; los marcados **(auto)** los comprueba un test y los marcados **(ojo)** los apruebas tú sobre capturas de producción. «En todas las anchuras» significa 390 × 844, 600 × 900, 820 × 1180, 1024 × 768 y 1440 × 900, en 3 temas × 2 modos.

**Build y normas**
1. **(auto)** El CSS compilado tiene `backdrop-filter:` sin prefijo en `.vidrio`.
2. **(auto)** `getComputedStyle` de `.vidrio` en la preview de producción contiene `blur(`.
3. **(auto)** Cero colores literales fuera de `temas/` y `estilo/tokens.ts`. Cero comparaciones con ids de tema fuera de `temas/`. Cero `!important`. Especificidad ≤ 0,2,0.
4. **(auto)** `npm run check` en verde: tipos, lint, stylelint, tests unitarios, tests visuales y comprobación de `dist/`.

**Colocación**
5. **(auto)** Barrido de 360 a 1920 px de ancho (pasos de 20, 5 altos), con menú abierto y cerrado y con aviso visible: ninguna caja se solapa con otra ni se sale de la pantalla. El aviso Android queda a 12 px del borde (320 px en ancha; a lo ancho menos el margen en estrecha) y no se solapa con el frasco, el reloj, el menú ni el pie.
6. **(auto)** En todas las anchuras, con el menú abierto: `scrollHeight ≤ clientHeight + 1` en el menú (no hay contenido cortado ni scroll), también con ciclos personalizados, en alturas ≥ 600 px.
7. **(auto)** En ancho, el frasco tiene la misma caja con el menú abierto y cerrado. En estrecho, con menú abierto el frasco mide ≥ 0,22 H (o se desvanece si no cabe), y cerrado ≥ 0,30 H.
8. **(auto)** Cambiar de tema no cambia ninguna caja (diferencia 0 px).
9. **(auto)** El pie y todos los controles cumplen `scrollWidth ≤ clientWidth` (nada cortado ni con «…») desde 360 px.

**Reloj y textos**
10. **(auto)** Contraste medido en la captura de producción, en la zona del reloj: (eliminado: el color del reloj lo elige Sebastián). Solo se comprueba que el reloj no tiene halo, `text-shadow`, `backdrop-filter` ni fondo.
11. **(auto)** Texto de controles (elegidos y no elegidos), del pie y del panel legal ≥ 4,5:1 medido en la captura.
12. **(auto)** El texto hablado del tiempo coincide con lo visible según la regla de 3.2 (con reloj congelado en 04:30, dice «5 minutos»; en pausa a 04:30 dice «4 minutos 30 segundos»).
13. **(auto)** En pausa, el botón del menú existe, es visible al mover el puntero y abre el menú.
14. **(auto)** En inglés no aparece ningún texto en español fuera de las páginas legales en español.

**Vidrio y controles**
15. **(auto)** El fondo de `.control` elegido y no elegido no tiene matiz: |R−G| y |G−B| < 3 en el valor calculado.
16. **(ojo)** Menú, cookies, aviso Android y panel legal se ven como el mismo vidrio sobre los 6 fondos.
17. **(auto)** En el panel legal, ningún píxel de texto del documento queda dentro de la caja de la cabecera al hacer scroll.

**Frasco**
18. **(auto)** Agua girada 30°, 45° y 60° (y a 0°), en reposo: la pendiente de la frontera agua-aire, medida por columnas en la captura, es < 1° respecto a la horizontal.
19. **(auto)** Bajo la superficie, el hueco entre la máscara y el agua es < 2 px en todo el contorno (el agua llena el cristal).
20. **(auto)** El color medio del agua tiene matiz entre 180° y 215° y R ≤ B (nunca marrón). No hay ninguna línea de más de 20 px con luminancia > 0,9 en la superficie.
21. **(auto)** Arena girada 30°, 45° y 60°: los granos están dentro de la máscara (0 px fuera) y su superficie libre baja hacia el lado bajo.
22. **(auto)** El número de granos/área de agua de arriba corresponde al tiempo restante ±1 % antes y después de un giro.
23. **(auto)** Voltear: el fotograma justo antes y justo después del cambio de bulbos difieren < 0,5 % de píxeles.
24. **(auto)** Con el reloj en marcha y el frasco derecho hay chorro; al inclinar 45° o parar, desaparece en ≤ 200 ms. Las gotas caen verticales en pantalla a cualquier ángulo.
25. **(ojo)** El frasco parece apoyado y con la luz de la escena en los 6 fondos (hoja de contacto).

**Nube, fondo y cambio de tema**
26. **(auto)** Tras cambiar Lluvia oscuro → Arena oscuro → Clásico oscuro sin recargar, `currentSrc` del vídeo visible contiene el id del tema activo.
27. **(auto)** El cambio de tema tarda 360 ± 40 ms y en el fotograma intermedio se ven las dos escenas mezcladas (no hay salto).
28. **(auto)** En 12 s de vídeo de la nube ningún fotograma tiene la caja de la nube más oscura que el fondo (no hay marco oscuro) y la posición de la caja no varía (0 px).

**Rendimiento y carga**
29. **(auto)** Los presupuestos de la tabla de 3.17 se cumplen.
30. **(auto)** Con Save-Data o 3g emulado: cero peticiones de vídeo y cero precargas.
31. **(auto)** Ningún recurso se pide en más de un formato. No se pide ningún archivo que no se pinte.

---

## 5. Plan de tests visuales

### 5.1 Herramienta y entorno

- **Playwright** (`@playwright/test`), en `apps/web/e2e/`.
- **Siempre contra producción:** `npm run build && npx vite preview --port 4173`. Nunca contra `vite dev`. El arranque del servidor lo hace la config de Playwright (`webServer`), así nadie puede olvidarlo.
- Chromium fijo (versión anclada en `package-lock`), fuentes empaquetadas, `deviceScaleFactor` 1 (y 2 en un subconjunto), `colorScheme` claro y oscuro.

### 5.2 Determinismo

- **Reloj congelado:** `page.clock.install()` con una hora fija; el tiempo restante se fija a 04:30 de 05:00.
- **Simulación con semilla fija** (la del core, `seed: 11`).
- **Vídeos parados:** tras cargar, `currentTime = 0.5` y `pause()` en todos los `<video>`.
- **Sin transiciones** salvo en los tests de transición: se inyecta una hoja de estilos de test con `page.addStyleTag` (no existe en el código de la app).
- **Ángulo fijo:** un módulo pequeño `pruebas.ts` expone `window.__hg.fijarAngulo(grados)` **solo** si antes de cargar existe `window.__HG_PRUEBA__` (lo pone `page.addInitScript`). En uso normal no hace nada.

### 5.3 Matriz de capturas

| Eje | Valores |
|---|---|
| Tema × modo | Lluvia, Arena, Clásico × claro, oscuro |
| Anchura | 390 × 844, 600 × 900, 820 × 1180, 1024 × 768, 1440 × 900 (+ 844 × 390 en un subconjunto) |
| Estado | parado · menú abierto (sesión) · menú abierto (ciclos personalizados) · pausa · banner de cookies · aviso Android · panel legal (arriba y con scroll) |
| Giro (recorte del frasco) | 0°, 30°, 45°, 60°, 150°, en Lluvia y Arena |
| Cambio de tema | Lluvia oscuro → Arena oscuro → Clásico oscuro, captura a mitad (180 ms) y al final |

- Comparación con `toHaveScreenshot({ maxDiffPixelRatio: 0.002 })`.
- Unas 200 capturas; se ejecutan en paralelo en unos 3 minutos.

### 5.4 Referencias aprobadas por ti

- Las imágenes de referencia viven en el repo (`apps/web/e2e/__referencias__/`).
- **Solo tú las apruebas.** Al cerrar cada fase que cambia algo visible, te llega una hoja con las capturas nuevas junto a las anteriores. Hasta que dices OK, no se guardan.
- Una vez aprobadas, cualquier cambio que las altere hace fallar el test, aunque sea «para mejor». Cambiarlas exige tu OK explícito y queda en el commit («Referencias aprobadas por Sebastián el …»).
- Así, un arreglo en el menú que mueva el frasco aparece como diferencia y se para antes de llegar a ti.

### 5.5 Comprobaciones baratas que hoy fallan

Se escriben **primero**, en la fase 0, y deben fallar sobre `25fca17`. Dicen *por qué* falla algo sin mirar capturas:

| Comprobación | Hoy |
|---|---|
| `backdropFilter` calculado de `.vidrio` contiene `blur(` | falla (`none`) |
| `dist/*.css` contiene `backdrop-filter:` sin prefijo | falla |
| Fondo de controles sin matiz (diferencias R−G y G−B < 3 en valor absoluto) | falla (pastillas teñidas) |
| Menú: `scrollHeight ≤ clientHeight + 1` en las 5 anchuras | falla (corta 10-23 px) |
| `video.currentSrc` contiene el tema tras cambiarlo | falla (Arena oscuro con vídeo de Lluvia) |
| Pendiente del agua a 30° < 1° | falla (unos 22°) |
| Hueco agua-máscara < 2 px | falla |
| Matiz del agua 180-215° | falla (marrón) |
| Barrido sin solapes de 360 a 1920 px | falla (reloj sobre frasco en intermedios; reloj sobre aviso Android) |
| Contraste del reloj medido en captura | falla (Lluvia claro 2:1, Arena oscuro) |
| Texto hablado = visible | falla (04:30 frente a 4:58) |
| Botón del menú en pausa | falla (oculto) |
| Pie y controles sin cortar | falla (pie cortado, «Automa…») |
| 0 fotogramas pedidos en reposo | falla en Lluvia (35 en 2 s) |
| Coste por fotograma al girar ≤ 8 ms | falla (40 ms) |
| Sin `tex-sand` ni formatos repetidos en la precarga | falla |

### 5.6 Cuándo se ejecutan

- Antes de cada commit: `npm run check` (incluye build, `comprobar-dist`, tests unitarios y visuales).
- En CI de GitHub en cada push a la rama, con las capturas de diferencia adjuntas cuando falla.

---

## 6. Plan por fases

Cada fase es un PR pequeño a `feature/web-escenas` (o una rama hija con nombre en español, nunca `cursor/…`). Ninguna fase se da por terminada sin: todos los tests en verde sobre producción, las capturas de producción y, si cambia algo visible, tu OK a las referencias nuevas. **Nada se mergea a `main` ni se publica sin tu OK.**

Las fases van de los cimientos hacia fuera, para que lo de encima no se rompa al tocar lo de debajo.

| Fase | Qué se hace | Cómo se verifica | Tu OK |
|---|---|---|---|
| **0. Red de seguridad** | Playwright contra `vite preview`, determinismo (5.2), `comprobar-dist.mjs`, stylelint y reglas ESLint de las normas. Las comprobaciones de 5.5 se escriben y se marcan «falla esperada». Se borran los tests que validaban lo mismo que el código (agua en espacio estirado, `tex-sand`, regex sobre `styles.css`). | Las comprobaciones fallan sobre `25fca17` por los motivos de la tabla 5.5 | No (no cambia nada visible) |
| **1. Tokens y tema único** | Objeto por tema y modo, `aplicarTema()`, tokens globales, borrar las copias de colores, un `.vidrio`, un `.control`, `backdrop-filter` sin prefijo y targets en Vite, paleta del reloj y halo. Borrar miel, nieve y CSS muerto. | Pasan 1, 2, 3, 10, 11, 15. Hoja de los 6 fondos con menú abierto | **Sí**: primeras referencias de vidrio y reloj |
| **2. Colocación medida** | `useMedidas()` + `calcularLayout` con las dos disposiciones y la regla «cabe o no cabe», `--hora-px`, aviso Android y cookies reservados, pie centrado, un solo `useAutoocultar`, botón del menú en pausa. Borrar `relajar` y `useClockLift`. | Pasan 5, 6, 7, 8, 9, 13. Capturas de las 5 anchuras con menú abierto y cerrado | **Sí** |
| **3. Geometría única** | Módulo `frasco/geometria/` que lee la máscara una vez: puntos interiores, cuello, bulbos, perfil para la `SandSimulation`, silueta para el clic y para la carga. Borrar `jarTable.json`, `CLASSIC_MODEL` en la web y `vidrioDeReserva`. | Tests unitarios: perfil ≤ 2 % por fila frente a la máscara; cuello en la fila más estrecha; áreas de bulbo. Nada visible cambia aún | No |
| **4. Agua, chorro y luz en el mundo** | Método de 3.4, gotas de 3.5, luz por encima del vidrio sin teñir el contenido, sombra sin girar. | Pasan 18, 19, 20, 23, 24 (Lluvia). Recortes a 0/30/45/60/150° | **Sí** |
| **5. Arena** | Perfil de la máscara, sello 3 × 3 en `ImageData`, `step` al inclinar con `tiltLod`, chorro de granos vertical. | Pasan 21, 22, 23, 24 (arena) y el presupuesto por fotograma | **Sí** |
| **6. Nube y bucle** | Nube en `<video>` con `screen`, vídeo de bucle limpio, bucle que se duerme. | Pasan 28 y «0 fotogramas en reposo» | **Sí** |
| **7. Fondos, cambio de tema y carga** | `<video key>`, capas con fundido, `cambiarTema()`, miniaturas en línea, precarga de un formato tras `load`, Save-Data, imágenes y vídeos recomprimidos, capas del frasco a 1024, fuentes, hash e `immutable`. Borrar texturas sin uso. | Pasan 26, 27, 29, 30, 31. Lighthouse móvil | **Sí** (fundido) |
| **8. Legales, idiomas y accesibilidad** | Panel legal con cabecera fuera del scroll y embed con tokens, generador desde `legal/textos/{es,en}`, todos los textos en los `messages` del core, `formatearTiempo` con texto hablado. | Pasan 12, 14, 17. Revisión con teclado y lector de pantalla | **Sí** |
| **9. Repaso final** | Repaso de todos los criterios, hoja completa de referencias, preview de Vercel revisada por mí en el navegador antes de enseñártela. | Todo en verde; tu revisión | **Sí**, y solo entonces decides si se publica y sustituye a la web actual |

---

## 7. Decisiones cerradas por Sebastián (12 nov 2026)

1. **Reloj discreto y más oscuro en todos los escenarios, sin halo ni fondo** (12 nov 2026, sustituye al blanco roto de Lluvia claro). Ver 3.2.
2. **En estrecho el reloj va abajo y centrado, debajo del frasco, como en la web actual.** «Arriba a la derecha» es solo para la disposición ancha. Confirmado.
3. **Pantallas muy bajas con el menú abierto:** se aplica lo propuesto (el reloj en ancho o el frasco en estrecho se desvanecen mientras el menú está abierto; sin scroll visible). Si al verlo no le gusta, se revisa.
4. **Trabajo:** rama nueva `feature/web-v2` creada desde `feature/web-escenas` (`25fca17`). `feature/web-escenas` se queda como copia de seguridad.
