package com.sebastianzaruha.relojdearena.background

/**
 * Cuándo se acaba la sesión «desde fuera» (1.8.6), sin Android (tests en la JVM).
 *
 * La regla de Sebastián:
 *   - Salir con «atrás» o con el gesto de inicio: la cuenta SIGUE (con la
 *     notificación y la ventana flotante).
 *   - Quitar la app de Recientes (también «Cerrar todo»), descartar la
 *     notificación de la cuenta atrás o llevar la ventana flotante a la ×:
 *     se PARA del todo. Al abrir la app, empieza en reposo con la duración
 *     elegida.
 *
 * Parar = la sesión guardada pasa a «ninguna» y sube `seq` (así la app, viva
 * o al arrancar, sabe que tiene que ponerse en reposo), y se quitan las
 * alarmas, la notificación, el servicio y la ventana flotante.
 */
enum class StopReason { TASK_REMOVED, NOTIFICATION_DISMISSED, FLOATING_CLOSED }

object SessionEnd {
  /**
   * ¿Hay que parar? Solo si había una cuenta viva (en marcha o en pausa). Si
   * ya había terminado o no había nada, no se toca `seq` (no hay nada que
   * avisar a la app), pero se limpia igual (`cleanUp`).
   */
  fun shouldStop(@Suppress("UNUSED_PARAMETER") reason: StopReason, session: BackgroundSession?, now: Long): Boolean {
    val s = session?.let { TimerModel.settle(it, now) } ?: return false
    return s.isRunning || s.isPaused
  }

  /** El estado guardado tras parar: sin sesión y con `seq` + 1. */
  fun stopped(state: StoredState): StoredState = state.withSession(null, state.seq + 1)
}
