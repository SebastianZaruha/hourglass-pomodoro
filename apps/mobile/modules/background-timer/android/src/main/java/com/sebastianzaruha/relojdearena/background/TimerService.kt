package com.sebastianzaruha.relojdearena.background

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Servicio en primer plano mientras hay una cuenta viva (1.8.6).
 *
 * Para qué: saber cuándo quitas la app de Recientes. Sin un servicio, Android
 * mata el proceso al quitarla sin avisar a nadie, y la notificación y las
 * alarmas seguían como si nada (la cuenta «seguía» con la app cerrada). Con
 * él, Android llama a `onTaskRemoved` y aquí se para la sesión
 * (`BackgroundTimer.stop`). Su notificación es la MISMA de la cuenta atrás
 * (mismo id): no aparece nada nuevo.
 *
 * Tipo `specialUse` (Android 14+): un temporizador no encaja en los tipos
 * con nombre. Si se publicara en Google Play habría que justificarlo en la
 * consola (ver docs/SEGUNDO_PLANO.md).
 *
 * Si Android no deja arrancarlo (la app ya estaba en segundo plano), todo
 * sigue como en la 1.8.5: notificación normal, sin enterarse de Recientes.
 */
class TimerService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Primero, SIEMPRE, ponerse en primer plano (ver ForegroundGate).
    val notification = TimerNotifications.countdownForService(this)
    try {
      ServiceCompat.startForeground(this, TimerNotifications.ID_COUNTDOWN, notification, foregroundType())
    } catch (e: Exception) {
      TimerServiceControl.startFailed()
      stopSelf()
      return START_NOT_STICKY
    }
    if (TimerServiceControl.started() == ForegroundGate.Command.STOP) {
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
    // Si Android lo matara, no se rehace solo: la próxima alarma o la app lo piden.
    return START_NOT_STICKY
  }

  /** Has quitado la app de Recientes (o «Cerrar todo»): se para la cuenta. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    BackgroundTimer.stop(applicationContext, StopReason.TASK_REMOVED)
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    TimerServiceControl.destroyed()
    super.onDestroy()
  }

  private fun foregroundType(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
}

/** Arranca y para `TimerService` según la sesión, con `ForegroundGate`. */
object TimerServiceControl {
  private val gate = ForegroundGate()

  /** ¿Hay una cuenta viva (en marcha o en pausa)? Entonces hace falta el servicio. */
  fun request(context: Context, active: Boolean) {
    val app = context.applicationContext
    val command = synchronized(gate) { gate.want(active) }
    val intent = Intent(app, TimerService::class.java)
    when (command) {
      ForegroundGate.Command.START -> try {
        ContextCompat.startForegroundService(app, intent)
      } catch (e: Exception) {
        // ForegroundServiceStartNotAllowedException (Android 12+, app en segundo
        // plano) u otro: sin servicio, la notificación normal sigue igual.
        startFailed()
      }
      ForegroundGate.Command.STOP -> try {
        app.stopService(intent)
      } catch (e: Exception) {
        // ya no estaba
      }
      ForegroundGate.Command.NONE -> Unit
    }
  }

  internal fun started(): ForegroundGate.Command = synchronized(gate) { gate.onStarted() }

  internal fun startFailed() = synchronized(gate) { gate.startFailed() }

  internal fun destroyed() = synchronized(gate) { gate.onDestroyed() }
}
