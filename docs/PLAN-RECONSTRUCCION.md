# Hourglass web: plan de reconstrucción por módulos

**Para:** Sebastián · **De:** Leonardo · **Fecha:** 13 nov 2026, 20:30 (hora de Madrid)
**Estado:** borrador para tu aprobación. Hasta que digas «OK» no se crea la rama ni se manda nada al agente.
**Base:** la web publicada, `main` @ `4b39e74`, más lo bueno de `feature/web-v2` (hasta `ac7278f`).
**Sustituye a:** el plan de fases de `REPASO-PROYECTO.md` §5.3 y la §6 de `ESPECIFICACION-V2.md`. Las normas y preferencias de esos documentos siguen valiendo salvo donde este plan diga otra cosa.

**Cómo leerlo:**
- (a) a (c) explican qué se hace y por qué.
- (d) dice cómo es cada pieza, con sus números.
- (e) son las vueltas del agente, escritas para pegarlas casi tal cual en el encargo.
- (f) es la lista de lo que no se puede romper.
- (g) recoge las tres preguntas que solo puedes decidir tú.
- Al final está la crítica: qué diseños descarté y por qué.

---

## (a) El objetivo en 5 líneas

1. Partimos de la web publicada: su arena, sus gestos y la colocación de su menú, avisos y cookies. Todo eso funciona y no se toca.
2. Encima ponemos lo bueno de v2: el frasco de foto, el vidrio esmerilado, los fondos, la nube, los botones de escena y el aspecto nuevo de Clásico.
3. Cada cosa vive en su carpeta. Tocar una no puede romper otra: Lluvia no sabe que existe la arena, y la nube no sabe que el frasco gira.
4. La arena (Arena y Clásico) y el agua (Lluvia) son dos modelos distintos, cada uno con sus leyes. La arena son granos. El agua es una masa continua que se mece.
5. Se hace pieza a pieza. Cada pieza queda terminada (sitio, aspecto y animación) antes de pasar a la siguiente, y lo publicado no cambia hasta que digas OK.

---

## (b) Qué se queda de la publicada y qué viene de v2

**Leyenda de la columna «Cómo entra»:**
- **Tal cual:** se mueve el archivo sin cambiar su lógica.
- **Adaptado:** se trae el código y se cambia lo justo para que encaje en su módulo.
- **Reescrito:** se escribe de nuevo, siguiendo una idea que ya probamos.

| Pieza | De dónde sale (commit · archivos) | Cómo entra | Por qué |
|---|---|---|---|
| Temporizador, sesión, ciclos, idiomas y ajustes | main `4b39e74` · `useSession.ts`, `useSettings.ts`, `packages/core` | Tal cual | Funciona y tiene sus tests de siempre |
| Clic, doble clic y teclado | main · `stageClick.ts` + manejadores de `App.tsx` 355-394 y 300-319 | Tal cual (se mueven a `app/useEntrada.ts`) | Es justo el comportamiento que quieres: 260 ms de espera, y el doble clic no reinicia en pausa |
| Rueda | main · `App.tsx` 321-353 (72 px por paso; no actúa en marcha ni con el menú abierto) | Tal cual | La rueda solo cambia el tiempo |
| Arrastre y volteo del frasco | main · `HourglassView.tsx` (`FLIP_COMMIT` = 0,45·π) y la parte de giro de `useEngine.ts` (volteo de 1000 ms, cambio de fase de 950 ms, ease-in-out cúbica, retorno ×0,84 por fotograma) | Adaptado: pasa a `comun/giro/`, que es el único dueño del ángulo | Es el mismo movimiento de hoy, pero con un solo dueño |
| Intro (una vuelta de 1,35 s al cargar) | main · `intro.ts` | Tal cual, apuntando al nuevo `comun/giro` | Ya la conoces y funciona |
| Motor de arena (rejilla, chorro, cráter, nivel según el tiempo) | main · `useEngine.ts` 93-305 + core `SandSimulation`, `syncSandToTarget`, `flowBudget`, `StreamParticles` | Adaptado: pasa a `escenas/arena-modelo/` | Es la arena que funciona. Solo cambia de dónde sale la forma (ahora de la máscara de la foto) |
| **Arena que reacciona grano a grano a la inclinación** | v2 `80244ee` (12 nov, 16:06) · `useFrasco.ts` 154-156: `sim.step(gravedadDelAngulo(angulo))` en cada fotograma mientras se arrastra o está inclinado. Igual en `670d98c`, `b5c0f07`, `67f92cb` y `5fc2209` | Reescrito dentro de `arena-modelo` con esa misma regla | Es lo que te gustaba. **Se rompió en `25fca17` (16:16):** desde ahí, al inclinar se recolocaba toda la arena en cada fotograma (`sim.arrange`), que la mueve como un bloque. En `41b91e1` se cambió a avalanchas con sello: sale «sal y pimienta» y se parte en trozos al girar |
| Frasco de foto | v2 `108884e` · `public/frasco/jar-back.webp`, `jar-front.webp`, `jar-mask.webp` (446×1024) | Tal cual las tres imágenes. La máscara se retoca una vez: se abre el canal del cuello (ver (d) 4) | Lo elegiste tú. Su caja mide lo mismo que la del frasco dibujado: 1024/446 = 2,296 de alto por ancho, frente a 2,3 |
| Forma única del frasco | Nuevo: `comun/frasco/geometria.ts` lee `jar-mask.webp` | Reescrito | Es la única fuente de la forma. De ella salen la rejilla de arena, el agua, el clic y el recorte. Así no hay huecos contra el cristal |
| Sombra en la mesa | main · `draw.ts` 173-197 (sigue en el mundo y se apaga al girar) | Adaptado: los colores salen de la escena | Ya se apoya bien |
| Luz de la escena sobre el vidrio | v2 · `temas/*.ts` (`luz.direccion`, `tinte`) | Reescrito, más simple: solo tiñe el vidrio delantero y nunca el contenido | El agua marrón venía de la luz pintada encima del contenido (causa 4 de la especificación v2) |
| Vidrio esmerilado (menú y paneles) | v2 `21a07a1` + `dba6986` · `estilo/vidrio.css`, `temas/vidrio.ts`, `estilo/tokens.ts` | Adaptado: un solo `vidrio.css` con números fijos y sin `aplicarTema` gigante | Te gusta tal como está en `dba6986` |
| `backdrop-filter` que el build no borre | v2 `20b2eaf` · `vite.config.ts` (`css.lightningcss.targets`) | Tal cual | Era la causa 1 de la especificación v2 |
| Colocación del menú, del aviso Android y de las cookies | main · `styles.css` 113-135, 196-260, 325-372, 611-790 y `App.tsx` 252-298 (`--clock-lift`, `--menu-pad`) | Tal cual, en sus nuevas carpetas | Dijiste que es perfecta |
| Contenido del menú (escena, sesión, duraciones, personalizado, modo, idioma, sonido) | main · `SettingsSheet.tsx` + la fila de escenas de v2 `0a9453c` | Adaptado: la fila de escenas sale del registro, y se aplican los arreglos del anexo del 13 nov | Mantiene lo publicado y añade lo que pediste |
| Menú disponible en pausa | v2 · decisión del 13 nov (F13a-c) | Adaptado | En main el botón se ocultaba en pausa. Lo decidiste el 13 nov |
| Rótulo de pausa blanco y traducido | v2 · `Pausa.tsx`, `pausa.css` | Adaptado | F15b y F16b |
| Panel legal (cabecera fija, scroll aparte) | v2 `70454f4` · `LegalOverlay.tsx`, `legal.css` | Adaptado: se arregla F18b (el botón de cerrar pisaba el texto) | Las URL no cambian, y la app móvil las enlaza |
| Generador de páginas legales | v2 · `legal/generar.mjs`, `legal/textos/*`, `public/legal.css`, `legal.js` | Tal cual | Quita unas 1.150 líneas de CSS copiadas |
| Banner de cookies y «Configurar cookies» | main (lógica: `cookies.ts`, `analytics.ts`) + v2 (aspecto de vidrio) | Adaptado | La lógica es la publicada y el aspecto el de v2 |
| Aviso de la app Android | main (lógica: `androidApp.ts`) + v2 (`promo.css` con vidrio) | Adaptado | Igual que las cookies |
| Pie de página | main · `SiteFooter.tsx` | Tal cual, con la tinta de la escena | — |
| Fondos (fotos y vídeos) | v2 `5a7fa65` + `108884e` · `fondo/Fondo.tsx`, `encuadre.ts`, `fondo.css`, `public/fondos/*` (≈ 830 KB en total) | Adaptado: el ancla del suelo la pone el frasco | El `<video key>` por escena arregla el fondo de Lluvia que se quedaba |
| Vídeo de la nube y bucle sin salto | v2 `ac7278f` · `public/nube/*`, `crearBucleNube` + `fundidoBucle` de `frasco/nube.ts` | Adaptado. **Se tira** `posturaNube` (la que la hacía girar) y todo lo que la movía desde el bucle del frasco | La nube queda quieta y solo cambia de opacidad |
| Agua | Nuevo: `escenas/lluvia/agua/` | Reescrito desde cero | La de v2 tenía línea blanca, bloque plano y compartía nivel y bucle con la arena. Ver (d) 9 |
| Gotas | v2 · idea de `fisica/gotas.ts` (gotas verticales en el mundo) | Reescrito, más simple | — |
| Aspecto nuevo de Clásico | v2 · `public/fondos/clasico-*` + colores de `temas/clasico.ts` | Adaptado | Te gusta cómo se ve |
| **No se trae** | v2 · `calcularLayout.ts`, `useMedidas`, `useFrasco.ts`, `dibujo.ts`, `maquina.ts`, `perfil.ts`, `nivel.ts`, `pintarAgua.ts`, `fisica/*`, `luz*.ts`, la red de tests de la fase 0 y `aplicarTema` | — | Cada uno es parte del acoplamiento que rompía una cosa al tocar otra, o es un test |

---

## (c) Arquitectura

### c.1 La idea en una frase

Hay una **cáscara común** (`comun/`), que gira el frasco, pinta el vidrio y coloca la interfaz. Y hay **escenas** (`escenas/`), cada una dueña de lo que hay dentro del frasco, de su fondo y de lo que flota encima. La cáscara no sabe qué escena hay. Las escenas no se conocen entre sí.

### c.2 Árbol de carpetas (`apps/web/src/`)

