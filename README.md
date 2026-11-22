# Hourglass Pomodoro

Un temporizador pomodoro que es un reloj de arena de vidrio. El tiempo no es una barra: es arena o agua dentro del frasco. Hay dos apps, web y Android, y comparten la lógica en `packages/core`.

La web está publicada en [hourglass.sebastianzaruha.com](https://hourglass.sebastianzaruha.com).

## Web

Vite, React 19 y TypeScript. El frasco es un vidrio 3D (three.js). Lo de dentro —arena o agua— se pinta en un lienzo 2D que va detrás de ese vidrio.

Tres escenas. **Lluvia** es la de por defecto: foto de fondo, agua y un vídeo de nube. **Arena** y **Clásico** usan la simulación de arena. El menú elige la escena, el tema (claro, oscuro o el del sistema) y el idioma (español o inglés).

Gestos en el frasco:

| Gesto | Qué hace |
| --- | --- |
| Clic | Empieza, pausa o sigue. |
| Arrastrar | Inclina el reloj. Al soltar, vuelve; no empieza la sesión. |
| Doble clic | Media vuelta y empieza de cero, con el contenido dentro. |
| Rueda | Solo cambia el tiempo. No gira el frasco. |

La hoja de ajustes se abre con el botón del menú. La de gestos explica lo mismo dentro de la web. Cookies, aviso legal, privacidad y la política de cookies están en el pie.

## Android

Expo SDK 58, React Native y un frasco dibujado con Skia. El acelerómetro mueve la arena. Un módulo nativo lleva el temporizador en segundo plano (aviso y cuenta atrás con la app cerrada). Firebase Analytics y Crashlytics solo entran si la persona lo acepta.

El APK actual es la **v1.8.15**, en [GitHub Releases](https://github.com/SebastianZaruha/hourglass-pomodoro/releases).

## El monorepo

```
hourglass-pomodoro/
├── package.json          scripts de la raíz (web:dev, web:build, apk)
├── packages/
│   └── core/             @reloj/core · lógica sin interfaz
│       └── src/
│           ├── timer/        motor del temporizador
│           ├── session/      sesiones y ciclos
│           ├── settings/     ajustes
│           ├── i18n/         español e inglés
│           ├── sim/          simulación de la arena
│           ├── physics/      inclinación y volteo
│           └── persistence/  guardar en el dispositivo
├── apps/
│   ├── web/              @reloj/web · Vite + React 19 + three.js
│   │   └── src/
│   │       ├── app/              pantalla, registro de escenas
│   │       ├── comun/            giro, frasco 3D, menú, reloj, cookies
│   │       └── escenas/          lluvia, arena, clasico
│   └── mobile/           @reloj/mobile · Expo + Skia
│       ├── src/              pantalla, frasco, gestos, menú
│       └── modules/background-timer/   aviso con la app cerrada
└── docs/                 arquitectura y capturas
```

`core` no importa las apps. Las apps importan `@reloj/core`.

## Cómo ejecutarlo

Hace falta **Node.js 22.13** o superior.

```bash
git clone https://github.com/SebastianZaruha/hourglass-pomodoro.git
cd hourglass-pomodoro
npm install
npm run web:dev      # http://localhost:5173
npm run web:build    # comprueba imports, tipos y deja apps/web/dist
```

### APK de Android

Solo la arquitectura **arm64-v8a**. Hacen falta el JDK, el SDK de Android (`ANDROID_HOME`) y el proyecto nativo generado una vez:

```bash
cd apps/mobile
npx expo prebuild -p android
cd ../..
npm run apk
```

El APK queda en `apps/mobile/android/app/build/outputs/apk/release/`. El script rechaza el paquete si lleva otra arquitectura.

## Dónde afinar

Colores del reloj, por escena y por tema (claro / oscuro): `reloj.digitos`, `reloj.pista` y `tinta` en

- `apps/web/src/escenas/lluvia/index.ts`
- `apps/web/src/escenas/arena/index.ts`
- `apps/web/src/escenas/clasico/index.ts`

Tiempos del giro, en `apps/web/src/comun/giro/giro.ts`:

- `MS_MEDIA_VUELTA` (600 ms): la media vuelta del reinicio.
- `MS_LLENADO` (350 ms): el revelado del contenido al quedar el frasco de pie. No mueve la física.

## Privacidad

En la web, el tema y el idioma se guardan en el navegador y no piden consentimiento. Google Analytics 4 y Vercel Web Analytics solo arrancan si se aceptan en el banner de cookies. Se pueden retirar en «Configurar cookies». No hay publicidad ni perfilado. El texto legal está en [hourglass.sebastianzaruha.com/legal](https://hourglass.sebastianzaruha.com/legal).

En Android, el reloj funciona sin analítica. Firebase Analytics y Crashlytics comparten un solo consentimiento, que se da o se retira en los ajustes de la app. El aviso está en la política de privacidad de la app (`apps/web/public/privacidad-app.html`).

## Licencia

[PolyForm Noncommercial 1.0.0](LICENSE.md). Uso personal y no comercial. El nombre, el logo y los gráficos no van incluidos en esa licencia.

## Autor

Sebastián Zaruha · [github.com/SebastianZaruha](https://github.com/SebastianZaruha)

Más detalle del móvil: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Historial: [CHANGELOG.md](CHANGELOG.md).

---

**English.** Hourglass Pomodoro is a glass hourglass used as a pomodoro timer, on the web and on Android. The web app (Vite, React 19, three.js) is live at [hourglass.sebastianzaruha.com](https://hourglass.sebastianzaruha.com): Rain is the default scene (photo, water, cloud video), plus Sand and Classic. Drag tilts the jar, double-click flips it, and the menu holds theme, language and cookie consent. Android (Expo SDK 58, React Native, Skia) uses the accelerometer and a background timer; Firebase Analytics and Crashlytics stay off until consent. The current APK is v1.8.15 on GitHub Releases. Shared logic lives in `packages/core`. Licensed under PolyForm Noncommercial 1.0.0.
