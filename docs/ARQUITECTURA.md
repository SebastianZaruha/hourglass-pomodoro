# Arquitectura y funcionamiento interno

Este documento explica **cómo está hecho** el Reloj de Arena: dónde vive cada cosa en el
código y cómo funcionan el temporizador, las sesiones y los ciclos, la arena, el vidrio, la
inclinación, la vibración, el sonido, el menú de ajustes, los temas y la entrada animada. Para instalarlo y ejecutarlo, ver el [README](../README.md); para la historia de cada
versión, el [CHANGELOG](../CHANGELOG.md).

## Índice

1. [Estructura del monorepo](#estructura-del-monorepo)
2. [Visión general](#visión-general)
3. [El temporizador](#1-el-temporizador-nunca-cuenta-ticks)
4. [La arena](#2-la-arena-es-una-simulación-granular-de-verdad)
5. [Dibujo 2.5D con Skia y shaders](#3-dibujo-25d-con-skia-y-shaders)
6. [Realismo de granos y vidrio (1.4)](#4-realismo-de-granos-y-vidrio)
7. [Inclinación, pausa de lado y volteo](#5-inclinación-pausa-de-lado-y-volteo)
8. [Vibración](#6-vibración)
9. [Sonido](#7-sonido)
10. [Memoria y objetos Skia](#8-memoria-y-objetos-skia)
11. [Sesiones y ciclos trabajo/descanso (1.5)](#9-sesiones-y-ciclos-trabajodescanso)
12. [Menú de ajustes (1.5)](#10-menú-de-ajustes)
13. [Temas claro, oscuro y automático (1.5)](#11-temas-claro-oscuro-y-automático)
14. [Entrada animada (1.5)](#12-entrada-animada)
15. [Idiomas: español e inglés (1.6)](#13-idiomas-español-e-inglés)
16. [Gestos: ayuda y zona del botón del menú (1.6)](#14-gestos-ayuda-y-zona-del-botón-del-menú)
17. [Segundo plano en Android (1.7)](#15-segundo-plano-en-android)
18. [Simulador de inclinación en el navegador](#simulador-de-inclinación-en-el-navegador)
19. [Personalizar colores (fondo claro)](#personalizar-colores-fondo-claro)
20. [Decisiones clave y por qué](#decisiones-clave-y-por-qué)
21. [Accesibilidad](#accesibilidad)
22. [Limitaciones conocidas](#limitaciones-conocidas)
23. [Scripts](#scripts)

## Estructura del monorepo

Un **monorepo** es un único repositorio con varios paquetes que se usan entre sí. Usamos
**npm workspaces**: el `package.json` de la raíz declara `packages/*` y `apps/*`, y npm enlaza
los paquetes locales como si fueran dependencias normales. Por eso en la app puedes escribir
`import { createTimer } from '@reloj/core'`.

```
reloj-de-arena/
├── package.json            ← raíz: workspaces + scripts globales (test, lint, check…)
├── eslint.config.mjs       ← reglas de calidad (Expo para la app, TypeScript para el core)
├── .prettierrc.json        ← formato automático del código
├── README.md · CHANGELOG.md · LICENSE.md · THIRD_PARTY_NOTICES.md
├── docs/
│   ├── ARQUITECTURA.md     ← este documento
│   ├── SEGUNDO_PLANO.md    ← notificación y avisos con la app cerrada (Android, 1.7)
│   └── capturas/           ← capturas de pantalla
│
├── packages/
│   └── core/               ← @reloj/core: LÓGICA PURA (sin React, sin UI)
│       ├── src/
│       │   ├── timer/      ← motor del temporizador, duraciones, formato, avisos, vibración y serialización
│       │   ├── recovery/   ← política del error boundary (remontar / recargar / rendirse)
│       │   ├── session/    ← planes, ciclos (preajustes, límites) y MOTOR DE SESIONES
│       │   ├── settings/   ← modelo de ajustes + validación (sanitize) + plan según ajustes
│       │   ├── catalog/    ← catálogos: contenidos (arena; agua más adelante) y modelos de reloj
│       │   ├── geometry/   ← perfil matemático (silueta) del reloj y zona de guarda del botón del menú
│       │   ├── i18n/       ← textos en español e inglés (diccionarios tipados) e idioma automático
│       │   ├── physics/    ← vectores 2D, filtro del acelerómetro, pausa/volteo
│       │   ├── sim/        ← simulación granular de la arena + controlador de flujo + menos detalle en un giro fuerte (TiltLod, 1.8.9)
│       │   ├── persistence/← interfaces de almacenamiento + implementación local
│       │   └── background/ ← sesión mínima para Android, avisos futuros y textos de la notificación
│       └── test/           ← tests de Vitest
│
└── apps/
    ├── mobile/             ← @reloj/mobile: la app Expo / React Native
    └── web/                ← @reloj/web: app de navegador (Vite + React). Reutiliza el core; no toca el móvil.
        ├── index.ts        ← entrada de Expo → src/bootstrap(.web).ts
        ├── app.json        ← configuración de Expo (nombre, paquete Android, tema, web…)
        ├── assets/sounds/  ← fin.mp3 (aviso al terminar) y cambio.mp3 (cambio de fase)
        ├── modules/background-timer/ ← MÓDULO NATIVO PROPIO (Kotlin): notificación, alarmas, botones, ventana flotante y PiP
        ├── public/         ← canvaskit.wasm para la web (lo copia npm install; no se versiona)
        └── src/
            ├── App.tsx             ← proveedores (gestos, safe area), fuentes, ajustes y fondo según el tema
            ├── bootstrap.ts        ← arranque nativo
            ├── bootstrap.web.ts    ← arranque web: carga CanvasKit y después la app
            ├── screens/TimerScreen.tsx ← la pantalla: gestos, avisos, menú, entrada, accesibilidad
            ├── components/TimeDisplay.tsx ← el tiempo digital de abajo y el rótulo de fase
            ├── components/HourglassBoundary.tsx ← error boundary: recupera el reloj si Skia falla
            ├── components/menu/    ← MENÚ DE AJUSTES (ver sección 10)
            │   ├── MenuButton.tsx  ← botón de dos rayas (abajo a la derecha desde la 1.8.10; su área es toda la zona de guarda)
            │   ├── SettingsSheet.tsx ← la hoja: pestañas de sesión, alto estable, arrastre, «atrás»
            │   ├── QuickSettings.tsx ← fila de botones redondos: Tema, Idioma, Sonido, Vibración, Flotante (1.8.8); etiqueta al mantener pulsado (1.8.10)
            │   ├── FrostedPanel.tsx  ← el vidrio de la hoja, sin desenfoque (Skia, dentro del lienzo del reloj)
            │   ├── useSheet.ts     ← estado y animación de abrir/cerrar
            │   ├── controls.tsx    ← segmentado, chip y stepper accesibles
            │   └── themedStyles.ts ← colores que cambian suavemente con el tema
            ├── hooks/              ← useSession, useSettings, useLatest, useKeepAwakeWhile
            ├── intro/useIntro.ts   ← entrada animada (solo al arrancar en frío)
            ├── dev/devClock.ts     ← reloj de la app; acelerable con ?velocidad=N (solo desarrollo)
            ├── sound/useCueSound.ts← avisos de fin y de cambio de fase (expo-audio)
            ├── haptics/            ← vibración (expo-haptics): haptics.ts + useTimerHaptics
            ├── motion/             ← acelerómetro (expo-sensors) → LiveMotion; simulador web
            ├── components/PauseLabel.tsx ← rótulo «Pausa» (al tumbar el móvil o al tocar)
            ├── components/GesturesHelp.tsx ← pantalla de ayuda «Gestos» (sección 14)
            ├── components/FloatingHelp.tsx ← explicación de la ventana flotante (mismo marco: InfoScreen.tsx)
            ├── i18n/I18n.tsx       ← idioma de la app: proveedor y useT() (sección 13)
            ├── background/         ← enlace con el módulo nativo: useBackgroundTimer, useFloatingWindow, sync, ¿avisa la app?
            ├── recovery/           ← guardar/recuperar la cuenta si hay que recargar (web)
            ├── storage/            ← adaptador AsyncStorage → interfaz del core
            ├── theme/theme.ts      ← paletas clara y oscura (también las del menú) y resolveScheme
            ├── theme/useAppTheme.ts← tema elegido o del sistema + progreso animado 0..1
            └── hourglass/          ← RENDERIZADOR REUTILIZABLE (Skia)
                ├── Hourglass.tsx   ← componente <Hourglass/> (capas en un Canvas, pose animable, hijos)
                ├── useThemeCrossfade.ts ← fundido al cambiar de tema (foto del lienzo)
                ├── objectPose.ts   ← pose del reloj (entrada + giro de cambio de fase)
                ├── layout.ts       ← tamaños en píxeles y trazados del vidrio
                ├── staticLayers.ts ← GlassPainter: fondo, sombra y vidrio (SkPicture)
                ├── pictureSlot.ts  ← publica pictures y libera los viejos (anillo fijo)
                ├── sandPainter.ts  ← arena + chorro en cada fotograma
                ├── useSandEngine.ts← bucle de animación (requestAnimationFrame; menos detalle en un giro fuerte, 1.8.9)
                ├── disposal.ts     ← liberación (diferida) de objetos Skia
                ├── resources.ts    ← compilación de shaders (por instancia, nunca global)
                ├── types.ts        ← fuente de movimiento (gravedad, inclinación, volteo)
                └── shaders/        ← programas SkSL para la GPU (vidrio, arena, fondo)
```

**Regla de oro:** `core` no importa nada de la app. La app importa de `core`. Así la lógica se
puede testear sin emuladores y reutilizar en la futura app de escritorio.

`apps/web` es la app de navegador (Vite + React). Importa el mismo core (sesión, ciclos,
ajustes, textos y simulación) y dibuja el vidrio en Canvas 2D. No usa Skia, sensores ni la
ventana flotante, y no modifica `apps/mobile`. Cómo arrancarla: [README › App de navegador](../README.md#app-de-navegador-appsweb).

## Visión general

```
 ┌───────────── TimerScreen ─────────────┐
 │ gestos (pan vertical de 1 dedo/tap/long press) y menú ──► useSession ──► motor de sesiones del core (fases encadenadas)
 │                                   │
 │                         getSnapshot() (tiempo calculado con marcas de tiempo)
 │                                   ▼
 │  <Hourglass> ──► useSandEngine (≈60 fps, se duerme cuando no hay nada que mover)
 │                    1. controlador de flujo: ¿cuántos granos deben quedar arriba?
 │                    2. SandSimulation.transfer() pasa granos por el cuello
 │                    3. SandSimulation.step() ×2: los granos ruedan y se asientan
 │                    4. SandPainter → SkPicture → shared value de Reanimated
 │                                   ▼
 │  <Canvas> Skia: [fondo+sombra+vidrio] [arena+chorro] [reflejos+contorno]
 └────────────────────────────────────────┘
```

### 1. El temporizador nunca cuenta «ticks»

El estado guarda `startedAt` (cuándo empezó a correr) y `accumulatedMs` (lo acumulado antes de
la última pausa). El tiempo transcurrido **se calcula** en cada momento:
`accumulatedMs + (ahora - startedAt)`. Si Android congela la app en segundo plano 10 minutos,
al volver el cálculo sigue siendo exacto. Las funciones (`start`, `pause`, `toggle`,
`restart`…) son **puras**: reciben estado y hora, devuelven un estado nuevo (como un reducer).

### 2. La arena es una simulación granular de verdad

`SandSimulation` (en el core) es un **autómata celular** tipo «falling sand»: el interior del
vidrio es una rejilla (~110×253 celdas) y cada celda está vacía o tiene un grano con su tono.
En cada paso cada grano intenta caer en la dirección de la **gravedad** (un vector de entrada),
si no puede prueba en diagonal y a veces se desliza de lado. De ahí salen solos el montón con
su ángulo de reposo, el cráter del bulbo superior y los deslizamientos.

- **El cuello está cerrado** en la rejilla: los granos solo lo cruzan con `transfer()`, que
  llama el **controlador de flujo** al ritmo exacto del temporizador
  (`granos arriba = granos iniciales × tiempo restante / duración`). La arena nunca se
  desincroniza del tiempo, aunque el móvil vaya lento.
- **Se vacía desde abajo, en embudo (1.6):** el grano que pasa es el de junto al cuello; la arena
  de encima baja a llenar el hueco fila a fila hasta la superficie, y en cada fila lo llena el
  grano de encima o uno de los de encima en diagonal, al azar (`collapseColumn`, el «modelo
  cinemático» de los silos). Así la superficie baja más en el centro y los lados resbalan hacia
  él. Antes bajaba una columna recta y se veía un canal vertical hasta el cuello.
- **Superficie en reposo (1.6):** al elegir duración o reiniciar, la arena de arriba ya forma un
  embudo suave (`crater` 0,25) con una ondulación leve, no una línea recta.
- **Una masa cae entera (1.6):** cuando un grano cae al vacío, la columna que tiene encima baja
  con él en el mismo paso (`followColumn`). Antes cada grano se enteraba un paso tarde y una
  masa grande (el bulbo lleno tras dar la vuelta) se abría en filas: rayas y un enrejado en V.
  Si el grano solo rellena un hueco de una celda (el cráter), no arrastra a nadie, así el cráter
  conserva su ladera ancha.
- **Fin de fase (1.6):** al cambiar de fase, los granos rezagados del embudo pasan abajo
  (`flushSource`) antes del giro; si no, quedaban colgando bajo el cuello y bajaban en bloque.
- Si la diferencia es enorme (vuelta de segundo plano, cambio de duración), la arena se
  **recoloca** directamente en su estado asentado en vez de animar horas de caída. El umbral
  y los granos por fotograma se adaptan al caudal (`flowBudget`): un retraso corto con mucho
  caudal (el giro de un cambio de fase) se recupera fluyendo, sin «reiniciar» la arena.
- **Igual a cualquier fps (1.6):** a 60 fps (el móvil) todo va como siempre: una sincronización
  y dos pasos de arena por fotograma, y el chorro emite y mueve sus granos una vez. Si el
  fotograma es más largo (el navegador sin GPU va a 12–30 fps), la arena da los pasos que le
  tocarían a 60 fps (hasta 3 «fotogramas de 60» por fotograma) y el chorro se parte en subpasos
  de ≤ 1/50 s. Antes, a pocos fps la arena caía más despacio que el tiempo y salía a tirones, y
  el chorro salía a paquetes y con menos granos.
- **Rendimiento:** solo se procesan los granos «despiertos» (los que se movieron o tienen un
  vecino que se movió). La arena en reposo no cuesta nada. En Node sin JIT (parecido a
  Hermes) un fotograma con dos pasos ronda 1,5–2 ms. Cuando nada se mueve, el bucle se detiene.

### 3. Dibujo 2.5D con Skia y shaders

No es 3D real: es **2D con shaders (SkSL)** que imitan el volumen, mucho más ligero:

- **Vidrio, cuerpo** (debajo de la arena): muestrea el fondo con un desplazamiento que depende
  de la curvatura → **refracción**; cerca del canto oscurece y tiñe (más vidrio atravesado).
- **Vidrio, frente** (encima de la arena): calcula la normal de la superficie de revolución,
  refleja el rayo de la cámara y mira un entorno sencillo (dos «ventanas» y un techo claro) con
  **Fresnel**. Así los brillos siguen la forma del bulbo, como en una foto.
- **Arena:** la simulación genera una imagen diminuta (1 píxel = 1 celda). El shader la amplía
  dibujando **microgranos** esféricos con posición, tamaño y tono aleatorios, luz, brillo y
  poros en sombra, más un sombreado cilíndrico global.
- **Fondo:** degradado cálido, luz difusa tipo ventana desenfocada, viñeta, una «mesa»
  insinuada y un grano finísimo anti‑bandas. Debajo del reloj, sombra de contacto y cáustica.

La silueta es una función matemática (`radiusAt` en `core/geometry/profile.ts`): bulbos en
forma de pera unidos al cuello con un «máximo suave». El shader implementa **la misma
fórmula**, así vidrio, arena y simulación encajan al píxel.

Las capas estáticas se graban una vez en un `SkPicture`; la arena se graba en cada fotograma y
se publica en un **shared value** de Reanimated, así el Canvas se redibuja **sin re-renderizar
componentes de React**.

**Al ritmo de la pantalla (1.8.1).** La simulación corre en el hilo de JavaScript, pero no con
`requestAnimationFrame` (que no espera a que la interfaz haya dibujado y, en un móvil lento,
encola fotogramas y retrasa todo lo demás). `useFramePacer` pide el siguiente paso desde el
hilo de la interfaz (`useFrameCallback`) y solo cuando el anterior ha terminado: como mucho un
paso por fotograma dibujado y nunca dos en cola. El vidrio (que depende de la inclinación) se
regraba como mucho 20 veces por segundo; la arena, en cada paso.

### 4. Realismo de granos y vidrio

| Qué                  | Cómo                                                                                                                                                                                                                                                                                                                                          | Dónde                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Tonos de grano       | Cada grano ya tenía su tono (1..255) fijado al crearse y que viaja con él. La tabla de colores ahora separa algo más los tonos (`CONTRAST` 0.6 → 0.75): varios matices de arena, estables, sin parpadeo.                                                                                                                                      | `hourglass/sandPainter.ts` (`buildPaletteLut`)               |
| Destellos de cuarzo  | Un ~5 % de los tonos (`SPARKLE_RATIO`) se marca con alfa 254 en la imagen de la rejilla (tabla `buildSparkleAlpha`, calculada una vez). El shader da a esos granos una «cara» con orientación propia: brillan cuando la luz, que se mueve al inclinar, se alinea con ella. Con el móvil quieto no cambian. Cero objetos nuevos por fotograma. | `hourglass/sandPainter.ts`, `hourglass/shaders/sand.ts`      |
| Vidrio más grueso    | Función `glassThickness(u)`: el vidrio es más grueso en los **extremos** y en el **cuello**. Ahí absorbe más (más teñido y oscuro), el canto se ve como una banda con un filo claro por dentro y un borde marrón muy tenue. El contorno pasa de 0.9 a 1.1 px y el brillo interior de 0.8 a 1.0 px.                                            | `hourglass/shaders/common.ts`, `glass.ts`, `staticLayers.ts` |
| Reflejos irregulares | Una ondulación suave (`glassWave`, dos senos: barata) tuerce un poco las ventanas reflejadas y varía su intensidad a lo largo del bulbo: ya no son rectángulos perfectos.                                                                                                                                                                     | `hourglass/shaders/glass.ts`                                 |
| Refracción           | Lo que se ve a través de los bulbos (el fondo) se ve un **3 % ampliado** (efecto lente) y ligeramente ondulado, y se desvía más donde el vidrio es grueso.                                                                                                                                                                                    | `hourglass/shaders/glass.ts`                                 |
| Vibración al voltear | Ya existía (impacto medio al completar el volteo, desde la 1.3): no se añade otra.                                                                                                                                                                                                                                                            | —                                                            |

Todo respeta **reducir movimiento** (los destellos y los reflejos dependen de la inclinación,

### 5. Inclinación, pausa de lado y volteo

| Parte                  | Qué hace ahora                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inclinación**        | El acelerómetro (`expo-sensors`, ~30 Hz, filtro paso bajo) da la gravedad. La arena «cae» hacia el suelo real: la superficie se queda casi horizontal, el montón se desliza y el chorro se curva un poco. Con el móvil plano, el reloj sigue «de pie».                                                                                                                                                                                                                                                                                                                           |
| **Avalanchas**         | Un grano quieto no resbala en cuanto puede: arranca con cierta probabilidad por paso (rozamiento estático, `staticFriction`). Al inclinar, la pendiente aguanta un instante y cae en pequeñas avalanchas hasta el ángulo de reposo (~30–34°).                                                                                                                                                                                                                                                                                                                                    |
| **Pausa de lado**      | Tumbar el móvil a ~90° (entra a 70°, sale por debajo de 55°, con un rebote de ~0,2 s) pausa: el reloj se desenfoca y aparece «Pausa», girado para leerse derecho. Al ponerlo de pie, sigue. Una pausa con el dedo no se reanuda sola: de pie muestra el mismo «Pausa», derecho, con un desenfoque ligero (2,5 px frente a 9). **De lado = en pausa (1.8.6, `pauseRule`)**: venga de donde venga, de lado se ve con el desenfoque fuerte y «Pausa» girado; tocar no reanuda (clic suave y «ponlo de pie para seguir»); al ponerlo de pie solo sigue si la pausa la puso tumbarlo. |
| **Voltear**            | Darle la vuelta (más de 150°, mantenido 0,3 s) es como voltear un reloj real: empieza **de cero** con la duración elegida y la arena que estaba abajo pasa a caer desde arriba. La pantalla gira 180° (el texto se lee derecho). Se puede repetir.                                                                                                                                                                                                                                                                                                                               |
| **Luz y reflejos**     | Los reflejos del vidrio, el brillo de los granos y el fondo se desplazan un poco con la inclinación (paralaje).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Sombra**             | La sombra suave del reloj sobre la mesa se desplaza y se alarga un poco hacia el lado al que inclinas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Pantalla encendida** | Mientras corre la arena (ya estaba; se apaga sola al pausar o terminar).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Reducir movimiento** | Filtro más lento, luz y sombra que se mueven menos, desenfoque sin animación y chorro calmado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Vibración**          | Ver tabla de abajo (`expo-haptics`). En la web no vibra.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Dónde está cada cosa:**

**Dónde está cada cosa:**

- Lógica pura y testeada (core): `physics/motion.ts` (filtro, gravedad de pantalla, escalones
  de 3° para la simulación, luz), `physics/orientation.ts` (máquina de estados de pausa y
  volteo con histéresis y rebote), `physics/pauseRule.ts` (qué hacen un toque, tumbar y poner
  de pie según quién puso la pausa, y cómo se ve; 1.8.6), `timer/haptics.ts`, `flip()` en `timer/engine.ts`,
  avalanchas y `rotateHalfTurn()` en `sim/sandSimulation.ts`.
- App: `src/motion/` (acelerómetro → `LiveMotion`; simulador de teclado para la web),
  `src/haptics/`, `components/PauseLabel.tsx`, y en `hourglass/` el `GlassPainter`
  (vidrio y sombra que se regraban baratos cuando cambia la luz) y `pictureSlot.ts`.
- **Solo con la app delante:** el acelerómetro se apaga en cuanto la app deja de estar en
  primer plano (`AppState`, en `useDeviceTilt`). Con la ventana flotante, en imagen en imagen
  o en segundo plano **voltear no reinicia** ni tumbar pausa: ahorra batería y evita reinicios
  sin querer con el móvil en el bolsillo. Es una decisión, no un fallo.
- La pantalla **no se re-renderiza** con cada muestra del sensor: el sensor escribe en un
  objeto que el bucle de animación lee en cada fotograma; React solo se entera de los eventos
  (pausa, volteo).

Detalles útiles:

- **Convención del acelerómetro:** en Android la gravedad «hacia abajo» en coordenadas de
  pantalla es `(-ax, ay, -az)`; en iOS el signo va al revés (`SIGN` en
  `motion/useDeviceTilt.ts`; sin probar en un iPhone real).
- **Umbrales** (`core/src/physics/orientation.ts`): pausa al pasar de 70° y reanuda por debajo
  de 55° (rebote 220/160 ms); volteo a más de 150° mantenido 300 ms (se deshace por debajo de
  140°).
- **Volteo:** la rejilla de la simulación se gira 180° (`rotateHalfTurn()`) y el lienzo también,
  en el mismo fotograma; así el código de dibujo siempre ve la arena caer «de arriba abajo».
- **Inclinar hacia delante/atrás** solo mueve la luz, no la arena (sería necesario un 3D real).

### 6. Vibración

| Momento                        | Vibración (`expo-haptics`)                                          |
| ------------------------------ | ------------------------------------------------------------------- |
| Empezar / reanudar             | `impactAsync(Medium)`                                               |
| Pausar (con el dedo o de lado) | `impactAsync(Heavy)` (más fuerte, para distinguirla)                |
| Voltear                        | `impactAsync(Medium)` (una sola vez)                                |
| Cada escalón al deslizar       | Android: `performAndroidHapticsAsync(Clock_Tick)`; iOS: `selection` |
| Cambio de fase (ciclos)        | Dos `impactAsync(Medium)` separados 120 ms, junto al sonido         |
| Fin del tiempo / de los ciclos | `notificationAsync(Success)`, junto al sonido                       |

Los clics al deslizar son uno por escalón que cambia y nunca dos a menos de 30 ms
(`StepTicker`). El ajuste `haptics` (interruptor «Vibración» del menú) lo apaga todo.

El módulo está en `apps/mobile/src/haptics/` (`haptics.ts` + `useTimerHaptics.ts`); la decisión
de qué vibración toca en cada cambio de estado es lógica pura del core (`timer/haptics.ts`,
con tests). En la web no hace nada.

### 7. Sonido

- **Sonido al terminar** (`expo-audio`): se precarga una vez, se libera al desmontar y suena
  una vez solo si la cuenta llega a 0 sola (en ciclos, al acabar la última ronda).
- **Sonido de cambio de fase** (`cambio.mp3`, «Swoosh 07» de Pixabay): un barrido suave, más
  bajo de volumen que el aviso de fin, al pasar de trabajo a descanso o al revés.
- **Sonido al voltear (1.8.6):** el mismo `cambio.mp3`, más bajo (cue `'flip'`), junto a la
  vibración del volteo.
- El interruptor **«Sonido»** del menú (ajuste `sound`) los silencia todos. En web, los navegadores solo permiten audio
  después de una interacción del usuario; como para empezar hay que tocar el reloj, funciona.
  Si un navegador lo bloqueara, la app sigue igual (el fallo se ignora).

Los avisos están en `apps/mobile/assets/sounds/` y los gestiona `sound/useCueSound.ts`
(volúmenes en `CUE_VOLUME`). Qué aviso toca y cuándo lo decide `sessionCue()` en
`core/src/session/session.ts` (con tests): `'phase-change'` si el contador `transitions` sube
sin que la sesión haya terminado, y `'finished'` cuando termina sola (no al pausar o reiniciar a
mano).

### 8. Memoria y objetos Skia

- En web, CanvasKit vive en memoria **WebAssembly** que el recolector de JavaScript no ve: cada
  objeto Skia (paint, shader, imagen, picture) hay que liberarlo a mano.
- Lo que se puede reutilizar (paints, `PictureRecorder`, rectángulos, buffers de uniforms,
  arrays tipados) se crea **una vez**. Por fotograma solo nacen la imagen de la rejilla, sus
  shaders y el `SkPicture` final, y se liberan **con retraso** (`disposal.ts`,
  `pictureSlot.ts`: anillo fijo de 8 fotogramas) cuando el lienzo ya no los usa.
- Nada de Skia vive a nivel de módulo (sobreviviría al Fast Refresh): cada `<Hourglass>`
  compila sus shaders (`resources.ts`) y los libera al desmontarse.
- **Nada se repinta sin cambios (1.8.1):** el tiempo en pantalla se refresca solo
  (`TimeDisplay` con `refresh`, 4 veces por segundo) y el resto de la pantalla, el lienzo, el
  menú y la ayuda solo se re-renderizan cuando cambia el estado de verdad. Con un lector de
  pantalla activo, la pantalla se actualiza una vez por segundo para que lea el tiempo.
- **El desenfoque de la pausa** solo cubre la franja del reloj y su sombra: el fondo es un
  degradado muy suave y desenfocado se ve igual, así que se dibuja fuera de la capa.
- Si algo falla al dibujar, `HourglassBoundary` remonta el lienzo; si CanvasKit ha muerto, la
  web guarda la cuenta y recarga una vez (`recovery/`).
- Número de granos: - **Número de granos revisado**: ~6.000 granos simulados en un móvil de 390×844 dp (cada uno se
  dibuja como 4 microgranos ≈ 24.000 granos visibles). Toda la simulación ocupa < 200 KB.
  Con granos más grandes (2,6 dp) se ahorrarían ~1.600 granos pero la arena se ve gruesa; no
  compensa.

### 9. Sesiones y ciclos trabajo/descanso

Desde la 1.5 la pantalla no maneja un temporizador suelto sino una **sesión**: un plan con una
o varias fases (`segments`) que se encadenan. Una sesión única es un plan de una fase; un
ciclo 25/5 × 4 rondas es `Trabajo, Descanso, Trabajo, Descanso, Trabajo, Descanso, Trabajo`
(**sin descanso final**: al acabar la última ronda de trabajo, se acabó; constante
`FINAL_BREAK`).

- **Todo en el core, todo puro y con tests** (`session/cycles.ts`, `session/session.ts`):
  `createSession`, `tickSession`, `toggleSession`, `flipSession`, `restartSession`,
  `replacePlan`, `sessionSnapshot`, `serializeSession`/`parseSession`…
- **Sin perder milisegundos:** la sesión guarda el temporizador de la fase actual (con sus
  marcas de tiempo). `settle()` mira si esa fase ya ha terminado y, si es así, arranca la
  siguiente **en el instante exacto en que acabó la anterior** (no «ahora»). Si el móvil estuvo
  dormido media hora, al volver se encadenan de golpe todas las fases que tocaba.
- **`transitions`** es un contador que sube en cada cambio de fase y nunca baja. Así la app
  detecta el cambio comparando dos números (para el sonido, la vibración y el giro del reloj),
  aunque entre dos fotogramas haya habido varios cambios.
- **Voltear el móvil** reinicia la fase en curso (en marcha). Si la sesión había terminado,
  empieza de nuevo desde la primera fase.
- **Preajustes** 15/3, 25/5, 50/10 y 90/15 (4 rondas, `CYCLE_PRESETS`) y **Personalizado**
  (1–180 min por fase siguiendo los mismos escalones que al deslizar, 1–12 rondas;
  `CYCLE_LIMITS`, `stepMinutes`, `stepRounds`).
- **Ajustes → plan:** `sessionPlanFor(settings)` (en `settings/sessionPlan.ts`) decide el plan.
  La pantalla lo recalcula cuando cambian los ajustes y, si es distinto (`samePlan`), lo aplica
  con `replacePlan` (la sesión vuelve a «lista para empezar»).

**El giro al cambiar de fase.** Lo dibuja el bucle de la arena (`useSandEngine`): en el mismo
fotograma en que ve subir `transitions`, empieza a girar el reloj 180° (`spin`, 950 ms,
`TURN_MS`, aceleración y frenada suaves). Mientras gira, la arena va «pegada» al vidrio (no se
sincroniza). Al terminar, se gira la rejilla (`rotateHalfTurn()`, lo mismo que al voltear el
móvil), se pone `spin` a 0 en el mismo fotograma (no se nota el cambio) y la arena vuelve a caer
desde arriba. Como el reloj es alto y estrecho, a mitad de giro no cabría a lo ancho: se
**encoge lo justo según el ángulo** (`fit` en `Hourglass.tsx`) y la sombra se desvanece.

**Rótulo de fase:** encima del tiempo, pequeño y discreto («Trabajo 2/4», «Descanso 2/4»).
En sesión única no aparece. Al acabar los ciclos: «ciclos completados · toca para empezar».

**Para probarlo sin esperar** (solo en desarrollo, en la web): `?velocidad=60` en la URL hace
que el reloj de la app (`dev/devClock.ts`) corra 60 veces más rápido. En producción la
constante se ignora.

### 10. Menú de ajustes

```
 MenuButton (dos rayas, 84×84) ──► useSheet.toggle() ──► offset: alto → 0 (340 ms)
                                        │
          ┌─────────────────────────────┴──────────────────────────┐
          ▼                                                        ▼
 FrostedPanel (Skia, DENTRO del lienzo del reloj)       SettingsSheet (React Native, encima)
 velo + sombra + panel del tema + filo de luz           secciones, controles, arrastre
 (sin desenfoque desde la 1.8.9)
          └──────────── los dos leen el mismo shared value `offset` ────────────┘
```

- **Vidrio sin desenfoque (1.8.9):** el panel de la hoja es un degradado del color del tema,
  casi opaco (93–96 %), recortado a la forma de la hoja, con un velo muy suave sobre la
  pantalla, una sombra sobre el canto y un filo de luz de 1 px. No lee la pantalla ni hace
  fotos: nada que copiar en la GPU en cada fotograma. Va **dentro del mismo `<Canvas>`** que el
  reloj (por eso `<Hourglass>` acepta `children`) y **montado siempre (1.8.6):** cerrado queda
  fuera de la pantalla (recorte vacío) y abrir solo mueve shared values, en el hilo de la
  interfaz, en el mismo fotograma que la hoja (montarlo al abrir obligaba a Skia a volver a
  grabar la escena entera en el hilo de JS; ver CHANGELOG 1.8.6). La arena sigue moviéndose
  detrás con el menú abierto y la hoja se anima al abrir y cerrar (sin animación solo con
  «reducir movimiento»). En pausa, el desenfoque del reloj crece con la hoja hasta 9 px
  (`menuOpenness` de `Hourglass`): eso es de la pausa, no del vidrio, y se queda.
  Encima, transparente, va el contenido en React Native. Como los dos se mueven con el mismo
  shared value (`offset`), van pegados al píxel, también al arrastrar.
  Historia: de la 1.5 a la 1.8.8 fue un vidrio esmerilado (`BackdropBlur` de Skia, radio 26):
  la 1.8.1 probó una copia desenfocada del reloj dentro de la hoja (en un Samsung A55 tardaba
  ~2 s en salir), la 1.8.2 volvió al `BackdropBlur`, que con la arena cayendo temblaba bajo el
  canto, y la 1.8.7 desenfocaba una foto fija del reloj hecha al abrir. Con el diagnóstico de
  la 1.8.3–1.8.8 se probaron en el A55 todas las combinaciones; la que mejor se veía era «Sin
  desenfoque», con el fondo en movimiento, la hoja animada y la arena moviéndose con el menú.
  En la 1.8.9 es la única y se quitaron el diagnóstico, el `BackdropBlur`, la foto fija
  (`glassBackdrop.ts`, `sceneImage.ts`, `StillBackdropGate`, `stillBlur`) y `glassBlur`.
- **Canto al píxel (1.8.7):** `top` (Skia) y el desplazamiento de la hoja (React Native) se
  redondean igual al píxel físico (`snapToPixel`): al final de la subida el filo de luz ya no
  cambia de suavizado en cada fotograma ni se separa medio píxel del contenido.
- **El vidrio sigue a la hoja (1.8.4):** `glassFade` (core, worklet) convierte lo abierta que
  está la hoja en la intensidad del vidrio (0 escondida, 1 al 55 % del recorrido). Con ella
  crecen la opacidad del panel, la sombra y el filo. La subida empieza en el `useLayoutEffect`
  de `useSheet`, para no perder fotogramas.
- **Worklets del core (1.8.5):** en la web son funciones normales; en Android corren en otro
  hilo con lo capturado en `this.__closure`, declarado dentro del cuerpo. Un parámetro con
  valor por defecto que use algo de fuera no lo ve y cierra la app (pasó en la 1.8.4 con
  `glassFade`). Lo vigilan `npm run check:worklets` (sobre el bundle de Android) y
  `packages/core/test/worklets.test.ts`.
- **Retraso de ~2 s en Android (1.8.1–1.8.2):** lo causaba el aviso hablado «Ajustes» al abrir,
  que se enviaba aunque no hubiera lector de pantalla. Desde la 1.8.4 todos los avisos pasan por
  `announce()` y solo suenan con el lector encendido (ver Accesibilidad).
- **El botón no se «rebota» (1.8.2):** `SheetToggle` (core) guarda si la hoja está abierta al
  momento y, mientras se anima, ignora los toques del botón. Abrir una hoja abierta no hace
  nada. «Pausa» se apaga mientras la hoja o una ayuda está delante (su vidrio está en el
  lienzo, por debajo del rótulo).
- **Botón abajo a la derecha (1.8.10):** las dos rayas van en la esquina de abajo a la derecha,
  cerca del pulgar (para usar el menú con una mano), centradas en su zona táctil de 84 × 84 dp
  por encima del margen seguro de abajo (barra de gestos), y por debajo de la línea del tiempo,
  que va centrada: no tapan ningún control del reloj. Con la hoja abierta (y mientras se
  cierra) el botón **se esconde**: opacidad 0, sin toques y fuera del lector de pantalla; la
  hoja tapa esa zona y se cierra con los gestos de abajo o con el asa «Cerrar ajustes».
- **Abrir / cerrar:** botón; tocar fuera (un velo `Pressable` transparente); arrastrar hacia
  abajo desde cualquier sitio (cierra si se arrastra más del 22 % del alto o rápido, si no
  vuelve a su sitio); el botón «atrás» de Android (`BackHandler`) o Escape en la web.
- **Al salir de la app, el menú se cierra (1.8.10):** si se abre el menú, se va a Inicio y se
  vuelve, el reloj sigue como estaba (en marcha, si lo estaba) pero la hoja aparece cerrada.
  `TimerScreen` escucha `AppState` y, al pasar a `background` (`closesMenuOnAppState`, core),
  llama a `useSheet.hideNow()`: cierra sin animación (al volver no se ve bajar) y
  `SheetToggle.reset()` deja el botón listo para abrir enseguida. El diálogo del permiso de
  notificaciones que se pide desde el menú también pone la app en `background` en Android;
  mientras está abierto (`withSystemPrompt` en `background/visibility.ts`) el menú no se
  cierra. Ir a los ajustes del sistema sí es salir de la app.
- **No choca con deslizar sobre el reloj:** con la hoja abierta, los gestos del reloj se
  desactivan y el velo y la hoja lo tapan; con la hoja cerrada, la hoja no recibe toques.
- **Alto:** el del contenido; si no cabe (pantallas bajas) se queda en casi toda la pantalla
  y el contenido se desplaza (`ScrollView`).
- **Alto estable (1.8.8):** la hoja mide su cabecera y su cuerpo y se pone ese alto, y su
  posición depende de ese alto. Yoga redondea cada vista al píxel físico según dónde cae, así
  que la medida podía variar un píxel con la posición, la hoja se movía, se volvía a medir… y
  subía y bajaba sin parar a su alto natural (con el diagnóstico de la 1.8.7 abierto la hoja
  estaba al máximo, con un alto que no depende de la medida, y paraba). `settleMeasure` (core) acepta
  siempre una medida que crece y solo una que encoge más de 2 puntos, y `sheetLayout` redondea el
  alto hacia arriba al píxel físico. El alto pasa al vidrio en un `useLayoutEffect` (el mismo
  fotograma que la vista).
- **Cabecera:** «Ajustes» con el resumen de la sesión debajo y, en la misma línea que el
  título, un «?» discreto que abre la ayuda de gestos (sección 14).
- **Disposición compacta (1.8.8):** la hoja queda baja, cerca del pulgar (en sesión única
  ~380 dp en un móvil Android con el aviso de permisos, frente a ~800 dp de la 1.8.7).
  - **Pestañas «Sesión única» / «Ciclos»** (el ajuste `sessionMode`): solo se ve lo de la
    elegida. Sesión única: tiempos rápidos (chips redondos de 5 a 60 min) y Personalizado,
    una barra a todo el ancho: se arrastra en horizontal por los mismos escalones (1–180 min)
    y − / + siguen un paso. El gesto nace en la barra, así que no pelea con deslizar el reloj
    ni con cerrar la hoja. Ciclos: preajustes,
    Personalizado con steppers y un resumen. Tocar un stepper con un preajuste elegido pasa a
    Personalizado copiando sus valores. Como la pestaña es el modo guardado, al abrir sale
    siempre el último modo usado.
  - **Una fila de botones redondos** (`QuickSettings.tsx`, 48 dp): Tema e Idioma rotan al
    tocarlos (Claro → Oscuro → Automático; Español → English → Automático; ver
    `core/src/menu/quickSettings.ts`), una raya fina, y Sonido, Vibración y Ventana flotante
    (solo Android) como interruptores redondos, rellenos de acento si están encendidos. Los
    iconos son trazos de Skia cuyo color sale de `themeProgress` en el hilo de la interfaz: se
    funden con el resto del menú al cambiar de tema.
  - **Etiquetas con pulsación larga (1.8.10):** mantener pulsado un botón redondo 450 ms enseña
    encima una píldora pequeña con su nombre («Tema», «Idioma», «Sonido», «Vibración»,
    «Ventana flotante»; los textos de i18n de siempre), con un clic suave de vibración. Al
    soltar, el botón **no** se activa (como las etiquetas de Android) y la etiqueta se va 1,5 s
    después. Si el dedo se aleja más de 24 dp (medio botón) de donde bajó, la pulsación se
    cancela y al soltar no pasa nada, aunque vuelva encima. La lógica es del core
    (`QuickPress`, `tooltipLeft`: centrada sobre el botón sin salirse de la fila); el dibujo,
    `QuickTooltip` (color `tooltip` de la paleta, casi opaco, texto `ink`, ≥ 9:1). Solo para
    la vista: el lector de pantalla ya dice el nombre de cada botón.
- **Todo se guarda** al momento en los ajustes (`SettingsStore` sobre AsyncStorage; versión 3
  de los ajustes, con migración automática desde la 1 y la 2: `language` y `gesturesSeen` son
  nuevos en la 1.6).

### 11. Temas claro, oscuro y automático

- `useAppTheme()` decide el tema: el elegido en el menú o, en «Automático», el del sistema
  (`useColorScheme`, cambia en vivo). Ya no hay ningún tema forzado en el código.
- **Transición suave:** justo antes de cambiar, `useThemeCrossfade` hace una **foto del lienzo**
  (`makeImageSnapshot`), la pone encima y la desvanece en 520 ms mientras debajo ya se dibuja el
  tema nuevo. Después la libera (es un objeto Skia). Con la hoja abierta, la foto lleva también
  el vidrio (sin desenfoque desde la 1.8.9) y se funde igual. Los textos y controles de React
  Native mezclan colores con `interpolateColor` y un progreso 0..1 animado.
- **Contraste:** los colores del menú (`UiPalette` en `theme.ts`) están elegidos para que los
  textos pasen 4,5:1 y los iconos y bordes 3:1 en los dos temas; la tabla está comentada en el
  propio archivo. El tiempo grande y el rótulo de fase son decorativos (muy suaves a
  propósito) y el lector de pantalla los lee del control del reloj.

### 12. Entrada animada

Al abrir la app **en frío** (≈1,25 s): el reloj aparece algo más grande (×1,12) y centrado,
da una vuelta completa de 360° con aceleración y frenada suaves (900 ms) y luego se coloca en
su sitio y tamaño (350 ms) mientras aparece su sombra; el tiempo y el botón del menú aparecen
con un fundido al final.

- **Solo en frío:** una variable de módulo (`introPlayed` en `intro/useIntro.ts`) recuerda que
  ya se ha mostrado. Volver de segundo plano no recrea el módulo, así que no se repite.
- **Reducir movimiento:** solo un fundido de 250 ms, sin giro ni escala.
- **Log en desarrollo (1.6):** con `__DEV__`, cuando la entrada no gira, `useIntro` escribe en la
  consola por qué: «reducir movimiento» activado (en Android, las animaciones desactivadas) o
  que ya se mostró en este proceso. La lógica de la entrada no cambia.
- **Coste:** todo son shared values animados en el hilo de UI; React no se re-renderiza durante
  la animación. Los grupos de Skia necesitan una capa (`saveLayer`) para desvanecer un
  `<Picture>`; esas capas **solo existen mientras dura la animación** (o el giro de fase).

### 13. Idiomas: español e inglés

- **Diccionarios tipados en el core** (`core/src/i18n/messages.ts`): `es` es la referencia y
  `en: Messages = typeof es`, así que a `en` no le puede faltar ni sobrar una clave, y las
  funciones (`phaseLabel(kind, round, rounds)`, `minutes(n)`…) tienen los mismos parámetros.
  Un test (`i18n.test.ts`) lo comprueba también en tiempo de ejecución (mismas claves, mismos
  tipos, misma aridad, sin tildes españolas en inglés). `describeDuration(ms, idioma)` dice las
  duraciones para el lector de pantalla en los dos idiomas.
- **Selector** en el menú (desde la 1.8.8, un botón redondo que rota): Español · English · Automático (ajuste `language`: `'es' | 'en' |
'system'`, por defecto `'system'`). Automático usa el idioma del sistema
  (`Intl.DateTimeFormat().resolvedOptions().locale`, sin dependencias nativas nuevas) y lo
  vuelve a leer al volver la app a primer plano: `es*` → español; cualquier otro → inglés; sin
  datos → español (`resolveLanguage`).
- **App:** `I18nProvider` (en `App.tsx`) y `useT()` dan los textos a cada componente. Están
  traducidos todos los textos visibles, las etiquetas, pistas y valores de accesibilidad y los
  anuncios. En la web también se pone `<html lang>`.

### 14. Gestos: ayuda y zona del botón del menú

- **Pantalla «Gestos» / «Gestures»** (`components/GesturesHelp.tsx`): a pantalla completa sobre
  el reloj (que se desenfoca detrás, como en la pausa de lado), título pequeño en versalitas, ×
  fina y una fila por gesto con un icono de línea dibujado en Skia (un trazado SVG por icono).
  Se abre con el «?» del menú y **sale sola una vez**, después de la entrada, en el primer
  arranque (ajuste `gesturesSeen`, también para quien actualiza). Se cierra con la ×, «atrás»
  o Escape; es una vista modal para el lector de pantalla. Mientras está abierta los gestos
  del reloj se apagan.
- **Zona de guarda del botón del menú** (`core/src/geometry/menuGuard.ts`, `inMenuGuard`): un
  cuadrado de 84 px sobre el margen seguro (y ese margen), en la esquina del botón (desde la
  1.8.10 abajo a la derecha; con el móvil volteado, arriba a la izquierda, porque la capa del
  menú gira 180°; hasta la 1.8.9 era arriba a la derecha). Gesture Handler
  reconoce los gestos en nativo, aparte del sistema de toques de React Native, así que en
  Android un toque sobre el botón también empezaba o pausaba el reloj. Ahora los tres gestos
  del reloj (tocar, mantener y deslizar) **fallan** en cuanto el dedo baja en la zona
  (`onTouchesDown` → `GestureStateManager.fail`) y tocar y mantener vuelven a comprobar el
  punto al activarse. El área táctil del botón es toda la zona: tocar en cualquier punto de la
  esquina abre el menú. Prueba web: `e2e-guarda.mjs` (con el botón y, haciendo el botón
  transparente a los toques, con los toques llegando al reloj como en Android).
- **Deslizar solo con un dedo** (`maxPointers: 1`): con dos dedos no pasa nada.

## 15. Segundo plano en Android

Con la app en segundo plano o cerrada, Android sigue mostrando la cuenta atrás en una
notificación fija (con **Pausar/Reanudar** y **Reiniciar**) y da los avisos de cambio de fase
y de fin con sonido y vibración. El **core** (`packages/core/src/background/`) traduce la
sesión a un modelo mínimo y calcula todos los avisos futuros por marcas de tiempo; un
**módulo local de Expo en Kotlin** (`apps/mobile/modules/background-timer/`) los programa
como alarmas exactas y pinta el cronómetro nativo. `useBackgroundTimer` envía cada cambio de
la sesión y, al volver, adopta lo que se haya hecho desde la notificación (número de
secuencia `seq`). Mientras la app está a la vista, avisa la app y la notificación calla.

Desde la 1.8.6 la cuenta **solo sigue fuera de la app si sales con «atrás» o con el gesto de
inicio** («atrás» manda la app al fondo sin cerrarla, `backKeepsRunning.ts`). Quitarla de
Recientes, descartar la notificación o la × de la ventana flotante la **paran** del todo
(`BackgroundTimer.stop`; para Recientes hay un servicio en primer plano mientras hay cuenta).
Ver [SEGUNDO_PLANO.md](SEGUNDO_PLANO.md#cuándo-se-para-la-cuenta-186).

Desde la 1.8, con «Ventana flotante» activada, el reloj de arena se queda encima de las demás
apps: una vista nativa (`HourglassView.kt`, `Canvas`) en una ventana superpuesta que lee el
mismo estado nativo, así que no necesita JavaScript. Sin el permiso «Mostrar sobre otras apps»
la app entra en imagen en imagen con solo el reloj (`useFloatingWindow`).

Todo el detalle (por qué no `expo-notifications`, canales, permisos, la ventana flotante, sus
gestos y límites) está en [SEGUNDO_PLANO.md](SEGUNDO_PLANO.md).

## Simulador de inclinación en el navegador

Con `npm run web` (modo desarrollo) — o en cualquier versión web añadiendo `?inclinar` a la
URL — se puede simular el acelerómetro con el teclado (haz clic antes en la página). El código
está en `apps/mobile/src/motion/tiltSimulator.ts`.

| Tecla           | Efecto                                               |
| --------------- | ---------------------------------------------------- |
| `←` / `→`       | Girar el móvil 5° a izquierda / derecha              |
| `Mayús` + `←/→` | Girar 30° (dos veces + una normal ≈ 65°; tres = 90°) |
| `↑` / `↓`       | Inclinarlo hacia atrás / delante (mueve la luz)      |
| `V`             | Voltear 180° de golpe                                |
| `0`             | Volver a «de pie»                                    |
| `Alt` + ratón   | Mover el ratón con Alt pulsado gira el móvil         |

Antes de la primera tecla no se simula nada: la web funciona exactamente igual que antes.

## Personalizar colores (fondo claro)

Desde la 1.2.1 el fondo claro es la **variante D (`#EBE5DD`, más claro)**, elegida por Sebastián.
Vive en **un solo token**, en `apps/mobile/src/theme/theme.ts`:

```ts
export const LIGHT_BACKGROUND = '#EBE5DD';
```

De ese token salen, con desplazamientos fijos, los demás tonos del fondo. Con la variante A
(`#E2D9CE`, la de la 1.0/1.1) eran estos:

| Uso                                         | Valor     |
| ------------------------------------------- | --------- |
| Color sólido (vista raíz / barra de estado) | `#E2D9CE` |
| Degradado arriba                            | `#ECE5DC` |
| Degradado abajo                             | `#D6CBBE` |
| Halo detrás del reloj                       | `#F8F3EC` |
| Viñeta de las esquinas                      | `#BFB1A2` |

Aparte, `apps/mobile/app.json` tiene `backgroundColor: #E6DED4` (solo la pantalla de carga y el
fondo del icono adaptativo de Android; no afecta a la app ya abierta).

En `docs/capturas/07-fondos-claros.png` está el reloj en reposo sobre 4 variantes:

| Variante | Hex       | Descripción             |
| -------- | --------- | ----------------------- |
| A        | `#E2D9CE` | el de la 1.0/1.1        |
| B        | `#E7D8C3` | más cálido              |
| C        | `#DDDAD5` | más neutro / gris       |
| D        | `#EBE5DD` | más claro (**elegido**) |

Para elegir otra, cambia solo el valor de `LIGHT_BACKGROUND` y guarda (se recarga solo).

Los demás colores (texto del tiempo, rótulo «Pausa», vidrio, sombra, arena) están en los temas
`LIGHT_THEME` y `DARK_THEME` del mismo archivo.

## Decisiones clave y por qué

| Decisión                                                              | Por qué                                                                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **npm workspaces** (no pnpm)                                          | Funciona sin configuración extra con Metro/Expo en Windows; pnpm necesita ajustes de enlaces simbólicos.                                                                              |
| **Core en TypeScript puro**                                           | Testeable con Vitest en milisegundos; reutilizable en escritorio.                                                                                                                     |
| **Tiempo por marcas de tiempo**                                       | Exacto aunque la app se suspenda; sin deriva acumulada.                                                                                                                               |
| **Autómata celular** para la arena                                    | Comportamiento granular creíble (montón, cráter, reacción a la gravedad) con coste bajo en JS.                                                                                        |
| **Cuello controlado por el temporizador**                             | La física es bonita, pero la verdad la marca el reloj: nunca se desincronizan.                                                                                                        |
| **2.5D con shaders**, no 3D                                           | Aspecto de vidrio realista a 60 fps en gama media. El modelo está tras un catálogo (`renderer: '2.5d' \| '3d'`) para poder cambiarlo.                                                 |
| **Movimiento como fuente de datos (`MotionSource`)**                  | La simulación y los shaders leen gravedad e inclinación de un objeto que el sensor actualiza; React solo se entera de los eventos (pausa, volteo), así el sensor no provoca renders.  |
| **SkPicture + shared value**                                          | Evita renders de React a 60 fps.                                                                                                                                                      |
| **CanvasKit en web**                                                  | Permite iterar el diseño en el navegador y prepara la versión de escritorio (Tauri mostrará la web).                                                                                  |
| **Persistencia tras interfaces** (`KeyValueStorage`, `SettingsStore`) | Hoy AsyncStorage; mañana sincronización entre dispositivos sin tocar la UI. Los ajustes llevan `updatedAt` para resolver conflictos.                                                  |
| **Development build** (`expo-dev-client`) + compatible con Expo Go    | No dependemos de la versión de Expo Go de la Play Store. Desde la 1.7 hay un módulo nativo propio; en Expo Go no existe y la app funciona sin notificación.                           |
| **Módulo local en Kotlin** para segundo plano (1.7)                   | `expo-notifications` no tiene cuenta atrás nativa ni botones que funcionen sin JavaScript. El core calcula los avisos y Kotlin los ejecuta. Ver [SEGUNDO_PLANO.md](SEGUNDO_PLANO.md). |
| **Objetos Skia con dueño y liberación diferida**                      | En web CanvasKit vive en memoria WASM que el recolector no ve: todo objeto Skia se libera, pero solo cuando el lienzo ya no lo usa.                                                   |
| **Sesión = plan de fases** en el core (1.5)                           | Ciclos y sesión única son lo mismo con distinto plan: una sola lógica, pura y con tests. Las fases se encadenan por marcas de tiempo, sin deriva.                                     |
| **Vidrio del menú con Skia** (1.5; sin desenfoque desde la 1.8.9)     | Dentro del lienzo del reloj, sin módulo nativo, igual en la web. Fue un `BackdropBlur` hasta la 1.8.8; en el A55 se veía y iba mejor sin desenfoque (ver sección 10).                 |
| **Sin descanso tras la última ronda** (1.5)                           | Al acabar el último trabajo, la sesión ha terminado: un descanso final solo retrasaría el aviso de fin. Se puede cambiar con `FINAL_BREAK`.                                           |
| **Cambiar el plan reinicia la sesión** (1.5)                          | Si cambias de ciclo a mitad, la sesión vuelve a «lista para empezar» con el plan nuevo: es lo más predecible.                                                                         |

## Accesibilidad

- El reloj es un control **ajustable** para TalkBack: «Reloj de arena», con el valor
  («25 minutos. Listo para empezar», «Quedan 12 minutos y 3 segundos»…).
- Deslizar arriba/abajo con TalkBack sube/baja la duración; doble toque empieza/pausa; acción
  personalizada «Reiniciar». Se anuncia «Tiempo terminado» al acabar.
- **Reducir movimiento:** si el sistema lo pide, el chorro se dibuja estático (sin granos
  animados); la arena sigue reflejando el tiempo restante. La entrada es un simple fundido y la
  hoja del menú aparece sin deslizarse.
- **Menú:** botón «Ajustes» (abajo a la derecha desde la 1.8.10; con la hoja abierta se
  esconde también para el lector, que cierra con el asa «Cerrar ajustes»), opciones con rol de radio y
  seleccionadas, interruptores con rol de switch, steppers ajustables (deslizar arriba/abajo con
  TalkBack) que leen «25 minutos», «4 rondas». Zonas táctiles de 44 px o más. Al abrir se
  anuncia «Ajustes» y el resto de la pantalla queda oculto al lector.
- **Fila de botones redondos (1.8.8):** 48 × 48 dp. Sonido, Vibración y Ventana flotante son
  interruptores («Sonido, interruptor, activado»). Tema e Idioma son botones que dicen su valor
  («Tema: Oscuro», «Idioma: English») con la pista «Toca para cambiar»; al tocarlos se anuncia
  el valor nuevo, ya en el idioma nuevo si se cambió el idioma. La etiqueta de la pulsación
  larga (1.8.10) es solo visual y queda oculta al lector, que ya dice el nombre de cada botón.
- **Avisos solo con lector (1.8.4):** todos los anuncios pasan por `announce()`
  (`hooks/useScreenReader.ts`), que no hace nada si el lector está apagado. En Android
  `announceForAccessibility` cuesta aunque no haya lector (servicios de accesibilidad de
  Samsung) y retrasaba la apertura del menú. No hay regiones vivas: el texto del tiempo y
  «Pausa» están ocultos al lector; el tiempo se lee en el valor del reloj.
- **Idioma:** todas las etiquetas, pistas, valores y anuncios están en español e inglés.
- **Ayuda de gestos:** vista modal; al abrirse se anuncia «Gestos»; la × se llama «Cerrar
  gestos». El «?» del menú se llama «Ver los gestos».
- **Ciclos:** se anuncia cada cambio de fase («Descanso, ronda 2 de 4») y el final.
- La pantalla se mantiene encendida mientras corre la arena.

## Limitaciones conocidas

- En Android, desde la 1.7, la cuenta sigue con la app cerrada (notificación y avisos) y al
  abrirla se retoma. En iOS y en la web, si se cierra la app del todo la cuenta se pierde
  (en web se conserva si la página se recarga por un fallo gráfico). Límites de Android
  (fabricantes que matan apps, «Forzar detención»…) en [SEGUNDO_PLANO.md](SEGUNDO_PLANO.md).
- Inclinar hacia delante/atrás solo mueve la luz, no la arena.
- iOS: el signo del acelerómetro y la vibración no se han probado en un iPhone real.
- Icono y pantalla de carga son todavía los de la plantilla de Expo.
- `npm audit` avisa de vulnerabilidades en dependencias **de desarrollo** de las herramientas de
  Expo (no llegan a la app). No uses `npm audit fix --force`: rompería las versiones del SDK.
- Si notas tirones en un móvil modesto, los primeros ajustes están en `useSandEngine.ts`
  (`STEPS_PER_FRAME`) y `layout.ts` (`TARGET_CELL_PX`: granos más grandes = menos celdas).
- **Giro fuerte (1.8.9, `TiltLod` en `core/src/sim/tiltLod.ts`):** al inclinar mucho el móvil
  sin llegar a voltearlo, casi toda la arena corre hacia el otro lado y un móvil de gama media
  bajaba a ~4 fps. Lo caro (medido en el core) es reordenar todas las celdas cada vez que la
  gravedad de la simulación cambia de escalón (`ensureOrder`, ~15 veces un paso normal; con
  escalones de 3° pasa casi en cada fotograma mientras se gira), los pasos con miles de granos
  moviéndose y la puesta al día (`MAX_CATCH_UP`), que a pocos fps da hasta 3 veces más pasos.
  Si el móvil se ha girado 40° o más desde el último reposo **y** la simulación cuesta 24 ms o
  más en dos fotogramas, `useSandEngine` pasa unos segundos a: gravedad de la simulación en
  escalones de 10° (10 divide 90: de pie y de lado sigue recta), sin puesta al día y la luz del
  vidrio a 10 regrabaciones por segundo. El dibujo, el chorro y la luz siguen con la gravedad
  suave. Se apaga 2,5 s después de que el móvil deja de girar (la arena se recoloca a 3° con
  una sola reordenación). De pie, de lado quieto, con inclinaciones normales o en un móvil que
  llega, no se activa; voltear (180°) lo apaga. No es un sistema general para móviles lentos:
  solo este pico.

## Scripts

Todos se ejecutan desde la raíz del proyecto:

| Comando                  | Qué hace                                                                     |
| ------------------------ | ---------------------------------------------------------------------------- |
| `npm run mobile`         | Arranca Expo (modo development build; `s` cambia a Expo Go).                 |
| `npm run web`            | Arranca la versión web en el navegador.                                      |
| `npm test`               | Ejecuta los tests unitarios (Vitest) del paquete `core`.                     |
| `npm run test:coverage`  | Tests + informe de cobertura (en `packages/core/coverage/index.html`).       |
| `npm run typecheck`      | Comprueba los tipos de TypeScript en todos los paquetes.                     |
| `npm run lint`           | ESLint en todo el monorepo (`npm run lint:fix` corrige lo automático).       |
| `npm run format`         | Formatea el código con Prettier.                                             |
| `npm run check:worklets` | Revisa los worklets del bundle de Android (1.8.5).                           |
| `npm run apk`            | APK de entrega: arm64, `.so` comprimidas, bundle nuevo y comprobado (1.8.6). |
| `npm run check`          | Todo lo anterior seguido: tipos, lint, formato, tests y worklets.            |

Para exportar la web estática: `cd apps/mobile && npx expo export --platform web` (sale en `dist/`).
