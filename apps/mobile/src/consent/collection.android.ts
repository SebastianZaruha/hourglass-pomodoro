import type * as AppMod from '@react-native-firebase/app';
import type * as AnalyticsMod from '@react-native-firebase/analytics';
import type * as CrashlyticsMod from '@react-native-firebase/crashlytics';

import { setNativeCrashlyticsCollectionEnabled } from '../../modules/firebase-consent';

import { collectionAction, type ConsentChoice, type LoadedConsent } from './consent';
import type { TimerEventName, TimerEventParams, UsageContext } from './events';

/**
 * Puente con Firebase en Android. La recogida nace apagada (firebase.json →
 * manifest). Aquí solo se enciende tras un Aceptar vigente, y se apaga al
 * rechazar, retirar o invalidar el texto.
 *
 * Los anuncios no existen: AD_STORAGE, AD_USER_DATA y AD_PERSONALIZATION
 * quedan DENIED aunque se acepte la analítica.
 */

/** Evita eventos si el nativo aún no confirmó el Aceptar. */
let open = false;

const DENIED_ADS = {
  ad_storage: false,
  ad_user_data: false,
  ad_personalization: false,
} as const;

let mods: { analytics: typeof AnalyticsMod; crashlytics: typeof CrashlyticsMod; app: typeof AppMod } | null =
  null;
let unavailable = false;

async function firebase() {
  if (unavailable) return null;
  if (mods) return mods;
  try {
    const [analytics, crashlytics, app] = await Promise.all([
      import('@react-native-firebase/analytics'),
      import('@react-native-firebase/crashlytics'),
      import('@react-native-firebase/app'),
    ]);
    mods = { analytics, crashlytics, app };
    return mods;
  } catch {
    unavailable = true;
    return null;
  }
}

async function enableNative(): Promise<boolean> {
  const sdk = await firebase();
  if (!sdk) return false;
  try {
    const app = sdk.app.getApp();
    const analytics = sdk.analytics.getAnalytics(app);
    const crashlytics = sdk.crashlytics.getCrashlytics(app);
    await sdk.analytics.setConsent(analytics, { analytics_storage: true, ...DENIED_ADS });
    await sdk.analytics.setAnalyticsCollectionEnabled(analytics, true);
    await sdk.crashlytics.setCrashlyticsCollectionEnabled(crashlytics, true);
    setNativeCrashlyticsCollectionEnabled(true);
    return true;
  } catch {
    await disableNative(false);
    return false;
  }
}

async function disableNative(reset: boolean): Promise<void> {
  open = false;
  setNativeCrashlyticsCollectionEnabled(false);
  const sdk = await firebase();
  if (!sdk) return;
  try {
    const app = sdk.app.getApp();
    const analytics = sdk.analytics.getAnalytics(app);
    const crashlytics = sdk.crashlytics.getCrashlytics(app);
    await sdk.analytics.setAnalyticsCollectionEnabled(analytics, false);
    await sdk.analytics.setConsent(analytics, { analytics_storage: false, ...DENIED_ADS });
    await sdk.crashlytics.setCrashlyticsCollectionEnabled(crashlytics, false);
    if (!reset) return;
    await sdk.crashlytics.deleteUnsentReports(crashlytics);
    await sdk.analytics.setUserProperty(analytics, 'language', null);
    await sdk.analytics.setUserProperty(analytics, 'theme', null);
    await sdk.analytics.setUserProperty(analytics, 'session_mode', null);
    await sdk.analytics.resetAnalyticsData(analytics);
  } catch {
    // Sin SDK la recogida sigue en el valor del manifest (apagada).
  }
}

export async function applyLoadedConsent(loaded: LoadedConsent): Promise<void> {
  const action = collectionAction(loaded);
  if (action.type === 'leave-default') {
    open = false;
    return;
  }
  if (action.type === 'grant') {
    open = await enableNative();
    return;
  }
  open = false;
  await disableNative(action.reset);
}

export async function applyChoice(choice: ConsentChoice, reset: boolean): Promise<void> {
  if (choice === 'accepted') {
    open = await enableNative();
    return;
  }
  open = false;
  await disableNative(reset);
}

export async function logTimerEvent(name: TimerEventName, params: TimerEventParams): Promise<void> {
  if (!open) return;
  const sdk = await firebase();
  if (!sdk) return;
  try {
    sdk.analytics.logEvent(sdk.analytics.getAnalytics(), name, params);
  } catch {
    // Un fallo de analítica no puede romper el reloj.
  }
}

export async function setUsageContext(context: UsageContext): Promise<void> {
  if (!open) return;
  const sdk = await firebase();
  if (!sdk) return;
  try {
    const analytics = sdk.analytics.getAnalytics(sdk.app.getApp());
    await sdk.analytics.setUserProperty(analytics, 'language', context.language);
    await sdk.analytics.setUserProperty(analytics, 'theme', context.theme);
    await sdk.analytics.setUserProperty(analytics, 'session_mode', context.mode);
  } catch {
    // Igual que los eventos: la app sigue sin analítica.
  }
}
