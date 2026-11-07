# Progreso — web fotográfica (`feature/materiales-3d`, PR #14)

No está mergeado. El móvil sigue con su renderer anterior.

## Hecho en este paso

- El pie de arena, miel y nieve se ancla abajo a la izquierda con el mismo recorte ampliado (`coverFrame`), no con el cover mínimo que dejaba la miel flotando. El panel de Ajustes queda a la derecha (`right` + `32vw`) para no tapar el frasco.
- La nube se recompuso en premultiplicado: el borde ya no es una costra negra; los flecos son grises y translúcidos.
- El chorro de miel ya no aplasta toda la rosca en un borrón: solo se dibujan los 70 px de arriba, como un hilo sobre la superficie. Los bucles de agua y miel se regeneraron más gruesos y con brillo.
- La hora va sobre una pastilla de cristal (`backdrop-filter`) para leerse encima de las piedras y las flores.
- Las fotos de escena y las briznas nacen ocultas y se muestran al colocarlas. Eso bajó el CLS de 0,88 a 0.

## Lighthouse (preview de producción, `vite preview` en el puerto 4173, no el dev server)

| | Puntuación | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Móvil | 87 | 1,9 s | 2,5 s | 370 ms | 0 |
| Escritorio | 100 | 0,2 s | 0,5 s | 50 ms | 0 |

Medido el 7 nov 2026 contra el build de esta rama. El dev server daba 23/49 porque sirve cada módulo suelto; no vale. El móvil no llega a 90 por el TBT (370 ms). La calidad de las capas 2048 se mantiene.

## Capturas comprobadas (no blancas)

`/opt/cursor/artifacts/v2-*.png`, reloj en marcha, texto `00:36` de un minuto (40 % transcurrido), 0 % de píxeles blancos, sin excepciones en consola:

- `v2-arena-1440.png`, `v2-lluvia-1440.png`, `v2-nieve-1440.png`
- `v2-miel-1440-menu.png` (menú abierto, panel a la derecha)
- `v2-lluvia-390.png` (esta usa el pie al 80 % de alto; el retrato se acaba de bajar al 86 % y no se ha vuelto a capturar)

La nube de `v3-lluvia-cloud.png` es la versión con el borde suavizado.

## Hallazgo de las capturas blancas

`fix-*.png` (5851 bytes) son un PNG blanco. Causa: Vite servía un `index.ts` sin `export * from './shape/visit'`, y el navegador lanzaba `does not provide an export named 'freshVisitClock'` antes de pintar. Reiniciar Vite lo arregló. No fiarse de una descripción de una imagen de 5 KB.

## Siguiente

- Volver a capturar 390×844 con el pie al 86 %.
- El chorro, aunque es un WebM con alfa, en el cuello sigue viéndose estrecho. Si el dueño lo quiere más grueso, subir el ancho de dibujo en `drawStream`.
- No hay MP4 HEVC con alfa.
- Abeja y nieve ambiental no salen en estas capturas: esperan 3–6 min y el reloj en marcha.
- No mergear. No APK. No igualar el móvil.
