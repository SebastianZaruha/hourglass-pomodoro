const fs = require('node:fs');
const path = require('node:path');
const { withFinalizedMod, withSettingsGradle } = require('expo/config-plugins');

/**
 * Módulos que solo sirven al cliente de desarrollo. En el APK de producción
 * no se autolinkean: el lanzador de expo-dev-launcher, en release, además
 * compila un stub, pero aquí ni siquiera entra el proyecto nativo.
 */
const EXCLUIR = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
  'expo-manifests',
  'expo-updates-interface',
];

const MARCA = 'expoAutolinking.useExpoModules()';
const LINEA = `expoAutolinking.exclude = ${JSON.stringify(EXCLUIR)}`;

function conExclusion(texto) {
  if (texto.includes('expoAutolinking.exclude')) return texto;
  if (!texto.includes(MARCA)) {
    throw new Error('sinClienteDev: settings.gradle no llama a useExpoModules()');
  }
  return texto.replace(MARCA, `${LINEA}\n${MARCA}`);
}

/** Quita expo-dev-client del proyecto nativo de producción. */
function sinClienteDev(config) {
  config = withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = conExclusion(cfg.modResults.contents);
    return cfg;
  });
  return withFinalizedMod(config, [
    'android',
    (cfg) => {
      const settings = path.join(cfg.modRequest.platformProjectRoot, 'settings.gradle');
      if (fs.existsSync(settings)) {
        const texto = fs.readFileSync(settings, 'utf8');
        const siguiente = conExclusion(texto);
        if (siguiente !== texto) fs.writeFileSync(settings, siguiente);
      }
      return cfg;
    },
  ]);
}

module.exports = { sinClienteDev };
