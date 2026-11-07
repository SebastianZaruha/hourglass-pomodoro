# Activos visuales que faltan

Lista para generar **fuera** de este entorno y dejar en el repo sustituyendo el
archivo. Si el archivo aún no está, se ve el degradado de siempre. Cuando llegue
el definitivo, no hay que tocar lógica: se sustituye el archivo y se reconstruye.

No hace falta copiar la escena 3D de rocas de estudio ni las esferas de luz. Hace
falta **su nivel de acabado**: una foto quieta, algodón dentro del frasco, luz
suave, paleta cálida. No hay vídeo.

Paleta de trabajo (sRGB):

| Uso                   | Claro                                              | Oscuro                                   |
| --------------------- | -------------------------------------------------- | ---------------------------------------- |
| Fondo arena           | `#EBE5DD`                                          | `#201B17`                                |
| Tinta                 | `#4F443B`                                          | `#E8DCCB`                                |
| Oliva de botón activo | `#6B7344`                                          | `#C5C8A4`                                |
| Nube                  | gris cálido `#E4E0D8` … `#F7F4EF`, panza `#C5C2BA` | un paso más oscura, nunca azul eléctrico |
| Agua                  | `#A8B4B6` … `#D5DCDE`                              | `#6E8086`                                |
| Miel                  | `#D4A04A` … `#F0D7A0`                              | `#C48A3C`                                |
| Luz cálida            | `#F8F1E6`                                          | `#463B31`                                |

Gamma: sRGB. Alfa **recto** (no premultiplicado): Skia lo lee como Unpremul.
No incluir perfil de color raro ni metadatos enormes.

---

## Prioridad 1 — se notan dentro del reloj

### 1. Copo de nube (el que más cambia el aspecto)

|               |                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo       | `apps/mobile/assets/materials/cloud-puff.png`                                                                                                                                                                                                                             |
| Tamaño        | 256×256 PNG-32                                                                                                                                                                                                                                                            |
| Tileable      | no                                                                                                                                                                                                                                                                        |
| Transparencia | sí, borde que se desvanece a alfa 0 (nada de círculo cortado)                                                                                                                                                                                                             |
| Peso          | ≤ 80 KB                                                                                                                                                                                                                                                                   |
| Estilo        | Un solo borrón de algodón visto de frente, más denso en el centro, irregular (no un disco perfecto). Gris cálido, un poco más claro arriba a la izquierda y más cálido-oscuro abajo a la derecha, como si le diera una luz de ventana. Sin contorno, sin ojos, sin gotas. |
| Uso           | Se decodifica **una vez**. Cada fotograma se dibuja unas 11 veces, escalado y con alfa, dentro del bulbo. Cero desenfoque en tiempo real. Sustituye el círculo generado en código.                                                                                        |

### 2. Sombra suave de la misma nube

|               |                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Archivo       | `apps/mobile/assets/materials/cloud-shade.png`                                                                         |
| Tamaño        | 256×256 PNG-32                                                                                                         |
| Tileable      | no                                                                                                                     |
| Transparencia | sí                                                                                                                     |
| Peso          | ≤ 60 KB                                                                                                                |
| Estilo        | El mismo borrón, más amplio, más transparente y más gris. Sirve de panza y de sombra bajo el racimo. Sin detalle fino. |
| Uso           | Una o dos copias por fotograma, detrás de los copos claros. Textura estática.                                          |

### 3. Raya de lluvia

|               |                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo       | `apps/mobile/assets/materials/rain-streak.png`                                                                                                        |
| Tamaño        | 32×160 PNG-32                                                                                                                                         |
| Tileable      | no                                                                                                                                                    |
| Transparencia | sí; los extremos superior e inferior en alfa 0                                                                                                        |
| Peso          | ≤ 12 KB                                                                                                                                               |
| Estilo        | Un trazo vertical suave, gris azulado muy lavado (`#C5D0D2` sobre transparente). Más opaco en el centro del trazo. Sin salpicadura, sin curva fuerte. |
| Uso           | Unas 11 copias recicladas por fotograma (posición = fase fija, no física). `drawImage`, sin blur.                                                     |

### 4. Gota de miel

|               |                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo       | `apps/mobile/assets/materials/honey-drop.png`                                                                                                       |
| Tamaño        | 96×96 PNG-32                                                                                                                                        |
| Tileable      | no                                                                                                                                                  |
| Transparencia | sí                                                                                                                                                  |
| Peso          | ≤ 20 KB                                                                                                                                             |
| Estilo        | Gota ámbar ya con el brillo horneado arriba a la izquierda (`#F3D7A2` el brillo, `#C4842E` el cuerpo). Borde suave. No hace falta animar el brillo. |
| Uso           | Unas 5 copias por fotograma en el cuello. El brillo va en la textura, no se calcula.                                                                |