```
main.tsx
app/                          ← lo único que junta todo
  App.tsx                     compone las capas (≤ 180 líneas)
  useEntrada.ts               clic, doble clic, rueda y teclado → órdenes (usa comun/tiempo/stageClick)
  useAvisos.ts                cookies, aviso Android y panel legal: cuál se ve
  registro.ts                 [lluvia, arena, clasico]: el ÚNICO sitio que conoce las escenas
  app.css                     rejilla de la escena (la colocación publicada)
comun/                        ← NUNCA importa de escenas/ ni de app/
  tiempo/                     useSession.ts, useSettings.ts, stageClick.ts, notify.ts, sound.ts, copy.ts
  giro/                       giro.ts (máquina pura), useGiro.ts (almacén), index.ts
  frasco/                     geometria.ts, golpe.ts, pintarVidrio.ts, sombra.ts, luz.ts,
                              Frasco.tsx (canvas + bucle), useCajaFrasco.ts, contrato.ts, intro.ts, index.ts
  reloj/                      TimeReadout.tsx, reloj.css, index.ts
  menu/                       SettingsSheet.tsx, Tooltip.tsx, Icons.tsx, menu.css, index.ts
  paneles/
    pausa/                    Pausa.tsx, pausa.css
    cookies/                  CookieBanner.tsx, cookies.ts, analytics.ts, vercelAnalytics.ts, cookies.css
    android/                  AndroidPromo.tsx, androidApp.ts, promo.css
    legal/                    LegalOverlay.tsx, legal.css
    pie/                      SiteFooter.tsx, pie.css
  fondo/                      Fondo.tsx, encuadre.ts, precarga.ts, fondo.css, index.ts
  estilo/                     base.css (reset), tokens.css, vidrio.css
escenas/
  arena-modelo/               ← el modelo de arena; lo usan Arena y Clásico, NUNCA Lluvia
    crearArena.ts             implementa Contenido con SandSimulation
    pintarArena.ts            rejilla → imagen, ruido, chorro
    index.ts
  arena/       index.ts       datos de la escena + crearContenido = crearArena
  clasico/     index.ts       datos de la escena + crearContenido = crearArena
  lluvia/
    index.ts                  datos de la escena + crearContenido = crearAgua + Encima = Nube
    agua/                     modelo.ts (masa + ola), pintar.ts, nivel.ts, index.ts
    gotas.ts
    nube/                     Nube.tsx, bucle.ts, nube.css, index.ts
legal/                        generar.mjs + textos/ (de v2)
scripts/comprobar-imports.mjs ← cerradura de las reglas de c.4 (no es un test, ver c.4)
public/frasco/ public/fondos/ public/nube/
```

### c.3 Contratos (las únicas puertas entre módulos)

**`comun/frasco/contrato.ts`.** Lo que la cáscara pide a cualquier contenido de frasco:

```ts
import type { SessionSnapshot } from '@reloj/core';

/** Forma del hueco del frasco. La única. Sale de jar-mask.webp. */
export interface GeometriaFrasco {
  /** Alto/ancho de la caja de la foto: 1024/446. */
  readonly aspecto: number;
  /** Ventana interior simétrica alrededor del cuello, en fracciones de la foto (0..1). */
  readonly ventana: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
  /** Radio interior (0..1 del medio ancho de la ventana) a la altura y ∈ [-1, 1] de la ventana.
   *  Es simétrico: radio(y) = radio(-y) = máximo de los dos bulbos a esa distancia del cuello. */
  radio(y: number): number;
  /** Máscara real (no simétrica) para recortar lo que se pinta. 446×1024, blanco = dentro. */
  readonly mascara: CanvasImageSource;
  /** Puntos interiores de cada bulbo en una rejilla de 4 px de la foto (≈ 110 × 240). Para el agua. */
  readonly puntos: { readonly arriba: Float32Array; readonly abajo: Float32Array }; // pares x,y en fracción de la foto
  /** Fila del cuello (centro de la franja cerrada), en fracción de la foto. */
  readonly cuelloY: number;
}

export type FaseGiro = 'reposo' | 'arrastre' | 'volviendo' | 'volteo';

export interface EntradaPaso {
  readonly ahora: number;              // ms
  readonly dt: number;                 // s, ≤ 0,1
  readonly angulo: number;             // rad, positivo = horario
  readonly velocidad: number;          // rad/s
  readonly fase: FaseGiro;
  readonly snap: SessionSnapshot;
  readonly reducir: boolean;           // prefers-reduced-motion
}

export interface Pintura {
  readonly caja: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }; // caja de la foto en px CSS, sin girar
  readonly angulo: number;             // el mismo que se aplica al vidrio
  readonly esquema: 'claro' | 'oscuro';
  readonly geo: GeometriaFrasco;
}

export interface Contenido {
  /** Avanza la física. Devuelve true si algo se sigue moviendo (el bucle no se duerme). */
  paso(e: EntradaPaso): boolean;
  /** Pinta en coordenadas del MUNDO, entre el vidrio de detrás y el de delante.
   *  Cada contenido aplica él mismo el giro a lo que deba girar. */
  pintar(ctx: CanvasRenderingContext2D, p: Pintura): void;
  /** Una vez, en el fotograma en que el volteo llega a 180° y el ángulo vuelve a 0.
   *  El fotograma de antes y el de después tienen que verse iguales. */
  alVoltear(motivo: 'reinicio' | 'fase', snap: SessionSnapshot): void;
  /** Al cambiar de escena: suelta todo. No queda nada vivo. */
  destruir(): void;
}
```

**`app/registro.ts` y `escenas/*/index.ts`.** Lo que es una escena:

```ts
export interface Aspecto {                       // uno para claro y otro para oscuro
  readonly fondo:
    | { readonly tipo: 'degradado'; readonly css: string }
    | { readonly tipo: 'foto'; readonly webp: string; readonly avif: string;
        readonly estrecho?: { readonly webp: string; readonly avif: string } }
    | { readonly tipo: 'video'; readonly webm: string; readonly mp4: string; readonly poster: string };
  readonly ancla: { readonly x: number; readonly y: number };  // punto de la foto donde apoya el frasco
  readonly reserva: string;                       // color mientras carga
  readonly barra: string;                         // <meta name="theme-color">
  readonly reloj: { readonly digitos: string; readonly pista: string };
  readonly tinta: string;                         // pie y botón del menú (fuera del vidrio)
  readonly vidrio: { readonly velo: string; readonly saturacion: number };
  readonly luz: { readonly direccion: number; readonly tinte: string; readonly fuerza: number }; // grados en el mundo
  readonly sombra: { readonly color: string; readonly opacidad: number };
}

export interface Escena {
  readonly id: 'lluvia' | 'arena' | 'clasico';
  readonly nombre: { readonly es: string; readonly en: string };
  /** En ancho, ¿el reloj sube a la altura del bulbo de arriba? (Lluvia y Arena sí; Clásico no.) */
  readonly relojAlto: boolean;
  readonly claro: Aspecto;
  readonly oscuro: Aspecto;
  crearContenido(geo: GeometriaFrasco, esquema: 'claro' | 'oscuro'): Contenido;
  /** Capa del DOM encima del frasco (la nube). Solo recibe la caja del frasco y la opacidad. */
  readonly Encima?: React.FC<{ caja: Pintura['caja']; opacidad: number; esquema: 'claro' | 'oscuro' }>;
}
```

**`comun/giro`.** El único que escribe el ángulo:

```ts
export type OrdenGiro =
  | { tipo: 'agarrar'; anguloPuntero: number }
  | { tipo: 'mover'; anguloPuntero: number }
  | { tipo: 'soltar' }                 // ≥ 0,45·π → volteo 'reinicio'
  | { tipo: 'reiniciar' }              // doble clic → volteo 'reinicio' de 1000 ms
  | { tipo: 'cambioDeFase' };          // fin de fase de un ciclo → volteo 'fase' de 950 ms
export interface EstadoGiro { angulo: number; velocidad: number; fase: FaseGiro; ocupado: boolean }
export function useGiro(): { estado: () => EstadoGiro; ordenar(o: OrdenGiro): void; alVoltear(cb): () => void };
```

En pausa, `agarrar` no hace nada (F04a). Durante un volteo (`ocupado`), tampoco.

**`comun/frasco/Frasco.tsx`:**

```ts
<Frasco contenido={Contenido} escena={Escena['claro']} esquema getSnapshot onCaja={(caja) => void} />
```

Dueño del canvas y del único `requestAnimationFrame`. Se duerme cuando el giro está en `reposo`, el reloj no está en marcha y `contenido.paso()` devuelve `false`.

**`useCajaFrasco()`.** La caja del frasco en px CSS. La escribe solo `Frasco`, con un `ResizeObserver`. La leen el reloj (para subirlo), el fondo (para el ancla) y la nube.

### c.4 Reglas de importación

1. `comun/**` no importa nada de `escenas/**` ni de `app/**`.
2. `escenas/X/**` importa solo de `comun/**` (por su `index.ts`) y de `@reloj/core`. Excepción: `escenas/arena/` y `escenas/clasico/` importan `escenas/arena-modelo`.
3. `escenas/lluvia/**` nunca importa `escenas/arena-modelo/**` ni `SandSimulation`, `StreamParticles` o `sandLevelForDuration`.
4. Solo `app/` importa `escenas/*` (y solo su `index.ts`).
5. Fuera de cada carpeta solo se importa su `index.ts`. Nada de `comun/frasco/geometria` desde fuera, sino `comun/frasco`.
6. Nadie fuera de `comun/giro` escribe el ángulo. La nube no recibe ángulo ni transformación, solo la `opacidad`.
7. Fuera de `escenas/*/index.ts` no hay `if (escena === 'lluvia')` ni `dark ? … : …`. Lo que cambia entre escenas es un dato del `Aspecto`.

**Cómo se hacen cumplir.** `scripts/comprobar-imports.mjs` son unas 40 líneas que recorren los `import` y aplican las reglas 1-5 y 7. Corre dentro de `npm run build`, antes de `vite build`: si alguien rompe una puerta, la web no compila. **No es un test:** no comprueba qué hace la app, solo que las puertas siguen cerradas. Es lo que garantiza que «trabajar en el menú no puede romper la arena».

### c.5 Orden de capas (de atrás adelante)

| # | Capa | Dónde vive | Gira con el frasco |
|---|---|---|---|
| 1 | Fondo (degradado, foto o vídeo) | `comun/fondo`, DOM, `z-index` 0 | No |
| 2 | Sombra en la mesa | `Frasco`, canvas, en el mundo | No (se apaga al girar) |
| 3 | Vidrio de detrás (`jar-back.webp`) | `Frasco`, canvas | Sí |
| 4 | Contenido: arena + chorro, o agua + gotas | `escena.crearContenido().pintar` | La arena sí; la superficie del agua y las gotas quedan en el mundo |
| 5 | Vidrio de delante (`jar-front.webp`) | `Frasco`, canvas | Sí |
| 6 | Luz de la escena, solo sobre la capa 5 | `Frasco`, canvas | No: la dirección es del mundo |
| 7 | Nube | `escena.Encima`, DOM, `z-index` 5 | **Nunca** |
| 8 | Reloj | `comun/reloj`, DOM, `z-index` 10 | No |
| 9 | Botón del menú, pie y avisos | DOM, `z-index` 22-24 | No |
| 10 | Menú (fondo 30, hoja 34), pausa (28), cookies (60), panel legal (70) | DOM | No |

