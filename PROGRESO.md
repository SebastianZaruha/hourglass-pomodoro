# Progreso — web fotográfica (`feature/materiales-3d`, PR #14)

No está mergeado. El móvil sigue con su renderer anterior. `apps/mobile/assets/glass/` no se commitea.

## Hecho en este paso

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
