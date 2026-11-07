# Progreso — web fotográfica (`feature/materiales-3d`, PR #14)

No está mergeado. El móvil sigue con su renderer anterior. `apps/mobile/assets/glass/` no se commitea.

## Hecho en este paso

La nube se difumina en el borde del fotograma para que no quede un corte recto. `alphaFromBlack` queda listo para la próxima nube sobre negro. El agua del bulbo ya no lleva la refracción oscura de las rocas. La pausa escala la escena desenfocada para tapar el marco claro, y «En pausa» es blanco. El idioma por defecto de la web es español aunque el navegador no lo sea.

`ESCENAS_ACTIVAS` en `apps/web/src/scenes.ts` es `['lluvia','arena']`. Miel y nieve no salen en el menú y un valor guardado vuelve a lluvia. El código y los archivos siguen. La abeja y el zorro no se cargan mientras esas escenas están ocultas.

La nube de `nube-original.mp4` no se ha sustituido. El damero está horneado y, al recortarlo, el borde sigue con cuadrados. Recorte: `docs/audit/cloud-key-dark.png` y `cloud-key-light.png`. Sigue la nube anterior.

La pausa desenfoca la escena entera (frasco, nube y reloj) y deja «En pausa» centrado. El menú usa blur de 56 px. La tarjeta del reloj no tiene sombra de caída. El agua del bulbo es un velo con profundidad, menisco y cáustica, sin la foto. La lluvia son trazos finos. Parado, el nivel sigue `sandLevelForDuration` (log de 1 min a 3 h) y al empezar drena desde ahí.

## Hecho antes

La pausa solo desenfocaba la foto. El cristal es un velo claro. El pie son letras blancas. La arena usa los granos de main. Capturas: `verify-arena-run-1440.png`, `verify-lluvia-run-1440.png`, `verify-lluvia-pause-1440.png`, `verify-cookie-1440.png`, `verify-cookie-390.png`.

## Hecho antes

En vertical el frasco vive en la celda de arriba y el reloj debajo, sin pisarse. Al abrir el menú el frasco encoge y el reloj queda justo encima del panel (390 cerrado y abierto, 768 abierto). El pie es cristal oscuro al 62 % con texto `#f7f4ee` (4,7:1 sobre blanco) y se esconde con el menú abierto en estrecho. La nube no gira: al arrastrar se aclara y sube, y el reloj queda por encima. Capturas: `verify-390-closed.png`, `verify-390-open.png`, `verify-768-open.png`, `verify-1440-closed.png`, `verify-1440-flip.png`.

## Hecho antes

La especificación está en `docs/DISENO-WEB.md`, con las correcciones de Sebastián: el reloj sube al abrir (como en main), el botón sigue abajo a la derecha, la primera visita es lluvia y se guarda, y el cristal no lleva franja blanca.

- La escena es el primer control de Ajustes. Sin nada guardado, o con un valor que no vale, o si el almacenamiento falla, entra lluvia. Arena, miel y nieve se restauran en la visita siguiente (`hourglass-web/ajustes`).
- En ancha el panel queda centrado bajo el reloj (desvío medido 0 px en 1440 y 1 px en 1024). El reloj sube 181 px en 1440. En 768 y 390 el reloj queda encima del panel, sin solaparse. En 480×360 el reloj se queda a la derecha y el panel hace scroll (166 px, no 72).
- Personalizado es una pista horizontal (370×28 en 1440). Arrastrarla pasó la hora de 05:00 a 2:00:00.
- El cristal del reloj, del panel y de los botones es un velo oscuro (`rgba(22, 20, 18, 0.46)` la tarjeta, `0.5` el panel), blur 32 y saturación. El filo es 1 px al 6 % de blanco, no una tapa clara. El activo lleva el acento de la escena al 35 %.
- Arrastrar el frasco que se ve lo gira. El suelte pasado 0,45π voltea. El doble clic no reinicia. Un clic pasó el título de 05:00 a 04:59 y el segundo lo dejó ahí. La rueda, parado, pasó de 04:59 a 08:00. Escape cierra el panel.
- Capturas (tamaño y % de blanco): `docs/audit/verify-1440-closed.png` (807 KB, 0,18 %), `verify-1440-open.png` (830 KB, 0,20 %), `verify-390-open.png` (266 KB, 0,13 %), `verify-480-open.png` (171 KB, 0,14 %), `verify-1440-flip.png` (779 KB, 0,19 %).

