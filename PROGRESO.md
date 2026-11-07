# Progreso — web fotográfica (`feature/materiales-3d`, PR #14)

No está mergeado. El móvil sigue con su renderer anterior. `apps/mobile/assets/glass/` no se commitea.

## Hecho en este paso

- La hora es texto blanco fino, sin pastilla. En horizontal queda en el cielo de la derecha; en 390 queda arriba, sobre el cielo.
- El encuadre vuelve al cover mínimo (toda la isla de lluvia: orbes, charca y rocas). El contacto se acerca al suelo solo hasta donde la foto sigue cubriendo, sin zoom extra.
- El cristal vacío no lleva velo de color. La refracción del fondo va al 22 %. En arena el bulbo de arriba deja ver el atardecer. Si detrás hay roca oscura, el vidrio se ve oscuro porque la roca lo es.
- El chorro de agua es un hilo casi recto (un solo vaivén de 2 px) y se dibuja a 56 px. La miel sigue siendo hilo más una rosca corta en la superficie.
- A un 40 % transcurrido el volumen de arriba es 0,6 (superficie y ≈ 0,17) y el de abajo 0,4 (superficie y ≈ 0,82). El de arriba ocupa más alto de bulbo.
- La nube se remateó desde `cloud-real.png`: el fleco es gris azulado luminoso (≈ 186, 196, 210) y el cuerpo ≈ 151, 160, 176. No queda costra negra.
- El panel y la barra son cristal ahumado (relleno oscuro y translúcido, blur fuerte). El acento ya no es oliva: arena ámbar, lluvia ámbar del orbe, miel oro, nieve azul gris. Va en el botón activo, los toggles y el relleno del slider.
- En viewports ≤ 900 px las capas del frasco son las de 1024. El vídeo del chorro, los atlas, el ambiente, el sonido y Analytics se cargan después del primer pintado.

## Lighthouse (preview de producción, puerto 4173, 7 nov 2026)

| | Puntuación | FCP | LCP | TBT | CLS | SI |
| --- | --- | --- | --- | --- | --- | --- |
| Móvil | 95 | 0,9 s | 2,1 s | 230 ms | 0 | 1,7 s |

El escritorio de la medición anterior seguía en 100; no se ha vuelto a pasar en este paso.

## Capturas comprobadas (no blancas)

Reloj en marcha, texto `00:36` de un minuto. Tamaño y % de blanco medidos en el PNG:

- `r4-arena-1440.png` (1,3 MB, 0,29 %), `r4-miel-1440-menu.png` (1,4 MB, 0,01 %, menú abierto), `r4-nieve-1440.png` (1,2 MB, 0,18 %)
- `r6-lluvia-1440.png` (762 KB, 0,19 %) y `r6-lluvia-390.png` (306 KB, 0,11 %, hora arriba)

Están en `/opt/cursor/artifacts/`.

## Qué no está

- No hay MP4 HEVC con alfa; el bucle es WebM VP9 y el atlas.
- Abeja, zorro y ventisca no salen en estas capturas: esperan unos minutos con el reloj en marcha.
- No mergear. No APK.
