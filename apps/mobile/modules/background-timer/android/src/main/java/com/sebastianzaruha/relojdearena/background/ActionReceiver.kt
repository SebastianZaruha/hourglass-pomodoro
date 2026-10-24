package com.sebastianzaruha.relojdearena.background

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Botones de la notificación: funcionan aunque la app esté cerrada. Y, desde
 * la 1.8.6, el «descartar» de la notificación (su `deleteIntent`): para la
 * cuenta del todo.
 */
class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action == ACTION_DISMISS) {
      BackgroundTimer.stop(context, StopReason.NOTIFICATION_DISMISSED)
    } else {
      BackgroundTimer.onAction(context, action)
    }
  }

  companion object {
    const val ACTION_PAUSE = "com.sebastianzaruha.relojdearena.background.PAUSE"
    const val ACTION_RESUME = "com.sebastianzaruha.relojdearena.background.RESUME"
    const val ACTION_RESTART = "com.sebastianzaruha.relojdearena.background.RESTART"
    /** Has descartado la notificación de la cuenta atrás (Android 14+ deja deslizarla). */
    const val ACTION_DISMISS = "com.sebastianzaruha.relojdearena.background.DISMISS"

    fun pendingIntent(context: Context, action: String): PendingIntent {
      val intent = Intent(context, ActionReceiver::class.java).setAction(action)
      // Un requestCode por botón (si no, Android reutilizaría el mismo PendingIntent).
      return PendingIntent.getBroadcast(
        context,
        action.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
