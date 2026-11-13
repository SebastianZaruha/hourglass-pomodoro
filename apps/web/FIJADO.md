# Ya arreglado

Nada de esta lista se rompe. Se repasa en el build de producción, con rueda, arrastre y doble clic, antes de cada push.

- Girar o arrastrar no arranca el tiempo. Solo sigue si el reloj ya corría.
- La rueda solo cambia el tiempo. No inclina el frasco ni arranca la cuenta.
- En pausa el frasco no gira. Un clic reanuda. El doble clic en pausa no reinicia.
- El doble clic, parado o en marcha y fuera de la pausa, hace el giro de 180° y el contenido gira con el frasco. Al terminar se queda parado.
- El menú se abre en pausa y conserva el tiempo, salvo al cambiar la duración o el modo: eso gira y no arranca solo.
- No hay solapes de 360 a 1920, ni en 620×1000 ni en 465×1000. El reloj no baja al abrir el menú. El frasco no se mueve en ancho.
- La nube es semitransparente (`mix-blend-mode: screen`) y no tapa el vidrio con un bloque opaco.
- En Lluvia el agua toca el cristal.
- Al girar, la mediana del fotograma cabe en 8 ms. En reposo el bucle del frasco no pide `requestAnimationFrame`.
- La arena se pinta con granos opacos, brillo distinto en cada uno y sin esquinas a media tinta.
- El vidrio es el mismo en las escenas: desenfoque 32. La saturación es 1,4, y en Arena 1,05. El velo es oscuro y bajo.
- El texto y los iconos del vidrio son blancos en los dos modos.
