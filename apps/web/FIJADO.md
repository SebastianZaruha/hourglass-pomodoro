# FIJADO

Una línea por comportamiento. Lo activo no puede empeorar en ninguna vuelta. Entre paréntesis, la vuelta desde la que está activo. En V0 solo están activas N01–N06 y N24.

## Gestos y tiempo

- N01 (V0) La rueda solo cambia el tiempo. Nunca gira el frasco y nunca arranca la cuenta. **activa**
- N02 (V0) Arrastrar o girar el frasco nunca arranca la cuenta. Soltarlo antes de 81° lo devuelve a 0. **activa**
- N03 (V2b) Un clic empieza, pausa o reanuda tras 260 ms. En pausa solo ese clic reanuda: sin rueda, sin mantener pulsado y sin doble clic. **activa**
- N04 (V0) El doble clic hace un giro de 180° con el contenido dentro, y deja el reloj parado en la duración, con el bulbo de arriba como en una carga limpia. **activa**
- N05 (V0) Con el reloj parado, el nivel de arriba sigue a la duración al momento, de forma suave. **activa**
- N06 (V0) En marcha, el nivel de arriba baja con el tiempo, y en ciclos hay media vuelta al cambiar de fase. **activa**
- N07 (V2) En pausa, el frasco no se arrastra y un clic reanuda. **activa**

## Menú y paneles

- N08 (V1) El menú está en el sitio publicado, en vidrio, con texto blanco, sin scroll ni cortes, con padding igual y − y + redondos. **activa**
- N09 (V2b) En pausa no hay menú, ni botón, ni pie: solo Pausa y la pista, y solo un clic reanuda, sin rueda, sin mantener pulsado y sin doble clic. Escena, modo y sonido mantienen la pausa si se cambian desde el menú en marcha; la duración y Sesión/Ciclos reinician con el giro. **activa**
- N10 (V2) En pausa: «Pausa» traducida, con el color de producción en claro y blanca en oscuro, la escena borrosa, y el botón del menú y el pie ocultos. **activa**
- N11 (V3) El banner de cookies está en el sitio publicado, en vidrio, a ≥ 12 px del pie, y a 720 px de ancho en pantallas grandes. **pendiente**
- N12 (V4) El aviso Android está en el sitio publicado. Nunca coincide con las cookies, el menú, la pausa o el panel legal. El reloj nunca lo pisa. **pendiente**
- N13 (V5) En el panel legal, la cabecera queda fija y nunca tapa el texto. Las URL son las de siempre. **pendiente**
- N14 (V1) Nada se solapa (reloj, frasco, menú, pie, avisos y botón) a 1440×900 y 390×844. **activa**

## Frasco y contenido

- N15 (V6) A simple vista, el contenido llena el cristal: no hay franja de fondo entre la arena o el agua y la pared. **activa**
- N16 (V6) El chorro de arena sale del centro del cuello y nunca atraviesa el vidrio. **activa**
- N17 (V6) Al cargar no se ve ningún frasco provisional de líneas o elipses. **activa**
- N18 (V7) La arena resbala grano a grano al inclinar, sin cambiar los granos de arriba, y nunca se parte en bloques al voltear. **pendiente**
- N19 (V8) Cambiar de escena no mueve ninguna caja y no deja restos: la escena nueva empieza limpia. **pendiente**
- N20 (V8) Cada escena y modo muestra su propio fondo (el vídeo correcto). **pendiente**
- N21 (V9) El agua es una masa continua, horizontal en el mundo, que se mece y se calma en menos de 1 s, sin línea blanca y nunca marrón. **pendiente**
- N22 (V10) Las gotas caen verticales en pantalla, solo en marcha y a menos de 35°. **pendiente**
- N23 (V11) La nube nunca se mueve ni gira con el frasco: solo cambia de opacidad. Su bucle no salta. **pendiente**
- N24 (V0) `npm run build` pasa, incluido `comprobar-imports`. **activa**
