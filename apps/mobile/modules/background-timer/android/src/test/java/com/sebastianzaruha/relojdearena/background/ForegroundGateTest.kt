package com.sebastianzaruha.relojdearena.background

import com.sebastianzaruha.relojdearena.background.ForegroundGate.Command
import com.sebastianzaruha.relojdearena.background.ForegroundGate.Phase
import org.junit.Assert.assertEquals
import org.junit.Test

/** Cuándo se arranca y se para `TimerService` (ver ForegroundGate). */
class ForegroundGateTest {
  @Test
  fun `arranca una vez y no vuelve a pedirlo mientras corre`() {
    val gate = ForegroundGate()
    assertEquals(Command.START, gate.want(true))
    assertEquals(Command.NONE, gate.want(true)) // arrancando: no otra vez
    assertEquals(Command.NONE, gate.onStarted())
    assertEquals(Phase.RUNNING, gate.phase)
    assertEquals(Command.NONE, gate.want(true))
  }

  @Test
  fun `parar mientras arranca no llama a stopService sino que se para el solo`() {
    val gate = ForegroundGate()
    gate.want(true)
    // La sesión termina antes de que el servicio llegue a primer plano.
    assertEquals(Command.NONE, gate.want(false))
    assertEquals(Command.STOP, gate.onStarted())
    assertEquals(Phase.IDLE, gate.phase)
  }

  @Test
  fun `si vuelve a hacer falta mientras arranca, se queda`() {
    val gate = ForegroundGate()
    gate.want(true)
    gate.want(false)
    gate.want(true)
    assertEquals(Command.NONE, gate.onStarted())
    assertEquals(Phase.RUNNING, gate.phase)
  }

  @Test
  fun `corriendo, dejar de hacer falta lo para`() {
    val gate = ForegroundGate()
    gate.want(true)
    gate.onStarted()
    assertEquals(Command.STOP, gate.want(false))
    assertEquals(Phase.IDLE, gate.phase)
    assertEquals(Command.NONE, gate.want(false))
  }

  @Test
  fun `si Android no deja arrancarlo, se puede volver a intentar`() {
    val gate = ForegroundGate()
    gate.want(true)
    gate.startFailed()
    assertEquals(Phase.IDLE, gate.phase)
    assertEquals(Command.START, gate.want(true))
  }

  @Test
  fun `un arranque que nadie pidio (Android lo rehace) se para`() {
    val gate = ForegroundGate()
    assertEquals(Command.STOP, gate.onStarted())
  }

  @Test
  fun `destruido por Android, la proxima vez se arranca de nuevo`() {
    val gate = ForegroundGate()
    gate.want(true)
    gate.onStarted()
    gate.onDestroyed()
    assertEquals(Command.START, gate.want(true))
  }
}