Las capas 1-8 van dentro de `.scene`, que es lo que se desenfoca en pausa. El botón del menú y el pie quedan fuera para seguir disponibles.

### c.6 La forma del frasco: una sola fuente

1. **La fuente es `public/frasco/jar-mask.webp`**, en blanco = dentro. Nada más define la forma.
2. **Retoque de la máscara, una sola vez (vuelta 7).**
   - Hoy la franja del cuello, filas 477-516 de 1024, está cerrada en negro.
   - Se abre un canal de 10 px de ancho centrado en x = 223 (columnas 218-227), que es el hueco real del cuello en la foto.
   - Así el chorro y las gotas se ven pasar por el cuello, y la rejilla tiene por dónde pasar.
3. **`geometria.ts` lee la máscara una vez,** a 446×1024, con umbral de luminancia de 127. De ella saca:
   - **El cuello:** el centro de la franja estrecha, que es la fila 496,5 de 1024.
   - **La ventana interior simétrica:** de x 26 a 421 (395 px de ancho) y de y 16 a 977. Son 480,5 px a cada lado del cuello, porque el bulbo de abajo de la foto es 15 px más hondo que el de arriba.
   - **El radio por altura:** `radio(d)` = el máximo de los dos bulbos a la distancia d del cuello, dividido entre 197,5. Así es simétrico, como necesita el volteo de la rejilla (`rotateHalfTurn`).
   - **Los puntos interiores de cada bulbo** cada 4 px, para el agua.
4. **La arena se simula en una rejilla construida con `radio()`.** Para eso hace falta **un solo cambio en `packages/core`**:
   - Es una opción nueva y opcional, `radioInterior?: (y: number) => number`, en `SandSimulationOptions`.
   - Si se pasa, el constructor la usa en lugar de `innerRadiusAt` y del grosor de pared.
   - Si no se pasa, todo queda exactamente como hoy. La app Android no cambia ni se recompila.
   - Con la rejilla se pasa un perfil con `halfHeightRatio` = 961/395 = 2,433 y `wallThickness` = 0.
   - **Pregunta 1 de (g).**
5. **Todo lo que se pinta dentro se recorta con la máscara real** (`destination-in`).
   - Donde un bulbo es más estrecho que el otro (como mucho 14 px por lado, solo en las puntas redondas), los granos que sobran quedan **detrás** del cristal y no se ven.
   - **Nunca queda un hueco entre el contenido y la pared**, porque la rejilla es siempre igual o más ancha que la foto.
6. **El clic sobre el frasco** cuenta si el punto, girado al marco del frasco, cumple `|x| ≤ radio(y) + 0,035`. Es la misma tolerancia que la publicada, y no hay una fórmula aparte.

**Por qué así y no de otra forma:**
- v2 simulaba con la fórmula de pera del frasco dibujado (`CLASSIC_MODEL`), estirada a la caja entera de la foto. Además, el cuello de la rejilla (centro de la foto, 0,5) no coincidía con el de la foto (0,485). De ahí los huecos y los chorros que cruzaban la pared.
- Ajustar los números de la fórmula a la foto deja errores de hasta un 2 % (lo midió v2), y entonces vuelven los huecos.
- Leer la forma de la máscara es exacto, y la máscara ya existe.

---

## (d) Cada elemento: cómo es, cómo se comporta y por qué

**Convenciones:**
- «Publicada» = `main` `4b39e74`. «v2» = `feature/web-v2` en el commit que se indica.
- Los px son CSS. `rem` = 16 px.
- Las curvas tienen nombre:
  - `suave` = `cubic-bezier(0.33, 0, 0.2, 1)`
  - `reloj` = `cubic-bezier(0.45, 0.02, 0.12, 1)`
  - `hoja` = `cubic-bezier(0.16, 0.84, 0.28, 1)`
- *Reducir movimiento* quita todas las transiciones y animaciones de esta sección, salvo los fundidos de opacidad de 160 ms o menos.

### 1. Disposición (tal cual la publicada)

- **Ancha** si `ancho ≥ 736 px` (46 rem) **y** `ancho > 1,05 × alto`. Si no, **estrecha**. Se recalcula al cambiar el tamaño de la ventana.
- **Ancha:**
  - `.stage` es una rejilla de dos columnas: `minmax(0, 1.08fr)` para el frasco y `minmax(0, 0.92fr)` para el reloj.
  - Su padding: arriba `clamp(0.75rem, 2.2vh, 1.6rem)`, derecha `clamp(1rem, 3vw, 2.6rem)`, abajo `clamp(2.6rem, 7vh, 4.2rem)` e izquierda `clamp(0.75rem, 2.2vw, 1.8rem)`.
- **Estrecha:**
  - Filas `minmax(min(36vh, 70%), 1fr)` para el frasco y `auto` para el reloj, todo centrado.
  - Padding: arriba `clamp(0.5rem, 1.6vh, 1rem)`, a los lados `clamp(0.75rem, 4vw, 1.25rem)` y abajo `var(--menu-pad, 4.75rem)`.
  - Con el aviso de Android, el de abajo pasa a `9.5rem`.
  - El padding de abajo cambia con una transición de 620 ms `suave`.
- **Por qué:** dijiste que esta colocación es perfecta. Se copia literal, sin el `calcularLayout` de v2.

### 2. Frasco: sitio y tamaño

- Ocupa un canvas que llena su celda (la columna izquierda en ancha, la fila de arriba en estrecha).
- La caja de la foto se calcula como en la publicada (`layoutFor`):
  - Ancho disponible = 84 % del canvas y alto disponible = 86 %.
  - Proporción de la foto: 1024/446 (alto/ancho).
  - Centro en `x = 50 %` y `y = 48 %` del canvas.
- **Por qué:** la foto mide casi lo mismo que el frasco dibujado (2,296 frente a 2,3), así que todo lo demás (reloj, menú y avisos) cae en el mismo sitio que hoy.
- Al abrir el menú en estrecha, el frasco se encoge y sube porque su fila pierde alto (`--menu-pad`), con los 620 ms `suave` del padding. Igual que en la publicada, pero ahora animado (lo pediste el 13 nov, punto 5).

### 3. Frasco: giro y gestos (tal cual la publicada)

| Gesto | Efecto | Números |
|---|---|---|
| Arrastrar sobre el frasco | Lo gira con el puntero | Límite ±180°. Cuenta como movido a partir de 0,03 rad, y entonces el clic que sigue no pausa |
| Soltar | Si `|ángulo| ≥ 0,45·π` (81°), volteo de reinicio. Si no, vuelve a 0 | Vuelta: ×0,84 por fotograma y a 0 por debajo de 0,004 rad |
| Doble clic (fuera de pausa) | Volteo de 180° y reinicio. El reloj queda **parado** en la duración | 1000 ms, ease-in-out cúbica, desde el ángulo actual hacia el lado al que estuviera inclinado |
| Fin de fase en ciclos | Media vuelta | 950 ms, ease-in-out cúbica |
| En pausa | El frasco no se arrastra. Un clic reanuda | — |
| Rueda | Solo cambia el tiempo (ver 6) | Nunca gira el frasco |

- **Intro**, solo en la primera carga de la pestaña (`intro.ts` publicado):
  - 0-300 ms: el vidrio aparece a ×1,12, sin sombra.
  - 0-900 ms: da una vuelta completa.
  - 900-1250 ms: vuelve a su sitio.
  - 950-1350 ms: aparecen el reloj, el menú y el pie (desenfoque de 12 px a 0).
  - Con *reducir movimiento*, solo un fundido de 280 ms.
- **Carga:**
  - El canvas espera a `jar-mask`, `jar-back` y `jar-front` (unos 148 KB).
  - La intro empieza cuando llegan, o a los 2,5 s como mucho. Si a los 2,5 s no han llegado, se pinta la silueta de la máscara con un velo `rgba(236,234,230,0.12)` y un borde `rgba(236,234,230,0.62)` de 1,5 px.
  - **Nunca** se ven las dos elipses provisionales (lo pediste el 7 y el 13 nov).

### 4. Frasco: dibujo

- **Capas 2-6 de c.5:**
  - **Sombra:** la publicada (`draw.ts` 173-197): tres óvalos con desenfoque de 22, 5 y 9 px, multiplicados por `smoothstep(|cos ángulo|)`, y los mismos colores claro y oscuro. Se apoya y se apaga al girar.
  - **Vidrio de detrás y de delante:** las fotos, escaladas a la caja con `imageSmoothingQuality = 'high'` y giradas sobre el centro de la caja.
- **Luz de la escena:**
  - Un degradado lineal **en el mundo**, en la dirección `luz.direccion` (grados; 0 = derecha, −90 = arriba).
  - Va de `luz.tinte` con alfa `luz.fuerza × 0,45` en el lado iluminado a transparente al 60 % del recorrido.
  - Se pinta con `soft-light` **solo sobre el vidrio de delante**: se compone en una hoja aparte con `source-atop` sobre `jar-front` y luego se pega.
  - El contenido no se tiñe nunca.
  - Valores (de v2):

| Escena | Dirección | Claro (tinte, fuerza) | Oscuro (tinte, fuerza) |
|---|---|---|---|
| Lluvia | −102 | `#ffe0b0`, 0,72 | `#ff8a2a`, 0,90 |
| Arena | −104 | `#ffc98a`, 0,70 | `#ff7a1a`, 0,92 |
| Clásico | −42 en claro, −48 en oscuro | `#f3e4d0`, 0,50 | `#e8a86a`, 0,82 |

- **Por qué:** pediste que la luz venga de la lámpara o del sol de la foto. Separar la luz del vidrio del color del contenido hace imposible el agua marrón.
- **El factor 0,45** es cosmético y lo eliges tú. Es un número en `comun/frasco/luz.ts`.

### 5. Arena (Arena y Clásico, un solo modelo: `escenas/arena-modelo`)

- **Rejilla:**
  - `SandSimulation` del core, con `radioInterior = geo.radio`. `cols` = ancho interior en pantalla / 2,15 px, entre 121 y 181 e impar (la regla publicada).
  - `seed` 11, `slideChance` 0,55, `fillRatio` 0,86, `staticFriction` 0,28.
  - Chorro: `StreamParticles` con `capacity` 280 y `seed` 5, e intensidad `1 − 0,6·t` según la duración (publicada).
- **Nivel según el tiempo** (publicada):
  - Granos arriba en reposo = `round(total × sandLevelForDuration(duración))`, colocados con `arrange` y un cráter de 0,16.
  - En marcha: `syncSandToTarget` hacia `targetSourceGrains(nivelInicial, restante, duración)` con `flowBudget`.
  - Con el reloj parado, al cambiar la duración se recoloca **al momento**, sin arrancar.
