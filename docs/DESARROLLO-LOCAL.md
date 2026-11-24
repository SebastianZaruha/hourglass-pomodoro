# Desarrollo local (Android)

La app de producción y la de desarrollo se instalan a la vez. La variable es
`APP_VARIANT`. Si no está definida, vale lo mismo que `production`.

| | Producción | Desarrollo (`APP_VARIANT=development`) |
| --- | --- | --- |
| Nombre | Hourglass | Hourglass Dev |
| Paquete | `com.sebastianzaruha.relojdearena` | `com.sebastianzaruha.relojdearena.dev` |
| Versión | 1.9.0 (`versionCode` 10904) | la misma |
| Firebase | `google-services.json` | `google-services.dev.json` |
| Cliente de desarrollo | no se enlaza | `expo-dev-client` |
| Comando de Gradle | `assembleRelease` | `assembleDebug` |

La firma no cambia: las dos salen con la clave de depuración que usan las
entregas desde la 1.8.1. No es una publicación.

## Requisitos

- Node.js 22.13 o superior, y `npm install` en la raíz del repo.
- JDK y el SDK de Android. `ANDROID_HOME` (o `ANDROID_SDK_ROOT`) tiene que
  apuntar al SDK.
- Un móvil Android con la depuración USB activada, o en la misma red Wi-Fi
  que el ordenador. La primera instalación del cliente de desarrollo pide
  cable o `adb`.

## Arrancar en el móvil

Hace falta el cliente de desarrollo instalado una vez (el apartado siguiente).
La app buena, «Hourglass», no habla con Metro: no lleva `expo-dev-client`.

Desde `apps/mobile`:

```bash
npm run start:dev
```

Eso es `APP_VARIANT=development npx expo start`. En el móvil se abre
**Hourglass Dev** y se conecta al bundler. Si el teléfono no ve el ordenador,
el mismo cable y `adb reverse tcp:8081 tcp:8081`.

`npx expo start` a secas, sin la variable, resuelve la identidad de
producción y no empareja con Hourglass Dev.

## APK de desarrollo

Desde `apps/mobile`:

```bash
npm run apk:dev
```

Regenera el proyecto nativo con el paquete `.dev` y compila `assembleDebug`.
El APK queda en
`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
Se instala al lado de la app buena:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:dev` hace lo mismo que `npx expo run:android` con la variante
de desarrollo: compila el debug y lo instala en el móvil conectado.

Ese APK es debug a propósito. En release, `expo-dev-launcher` sustituye el
lanzador por un stub y `npx expo start` no tendría con quién hablar.

## APK definitivo

Desde `apps/mobile`:

```bash
npm run apk
```

Es `APP_VARIANT=production` (el valor por defecto): paquete
`com.sebastianzaruha.relojdearena`, nombre «Hourglass», versión 1.9.0 y
`google-services.json`. Compila `assembleRelease`. El APK queda en
`apps/mobile/android/app/build/outputs/apk/release/`.

Desde la raíz, `npm run apk` sigue compilando ese release si `apps/mobile/android`
ya se generó con la variante de producción (`npx expo prebuild -p android`,
sin `APP_VARIANT=development`).

## Qué no entra en producción

`expo-dev-client` sigue en `package.json` porque el modo de desarrollo lo
necesita. En el prebuild de producción, `settings.gradle` excluye del
autolinking `expo-dev-client`, `expo-dev-launcher`, `expo-dev-menu`,
`expo-dev-menu-interface`, `expo-manifests` y `expo-updates-interface`.
Esos proyectos nativos no se compilan en el APK definitivo.

Expo, al ver el paquete instalado, añade el esquema `exp+reloj-de-arena`
al manifiesto. No abre ningún lanzador: el módulo no está enlazado.
