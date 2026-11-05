package com.sebastianzaruha.relojdearena.consent

import com.google.firebase.crashlytics.FirebaseCrashlytics
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * `setCrashlyticsCollectionEnabled` del SDK de Firebase, en este proceso.
 * false corta los informes ya; true solo se llama después de Aceptar.
 */
class FirebaseConsentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FirebaseConsent")

    Function("setCrashlyticsCollectionEnabled") { enabled: Boolean ->
      try {
        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(enabled)
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