- **Inclinación (lo nuevo, de v2 `80244ee`):**
  - En cada fotograma con `fase ≠ 'reposo'` o `|ángulo| > 0,01`, se hacen 2 pasos de `sim.step(g)` con `g = (sin ángulo, cos ángulo)`, la gravedad vista desde dentro del frasco.
  - Si el paso del fotograma anterior costó más de 24 ms, `TiltLod` del core redondea `g` a escalones de 10° (lo mismo que hace el móvil).
  - Al soltar, mientras el frasco vuelve a 0, se sigue con `g`. En reposo, `GRAVITY_DOWN` hasta que la rejilla se asienta.
  - **El número de granos arriba no cambia al inclinar**: solo `syncSandToTarget` pasa granos por el cuello.
- **Volteo** (`alVoltear`), tal cual la publicada:
  - **Reinicio:** `arrange(abajo = nivel)` y luego `rotateHalfTurn()`. Queda todo arriba, como en una carga limpia.
  - **Fase:** `flushSource` y luego `rotateHalfTurn()`.
  - Durante el volteo, la arena va pegada al vidrio (no se simula).
- **Pintura (publicada):**
  - La rejilla pasa a `ImageData` con la LUT de la paleta (`SAND.palette.light` o `.dark`, contraste 0,75).
  - Se dibuja sin suavizado en la ventana interior, con ruido de grano encima al 20 % en claro y al 16 % en oscuro (`source-atop`).
  - Las partículas del chorro son elipses del tono del grano.
  - Todo esto va en una hoja aparte que se recorta con `geo.mascara` (`destination-in`) y luego se pega girada.
- **Por qué:**
  - Es la arena que funciona, con la única reacción que te gustó de v2.
  - El sello 3×3 y las avalanchas de `41b91e1` no se traen. Son el «sal y pimienta» y los trozos al girar.

### 6. Rueda, clic y teclado (tal cual la publicada)

- **Rueda:**
  - Suma `deltaY` (×16 si viene en líneas, ×400 si viene en páginas). Cada 72 unidades es un paso.
  - Hacia abajo, más tiempo. Usa `stepToDuration` en sesión única, o los minutos de trabajo en ciclos.
  - Solo actúa con el reloj parado, el menú cerrado y la intro terminada.
  - Nunca gira el frasco ni arranca la cuenta.
- **Clic:**
  - Espera 260 ms por si llega un segundo clic. Si no llega, empieza, pausa o reanuda.
  - Si la pareja de clics empezó en pausa, el segundo clic no reinicia (`stageClick.ts`).
- **Teclado:** Espacio y Enter alternan. Escape cierra el panel legal o el menú.

### 7. Reloj

- **Letra:**
  - Manrope 200, cifras tabulares, `letter-spacing −0.035em` y `line-height 0.92`.
  - Tamaño: en ancha `clamp(2.7rem, min(6.8vw, 14vh), 7.25rem)`; en estrecha `clamp(2.45rem, min(12vw, 9vh), 5rem)`.
  - Estado: 1,15 rem con 0,55 rem de margen arriba. Pista: 0,95 rem con 0,4 rem de margen arriba.
  - Sin halo, sin sombra y sin fondo.
- **Colores:** los de v2 (dígitos = pista).

| Escena | Claro | Oscuro |
|---|---|---|
| Lluvia | `#2E302F` | `#8F8B86` |
| Arena | `#4A4541` | `#B7B1AA` |
| Clásico | `#5A5550` | `#86817B` |

- **Sitio:**
  - En estrecha y en Clásico ancha: el publicado, centrado en su celda.
  - En **Lluvia y Arena, en ancha**: el borde de arriba del bloque del reloj va a `caja.y + 0,06 × caja.h` del frasco (de `useCajaFrasco`), centrado en horizontal en la columna derecha.
  - **Por qué:** así queda por encima de las rocas y del orbe de la foto. Es lo que hacía v2 (`RELOJ_TOP` = 0,06) y lo que pediste.
- **Al abrir el menú en ancha**, el reloj sube con `--clock-lift` (la fórmula publicada de `App.tsx` 252-298, sin cambios), con una transición de 760 ms `reloj`. En estrecha no sube por su cuenta: baja la fila del frasco.

### 8. Fondo

- **Fuentes (de v2, `public/fondos/`):**
  - Lluvia: en claro, foto (`lluvia-claro.avif`/`webp`, y `-estrecho` por debajo de 736 px); en oscuro, vídeo (`lluvia-oscuro.webm`/`mp4` + póster `webp`).
  - Arena: igual, con `arena-*`.
  - Clásico: foto `clasico-claro` y foto `clasico-oscuro`.
  - Escena «Clásico publicada», solo en las vueltas 0-11: el degradado publicado (`styles.css` 79-92) con los colores `--bg-top`, `--bg-bottom` y `--glow` de la publicada.
- **Encuadre:**
  - Es `encuadreFondo()` de v2, tal cual.
  - El punto `ancla` de la foto cae justo bajo la base del frasco: `x = caja.x + caja.w/2` y `y = caja.y + 0,978 × caja.h`.
  - Anclas: Lluvia (0,28; 0,80), Arena (0,30; 0,84), Clásico (0,32; 0,80).
  - **Por qué:** que el frasco parezca apoyado en todas las anchuras.
- **Carga:**
  - El color `reserva` del aspecto se ve al instante.
  - La foto o el póster entran con un fundido de 160 ms lineal.
  - Cada vídeo es un `<video key={url} muted loop playsInline autoPlay>` **nuevo** cuando cambia la fuente.
  - Tras `load` y en un hueco libre, se precargan los demás fondos en **un** formato.
  - Con Save-Data o 2g/3g, ni precarga ni vídeo (se queda el póster).
- **Al cambiar de escena o de modo,** la capa nueva entra encima con opacidad de 0 a 1 en 360 ms `suave` y la vieja se retira al terminar.

### 9. Agua (Lluvia; modelo propio, `escenas/lluvia/agua`)

**Qué es.** Una **masa continua** por bulbo, nunca granos. Su superficie es una **línea elástica** (un campo de alturas de 32 puntos) que se mece y hace olas cuando el frasco gira. Debajo de esa línea, todo es agua, recortada a la forma real del cristal.

**Las leyes (`modelo.ts`, puro, sin canvas):**

1. **Volumen según el tiempo.** El agua de cada bulbo es una fracción de su **área** (puntos interiores de `geo.puntos`):
   - `nivelInicial = sandLevelForDuration(duración)`. Se importa del core en `lluvia/agua/nivel.ts`, que es **solo de Lluvia**. Si algún día el agua necesita otra curva, se cambia ese archivo y la arena ni se entera.
   - Arriba: `nivelInicial × restante / duración × áreaArriba`.
   - Abajo: `(nivelInicial × áreaArriba − volumen de arriba)`, como fracción de `áreaAbajo`.
   - El volumen pintado sigue al objetivo con una constante de 0,6 s (cambiar la duración con la rueda se ve como una subida suave, no un salto).
   - **Por qué área y no volumen 3D:** la arena también es 2D, así que los dos «bajan igual» a la vista. Y es exacto con la máscara.
2. **Altura de la superficie.** Para el ángulo actual se giran los puntos del bulbo al mundo, y se busca la altura `h` del k-ésimo punto más bajo (k = volumen en puntos; selección rápida, menos de 0,5 ms).
   - **Resultado por construcción:** la superficie es horizontal en el mundo, el agua se apoya en el lado bajo y llena el cristal pared con pared a cualquier ángulo, también boca abajo. El volumen no cambia al girar.
3. **Vaivén (la masa se mece entera).** La inclinación de la superficie respecto a la horizontal, `φ`, es un muelle amortiguado:
   - `φ'' = −ω²·φ − 2ζω·φ' − κ·α`, donde `α` es la aceleración angular del frasco.
   - Valores: **frecuencia 1,8 Hz (ω = 11,3 rad/s), ζ = 0,30 y κ = 0,35**.
   - Al girar de golpe, el agua se queda «atrás», cruza la horizontal 2-3 veces y se calma en unos 0,8 s (por debajo de 1°).
   - El muelle no cambia el volumen: el giro de la línea es sobre su punto medio, y el área que gana un lado la pierde el otro. Se recalcula `h` con el ángulo del frasco + `φ`.
4. **Olas (campo de alturas).**
   - 32 puntos equiespaciados a lo ancho del bulbo, con altura `y_i` respecto a la línea.
   - Ecuación de onda discreta: `y_i'' = c²·(y_{i−1} − 2y_i + y_{i+1})/Δx² − β·y_i'`, con **c = 0,9 × ancho del bulbo por segundo y β = 2,4 /s**.
   - Excitación: cada fotograma, `y_i' += ε·v·(x_i − x̄)` (el giro empuja un lado hacia arriba y el otro hacia abajo), con **ε = 0,08** y `v` = velocidad angular. Cada gota que llega suma un pulso de −0,6 px en su punto.
   - Las alturas se limitan a ±4 % del alto del bulbo. Se les resta la media en cada paso, así que **la masa se conserva exacta**.
   - Bordes: pendiente nula contra el cristal (el agua sube y baja pegada a la pared, sin despegarse).
5. **En reposo y sin reloj en marcha,** cuando `|φ| < 0,2°`, `|φ'|` es pequeño y las olas valen menos de 0,1 px, `paso()` devuelve `false` y el bucle se duerme.
6. **Volteo (`alVoltear`):**
   - **Reinicio:** durante los 1000 ms del giro, el volumen va pasando al bulbo que acaba arriba (ease-in-out, en el primer 60 % del giro). Al llegar a 180°, se intercambian los bulbos y el ángulo vuelve a 0 en el mismo fotograma: `φ` y las olas se invierten de signo, así que se ven igual.
   - **Fase:** solo el intercambio.
   - En pausa no hay volteo.

**Cómo se ve (`pintar.ts`):**
- Se rellena en el mundo el polígono «por debajo de la superficie» de cada bulbo: los 32 puntos de la ola y luego los bordes de la caja.
- Se recorta con la mitad de la máscara girada que le toca a ese bulbo (separadas por la línea del cuello, que gira con el frasco), con `destination-in` en una hoja aparte.
- **Color:**
  - Claro: de `rgba(214,228,234,0.26)` arriba a `rgba(201,214,220,0.26)` abajo, en vertical en el mundo.
  - Oscuro: de `rgba(160,178,188,0.20)` a `rgba(150,167,177,0.20)`.
  - Transparente y frío, matiz entre 180° y 215°. **Nunca** marrón.
- **Superficie:**
  - **Sin línea blanca.** Un menisco de 2 px, solo junto al cristal (los 6 px de cada extremo), en `rgba(196,222,238,0.72)` (claro) o `rgba(176,200,214,0.58)` (oscuro).
  - Un reflejo de 10 px bajo la superficie que se desvanece: `rgba(214,228,234,0.2)` → 0.
