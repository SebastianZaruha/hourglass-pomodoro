import type { ConfigContext, ExpoConfig } from 'expo/config';
import { sinClienteDev } from './plugins/sinClienteDev';

const PAQUETE = 'com.sebastianzaruha.relojdearena';

/**
 * APP_VARIANT no definida, o `production`: Hourglass de producción.
 * `development`: paquete `.dev`, para instalarla al lado y usar expo-dev-client.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const cruda = process.env.APP_VARIANT;
  if (cruda && cruda !== 'production' && cruda !== 'development') {
    console.warn(`APP_VARIANT=${cruda} no se reconoce; se usa production.`);
  }
  const dev = cruda === 'development';
  const slug = config.slug;
  if (!slug) throw new Error('app.json sin slug');
  const plugins = [...(config.plugins ?? [])];
  if (dev) plugins.push('expo-dev-client');

  let expo: ExpoConfig = {
    ...config,
    slug,
    name: dev ? 'Hourglass Dev' : 'Hourglass',
    plugins,
    android: {
      ...config.android,
      package: dev ? `${PAQUETE}.dev` : PAQUETE,
      googleServicesFile: dev ? './google-services.dev.json' : './google-services.json',
    },
  };
  if (!dev) expo = sinClienteDev(expo);
  return expo;
};