## Hecho antes

- El marco de líneas se quitó: no había un raster fotográfico que aguantara al lado del vidrio.
- La tarjeta de la hora es más alta y ancha: el relleno es ~0,38 em arriba y a los lados respecto al tamaño de los dígitos, con aire entre la hora y el texto. Sigue el cristal ahumado y se escala con la ventana.
- La nube se aclaró a un gris azulado luminoso. El alfa del borde se difumina (~8 px) para que el contorno no quede granulado. El tamaño y el sitio no cambian.
- Nieve recupera una sombra de contacto muy difusa y una oclusión suave justo en el pie. No hay óvalo blanco.
- El bulbo de arriba deja aire (el volumen se dibuja al 84 %). Arena y nieve hacen montículo, la miel un menisco y el agua una superficie suave. La nieve se rotó y se desenfocó para quitar el tramado diagonal.
- La sombra de nieve es un óvalo grande y muy difuso. El pie se hunde un poco y hay nieve delante de la base.
- Los enlaces del pie van en una pastilla clara (`#3a322c` sobre `rgba(255,250,244,0.84)`), por encima de 4,5:1 aunque el fondo sea blanco o negro.
- Visto en `frame-arena-1440.png`, `frame-lluvia-1440.png`, `frame-miel-1440.png` y `frame-nieve-1440.png`.

## Hecho antes

- La nube de lluvia es un bucle de 4,8 s (24 fotogramas, WebM con alfa y `cloud-atlas.webp`) hecho con la foto densa. Se pausa con el reloj y queda quieta si se reduce el movimiento. Es una tapa baja y ancha: tapa el borde de arriba y deja ver el agua del bulbo.
- La hora va sobre una tarjeta de cristal ahumado, el mismo blur y el borde fino del menú.
- No hay barra inferior ni botones de empezar o reiniciar. Un clic empieza o pausa; el doble clic no reinicia. La rueda cambia el tiempo y arrastrar el frasco lo voltea, como en main. Espacio y Enter hacen lo mismo. El botón de Ajustes solo aparece con el ratón dentro de la ventana y se esconde a los pocos segundos; en táctil, al tocar.
- La foto cubre siempre el viewport desde un foco por escena. En horizontal el frasco queda a la izquierda y el reloj a la derecha; en vertical el reloj va debajo. Lluvia se espeja para que el cielo vacío quede bajo el reloj, y la luz y la sombra se invierten con el espejo.
- Comprobado a `00:36`: `b-arena-1440.png`, `b-lluvia-1440.png`, `b-miel-1440.png`, `b-nieve-1440.png`, `b-lluvia-390.png`, `b-lluvia-480.png`. Sin caja, vidrio vacío transparente, nube sin tapar el agua, sin barra.

## Hecho antes