- **Por qué este modelo y no granos ni la arena del core:**
  - El agua no tiene ángulo de reposo ni fricción. Es un líquido, y lo que se ve es su superficie.
  - Un muelle más un campo de alturas es el modelo mínimo que da superficie horizontal, vaivén y olas, con masa exacta. Cuesta menos de 1 ms por fotograma.
  - No reutiliza nada de la arena porque no comparten leyes. Solo comparten la geometría (`comun/frasco`) y el tiempo.

### 10. Gotas (Lluvia, `escenas/lluvia/gotas.ts`)

- **Cuándo:**
  - Solo con el reloj en marcha, `|ángulo| < 35°` y agua arriba.
  - Se cortan con una caída de 200 ms.
  - En pausa se congelan en su sitio.
- **Cómo:**
  - 14 gotas a la vez como mucho, que salen del centro del cuello (`cuelloY`, girado con el frasco) y caen **verticales en el mundo** hasta la superficie de abajo.
  - Cada gota mide 1,5 px de ancho y de 6 a 14 px de largo, a 520-760 px/s (semilla fija 5).
  - Opacidad entre 0,35 y 0,6, en `rgb(232,240,244)` (claro) o `rgb(214,226,232)` (oscuro).
  - Al llegar, pulso en la ola (9.4).
- **Por qué:** sustituyen a la línea blanca fija de v2.

### 11. Nube (Lluvia, `escenas/lluvia/nube`)

- **Capa del DOM** encima del canvas (capa 7). Un `<div class="nube">` con dos `<video muted playsInline preload="auto">` (`nube.webm`/`mp4` de v2) y el póster `nube.webp` debajo.
- **Caja fija** (solo cambia si cambia la caja del frasco, al redimensionar o al abrir el menú en estrecha):
  - Ancho = **1,5 ×** el ancho de la caja del frasco. En v2 era 1,3; la pediste «un poco más grande».
  - Alto = ancho × 438/1100.
  - Centro horizontal = centro del frasco.
  - Arriba = `caja.y − 0,28 × alto`, así que tapa la boca del frasco y no asoma el borde.
  - Se coloca con `left` y `top` en px enteros. **Nunca** lleva `transform: rotate` ni nada que dependa del ángulo.
  - Al cambiar la caja, `transition: left/top/width/height 620ms suave`, a la vez que el frasco.
- **Aspecto:**
  - `mix-blend-mode: screen` (el negro del vídeo desaparece) y `mask-image: linear-gradient(to bottom, black 42%, transparent 100%)`, para que la base no quede cortada en recto.
  - Opacidad máxima **0,85** (semitransparente).
  - En oscuro, `filter: brightness(0.72) saturate(0.85)`.
- **Opacidad según el giro:** es la única entrada.
  - `opacidad = 0,85 × max(0, 1 − |ángulo| / 50°)`: aparece y desaparece, y no gira.
  - Durante el volteo de reinicio, 0 desde el primer fotograma, y vuelve con 360 ms `suave` al terminar.
  - La escribe `Frasco` mediante `escena.Encima` con la prop `opacidad`; no hay otra vía.
- **Bucle sin salto:** `crearBucleNube` de v2. Dos vídeos que se cruzan durante los últimos 2 s, sin volver al fotograma 0 mientras se ve. Va con `requestVideoFrameCallback`, no con el bucle del frasco.
- Con *reducir movimiento* o Save-Data, solo el póster.
- **Por qué:** es tu definición literal: quieta, sin girar, solo opacidad y con un bucle limpio. Al no recibir el ángulo, **no puede** girar.

### 12. Vidrio esmerilado (un solo estilo: `comun/estilo/vidrio.css`, de v2 `dba6986`)

| Propiedad | Valor |
|---|---|
| Desenfoque | `backdrop-filter: blur(32px) saturate(var(--vidrio-sat))`. `--vidrio-sat` vale 1,4, y 1,05 en Arena |
| Velo | `var(--velo)` = `rgba(0,0,0,0.12)`, y `rgba(0,0,0,0.08)` en Arena |
| Sin soporte de `backdrop-filter` | `rgba(0,0,0,0.72)` |
| Borde | 1 px `rgba(255,255,255,0.32)` |
| Brillo interior | `inset 0 1px 0 rgba(255,255,255,0.22)` |
| Sombra | Claro: `0 16px 48px rgba(0,0,0,0.16)`. Oscuro: `0 18px 52px rgba(0,0,0,0.28)` |
| Radio | 28 px |
| Texto e iconos | `#FFFFFF`, con sombra de texto `0 1px 2px rgba(0,0,0,0.5), 0 0 10px rgba(0,0,0,0.28)` e iconos con `drop-shadow(0 1px 2px rgba(0,0,0,0.45))` |
| Texto secundario | `rgba(255,255,255,0.78)` |

**Controles (`.control`):**
- Alto mínimo 40 px (44 en táctil), radio 999 px y padding horizontal 12 px. Texto de 15 px y peso 400.
- Fondo: en reposo `rgba(255,255,255,0.07)`, hover `0.12` y elegido `0.18` con peso 500.
- Foco: `outline 1px rgba(255,255,255,0.9)` con 2 px de separación.
- Desactivado: opacidad 0,35.
- Botones redondos (×, −, +): 48 × 48 px, `aspect-ratio: 1`, radio 50 %.

**Build:**
- Se escribe solo `backdrop-filter`, sin prefijo.
- `vite.config.ts` lleva `css.transformer: 'lightningcss'` y `css.lightningcss.targets` para Chrome 111, Safari 16 y Firefox 115 (de v2 `20b2eaf`).

**Por qué:** es el vidrio que diste por bueno el 13 nov. Un solo estilo, así que lo que cambia es solo lo que hay detrás.

### 13. Menú

- **Botón:**
  - Sitio publicado: `position: fixed`, derecha `clamp(0.65rem, 1.6vw, 1.25rem)` y abajo `calc(clamp(1.6rem, 4.2vh, 2.5rem) + env(safe-area-inset-bottom))`. Mide 48 × 44.
  - Dos barras de 18 y 12 px × 1,5 px, con 5 px de hueco y la corta 6 px hacia la izquierda, del color `tinta` de la escena.
  - Se ve al pasar el ratón por la ventana (opacidad de 0 a 1 en 160 ms) y se oculta a los 3 s sin moverlo. En táctil está siempre a 0,9.
  - **También en pausa.** Oculto con el menú abierto.
- **Hoja, sitio publicado:**
  - **Estrecha:** izquierda y derecha `clamp(0.75rem, 3.5vw, 1.25rem)`, abajo `max(0.85rem, env(safe-area-inset-bottom))`. Al abrirse, `--menu-pad` de la escena = alto medido de la hoja + 1,15 rem.
  - **Ancha:** izquierda `var(--side-left) + clamp(0.75rem, 1.6vw, 1.5rem)`, ancho `min(var(--side-width) − clamp(1.5rem, 3vw, 3rem), 46vw)` y abajo `var(--side-bottom) + 0.75rem`.
  - Alto máximo: `calc(100dvh − 6rem)`. **Sin scroll y sin cortar nada.** Solo por debajo de 600 px de alto puede hacer scroll interno, sin barra visible (`scrollbar-width: none`) y con un degradado de 24 px abajo.
- **Hoja, aspecto:** vidrio (12) con **16 px de padding igual en los cuatro lados** y **12 px entre filas**.
- **Animación (publicada):**
  - Entra desde `translateY(calc(100% + 3rem))` con `blur(16px)` y opacidad 0.
  - Transiciones: `transform` 680 ms `hoja`, `opacity` 520 ms ease y `filter` 560 ms ease.
  - Debajo, una capa transparente (`z-index` 30) que lo cierra al hacer clic fuera. La hoja va en `z-index` 34.
- **Contenido, en este orden:**
  1. Cabecera: «Ajustes» a la izquierda, en `clamp(1.45rem, 2.4vw, 1.9rem)` con peso 500 y `letter-spacing −0.03em`, y × redondo a la derecha, centrados en vertical.
  2. Escena: un `.control` por escena del registro (Lluvia · Arena · Clásico), a partes iguales. **Si el registro tiene una sola escena, la fila no se pinta.**
  3. Sesión única · Ciclos, en 2 columnas.
  4. Duraciones (5, 10, 15, 25, 45, 60 y Personalizado) o ciclos predefinidos, en una fila que salta de línea.
  5. Personalizado: un `Stepper` con − y + redondos (de 48 px) y el valor en el centro.
  6. Modo (Auto/Claro/Oscuro), Idioma (Auto/ES/EN) y Sonido, en 3 columnas. «Automático» se escribe «Auto», con el texto completo en el `Tooltip`.
- **Comportamiento:**
  - Se abre en pausa.
  - Cambiar de escena, de modo o el sonido mantiene la pausa y el tiempo.
  - Cambiar la duración o Sesión/Ciclos reinicia con el volteo de 180°.
  - Escape o × lo cierran.

### 14. Pausa

- La capa `.scene` (fondo, frasco, nube y reloj) lleva `filter: blur(18px)`.
- «Pausa» aparece centrada:
  - Tamaño `clamp(3.4rem, 8vw, 6rem)`, peso 400 y `letter-spacing 0.01em`.
  - Color `#FFFFFF`, con la sombra de texto del vidrio.
  - Va en `z-index` 28 y no recibe clics.
- La pista va debajo, a `50% + 4.2rem`, en 1 rem, también blanca.
- El texto sale de los `messages` del core, así que se traduce.
- El botón del menú y el pie siguen visibles y se pueden usar.

### 15. Cookies

- **Banner (sitio publicado):**
  - `position: fixed`, centrado (`left: 50%; transform: translateX(-50%)`), abajo `calc(altoPie + 12px + env(safe-area-inset-bottom))`. El alto del pie se mide y se pasa como `--alto-pie`, así quedan ≥ 12 px sobre los enlaces (F19a).
  - Ancho: `min(40rem, 100% − 1.25rem)`. Por encima de 1200 px de ancho, `min(720px, 100% − 48px)`, que es más ancho y menos alto, como pediste.
  - Vidrio (12) con padding 16 16 14 px. Texto de 0,92 rem con interlineado 1,45 y 12 px de margen abajo.
  - Tres `.control` de 42 px de alto mínimo, en 3 columnas con 8 px de hueco; en 1 columna por debajo de 560 px de ancho.
  - Entra con opacidad y `translateY(8px)` → 0 en 420 ms ease.
- **Lógica:** la publicada. Hasta que se decide, no sale el aviso de Android. «Configurar cookies» (desde el pie o desde el panel legal) vuelve a abrir el banner.

### 16. Aviso de la app Android

