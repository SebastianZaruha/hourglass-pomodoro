# Diseño web

Este documento fija el sistema de la web fotográfica antes de otro cambio de código. No implementa nada. El marco del frasco no vuelve.

La auditoría se hizo el 7 nov 2026 contra `http://127.0.0.1:5173` en la rama `feature/materiales-3d`, interactuando en Chrome. Las capturas están en `docs/audit/`. Las medidas salen de `getBoundingClientRect` en esa sesión.

## Qué se conserva

El frasco se queda sin marco. Los intentos de postes y capuchones se leían como líneas y discos, y un raster sombreado a mano seguía pareciendo dibujado. Hasta que exista una capa fotográfica alineada con `geometry.json` que aguante al lado del vidrio, no hay marco.

Se conservan la tarjeta de cristal del reloj, el frasco a la izquierda y el reloj a la derecha en ventana ancha, la lluvia espejada, y la ausencia de barra inferior.

## Auditoría

En las cinco medidas no hay ningún botón Arena, Lluvia, Miel ni Nieve. `GlassDock` sigue en el repo y no está montado. La elección de escena solo existía en esa barra. Capturas `audit-1440-idle.png`, `audit-1440-menu.png`, `audit-390-menu.png`.

El botón de Ajustes nace con opacidad 0 y `pointer-events: none`. Solo aparece tras `mousemove`. En 1440×900 está en (1372, 818), esquina inferior derecha, no bajo el reloj. Captura `audit-1440-idle.png` frente a `audit-1440-hot.png`.

En ancha el panel no está centrado bajo el reloj. En 1440×900 el reloj ocupa x 870, ancho 427 (centro 1084). El panel abierto ocupa x 995, ancho 416 (centro 1203). Queda 119 px a la derecha del reloj, pegado al borde. Al abrirlo el reloj salta de y 328 a y 94 por `--clock-lift`. Igual en 1024×768 (`audit-1024-menu.png`). Captura `audit-1440-menu.png`.

El control Personalizado es `.glass-cap`, 28×112 px en las cinco medidas. Es vertical. Capturas `audit-1440-custom.png` y `audit-390-menu.png`.

El panel usa un relleno oscuro al 34 % y un borde que empieza en blanco al 55 %. En la foto se lee como una tapa clara, no como el cristal oscuro de la referencia. Captura `audit-1440-menu.png`. La referencia es `assets/ref_glass_weather_ui.jpg` en el hilo. Cristal oscuro, blur fuerte, filo luminoso fino más claro arriba a la izquierda, sin degradado blanco de relleno, sombra interior suave, botones redondos translúcidos y el acento solo en el activo.

Arrastrar el frasco visible no lo gira. Con el reloj parado, el recorte del frasco en 1440×900 (x 560–900, y 180–780) tuvo diferencia de píxeles 0 antes y después del arrastre. `drawPhotoreal` no lee `gestureAngle`. `hitVessel` usa `layoutFor` del vidrio clásico centrado, no `dioramaPlacement`.

El clic sí empieza la cuenta. El título pasó de `01:00 · Hourglass Pomodoro` a `00:59 · Hourglass Pomodoro` al segundo. La rueda, con el reloj parado, pasó la hora de `01:00` a `06:00` en las cinco medidas. El fallo de la primera lectura (seguía en `01:00` a los 0,5 s) era el retardo de un segundo, no un clic muerto.

`isWideLayout` pide ancho de al menos 46 rem y ancho mayor que alto × 1,05. 480×360 es apaisado y aun así sale `data-layout=narrow`. El panel queda en 72 px de alto (`min(40vh, 100vh - 18rem)`). Solo se lee «Ajustes» y una línea cortada. El slider, de 112 px, queda fuera del panel (y 461, el panel acaba en y 346). Captura `audit-480-custom.png`.

En 390×844 el panel (y 493, alto 338) tapa el reloj (y 745). El slider vertical asoma por abajo del contenido. Captura `audit-390-menu.png`.

