# Diagnóstico del frasco — por qué no responde a la luz del fondo

V14, punto 7. Solo lectura. En esta vuelta no se cambia el vidrio.

El frasco se ve teñido y plano porque lo que se pinta no es vidrio: es una foto de un vidrio ya iluminado en un estudio, compuesta en `screen`. Esa foto lleva su luz dentro. El fondo de la escena no entra en el cálculo, y el único pase que sí miraba la dirección de la luz de la escena está apagado (`fuerza: 0`).

## Capas, de atrás hacia delante

El orden está en `pintarVidrio` (`apps/web/src/comun/frasco/pintarVidrio.ts`).

1. **Sombra de suelo** (`sombra.ts`). Dos elipses desenfocadas (lejos y de contacto) más un óvalo en `screen` (`BRILLO`). No gira con el frasco. Se apaga con `|cos(ángulo)|`. Es la sombra del suelo, no un sombreado del vidrio. No tiñe la pared.

2. **Dorso** (`/frasco/jar-back.webp`), `source-over`. Antes de pintarse pasa por `vaciarInterior` (`geometria.ts`): dentro de la máscara, todo píxel con luminancia menor que 168 queda con alfa 0. Lo que sobrevive es la parte clara de la foto, opaca, con el color del estudio. Se pinta detrás del contenido.

3. **Contenido** (arena o agua), en el mismo giro que el vidrio.

4. **Frente** (`/frasco/jar-front.webp`), **`globalCompositeOperation = 'screen'`**. Esta es la capa que tiñe. Antes del `screen` la foto pasa por dos procesados, los dos horneados, ninguno lee el fondo:
   - `afinarBrillos`: entre el 42 % y el 54,5 % de la altura (la franja del cuello) reescribe los píxeles hacia blanco 245, medio 110 o 0. El resto de la foto no lo toca.
   - `vaciarInterior`: dentro de la silueta, alfa 0 si la luminancia es menor que 168. Fuera de la silueta no cambia un píxel. El comentario del código lo dice: ahí vive el color de la pared, y no se repinta.

5. **Luz de escena** (`luz.ts`, `soft-light`). Degradado del `tinte` en la `direccion`, contra-girado para quedarse en el mundo, con alfa `fuerza * 0,45`. Arena, Lluvia y Clásico tienen `luz.fuerza: 0` en los dos modos. La función sale en la primera línea. **La luz de la escena no llega al vidrio.**

6. **`aspecto.vidrio.velo` y `aspecto.vidrio.saturacion`** están en el contrato y en cada escena, pero el pintor del frasco no los lee. `--velo` y `--vidrio-sat` en `vidrio.css` son del vidrio de las hojas (menú, pausa, legal), con valores fijos. No son el tinte del frasco.

La máscara (`jar-mask.webp`) solo recorta la silueta, vacía el interior oscuro y, si las fotos no han llegado, dibuja el sustituto gris. No ilumina.

## Qué tiñe el vidrio de forma uniforme

El frente en `screen`.

`screen` hace `1 - (1 - origen) * (1 - destino)`. Cada píxel que sobrevivió al umbral 168 (la pared clara y los brillos de la foto) aclara lo que tiene debajo —fondo, dorso y contenido— hacia el color de esa foto. El color es el mismo en Arena de noche, en Lluvia y en Clásico, porque sale del archivo, no del fondo que hay detrás. Por eso parece un velo o un tinte puesto encima, y por eso los arreglos anteriores, que volvían a tocar la misma foto (vaciar el negro, afinar el cuello, bajar la fuerza de la luz), no hacen que el vidrio refleje la escena: siguen componiendo una luz que ya venía pintada.

El pase del cuello empeora una franja, no el frasco entero. El tinte de todo el cuerpo es el `screen` de la pared.

Apagar `pintarLuz` quitó el único término que dependía de `luz.direccion`. Con fuerza 0 el frasco queda exactamente con la iluminación del estudio, sea de día o de noche.

## Qué no va a funcionar

Otro retoque de `jar-front.webp`, otro umbral, otro `screen` más suave o volver a subir `fuerza` sobre la misma foto. La foto ya contiene una dirección de luz. Multiplicarla o aclararla cambia el velo, no lo sustituye por la luz del fondo. Es el mismo fallo de las vueltas anteriores.

## Cambio que propongo

Dejar de usar las dos fotos como cuerpo del vidrio y pintar el frasco en tiempo real, con la normal de la superficie.

La vía corta, y la que haría primero: un mapa de normales horneado una vez desde la silueta (o desde la máscara) y un shader 2D sobre el recorte que ya existe. La vía completa: un torno 3D del perfil del frasco y el mismo shader. Las dos leen el fondo de verdad. Recomiendo la segunda si el coste de una malla de revolución cabe; si no, el mapa de normales ya resuelve el tinte plano, que es el fallo de ahora. No hace falta un modelo 3D para dejar de usar la foto, pero sí hace falta una normal y una muestra del fondo. Seguir con la lámina no.

El shader, en los dos casos, tendría cuatro términos y ninguno sería una foto:

- **Tinte.** Color de absorción del vidrio por el grosor (más en el borde, menos de frente). No un velo gris uniforme.
- **Refracción.** Muestrear el fondo ya pintado (la misma capa que usa el agua) desplazado por la normal, para que la pared doble la escena.
- **Reflejo.** Fresnel de ese fondo más un especular de `luz.direccion` y `luz.tinte`. El hombro que mira a la luz se aclara; el otro queda oscuro. Esto es lo que la foto no puede hacer.
- **Sombra.** La del suelo puede quedarse como está. La de la pared sale de la misma normal (auto-oclusión en el lado contrario a la luz) y de un término de contacto junto al vidrio, no del sombreado que ya trae el JPEG.

`afinarBrillos`, el `screen` del frente y `vaciarInterior` sobran en ese camino: existen para domesticar una foto que el shader reemplaza. `pintarLuz` también, porque su degradado es el sustituto pobre del especular.
