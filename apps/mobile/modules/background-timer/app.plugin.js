/**
 * Plugin de configuración de Expo para el módulo de segundo plano. En cada
 * `npx expo prebuild` hace dos cosas en la carpeta android/ (que se genera
 * y no se versiona):
 *
 * 1. Sonidos. Los avisos de la notificación suenan con los MISMOS mp3 que la
 *    app (assets/sounds). Un canal de notificación de Android solo puede
 *    usar un sonido de `res/raw`, así que se copian allí con un prefijo
 *    (para no chocar con recursos de otras librerías):
 *
 *      assets/sounds/fin.mp3    → android/app/src/main/res/raw/reloj_fin.mp3
 *      assets/sounds/cambio.mp3 → android/app/src/main/res/raw/reloj_cambio.mp3
 *
 * 2. Imagen en imagen (1.8). La actividad principal declara
 *    `android:supportsPictureInPicture="true"`: es el plan B de la ventana
 *    flotante cuando no hay permiso para dibujar encima de otras apps.
 *
 * 3. Cómo se empaqueta el APK (1.8.6). android/gradle.properties sale de la
 *    plantilla de Expo con las 4 arquitecturas y las librerías nativas sin
 *    comprimir: un APK de ~140 MB. Las entregas son solo arm64-v8a (todos los
 *    Android de los últimos años) con las .so comprimidas (~22 MB). Se fija
 *    aquí para que un `prebuild` no lo deshaga; `npm run apk` (scripts/
 *    build-apk.mjs) además lo pasa explícito y comprueba el APK.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withGradleProperties } = require('expo/config-plugins');

/** Propiedades de Gradle de las entregas (ver el punto 3 de arriba). */
const GRADLE_PROPERTIES = {
  reactNativeArchitectures: 'arm64-v8a',
  'expo.useLegacyPackaging': 'true',
};

function withApkPackaging(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(GRADLE_PROPERTIES)) {
      const found = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
      if (found) found.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
}

const SOUNDS = { 'fin.mp3': 'reloj_fin.mp3', 'cambio.mp3': 'reloj_cambio.mp3' };

function withSounds(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const raw = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      fs.mkdirSync(raw, { recursive: true });
      for (const [from, to] of Object.entries(SOUNDS)) {
        fs.copyFileSync(path.join(root, 'assets', 'sounds', from), path.join(raw, to));
      }
      return cfg;
    },
  ]);
}

function withPictureInPicture(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (main) main.$['android:supportsPictureInPicture'] = 'true';
    return cfg;
  });
}

module.exports = function withBackgroundTimer(config) {
  return withApkPackaging(withPictureInPicture(withSounds(config)));
};