- **Sitio (publicado):**
  - Izquierda `clamp(0.7rem, 2.4vw, 1.15rem)`, abajo `calc(2.65rem + env(safe-area-inset-bottom))`; por debajo de 640 px de ancho, abajo `calc(4.15rem + env(…))`.
  - Ancho `min(28rem, 100% − 5.4rem)`.
- **Aspecto:**
  - Vidrio (12) con padding `0.45rem 0.35rem 0.45rem 0.75rem` y 0,45 rem de hueco.
  - Textos: título de 0,8 rem con peso 500, frase de 0,72 rem y nota de instalación de 0,68 rem, estas dos en el blanco secundario.
  - «Descargar»: `.control` elegido de 2 rem de alto, 0,75 rem y padding `0 0.7rem`.
  - ×: redondo de 1,7 rem.
- **Animación:** `translateY(8px)` → 0 y opacidad de 0 a 1 en 420 ms ease.
- **Cuándo:** la regla publicada `androidPromoOpen`. Se oculta en pausa, con el menú abierto y con el panel legal.
- **El reloj nunca se le monta encima:** en estrecha, el padding de abajo pasa a 9,5 rem (publicado).

### 17. Panel legal y pie

- **Capa:**
  - `position: fixed; inset: 0; z-index: 70`, con padding `clamp(0.75rem, 2vw, 1.5rem)` y fondo `rgba(0,0,0,0.28)`.
  - Diálogo de vidrio (12), centrado, de `min(44rem, 100%)` × `min(86vh, 52rem)`, con `overflow: hidden`.
- **Documento:**
  - Un `iframe` con `?embed=1&modo=claro|oscuro`, de fondo transparente. Lo generan `legal/generar.mjs` y `public/legal.css`.
  - **Cabecera dentro del documento:** `position: sticky; top: 0`, de 56 px de alto, con fondo `rgba(18,18,18,0.55)` y `backdrop-filter: blur(16px)`, y una línea abajo de 1 px `rgba(255,255,255,0.12)`.
  - En la cabecera van el título, ES/EN y un × redondo de 36 px a 12 px del borde derecho.
  - El texto va en una columna de 70 caracteres como máximo, con 16 px de padding a los lados. Empieza 16 px bajo la cabecera y nunca pasa por debajo de ella.
  - Barra de scroll oculta (`scrollbar-width: none`). Un solo borde (el del diálogo), sin cajas dentro.
- **URL:** las de siempre (`/privacidad.html`, `/privacy.html`, etc.).
- **Pie:**
  - `position: fixed`, abajo y centrado, saltando de línea si hace falta. Hueco de `0.35rem 0.85rem` y padding `0.5rem max(4.5rem, 6vw) calc(0.5rem + env(safe-area-inset-bottom))`.
  - Texto de 0,75 rem en la `tinta` de la escena al 78 %.
  - Enlaces (publicados): Aviso legal · Privacidad · Cookies · App Android · Ajustes de cookies.
  - Se ve también en pausa.

### 18. Escenas: qué trae cada una

| | Lluvia (por defecto) | Arena | Clásico |
|---|---|---|---|
| Contenido | Agua (9) + gotas (10) | Arena (5) | Arena (5) |
| Encima | Nube (11) | — | — |
| Reloj alto en ancha | Sí | Sí | No (centrado en vertical, como el publicado) |
| `tinta` claro / oscuro | `#161816` / `#F4F6F5` | `#2A2623` / `#FFFFFF` | `#36322F` / `#F2EFEA` |
| `reserva` claro / oscuro | `#c5cdc8` / `#2c2824` | `#e4c7a4` / `#3a2618` | `#e8dfd4` / `#2a2422` |
| `barra` claro / oscuro | `#c5d0cb` / `#1a2422` | `#e6d7c4` / `#241910` | `#ebe5dd` / `#241c18` |

- La escena se guarda en `localStorage` con la clave `hourglass-web/escena`. Si lo guardado no vale, Lluvia.
- **Cambiar de escena:**
  - Se llama a `destruir()` del contenido viejo y se crea el nuevo, que no hereda nada.
  - El fondo cambia con el fundido de 8, y la interfaz con `transition: color, background-color, border-color 360ms suave`.
  - **No se mueve ninguna caja.**

---

## (e) Vueltas del agente

### e.0 Cómo es cada encargo (cabecera común, se pega igual en todas)

```
Modelo: grok-4.7, reasoning_effort xhigh (puesto a mano en esta llamada)
Repo: SebastianZaruha/hourglass-pomodoro · rama feature/web-modular · solo apps/web (y packages/core SOLO donde se diga)
Lee antes: apps/web/AGENTS.md, apps/web/FIJADO.md, docs/PLAN-RECONSTRUCCION.md (secciones c y d)
Reglas:
- Un commit por pieza, mensaje en español. Sin merge, sin publicar, sin esperar al CI.
- Solo puedes tocar los archivos de «Archivos permitidos». Si necesitas otro, PARA y explica por qué.
- Prohibido: tests nuevos, refactors no pedidos, tocar otras escenas, cambiar números que este encargo no da.
- npm run build tiene que pasar (incluye comprobar-imports).
- Antes del push, comprueba a mano en `vite build && vite preview`, con ratón real, cada línea de FIJADO.md activa.
- Entrega: lista de lo hecho, capturas 1:1 a 1440×900 y 390×844 de lo que cambia, y lo que no hayas conseguido dicho claro.
```

Después de cada vuelta:
1. **Leonardo** pasa su verificación (`verify/`, fuera del repo) y la revisión a mano en la preview de Vercel.
2. Si algo de FIJADO se rompe, se revierte ese commit entero.
3. Lo cosmético lo miras tú en la preview cuando quieras. No hace falta para seguir, salvo en las vueltas marcadas **«Tu OK»**.

### V0. Rama y mudanza sin cambiar nada visible

- **Objetivo:** el código de `main` repartido en el árbol de c.2, con **la misma web** que producción.
- **Archivos permitidos:** todo `apps/web/src/**` (para moverlo), `apps/web/scripts/comprobar-imports.mjs` (nuevo), `apps/web/package.json` (solo el script `build`), `apps/web/AGENTS.md` y `apps/web/FIJADO.md` (nuevos), y `docs/PLAN-RECONSTRUCCION.md` (copia de este documento).
- **Qué hacer:**
  1. Crear `feature/web-modular` desde `4b39e74`.
  2. Mover sin cambiar lógica:
     - `useEngine.ts`: el giro, el volteo y la intro van a `comun/giro/giro.ts` + `useGiro.ts` (único dueño del ángulo, con la interfaz `OrdenGiro` de c.3), y la simulación de arena a `escenas/arena-modelo/crearArena.ts`, implementando `Contenido`.
     - `draw.ts`: el vidrio dibujado y la sombra van a `comun/frasco/pintarVidrio.ts` y `sombra.ts` (de momento el frasco **dibujado**, igual que hoy); `paintCells`, la LUT, el ruido y las partículas, a `arena-modelo/pintarArena.ts`.
     - `HourglassView.tsx` pasa a ser `comun/frasco/Frasco.tsx`, con el bucle único que se duerme y el arrastre, que manda órdenes a `useGiro`.
  3. Partir `App.tsx` en `app/App.tsx`, `app/useEntrada.ts` y `app/useAvisos.ts`. `styles.css` se reparte, sin cambiar ni un valor, en el CSS de cada carpeta y en `app/app.css`.
  4. `app/registro.ts` = `[clasicoPublicado]`: una escena con el degradado y los colores publicados, `relojAlto: false` y `crearContenido = crearArena`. Mientras haya una sola escena, la fila de escenas no existe.
  5. `scripts/comprobar-imports.mjs` con las reglas 1-5 y 7 de c.4, ejecutado en `build` antes de `tsc`.
  6. `AGENTS.md`: las reglas de `REGLAS-AGENTE.md` + c.4. `FIJADO.md`: la lista (f), con las líneas activas desde V0.
- **Hecho cuando:**
  - La preview y producción, una al lado de la otra a 1440×900 y 390×844, en claro y en oscuro, se ven **iguales**: frasco, arena, reloj, menú, cookies, aviso, pie y pausa.
  - Rueda 05:00 → 15:00 → 01:00: la arena de arriba sube y baja sin arrancar.
  - Arrastrar inclina y no arranca. Soltar a menos de 81° vuelve.
  - Doble clic en marcha: giro de 180° y reloj parado en la duración, con el montón como al cargar.
  - Clic arranca y hay chorro fino y centrado a los 4 s.
- **No romper:** todo FIJADO activo. **Tu OK:** no (no cambia nada visible).

### V1. Vidrio y menú

- **Objetivo:** el menú queda terminado: sitio publicado, aspecto v2 y comportamiento del 13 nov.
- **Archivos permitidos:** `comun/estilo/tokens.css`, `comun/estilo/vidrio.css`, `comun/menu/**`, `app/App.tsx` (solo para pasar `escenas` al menú y permitir el menú en pausa), `app/app.css` (solo `--menu-pad`), `vite.config.ts` y `package.json` (dependencia `lightningcss`).
- **Qué construir:** (d) 12 y 13, con todos sus números.
  - `tokens.css` con espacios 4/8/12/16/24/32/48, radio de panel 28, textos 13/15/17/22, duraciones 160/360/620 y curva `suave`.
  - `vidrio.css` con `.vidrio` y `.control`.
  - El menú se abre en pausa.
  - Las reglas de cambio en pausa de (d) 13.
- **Hecho cuando:**
  - En 1440×900 y 390×844, el menú abierto está **en el mismo sitio** que en producción, con vidrio esmerilado: el fondo se ve borroso detrás.
  - El texto y los iconos son blancos. Los botones son casi transparentes, y el elegido, un poco más claro.
  - El hueco entre filas es igual, el padding es igual en los 4 lados, y − y + son círculos.
  - Sin barra de scroll y sin nada cortado, también con Personalizado y con ciclos.
  - Se abre y se cierra con la animación publicada.
  - En pausa: se abre, y cambiar el modo o el sonido mantiene la pausa; cambiar la duración reinicia con el giro.
  - `dist/assets/*.css` contiene `backdrop-filter:` sin prefijo.
- **Tu OK:** sí, mirando el menú en claro y en oscuro.

### V2. Pausa

- **Archivos permitidos:** `comun/paneles/pausa/**`, `app/App.tsx` (montar `<Pausa>` y la clase `is-paused`) y `app/app.css` (solo el desenfoque de `.scene`).
- **Qué construir:** (d) 14. Pie y botón del menú visibles en pausa.
- **Hecho cuando:**
  - En pausa, la escena se ve borrosa, y «Pausa» grande, centrada y blanca, con la pista debajo.
  - En inglés pone «Paused».
  - El botón del menú y el pie se ven y funcionan.
  - Un clic reanuda. El frasco no se deja arrastrar.

