# Registro de decisiones

Cada punto: a favor, en contra, qué se descartó y qué quedó. No es un estudio de usuarios.

## Materiales

A favor de reutilizar el autómata de arena para el agua y la nieve: un solo camino, inclinación y pausa ya resueltas. En contra: grano a grano es caro al volcar el móvil, y nadie cuenta los granos. Sebastián pidió porcentaje.

Descartado: metaballs, Lottie, shader de fluido completo.

Quedó: arena como está. Lluvia (nube, rayas, agua), miel (cúpula, gotas, ámbar) y nieve (manto arriba, capa abajo, copos con tope fijo). Las tres por `flowPose`.

## Chorro

A favor de las partículas actuales: ya existen y salpican. En contra: su cantidad y su física dependen del fotograma, y un temporizador largo se vería más pobre si se ataran al caudal real.

Descartado: simular cada gota.

Quedó: un patrón reciclado (`writeRibbons`, y `writeFlakes` para la nieve) a ciclos por segundo fijos. La arena conserva sus partículas. El tope de copos es 16.

## Nube

A favor de un óvalo o de un shader por píxel: poco código. En contra: se ve plano, o cuesta como el shader de la arena.

Descartado: desenfoque en cada fotograma, vídeo de nubes.

Quedó: `cloud-puff.png` y `cloud-shade.png`, dibujados unas pocas veces por fotograma. Si la textura no está, un degradado. No hay desenfoque por fotograma.

## Fondo

A favor del vídeo de 2–3 s: el césped se mueve y se parece más a un plano. En contra: una sesión dura 25–60 minutos; el decodificador no para, y en Android Skia copia el fotograma en cada refresco. Calienta sin hacer falta, porque la foto ya tiene la profundidad.

A favor de un degradado solo: barato y ya está. En contra: no es la foto de producto que pidió Sebastián.

Descartado: vídeo, diorama 3D de rocas y esferas, hierba calculada.

Quedó: el frasco se apoya en la hierba. Las piedras están en la foto, no debajo. El punto de contacto y el tamaño de la sombra se leen de `packages/core/src/shape/anchors-ground.json`. Cambiar las fotos o ese JSON no pide tocar el código. Escena y briznas usan el mismo recorte. Los `stone-*.webp` no se dibujan.

## Botones (móvil)

A favor de imitar el vidrio esmerilado con `BackdropBlur`: es lo de la referencia. En contra: en el A55 ya se midió que el desenfoque del menú daba tirones (1.8.9) y se quitó.

Descartado: blur en vivo.

Quedó: la hoja es un vidrio ahumado de 36 px de radio, con filo de luz. El desenfoque es una foto de la escena calculada una vez y recortada; no hay `BackdropBlur` por fotograma. La opción elegida es el oliva `#6B7344`. La fila rápida no cambia de orden. En la web el mismo aspecto usa `backdrop-filter`, con fondo opaco si falta.

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
