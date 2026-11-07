# Materiales del reloj

Arena, lluvia y miel. La arena sigue siendo la simulación de granos. La lluvia y la miel no cuentan partículas: el nivel es el porcentaje de tiempo y el chorro es un dibujo continuo.

## Cómo va la arena hoy

El temporizador no cuenta fotogramas: guarda marcas de tiempo. Cada fotograma, `useSandEngine` pregunta cuánto queda y `syncSandToTarget` pasa por el cuello los granos que tocan. La rejilla (`SandSimulation`) mueve solo los granos despiertos. El chorro decorativo es `StreamParticles`. El pintor copia la rejilla a una imagen diminuta y un shader de Skia la convierte en microgranos. Eso se publica en un `SkPicture`. El lienzo lo dibuja el hilo de la interfaz.

El marcapasos (`useFramePacer`) no encola fotogramas: la interfaz pide el siguiente cuando ha dibujado el anterior. Si el móvil puede 120 Hz, el bucle puede ir a 120. El vidrio se regraba como mucho cada 50 ms (~20 fps) y eso no frena el material.

Presupuesto de la interfaz: 8,3 ms para 120 Hz y 16,7 ms para 60 Hz. En reposo (arena asentada, tiempo parado, móvil quieto) el bucle se detiene.

A 60 Hz la simulación da 2 pasos por fotograma, como siempre. A 120 Hz da 1, para no duplicar el trabajo ni asentar la arena el doble de rápido (`takeSimSteps`).

## Lluvia y miel

`flowPose` en `packages/core/src/shape/geometry.ts` hace `p = transcurrido / duración`. Arriba queda `1 − p`, abajo `p`. La inclinación solo tumba la superficie. El chorro (`writeRibbons`) avanza con una fase en ciclos por segundo: un reloj de 5 minutos y uno de 60 se ven igual de vivos. La cantidad no depende de la duración, solo del porcentaje.

La lluvia pinta una nube de círculos suaves (textura hecha una vez, sin desenfoque por fotograma), rayas en el cuello y un nivel de agua abajo. La miel pinta dos charcos con una cúpula suave y unas gotas gruesas. Al pausar, la fase se congela y, si no queda nada moviéndose, el bucle para.

El volteo reinicia la fase (el temporizador ya lo hacía). De lado, la gravedad vertical no basta y no hay chorro; el temporizador, además, pausa.

## Fondos

Hasta que lleguen los archivos de `docs/assets-needed.md`, el fondo es el degradado de siempre, con un tinte fijo por material (lluvia un grado más gris, miel un grado más ámbar). En el móvil entra en el tema del lienzo; en la web, en `--bg-top` y `--bg-bottom`. El menú no usa ese tinte: sus colores siguen en la hoja.

Cuando existan las imágenes, serán cuatro capas estáticas: escena desenfocada, piedra anclada al pie del frasco, el frasco en Skia, y briznas transparentes por delante que no tapan el nivel ni reciben toques. No hay vídeo.

## Gustos (hipótesis, no un estudio)

No hay porcentajes de usuarios. Es un razonamiento:

- Quien estudia u oposita durante horas quiere calma y ver el progreso de un vistazo. La arena ya lo cumple. La miel, lenta y cálida, también. La lluvia, si es un claro y no una tormenta, se parece a los fondos de sonido de apps de foco (Tide, Noisli, Rainy Mood): se asocia con concentrarse, sin que eso mida a cuánta gente le gusta verla.
- Quien trabaja quiere algo sobrio. La arena es la de por defecto.
- Purpurina, luciérnagas o pétalos piden la mirada en cada segundo. Para una sesión de 25–60 minutos estorban, y además costarían más.

## Calidad y calor

No hace falta ser la app más ajustada del mundo. Sí hace falta que una sesión larga no deje el móvil inservible.

- Al tocar, el objetivo sigue siendo 120 Hz, con 60 como mínimo. Si el fotograma de JavaScript no cabe, `updateDetail` adelgaza el chorro y quita las ondas sin un aviso.
- En reposo el bucle ya se para. El vidrio no se regraba si la luz no se mueve.
- El fondo, cuando sea foto, es estático. Un vídeo en bucle durante 25–60 minutos se descartó: en Android, Skia copia cada fotograma nuevo del decodificador (`makeNonTextureImage` en `useVideo`) y eso suma calor sin que las briznas quietas lo necesiten.
- No hay lectura del estado térmico del sistema (haría falta código nativo nuevo). La señal que sí tenemos es la caída de fps: si el hueco entre fotogramas se alarga, baja el detalle del chorro.

## Dónde se midió

En esta máquina virtual, solo el hilo de JavaScript, con Vitest, rejilla de 121 columnas (9791 granos) y el perfil clásico. No es un Galaxy A55, no es la GPU y no es una sesión de 10 minutos. No hay termómetro ni contador de batería aquí.

| Qué                                                | Tiempo medio |
| -------------------------------------------------- | ------------ |
| Un paso de arena con la masa inclinada y despierta | 1,71 ms      |
| Un paso de arena ya quieta                         | 0,18 ms      |
| Pose de porcentaje + altura de la superficie       | 0,016 ms     |

A 120 Hz caben 8,3 ms. Un paso caro de arena cabe, pero el shader de microgranos (GPU) no está en este número. La pose de la lluvia y la miel es unas cien veces más barata que ese paso caro, en CPU.

En Chrome headless de esta misma máquina, con la lluvia en marcha, 179 fotogramas seguidos salieron a 16,7 ms (60 fps: el tope del compositor, no un techo de la app). No es el Galaxy A55.

Para medir el móvil de verdad: mantener pulsado el título «Ajustes» enseña fps y milisegundos (apagado no hace nada).

No se generó un APK en esta máquina: no hay SDK de Android en el entorno. El `versionCode` queda en 10816.

## Web

La web dibuja lluvia y miel con las mismas funciones del core. La arena no cambia. La barra de cristal es fija si la ventana mide al menos 960×680; si no, solo el menú, y la barra aparece al pasar el ratón o al enfocar, con 320 ms de retardo al salir. En táctil sin hover no aparece. `backdrop-filter` tiene un fondo opaco de reserva.