### V3. Cookies

- **Archivos permitidos:** `comun/paneles/cookies/**`, `comun/paneles/pie/pie.css` (solo exponer `--alto-pie`) y `app/useAvisos.ts`.
- **Qué construir:** (d) 15.
- **Hecho cuando:**
  - Con `localStorage` vacío, el banner sale en el sitio publicado, en vidrio.
  - Hay ≥ 12 px entre el banner y los enlaces del pie (medido en la captura a 1440 y a 390).
  - A 1920×1080 es más ancho (720 px) y los 3 botones van en fila.
  - Aceptar, Rechazar y Configurar funcionan como en producción. «Ajustes de cookies» del pie lo vuelve a abrir.

### V4. Aviso de la app Android

- **Archivos permitidos:** `comun/paneles/android/**` y `app/useAvisos.ts`.
- **Qué construir:** (d) 16.
- **Hecho cuando:**
  - Tras decidir las cookies, el aviso sale abajo a la izquierda, como en producción, en vidrio y con su animación.
  - × lo cierra para siempre.
  - No sale con el menú abierto, en pausa ni con el panel legal.
  - En 390×844, el reloj no lo pisa.

### V5. Panel legal y pie

- **Archivos permitidos:** `comun/paneles/legal/**`, `comun/paneles/pie/**`, `legal/**` (generador y textos de v2), `public/*.html`, `public/legal.css` y `public/legal.js`.
- **Qué construir:** (d) 17. Se trae el generador de v2. Se arregla la cabecera sticky, que en v2 falla en F18b.
- **Hecho cuando:**
  - Cada enlace del pie abre su documento en el panel de vidrio.
  - Con la rueda, el texto hace scroll por **debajo** de una cabecera fija que nunca pisa una línea, en ES y en EN.
  - Hay un solo borde y ninguna barra blanca.
  - Las URL de siempre siguen abriendo la página suelta (prueba: `/privacidad.html` en una pestaña nueva).
- **Tu OK:** sí, el panel legal.

### V6. Frasco de foto y arena dentro (una sola forma)

- **Objetivo:** el frasco nuevo, con la arena publicada llenándolo pared con pared.
- **Archivos permitidos:**
  - `public/frasco/jar-back.webp`, `jar-front.webp` y `jar-mask.webp` (de v2 `108884e`; en la máscara, solo abrir el canal del cuello: filas 477-516 y columnas 218-227 en blanco).
  - `comun/frasco/**` y `escenas/arena-modelo/**`.
  - `packages/core/src/sim/sandSimulation.ts`, **solo** para añadir la opción `radioInterior` (c.6.4), sin tocar nada más. Si dices que no en (g) 1, esta línea se borra y el agente para y avisa.
- **Qué construir:**
  - c.6 completo (`geometria.ts` y `golpe.ts`).
  - `pintarVidrio.ts`: la sombra publicada, luego `jar-back` girado, luego `contenido.pintar`, luego `jar-front` girado y luego la luz (con fuerza 0 mientras Clásico siga con el degradado publicado).
  - En `arena-modelo`: la rejilla con `radioInterior`, la pintura recortada con la máscara, la ventana interior de c.6.3 y los números de (d) 5 **sin** inclinación todavía.
  - La carga de (d) 3.
- **Hecho cuando:**
  1. El frasco es el de foto, del mismo tamaño y en el mismo sitio que el dibujado de producción (se comparan los dos a 1440×900).
  2. Ampliando la captura 1:1, la arena toca el cristal en los dos bulbos: **sin franja de fondo** entre la arena y la pared, ni en reposo, ni en marcha, ni a 45° de inclinación.
  3. El chorro baja por el centro del cuello y no atraviesa el vidrio.
  4. Todo lo que comprobó V0 (rueda, arrastre, doble clic y clic) se comporta igual.
  5. No se ven las dos elipses al cargar.
- **Tu OK:** sí, el frasco con la arena.

### V7. La arena responde a la inclinación, grano a grano

- **Archivos permitidos:** `escenas/arena-modelo/crearArena.ts`.
- **Qué construir:** (d) 5, apartado «Inclinación». Es la regla de v2 `80244ee` (`useFrasco.ts` 154-156) con 2 pasos por fotograma y `TiltLod`.
- **Hecho cuando:**
  - Parado, al inclinar 10-20° con el ratón, la superficie de arriba y el montón de abajo **resbalan** hacia el lado bajo, grano a grano.
  - Al soltar, vuelven a asentarse.
  - Arriba quedan los mismos granos: el nivel no cambia y el reloj no arranca.
  - En marcha, igual, y el chorro sigue saliendo del cuello.
  - Doble clic: el montón queda como al cargar, sin bloques ni trozos sueltos en la media vuelta.
- **Tu OK:** sí, cómo se mueve.

### V8. Fondos y escena Arena

- **Archivos permitidos:** `comun/fondo/**`, `public/fondos/arena-*` (de v2), `escenas/arena/**`, `app/registro.ts` (añadir `arena`), `app/App.tsx` (montar `<Fondo>`, el reloj alto con `useCajaFrasco` y el cambio de escena) y `comun/reloj/**` (solo el modo `relojAlto`).
- **Qué construir:**
  - (d) 8 completo.
  - La escena Arena con los datos de (d) 4, 7 y 18: luz, reloj alto, tinta, reserva y barra.
  - El cambio de escena de (d) 18, con `destruir()` y el fundido de 360 ms.
  - Ahora el registro tiene 2 escenas, así que la fila de escenas aparece en el menú sin tocar el menú.
- **Hecho cuando:**
  - Arena en claro (foto) y en oscuro (vídeo, que se mueve): el frasco apoyado en el suelo de la foto a 1440×900, 1024×768 y 390×844.
  - En ancha, el reloj está a la altura del bulbo de arriba, encima de las rocas.
  - Clásico → Arena → Clásico **sin recargar**: el fondo cambia con un fundido, nada se mueve de sitio, y la arena de Clásico sigue bien (rueda y doble clic).
  - En Arena oscuro se ve el vídeo de Arena, no otro.
- **Tu OK:** sí, Arena.

### V9. Escena Lluvia: fondo y agua

- **Archivos permitidos:** `escenas/lluvia/index.ts`, `escenas/lluvia/agua/**`, `public/fondos/lluvia-*` (de v2) y `app/registro.ts` (añadir `lluvia` primero, por defecto).
- **Qué construir:**
  - (d) 9 completo: masa por área, k-ésimo punto, muelle de 1,8 Hz con ζ 0,30 y κ 0,35, olas de 32 puntos con c 0,9 y β 2,4 y ε 0,08, el color, el menisco y el volteo.
  - Los datos de la escena de (d) 4, 7 y 18.
  - **Sin** gotas ni nube todavía.
  - Lluvia no importa nada de `arena-modelo` (lo vigila `comprobar-imports`).
- **Hecho cuando:**
  1. El agua llena el cristal pared con pared en los dos bulbos (ampliando 1:1, sin franja).
  2. Al inclinar 30-40° y soltar, la superficie se queda **horizontal en el mundo**, se mece 2-3 veces y se calma en menos de 1 s, como una sola masa, con olas suaves y sin granos.
  3. El volumen no cambia al mecerse.
  4. Con la rueda, el agua de arriba sube y baja con el tiempo, suave y sin arrancar.
  5. En marcha, el agua de arriba baja y la de abajo sube.
  6. Doble clic: giro de 180° con el agua dentro, y queda todo arriba y parado.
  7. Ninguna línea blanca, y nunca marrón.
  8. Lluvia → Arena → Lluvia sin recargar: la arena de Arena está intacta (rueda y doble clic) y el agua de Lluvia empieza limpia.
- **Tu OK:** sí, el agua.

### V10. Gotas

- **Archivos permitidos:** `escenas/lluvia/gotas.ts` y `escenas/lluvia/agua/modelo.ts` (solo la entrada del pulso de la gota).
- **Qué construir:** (d) 10.
- **Hecho cuando:**
  - En marcha caen gotas finas, verticales en pantalla, del cuello al agua de abajo, y dejan una onda mínima.
  - Al inclinar más de 35° o al pausar, se cortan en unos 200 ms.
  - Parado, no hay ninguna.

### V11. Nube

- **Archivos permitidos:** `escenas/lluvia/nube/**`, `public/nube/*` (de v2) y `escenas/lluvia/index.ts` (solo `Encima`).
- **Qué construir:** (d) 11.
- **Hecho cuando:**
  1. La nube tapa la boca del frasco, es semitransparente y un poco más ancha que en v2.
  2. Al inclinar el frasco, la nube **no se mueve ni gira**, solo se desvanece. A 50° ya no se ve, y vuelve al soltar.
  3. Durante el doble clic desaparece y vuelve al terminar.
  4. Mirándola 30 s, el bucle no salta, no hay marco oscuro y no tiembla.
  5. En 390×844 no es mucho más ancha que el frasco y su base no queda cortada en recto.
- **Tu OK:** sí, la nube.

### V12. Clásico nuevo

- **Archivos permitidos:** `escenas/clasico/**`, `public/fondos/clasico-*` (de v2) y `app/registro.ts` (sustituir `clasicoPublicado` por `clasico`).
- **Qué construir:** los datos de Clásico de (d) 4, 7, 8 y 18: estudio crema en claro y carbón con foco cálido en oscuro, y el reloj centrado en vertical.
- **Hecho cuando:**
  - Clásico se ve con el estudio nuevo y el frasco de foto apoyado.
  - El reloj está centrado en vertical en la columna derecha (ancha) o debajo del frasco (estrecha), en el mismo sitio que en producción.
  - La arena funciona igual que en Arena.
- **Tu OK:** sí, Clásico.

### V13. Cierre (sin agente)

1. Leonardo pasa la verificación completa en las 3 escenas × 2 modos × 5 tamaños (390×844, 768×1024, 1024×768, 1440×900 y 1920×1080).
2. Te enseña la preview con una hoja de capturas.
3. Solo con tu OK se habla de publicar.

Las fases 8-9 de la especificación v2 (idiomas, accesibilidad y presupuestos de carga) van después, con su propio plan.

---

## (f) FIJADO de la rama nueva

Va en `apps/web/FIJADO.md`. Una línea por comportamiento. Lo activo no puede empeorar en ninguna vuelta. Entre paréntesis, la vuelta desde la que está activo.

**Gestos y tiempo**
- N01 (V0) La rueda solo cambia el tiempo. Nunca gira el frasco y nunca arranca la cuenta.
- N02 (V0) Arrastrar o girar el frasco nunca arranca la cuenta. Soltarlo antes de 81° lo devuelve a 0.
- N03 (V0) Un clic empieza, pausa o reanuda tras 260 ms. En pausa, el segundo clic no reinicia.
- N04 (V0) El doble clic hace un giro de 180° con el contenido dentro, y deja el reloj parado en la duración, con el bulbo de arriba como en una carga limpia.
- N05 (V0) Con el reloj parado, el nivel de arriba sigue a la duración al momento, de forma suave.
- N06 (V0) En marcha, el nivel de arriba baja con el tiempo, y en ciclos hay media vuelta al cambiar de fase.
- N07 (V2) En pausa, el frasco no se arrastra y un clic reanuda.