### 5. Grano tileable (dither compartido)

|               |                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo       | `apps/mobile/assets/materials/grain-tile.png`                                                                                                                              |
| Tamaño        | 128×128 PNG-24 o PNG-32                                                                                                                                                    |
| Tileable      | **sí**, en los cuatro lados, sin costura                                                                                                                                   |
| Transparencia | no hace falta; si la lleva, el motivo es el alfa y el color es blanco                                                                                                      |
| Peso          | ≤ 20 KB                                                                                                                                                                    |
| Estilo        | Ruido fino de papel o de película, de bajo contraste, monocromo. Sirve para que los degradados no hagan bandas. No es una foto. No es un patrón que se lea a simple vista. |
| Uso           | Shader o `drawImage` repetido **una vez** al grabar el fondo, y una pasada muy suave (alfa ~4 %) encima del líquido. No se regenera por fotograma.                         |

---

## Prioridad 2 — foto de producto (escena y primer plano)

Las piedras van dentro de la escena, a los lados. No hay un archivo de piedra debajo del frasco: `stone-*.webp` no se usa. El apoyo lo marca `packages/core/src/shape/anchors-ground.json`.

No hay vídeo ni hierba que se mueva. Es una foto quieta, como el frasco apoyado en una piedra en el césped: el paisaje tiene profundidad de campo y unas briznas pasan por delante del vidrio. El reloj sigue dibujándose en Skia, entre la piedra y las briznas.

Cuatro capas, de atrás hacia delante:

1. **Escena** desenfocada (el césped y el claro, lejos).
2. **Piedra**, donde se apoya el frasco. Va alineada con el pie del vidrio, no con el borde de la pantalla.
3. **El frasco** (no es un archivo: lo pinta la app).
4. **Briznas** en primer plano, con transparencia. Pasan por delante solo por abajo y por los lados. El centro de los dos bulbos se queda vacío: ahí se lee el nivel.

Nada de estas capas intercepta el dedo. El deslizamiento para cambiar el tiempo sigue cayendo en el frasco.

### Escenas

| Material | Qué se ve                                                                                                           | Vertical (móvil)                                   | Horizontal (web)                                |
| -------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Arena    | Pradera al sol bajo. Hierba beige y verde suave, luz cálida. El centro, donde caerá el frasco, ya está desenfocado. | `apps/mobile/assets/materials/scene-arena-v.webp`  | `apps/web/public/backgrounds/scene-arena.webp`  |
| Lluvia   | El mismo claro con lluvia fina y luz gris cálida. Sin tormenta, sin rayos.                                          | `apps/mobile/assets/materials/scene-lluvia-v.webp` | `apps/web/public/backgrounds/scene-lluvia.webp` |
| Miel     | La pradera a última hora, muy desenfocada, luz dorada. Casi un color, no un bosque nítido (ver abajo).              | `apps/mobile/assets/materials/scene-miel-v.webp`   | `apps/web/public/backgrounds/scene-miel.webp`   |
| Nieve    | Bosque nevado, suave, luz fría sin azul eléctrico. No se usa hasta que exista el material.                          | `apps/mobile/assets/materials/scene-nieve-v.webp`  | `apps/web/public/backgrounds/scene-nieve.webp`  |

|               | Vertical       | Horizontal     |
| ------------- | -------------- | -------------- |
| Tamaño        | 1080×1920 WebP | 1920×1080 WebP |
| Transparencia | no             | no             |
| Peso          | ≤ 220 KB       | ≤ 200 KB       |

El desenfoque y el velo del centro van **pintados en el archivo**. La app no desenfoca en marcha. Recorte: se cubre la pantalla (`cover`) con el centro de la imagen en el cuello del frasco, así al cambiar de proporción no aparece un borde ni se va la zona quieta.

En el APK solo entran las tres verticales de arena, lluvia y miel (unos 660 KB). La de nieve no se importa hasta que el material exista.

### Piedra

Una por material, con transparencia alrededor. La misma piedra en vertical y en horizontal no encaja: el frasco en el móvil es alto y estrecho, y en la web ancha se ve más suelo. Por eso hay dos archivos.

