import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import {
  loadConsent,
  writeConsent,
  type ConsentChoice,
  type ConsentRecord,
  type LoadedConsent,
} from './consent';

/** Versión que declara app.json (prueba del consentimiento, no la huella del texto). */
export function currentAppVersion(): string {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && /^[0-9A-Za-z.+-]{1,32}$/.test(version) ? version : '0';
}

export function loadStoredConsent(now = Date.now()): Promise<LoadedConsent> {
  return loadConsent(AsyncStorage, now);
}

export function writeStoredConsent(choice: ConsentChoice, now = Date.now()): Promise<ConsentRecord> {
  return writeConsent(choice, AsyncStorage, now, currentAppVersion());
}