- La hora es texto blanco fino, sin pastilla. En horizontal queda en el cielo de la derecha; en 390 queda arriba, sobre el cielo.
- El encuadre vuelve al cover mínimo (toda la isla de lluvia: orbes, charca y rocas). El contacto se acerca al suelo solo hasta donde la foto sigue cubriendo, sin zoom extra.
- El cristal vacío no lleva velo de color. La refracción del fondo va al 22 %. En arena el bulbo de arriba deja ver el atardecer. Si detrás hay roca oscura, el vidrio se ve oscuro porque la roca lo es.
- Los cuatro chorros son bucles de las fotos (`tex-*.jpg`), 12 fotogramas a 10 fps, WebM con alfa y atlas. El alfa solo recorta; el color es la textura. Al dibujar se tiñen con el brillo de la escena (`source-atop` al 18 %). Agua: hilo fino transparente con los cáusticos de la foto y un solo vaivén, más una onda al caer. Miel: hilo ámbar grueso y lento, con una rosca corta de la misma foto. Arena: granos de la foto, sueltos en el borde, y un montón al caer. Nieve: copos y polvo de la foto, en una columna ancha, y un montón blando.
- A un 40 % transcurrido el volumen de arriba es 0,6 (superficie y ≈ 0,17) y el de abajo 0,4 (superficie y ≈ 0,82). El de arriba ocupa más alto de bulbo.
- La nube se remateó desde `cloud-real.png`: el fleco es gris azulado luminoso (≈ 186, 196, 210) y el cuerpo ≈ 151, 160, 176. No queda costra negra.
- El panel y la barra son cristal ahumado (relleno oscuro y translúcido, blur fuerte). El acento ya no es oliva: arena ámbar, lluvia ámbar del orbe, miel oro, nieve azul gris. Va en el botón activo, los toggles y el relleno del slider.
- En viewports ≤ 900 px las capas del frasco son las de 1024. El vídeo del chorro, los atlas, el ambiente, el sonido y Analytics se cargan después del primer pintado.
- El rectángulo crema era el `multiply` del color de luz sobre `jar-front`, que es negro opaco dentro del bulbo: SCREEN lo volvía un bloque opaco y el vidrio vacío se veía negro. Ahora el alfa del frente se queda solo en los brillos, y el degradado de luz se recorta con el alfa de `jar-back`. Alrededor y a través del vidrio vacío se ve la foto. Comprobado en `clear-arena-1440.png`, `clear-lluvia-1440.png`, `clear-miel-1440.png` y `clear-nieve-1440.png`: no hay caja, y en lluvia la nube ya no se corta contra ese rectángulo.
- La luz del frasco sale de `SCENE_LIGHT`, sin regenerar capas. El sol de arena está a la derecha (sombra a la izquierda, oro); el de miel a la izquierda (sombra a la derecha, oro); lluvia toma el orbe izquierdo (ámbar, cielo neutro, sombra a la derecha); nieve toma el cielo frío (azul gris, sombra corta a la derecha). Los brillos de `jar-front` se multiplican por ese color, un degradado soft-light sombrea el lado oscuro y aclara el lado de la luz, y un rebote del suelo sube por el pie. En la captura, la arena del bulbo de arriba es más clara a la derecha y la miel más clara a la izquierda.

## Lighthouse (preview de producción, puerto 4173, 7 nov 2026)

| | Puntuación | FCP | LCP | TBT | CLS | SI |
| --- | --- | --- | --- | --- | --- | --- |
| Móvil | 95 | 0,9 s | 2,1 s | 230 ms | 0 | 1,7 s |

El escritorio de la medición anterior seguía en 100; no se ha vuelto a pasar en este paso.

## Capturas comprobadas (no blancas)

Reloj en marcha, texto `00:36` de un minuto. Tamaño y % de blanco medidos en el PNG:

- `r4-arena-1440.png` (1,3 MB, 0,29 %), `r4-miel-1440-menu.png` (1,4 MB, 0,01 %, menú abierto), `r4-nieve-1440.png` (1,2 MB, 0,18 %)
- `r6-lluvia-1440.png` (762 KB, 0,19 %) y `r6-lluvia-390.png` (306 KB, 0,11 %, hora arriba)
- Luz por escena, frasco lleno arriba: `light-arena-1440.png`, `light-lluvia-1440.png`, `light-miel-1440.png`, `light-nieve-1440.png` (0,16–0,26 % blanco)
- Chorro en marcha a `00:36`: `stream-arena-1440.png`, `stream-lluvia-1440.png`, `stream-miel-1440.png`, `stream-nieve-1440.png` (0,18–0,29 % blanco). En lluvia el centro del cuello mide ~[116, 126, 122] contra el vidrio oscuro ~[9, 7, 5].

Están en `/opt/cursor/artifacts/`.

## Qué no está

- No hay MP4 HEVC con alfa; el bucle es WebM VP9 y el atlas.
- Abeja, zorro y ventisca no salen en estas capturas: esperan unos minutos con el reloj en marcha.
- No mergear. No APK.
