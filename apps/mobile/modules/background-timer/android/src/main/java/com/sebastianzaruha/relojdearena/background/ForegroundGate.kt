package com.sebastianzaruha.relojdearena.background

/**
 * Cuándo arrancar o parar el servicio en primer plano (`TimerService`), sin
 * Android (tests en la JVM).
 *
 * El peligro que evita: un servicio pedido con `startForegroundService` TIENE
 * que llamar a `startForeground` antes de pararse. Si se para antes (p. ej.
 * se pide y, un instante después, la sesión termina y se llama a
 * `stopService`), Android cierra la app («did not then call
 * Service.startForeground»). Por eso, mientras arranca, una petición de
 * parar no se cumple al momento: se apunta y el propio servicio se para
 * justo después de ponerse en primer plano.
 *
 *   IDLE ──quiero(sí)──▶ STARTING ──onStarted──▶ RUNNING ──quiero(no)──▶ IDLE
 *                         │  quiero(no): se apunta «parar»
 *                         └─ onStarted con «parar» apuntado → se para solo
 */
class ForegroundGate {
  enum class Phase { IDLE, STARTING, RUNNING }

  /** Qué tiene que hacer quien llama. */
  enum class Command { NONE, START, STOP }

  var phase = Phase.IDLE
    private set
  private var stopRequested = false

  /** La sesión necesita (o ya no) el servicio. */
  fun want(active: Boolean): Command = when (phase) {
    Phase.IDLE -> if (active) {
      phase = Phase.STARTING
      stopRequested = false
      Command.START
    } else {
      Command.NONE
    }
    Phase.STARTING -> {
      stopRequested = !active
      Command.NONE
    }
    Phase.RUNNING -> if (active) {
      Command.NONE
    } else {
      phase = Phase.IDLE
      Command.STOP
    }
  }

  /**
   * El servicio ya está en primer plano. Devuelve STOP si mientras arrancaba
   * dejó de hacer falta (entonces se para él solo).
   */
  fun onStarted(): Command {
    if (phase != Phase.STARTING) return if (phase == Phase.IDLE) Command.STOP else Command.NONE
    return if (stopRequested) {
      phase = Phase.IDLE
      stopRequested = false
      Command.STOP
    } else {
      phase = Phase.RUNNING
      Command.NONE
    }
  }

  /** Android no dejó arrancarlo (app en segundo plano sin excepción): sin servicio. */
  fun startFailed() {
    phase = Phase.IDLE
    stopRequested = false
  }

  /** El servicio se ha destruido (parado por nosotros o por Android). */
  fun onDestroyed() {
    phase = Phase.IDLE
    stopRequested = false
  }
}
