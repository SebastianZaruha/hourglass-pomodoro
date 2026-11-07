# Progreso — web fotográfica (`feature/materiales-3d`, PR #14)

Actualizado al dejar el trabajo a medias. No está mergeado. El móvil no se ha igualado a la web.

## Hecho

- La web dibuja el frasco con las capas de `jar3d` (2048 en `/glass/hi/`): sombra, `jar-back`, refracción del fondo desenfocada una vez, textura recortada por la máscara interior, chorro, brillos en `screen`, y la nube **delante** del cristal (más ancha que el bulbo). Dentro de lluvia solo hay agua.
- El fondo cubre el viewport (`dioramaPlacement` en `packages/core/src/shape/jar.ts` y `ScenePlate.tsx`).
- Chorros: WebM VP9 con alfa (`apps/web/public/streams/*.webm`, 12 fotogramas, 10 fps, ~1,2 s) y atlas WebP de reserva. Solo suenan con el temporizador en marcha. Reducir movimiento deja el fotograma 0. No hay MP4 HEVC con alfa: este ffmpeg no lo genera; el atlas es el segundo camino.
- Menú y barra con `backdrop-filter`, borde en degradado y textos en español en una instalación nueva de la web (`useSettings` fuerza `language: 'es'`).
- Abeja (miel) y visita de nieve (zorro o petirrojo, o una ráfaga de polvo) en `apps/web/src/hourglass/ambient.ts`. Solo con el reloj en marcha, nunca en los primeros 30 s, luego cada 3–6 min, y nada si hay reducir movimiento. Los archivos salen de `/ambient/` y solo se piden con ese material.
- Versión de la web subida a 1.8.16.

## En curso

- El CSS del deslizador de «Personalizado» acaba de quitar el fondo de caja vacía (`.stepper-row.stepper-solo { background: transparent }`). No hay una captura nueva que lo confirme.
- `photoreal.ts` ya no pinta un rectángulo de tinte encima del frasco (eso se veía como un panel translúcido). Las capturas `p40-*` se tomaron con ese cambio.

## Hallazgos

- **Capturas en blanco (`fix-*.png`, 5851 bytes, 100 % blanco).** La página no llegó a pintar. La consola decía: `The requested module '.../packages/core/src/index.ts' does not provide an export named 'freshVisitClock'`. El `export * from './shape/visit'` ya estaba en disco; Vite servía un `index.ts` viejo, sin esa línea. Reiniciar Vite lo arregló. Un modelo de visión describió esas PNG blancas como si tuvieran escena: no sirven. Hay que medir píxeles (porcentaje de blanco y tamaño) antes de fiarse de una descripción.
- Tras el reinicio, `check-arena.png` y `run-*.png` / `p40-*.png` no son blancos (0–0,1 % de píxeles blancos, cientos de KB).
- `p40-*-1440.png` y `p40-lluvia-390.png` se sacaron con el reloj en marcha y el texto `00:36` de un minuto (unos 40 % transcurridos). Están en `/opt/cursor/artifacts/`, no en el repo.
- La máscara interior es RGB opaco (blanco = cavidad). `destination-in` necesita alfa, así que `lumenMask()` en `photoreal.ts` copia la luminancia al canal alfa una sola vez.

## Siguiente

1. Abrir `p40-arena-1440.png`, `p40-lluvia-1440.png`, `p40-miel-1440-menu.png`, `p40-nieve-1440.png` y `p40-lluvia-390.png` y comprobar a ojo el pie, la nube, el chorro y que no haya un rectángulo de textura. Si falla, corregir y volver a capturar.
2. Capturar el menú otra vez y confirmar que el deslizador ya no flota en una caja vacía ni hay scroll interno a 1440×900.
3. Lighthouse (emulación móvil) contra `http://127.0.0.1:5173/`. Objetivo ≥ 90; si choca con la calidad, gana la calidad y se anota el número.
4. Commit y push a `feature/materiales-3d` (PR #14). No mergear. No tocar el APK. No rehacer el móvil.

## Cómo reanudar

```bash
cd /agent/repos/hourglass-pomodoro
git checkout feature/materiales-3d
cd apps/web && npm run dev -- --host 127.0.0.1 --port 5173
```

Si la página sale en blanco, reiniciar Vite y mirar la consola: un `index.ts` cacheado sin `freshVisitClock` tira toda la app.
