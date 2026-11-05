/**
 * Llama a Crashlytics en el acto. El método de `@react-native-firebase/crashlytics`
 * solo guarda la preferencia y el SDK la aplica en el siguiente arranque;
 * retirar el consentimiento tiene que cortar la recogida en este proceso.
 *
 * Si el módulo no está en el binario (web, o un APK anterior), no hace nada.
 */
import { requireOptionalNativeModule } from 'expo';

interface FirebaseConsentNative {
  setCrashlyticsCollectionEnabled(enabled: boolean): boolean;
}

export function setNativeCrashlyticsCollectionEnabled(enabled: boolean): void {
  try {
    requireOptionalNativeModule<FirebaseConsentNative>('FirebaseConsent')?.setCrashlyticsCollectionEnabled(
      enabled,
    );
  } catch {
    // Sin el módulo nativo la app sigue; la recogida no se enciende sola.
  }
}
