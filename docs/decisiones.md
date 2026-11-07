# Registro de decisiones

Cada punto: a favor, en contra, qué se descartó y qué quedó. No es un estudio de usuarios.

## Materiales

A favor de reutilizar el autómata de arena para el agua y la nieve: un solo camino, inclinación y pausa ya resueltas. En contra: grano a grano es caro al volcar el móvil, y nadie cuenta los granos. Sebastián pidió porcentaje.

Descartado: metaballs, Lottie, shader de fluido completo, nieve como tercer material de esta versión (estacional; el registro la puede añadir después).

Quedó: arena como está. Lluvia (nube, rayas, agua) y miel (cúpula, gotas, ámbar), las dos por `flowPose`.

## Chorro

A favor de las partículas actuales: ya existen y salpican. En contra: su cantidad y su física dependen del fotograma, y un temporizador largo se vería más pobre si se ataran al caudal real.

Descartado: simular cada gota.

Quedó: un patrón reciclado (`writeRibbons`) a ciclos por segundo fijos. La arena conserva sus partículas.

## Nube

A favor de un óvalo o de un shader por píxel: poco código. En contra: se ve plano, o cuesta como el shader de la arena.

Descartado: desenfoque en cada fotograma, vídeo de nubes.

Quedó: varios copos de un círculo suave creado una vez, solapados, que encogen con el porcentaje. Cuando llegue `cloud-puff.png`, se sustituye el círculo.

## Fondo

A favor del vídeo de 2–3 s: el césped se mueve y se parece más a un plano. En contra: una sesión dura 25–60 minutos; el decodificador no para, y en Android Skia copia el fotograma en cada refresco. Calienta sin hacer falta, porque la foto ya tiene la profundidad.

A favor de un degradado solo: barato y ya está. En contra: no es la foto de producto que pidió Sebastián.

Descartado: vídeo, diorama 3D de rocas y esferas, hierba calculada.

Quedó: cuatro capas estáticas cuando existan los archivos (escena desenfocada, piedra anclada al pie, frasco en Skia, briznas transparentes que no tapan el nivel ni los gestos). Hasta entonces, el degradado con un tinte por material. La miel no lleva césped nítido: el ámbar ya es el detalle. La nieve está descrita en `docs/assets-needed.md` y no se empaqueta todavía.

## Botones (móvil)

A favor de imitar el vidrio esmerilado con `BackdropBlur`: es lo de la referencia. En contra: en el A55 ya se midió que el desenfoque del menú daba tirones (1.8.9) y se quitó.

Descartado: blur en vivo.

Quedó: bandeja semitransparente, borde claro de 1 px, sombra suave, oliva `#6B7344` al activar (contraste del icono claro sobre el oliva, por encima de 4:1). Al pulsar, el botón encoge con un muelle y vuelve. El orden de la fila no cambia.

## Barra web

A favor de dejarla siempre: se ve todo. En contra: en una ventana pequeña tapa el frasco.

Descartado: sincronizar ajustes con el móvil.

Quedó: fija desde 960×680. Por debajo, solo el menú; la fila entra con el ratón o el foco y sale a los 320 ms. Sin hover (táctil), no entra. Sin `backdrop-filter`, el fondo de la píldora es opaco.

## Selector

A favor de un botón que rota, como el tema: no alarga el menú. En contra: no se ven las tres opciones.

Quedó: una fila Arena / Lluvia / Miel, con rol de grupo de radio. Se guarda en `contentId`. Un ajuste de la 1.8.15 sin ese valor, o con uno desconocido, sigue en arena.

## Rendimiento

A favor de optimizar la arena a un porcentaje: en esta máquina un paso con la masa despierta costó 1,71 ms y la pose 0,016 ms (Vitest, no un A55). En contra: Sebastián aprobó las avalanchas. No se cambia en este PR.

A favor de 120 Hz en todo, incluido un fondo animado. En contra: una sesión larga no necesita 120 Hz en el césped, y el calor importa más que el último fotograma.

Quedó: 120 Hz al tocar y al ver caer el material, 60 como mínimo. En reposo, bucle parado. Si el fotograma no cabe, menos rayas y sin ondas, sin aviso. No hay sensor térmico en JavaScript; la señal es la caída de fps.

## Accesibilidad

La fila de materiales es un radiogrupo con nombre. El fondo en capas no roba el gesto. Reducir movimiento congela la fase del chorro. El aviso al cambiar de material solo se dice si el lector está encendido (el `announce` de la app ya lo filtra).