| Material | Vertical                                           | Horizontal                                      |
| -------- | -------------------------------------------------- | ----------------------------------------------- |
| Arena    | `apps/mobile/assets/materials/stone-arena-v.webp`  | `apps/web/public/backgrounds/stone-arena.webp`  |
| Lluvia   | `apps/mobile/assets/materials/stone-lluvia-v.webp` | `apps/web/public/backgrounds/stone-lluvia.webp` |
| Miel     | `apps/mobile/assets/materials/stone-miel-v.webp`   | `apps/web/public/backgrounds/stone-miel.webp`   |
| Nieve    | `apps/mobile/assets/materials/stone-nieve-v.webp`  | `apps/web/public/backgrounds/stone-nieve.webp`  |

|               | Vertical                                                                                                                                                                                                     | Horizontal             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Tamaño        | 1080×720 WebP con alfa                                                                                                                                                                                       | 1600×640 WebP con alfa |
| Transparencia | sí, por encima de la piedra                                                                                                                                                                                  | sí                     |
| Peso          | ≤ 120 KB                                                                                                                                                                                                     | ≤ 140 KB               |
| Estilo        | Piedra baja y ancha, tono del material (arena cálida, lluvia un poco más gris, miel dorada, nieve con un borde blanco). La cara de arriba es bastante horizontal: ahí se apoya el pie del vidrio. Sin texto. |

Anclaje: el centro horizontal de la piedra coincide con el del frasco. El borde superior de la piedra queda en el pie del vidrio (el punto más bajo del reloj). El ancho visible es unas 2,2 veces el ancho del frasco. Así acompaña al reloj en cualquier pantalla, en vez de pegarse al borde del teléfono.

### Briznas (delante del frasco)

PNG o WebP con alfa. Casi todo el cuadro es transparente. Las briznas solo viven en la franja baja y en dos mechones laterales que no cruzan el centro de los bulbos. Si una hoja tapa el nivel, el archivo no sirve.

| Material | Vertical                                            | Horizontal                                       |
| -------- | --------------------------------------------------- | ------------------------------------------------ |
| Arena    | `apps/mobile/assets/materials/blades-arena-v.webp`  | `apps/web/public/backgrounds/blades-arena.webp`  |
| Lluvia   | `apps/mobile/assets/materials/blades-lluvia-v.webp` | `apps/web/public/backgrounds/blades-lluvia.webp` |
| Miel     | `apps/mobile/assets/materials/blades-miel-v.webp`   | `apps/web/public/backgrounds/blades-miel.webp`   |
| Nieve    | `apps/mobile/assets/materials/blades-nieve-v.webp`  | `apps/web/public/backgrounds/blades-nieve.webp`  |

|               | Vertical                                                                                                                                                                                  | Horizontal              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Tamaño        | 1080×1920 WebP con alfa                                                                                                                                                                   | 1920×1080 WebP con alfa |
| Transparencia | sí, alfa recto (no premultiplicado)                                                                                                                                                       | sí                      |
| Peso          | ≤ 180 KB                                                                                                                                                                                  | ≤ 160 KB                |
| Estilo        | Pocas briznas, nítidas, como en una foto de producto. Arena: hierba seca y verde. Lluvia: las mismas, con alguna gota. Miel: menos hojas y más doradas. Nieve: puntas escarchadas, pocas. |

Anclaje: el mismo centro que el frasco, a la misma escala que la piedra. Se dibujan encima del vidrio y **no reciben toques** (`pointerEvents` ninguno): el gesto de deslizar sigue siendo el del reloj. Quedan por debajo del menú y de la hora.

### Por qué la miel no lleva un bosque nítido

El ámbar ya es el detalle. Un césped afilado detrás y unas briznas delante compiten con el brillo del líquido. La escena de la miel es la pradera de la arena fundida en luz dorada (se intuye, no se cuenta). Las briznas delanteras son pocas y se quedan en el pie. Si el generador solo hace hierba cortante, para la miel es mejor no usarla y dejar el degradado ámbar.

### Por qué no hay vídeo

Un bucle, aunque dure dos segundos, decodifica durante todo el rato que el reloj está abierto (25–60 minutos) y en Android Skia copia el fotograma en cada refresco. No aporta: la foto ya tiene la profundidad y las briznas. No hay ajuste para apagar un fondo animado, porque no hay fondo animado. El único movimiento es el del material dentro del frasco, y se para cuando no cambia nada.

Sustituir estos archivos no cambia la lógica. Hasta que existan, se ve el degradado de siempre.

---

## Prioridad 3 — iconos (sustituir los que ya existen)

Misma ruta, para no cambiar `app.json`. Fondo del adaptive icon: `#E6DED4`.