En 768×1024 el panel (y 601, alto 410) tapa el reloj (y 869). Captura `audit-768-menu.png`.

En 480×360 el botón de menú (y 290, 48×44) pisa el reloj (y 278, alto 71).

No hay marco en estas capturas. Eso se queda así.

## Qué hace main y qué se rompió

La web publicada en `origin/main` es el reloj mínimo.

| Regla en main | Estado en esta rama |
| --- | --- |
| Un clic espera 260 ms y entonces empieza o pausa. | Sigue. Medido en el título. |
| Doble clic reinicia, salvo si la pareja empezó en pausa (`decideStageDoubleClick`). | Aquí el doble clic no reinicia, a petición posterior. Se queda así. |
| Rueda cambia la duración si el reloj no corre y el menú está cerrado. | Sigue. |
| Arrastrar el vidrio lo gira. A partir de 0,45π el suelte voltea (`FLIP_COMMIT` en `HourglassView`). | Roto. El dibujo fotográfico ignora el gesto y el hit no usa su sitio. |
| Espacio y Enter alternan. Escape cierra el menú. | Sigue en `App.tsx`. No se volvió a pulsar en esta pasada. |
| Ancha. Dos columnas. El reloj, centrado en la derecha, sin pastilla. | La columna sigue. La pastilla es nueva y se queda. |
| Estrecha. El reloj debajo del frasco. | Sigue cuando `data-layout=narrow`. |
| El botón de menú está abajo a la derecha y se ve al pasar el ratón. | Ahora está oculto hasta `mousemove` y se esconde a los 3,2 s. |
| El panel ancho va a la derecha y el reloj sube para no chocar. | Sigue, y por eso el menú no queda centrado bajo el reloj. |
| No hay selector de escena. | La escena se añadió en la barra y luego se desmontó la barra. No quedó otro sitio. |

## Sistema

Una sola regla de composición, un solo material de cristal, un solo sitio para la escena.

### Composición

Ancha. El frasco ocupa la mitad izquierda y se apoya en el suelo de la foto. El reloj ocupa la mitad derecha, centrado en vertical. El panel de Ajustes, cuando está abierto, tiene el mismo centro horizontal que el reloj y empieza 16 px bajo el reloj. No empuja el reloj.

Estrecha. El frasco arriba, el reloj debajo, el panel como hoja inferior que no tapa el reloj. El slider cabe dentro de la hoja.

El corte ancho es el de main. Ancho de al menos 46 rem y ancho mayor que alto × 1,05. Una ventana apaisada por debajo de 46 rem (480×360) no puede usar la hoja de 40 vh pensada para un teléfono alto. En ese caso el panel es una hoja con scroll, de alto como máximo la mitad de la ventana, y el reloj sigue a la derecha si cabe una columna de 16 rem. Si no cabe, se apila y el panel hace scroll.

### Fondo

La foto cubre el viewport con el cover mínimo. El foco de cada escena (`SCENE_FOCUS` en `packages/core/src/shape/jar.ts`) cae cerca del centro. En ancha el pie del frasco se acerca al 30 % del ancho sin dejar huecos. En estrecha el pie se centra. Lluvia se dibuja con `scaleX(-1)` y el contacto y la luz se leen al revés, para que el cielo vacío quede bajo el reloj.

### Cristal

Un solo material, el de la referencia. Lo usan la tarjeta del reloj, el panel y los botones. No hay un degradado blanco de relleno.

| Token | Valor |
| --- | --- |
| `--glass-tint` | `rgba(22, 20, 18, 0.46)` |
| `--glass-blur` | `blur(32px) saturate(1.35)` |
| `--glass-rim` | 1 px, blanco 0,55 arriba a la izquierda hasta blanco 0,08 abajo a la derecha |
| `--glass-inset` | `inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -12px 24px rgba(0, 0, 0, 0.18)` |
| `--glass-radius` | `28px` en paneles, `999px` en botones redondos |
| `--accent` | Por escena. Arena ámbar, lluvia ámbar del orbe, miel oro, nieve azul gris. |