**Menú y paneles**
- N08 (V1) El menú está en el sitio publicado, en vidrio, con texto blanco, sin scroll ni cortes, con padding igual y − y + redondos.
- N09 (V1) El menú se abre en pausa. Escena, modo y sonido mantienen la pausa; la duración y Sesión/Ciclos reinician con el giro.
- N10 (V2) En pausa: «Pausa» blanca y traducida, la escena borrosa, y el botón del menú y el pie disponibles.
- N11 (V3) El banner de cookies está en el sitio publicado, en vidrio, a ≥ 12 px del pie, y a 720 px de ancho en pantallas grandes.
- N12 (V4) El aviso Android está en el sitio publicado. Nunca coincide con las cookies, el menú, la pausa o el panel legal. El reloj nunca lo pisa.
- N13 (V5) En el panel legal, la cabecera queda fija y nunca tapa el texto. Las URL son las de siempre.
- N14 (V1) Nada se solapa (reloj, frasco, menú, pie, avisos y botón) a 1440×900 y 390×844.

**Frasco y contenido**
- N15 (V6) El contenido llena el cristal: no hay franja de fondo entre la arena o el agua y la pared.
- N16 (V6) El chorro de arena sale del centro del cuello y nunca atraviesa el vidrio.
- N17 (V6) Al cargar no se ve ningún frasco provisional de líneas o elipses.
- N18 (V7) La arena resbala grano a grano al inclinar, sin cambiar los granos de arriba, y nunca se parte en bloques al voltear.
- N19 (V8) Cambiar de escena no mueve ninguna caja y no deja restos: la escena nueva empieza limpia.
- N20 (V8) Cada escena y modo muestra su propio fondo (el vídeo correcto).
- N21 (V9) El agua es una masa continua, horizontal en el mundo, que se mece y se calma en menos de 1 s, sin línea blanca y nunca marrón.
- N22 (V10) Las gotas caen verticales en pantalla, solo en marcha y a menos de 35°.
- N23 (V11) La nube nunca se mueve ni gira con el frasco: solo cambia de opacidad. Su bucle no salta.
- N24 (V0) `npm run build` pasa, incluido `comprobar-imports`.

---

## (g) Riesgos y preguntas para ti

**Preguntas (solo tú puedes decidirlas):**

1. **¿Me dejas añadir una opción opcional a `packages/core` (`SandSimulation`)?**
   - Son unas 6 líneas. Si no se usa, todo funciona exactamente como hoy, y la app Android no cambia ni hay que recompilarla.
   - Es lo que permite que la arena tenga **exactamente** la forma de la foto.
   - Si dices que no, la alternativa es ajustar los números de la fórmula de pera. Quedan diferencias de hasta un 2 % (unos 2-3 px en pantalla), tapadas en parte por el borde del cristal. Funciona, pero no es exacto.
2. **Colocación en estrecho: ¿la publicada tal cual, o con los retoques que pediste para v2 el 13 nov?** Esos retoques eran:
   - más separación entre frasco y reloj (≥ 32 px);
   - con la ventana a 1/3, que el reloj no baje al abrir el menú;
   - el menú algo más separado del borde de abajo.

   Dijiste que la publicada es perfecta, así que el plan la deja **tal cual**. Si quieres esos retoques, entran como una vuelta aparte después de V5.
3. **El tacto del agua.** He elegido que se meza 2-3 veces y se calme en unos 0,8 s (1,8 Hz, amortiguación 0,30). El 12 nov pediste que se calmara en 600 ms, y hoy que haga ola o vaivén. Si lo quieres más tranquilo o más vivo, es un número. Lo ves en V9 y me dices.

**Riesgos y cómo se cubren:**

| Riesgo | Cómo se cubre |
|---|---|
| El bulbo de abajo de la foto es 15 px más hondo que el de arriba | Rejilla simétrica con el máximo de los dos y recorte con la máscara real: nunca hay hueco; lo que sobra queda detrás del cristal (c.6) |
| El agente se sale de sus archivos | La lista de archivos permitidos en cada encargo + `comprobar-imports` en el build + la revisión del diff antes de aceptar |
| Una vuelta rompe algo ya hecho | FIJADO + verificación de Leonardo en la preview. Se revierte el commit, no se parchea encima |
| El agua cuesta más de una vuelta | Está aislada en `escenas/lluvia/agua/`. Si falla dos veces, primero se diagnostica (regla 16 de Leonardo) |
| El frasco de foto pesa más que el dibujado (~148 KB) | La intro espera a que llegue, y a los 2,5 s se pinta la silueta |

---

## Apéndice: crítica y alternativas descartadas

### A.1 Dos diseños de partida

**Diseño A: «la escena es un objeto con `paso` y `pintar`; la cáscara es fina».**
- Un canvas y un bucle en `comun/frasco`.
- La escena da un `Contenido` que la cáscara llama entre el vidrio de detrás y el de delante. La nube es un componente del DOM aparte.

**Diseño B: «la escena es un componente React con su propio canvas, apilado bajo una capa común del frasco».**
- Cada escena monta `<CanvasDeEscena>` con su propio `requestAnimationFrame`.
- La cáscara pone encima un canvas solo con el vidrio y otro detrás.

**Diseño C (el de v2, como referencia): un bucle con `if (tipo === 'agua')`.** Ya sabemos cómo acaba.

### A.2 Revisión contra las señales de mal diseño (`design-red-flags.md`)

| Señal | A | B | C (v2) |
|---|---|---|---|
| Módulo poco profundo | Bien: `Contenido` tiene 4 métodos y esconde toda la física | Bien | Mal: `useFrasco` expone 12 campos |
| Fuga de información | Bien: solo cruza la `GeometriaFrasco` | **Mal: el ángulo, la caja y la intro se copian a cada canvas de escena** | Mal: nivel común |
| Dueño repartido | Bien: el ángulo lo escribe solo `giro` | **Mal: tres bucles leen y suavizan el ángulo cada uno a su manera; si uno va un fotograma tarde, el contenido «baila» contra el vidrio** | Mal |
| Dos formas de hacer lo mismo | Bien | Mal: dos bucles que se duermen de forma distinta | Mal: dos geometrías (máscara y perfil) |
| Partes internas importables | Bien: `index.ts` + `comprobar-imports` | Igual | Mal |
| Lista sincronizada a mano | Bien: el menú lee el registro | Bien | Mal: miniaturas, flags de precarga y temas por separado |

**Veredicto:** gana A.
- B parece más «separado», pero divide lo que debe ir junto: el vidrio y su contenido tienen que pintarse **en el mismo fotograma con el mismo ángulo**. Si no, la arena se despega del cristal al girar, que es justo el fallo que queremos matar.
- B además triplica el coste de canvas en móviles.

### A.3 El bucle de crítica (preguntándome por qué en cada decisión)

1. **«¿Por qué no trasplantar v2 y arreglarlo?»** Porque su corazón es un solo bucle con un nivel común. Arreglarlo es reescribirlo, solo que sobre 36 parches. Descartado.
2. **«¿Por qué la nube no va dentro del canvas?»** Porque entonces la pintaría el código que gira. En el DOM, con solo la prop `opacidad`, girarla es **imposible**, no solo «algo que no hay que hacer».
3. **«¿Por qué no un `Contenido` por cada cosa (arena, chorro, agua, gotas)?»** Lo probé en papel: el chorro necesita la rejilla de la arena, y las gotas necesitan la superficie del agua. Partirlos expone sus internos (fuga). Mejor un `Contenido` por modelo, con sus piezas dentro.
4. **«¿Arena y agua comparten algo?»**
   - El agua con el modelo de la arena serían granos: lo prohibiste, y además no tiene sentido físico.
   - Comparten **solo** la geometría (es el mismo frasco) y el reloj (es el mismo tiempo).
   - La curva de nivel del core es una regla de tiempo, no de arena: Lluvia la usa a través de su propio `nivel.ts`, así que cambiarla para el agua no puede tocar la arena.
5. **«¿Por qué una ola de 32 puntos y no una simulación de fluidos?»**
   - Lo que se ve de un líquido en un frasco es su superficie.
   - Navier-Stokes o partículas SPH costarían 20-40 ms por fotograma y serían inestables en un canvas.
   - Un muelle (la masa entera que se inclina) más un campo de alturas (las olas) da horizontal, vaivén, olas y masa exacta en menos de 1 ms.
6. **«¿Por qué rejilla simétrica con el máximo y no con el mínimo?»**
   - Con el mínimo quedarían franjas de fondo de hasta 14 px en la base, que es justo donde se acumula la arena y se ve.
   - Con el máximo, lo que sobra queda detrás del cristal, en las puntas redondas que la arena casi nunca alcanza (llena el 86 %).
7. **«¿Por qué copiar la colocación publicada en vez de la medida de v2?»** La pediste así. Además el frasco de foto mide lo mismo que el dibujado, así que no hace falta medir nada nuevo. Una función de colocación de 381 líneas (la de v2) es justo la complejidad que no queremos.
8. **«¿`comprobar-imports` no es un test encubierto?»** No comprueba qué hace la web, sino que las puertas entre carpetas sigan cerradas. Sin él, «cada cosa en su sitio» dependería de que el agente se acuerde, y ya vimos que no se acuerda.
9. **«¿Por qué empezar con el frasco dibujado (V0) y cambiarlo en V6?»** Porque V0 tiene que poder compararse con producción píxel a píxel. Si en V0 cambiara el frasco, no sabríamos si la mudanza rompió algo.
10. **«¿Por qué Clásico al final si es la escena más simple?»** Porque hasta V12 hace de «testigo»: es la web publicada dentro de la estructura nueva. Si algo cambia en ella, lo ha roto otra pieza.

### A.4 Alternativas descartadas, en una línea cada una

- **Ajustar la fórmula de pera a la foto:** 2 % de error y huecos. Solo si dices que no a la pregunta 1.
- **Construir la rejilla con la forma real de cada bulbo, sin simetría:** el volteo de la rejilla (`rotateHalfTurn`) dejaría granos fuera del hueco.
- **Hacer simétrica la foto del frasco (espejar el bulbo de arriba):** la luz y los reflejos quedarían al revés en el bulbo de abajo y perdería lo que te gusta de la foto.
- **Traer `calcularLayout` de v2:** contradice «la colocación publicada es perfecta» y suma 381 líneas.
- **Un bucle por escena (diseño B):** se pierde la sincronía entre el vidrio y el contenido, y triplica el coste.