| Archivo                                          | Tamaño           | Peso     | Notas                                                                                                                 |
| ------------------------------------------------ | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/assets/icon.png`                    | 1024×1024 PNG    | ≤ 250 KB | Reloj de arena mínimo, beige, un hilo de miel o una nube diminuta solo si no ensucia. Sin texto. Margen seguro ~17 %. |
| `apps/mobile/assets/android-icon-foreground.png` | 1024×1024 PNG-32 | ≤ 200 KB | Solo el reloj, centrado en la zona segura (66 %). Alfa alrededor.                                                     |
| `apps/mobile/assets/android-icon-background.png` | 1024×1024 PNG    | ≤ 150 KB | Fondo liso o degradado muy suave `#E6DED4` → `#E2D9CE`. Sin forma.                                                    |
| `apps/mobile/assets/android-icon-monochrome.png` | 1024×1024 PNG-32 | ≤ 80 KB  | Silueta blanca del reloj sobre transparente, para el tema monocromo de Android.                                       |
| `apps/mobile/assets/splash-icon.png`             | 1024×1024 PNG-32 | ≤ 200 KB | El mismo reloj, más aire alrededor. Se ve sobre `#E6DED4`.                                                            |
| `apps/mobile/assets/favicon.png`                 | 48×48 PNG        | ≤ 8 KB   | Reducción legible del icono.                                                                                          |

No son texturas del bucle: se ven al instalar y al arrancar. Cero fps.

---

## Prioridad 4 — solo web (marketing)

No entran en el APK. El temporizador de la web no los reproduce dentro del reloj.

### Imagen Open Graph

|               |                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo       | `apps/web/public/og.jpg`                                                                                                                                                         |
| Tamaño        | 1200×630 JPG, calidad ~80                                                                                                                                                        |
| Transparencia | no                                                                                                                                                                               |
| Peso          | ≤ 180 KB                                                                                                                                                                         |
| Estilo        | El reloj centrado sobre el beige, con aire. Una sola frase no: mejor sin texto (el título lo pone la etiqueta). Luz cálida, acabado de foto de producto, no de mockup con rocas. |

### Hero estático de la página de descarga

|               |                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Archivo       | `apps/web/public/hero.webp`                                                                                          |
| Tamaño        | 1600×1200 WebP                                                                                                       |
| Transparencia | no                                                                                                                   |
| Peso          | ≤ 220 KB                                                                                                             |
| Estilo        | Mismo reloj apoyado en la piedra, con aire. Fondo de pradera ya desenfocado. Sin texto. No es un fotograma de vídeo. |

### Capturas promocionales

Para la página y, si más adelante se quieren, la ficha de Play. No las carga el temporizador.

| Archivo                             | Qué se ve                        |
| ----------------------------------- | -------------------------------- |
| `apps/web/public/promo/arena.webp`  | Arena en reposo, claro           |
| `apps/web/public/promo/lluvia.webp` | Nube y agua, a media sesión      |
| `apps/web/public/promo/miel.webp`   | Miel, claro                      |
| `apps/web/public/promo/menu.webp`   | Menú abierto, botones de cristal |

|        |                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| Tamaño | 1080×1920 WebP (retrato de teléfono)                                                                        |
| Peso   | ≤ 280 KB cada una                                                                                           |
| Estilo | Captura limpia del producto, no un montaje con el concepto de Behance. Barra de estado discreta o sin ella. |

---

## Qué no generar

- El diorama de la referencia: rocas de estudio, musgo de maqueta, esferas de luz gigantes, personaje o interfaz dentro del fondo. El paisaje de la prioridad 2 es otra cosa (foto o pintura quieta, con el centro ya velado).
- Cualquier vídeo. El fondo es una foto en capas; un bucle no aporta y seguiría decodificando durante toda la sesión.
- Normal map o mapa de brillo del cristal a resolución de pantalla. El vidrio ya es un shader que se graba poco.
- Purpurina, pétalos, burbujas. No son materiales de esta versión. El bosque nevado solo se genera; no se cablea todavía.
- Texturas animadas (spritesheet de muchos fotogramas). El movimiento del contenido lo pone la fase del código.

## Orden sugerido si hay que elegir

1. `cloud-puff.png` y `cloud-shade.png`
2. `rain-streak.png` y `honey-drop.png`
3. `grain-tile.png`
4. Por material (arena, lluvia, miel; nieve puede esperar): `scene-*`, `stone-*` y `blades-*`, vertical y horizontal
5. Iconos
6. `og.jpg`, `hero.webp` y las capturas `promo/`