El botón inactivo es el mismo cristal, más transparente. El activo no se rellena de sólido. Lleva el acento en un brillo (`box-shadow`) y un velo del mismo color al 35 %.

La tarjeta del reloj usa el tamaño de los dígitos como `em`. Relleno superior 0,38 em, lateral 0,55 em, inferior 0,44 em. Entre la hora y la pista hay 0,28 em. La pista va al 0,18 em. En ancha el tamaño es `clamp(2.7rem, min(6.8vw, 14vh), 7.25rem)`. En estrecha, `clamp(2.15rem, min(11vw, 8vh), 4.4rem)`. Al medir, la altura de `.readout` partida por la altura de `.time` queda entre 1,6 y 1,9 cuando la pista es una línea.

### Menú

Orden, de arriba abajo.

1. Escena. Cuatro opciones. Arena, Lluvia, Miel, Nieve. Es el primer control.
2. Sesión única o Ciclos.
3. Presets de 5, 10, 15, 25, 45 y 60.
4. Personalizado. Un slider horizontal de ancho completo y 28 px de alto. El thumb es un círculo de cristal. No existe `.glass-cap` vertical.
5. Claro, idioma y sonido, en botones redondos de cristal.

### Cuándo se ve el botón

Sin puntero dentro de la ventana solo se ven el frasco y el reloj. `mousemove` o `mouseenter` muestran el botón. `mouseleave` lo esconde. Si el puntero sigue dentro y no se mueve, se esconde a los 3 s. En táctil, un toque lo muestra y el mismo plazo lo esconde. Con el panel abierto el botón no hace falta. El panel no se cierra solo por ese plazo.

### Interacción

| Gesto | Efecto |
| --- | --- |
| Clic en el escenario | Empieza o pausa, tras 260 ms por si llega otro clic. |
| Doble clic | No reinicia. |
| Rueda, reloj parado, menú cerrado | Cambia la duración. |
| Arrastre sobre el frasco fotográfico | Gira ese frasco. Al soltar, si el ángulo pasa de 0,45π, voltea y reinicia, como en main. |
| Espacio o Enter | Igual que el clic. |
| Escape | Cierra el menú o el texto legal. |
| Reducir movimiento | Sin giro de entrada, nube en el fotograma 0, superficies quietas. |

El arrastre tiene que acertar el frasco que se ve (`dioramaPlacement`) y `drawPhotoreal` tiene que aplicar el mismo ángulo. Hoy ninguna de las dos cosas ocurre.

### Lista de comprobación

Hay que hacer el gesto, no solo mirar una foto.

1. En 1440×900, sin mover el ratón, no hay botón ni barra. Al moverlo, aparece el botón. A los 3 s se va.
2. Abrir Ajustes. El primer control cambia Arena, Lluvia, Miel y Nieve, y la foto cambia.
3. El centro horizontal del panel coincide con el del reloj, con 8 px de tolerancia. El reloj no se mueve al abrir.
4. Personalizado es una pista más ancha que alta. Arrastrarla cambia la hora.
5. El panel y la tarjeta usan `--glass-tint` y no tienen una franja blanca de relleno arriba.
6. Clic. El título baja un segundo. Otro clic lo deja parado.
7. Doble clic. La cuenta no vuelve a empezar desde el principio.
8. Rueda con el reloj parado. La hora cambia. Con el reloj en marcha, no cambia.
9. Arrastre sobre el frasco. El vidrio que se ve gira. Un arrastre largo lo voltea.
10. Repetir 2, 3 y 4 en 1024×768, 768×1024, 390×844 y 480×360. En 480×360 el panel hace scroll y no queda en 72 px. En 390 y 768 el reloj sigue visible encima del panel.
11. Escape cierra el panel.

## Qué no se toca hasta confirmar

Ningún archivo de `apps/web` ni de `packages/core` cambia con este documento. El orden, cuando se confirme, es el menú (escena, slider horizontal, sitio bajo el reloj, cristal), después el arrastre del frasco fotográfico, y al final el corte de 480×360. El marco no entra en ese orden.
