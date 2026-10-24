package com.sebastianzaruha.relojdearena.background

import android.app.Application
import android.app.NotificationManager
import android.content.Context
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Parar la cuenta desde fuera (1.8.6): Recientes, notificación descartada o
 * la × de la ventana flotante. Ver SessionEnd y BackgroundTimer.stop.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SessionStopTest {
  private val min = 60_000L
  private lateinit var context: Context
  private var heard: Int? = null

  private fun session(status: String, at: Long = System.currentTimeMillis()) = BackgroundSession(
    status = status,
    durations = listOf(10 * min),
    repeat = false,
    index = 0,
    phaseEndsAt = if (status == BackgroundSession.RUNNING) at + 10 * min else null,
    remainingMs = if (status == BackgroundSession.PAUSED) 4 * min else null,
    transitions = 0,
  )

  private fun store(s: BackgroundSession, seq: Int = 3) {
    TimerStore.save(context, StoredState(JSONObject().put("session", s.toJson()).put("floating", true), seq))
  }

  @Before
  fun setUp() {
    context = RuntimeEnvironment.getApplication()
    BackgroundTimer.listener = { heard = it }
  }

  @After
  fun tearDown() {
    BackgroundTimer.listener = null
  }

  @Test
  fun `solo para una cuenta viva`() {
    val now = 5_000_000L
    for (reason in StopReason.values()) {
      assertTrue(SessionEnd.shouldStop(reason, session(BackgroundSession.RUNNING, now), now))
      assertTrue(SessionEnd.shouldStop(reason, session(BackgroundSession.PAUSED, now), now))
      assertFalse(SessionEnd.shouldStop(reason, null, now))
      // Ya terminada (aunque lo guardado diga «en marcha»): nada que avisar.
      assertFalse(SessionEnd.shouldStop(reason, session(BackgroundSession.RUNNING, now), now + 11 * min))
    }
  }

  @Test
  fun `parar deja la sesion en ninguna, sube seq y avisa a la app`() {
    store(session(BackgroundSession.RUNNING))
    BackgroundTimer.stop(context, StopReason.NOTIFICATION_DISMISSED)
    val after = TimerStore.load(context)!!
    assertNull(after.session)
    assertEquals(4, after.seq)
    assertEquals(4, heard)
    // El resto de lo guardado (textos, interruptores) se queda.
    assertTrue(after.floating)
    // La app ve la parada como «ninguna sesión con seq nuevo» (pendingNativeChange → 'stopped').
    val snap = JSONObject(BackgroundTimer.snapshot(context)!!)
    assertTrue(snap.isNull("session"))
    assertEquals(4, snap.getInt("seq"))
  }

  @Test
  fun `tambien en pausa, y sin alarmas despues`() {
    store(session(BackgroundSession.PAUSED))
    BackgroundTimer.stop(context, StopReason.TASK_REMOVED)
    assertNull(TimerStore.load(context)!!.session)
    val alarms = shadowOf(context.getSystemService(android.app.AlarmManager::class.java))
    assertNull(alarms.peekNextScheduledAlarm())
  }

  @Test
  fun `sin cuenta viva no se toca seq`() {
    store(session(BackgroundSession.RUNNING, System.currentTimeMillis() - 11 * min))
    BackgroundTimer.stop(context, StopReason.FLOATING_CLOSED)
    assertEquals(3, TimerStore.seq(context))
    assertNull(heard)
  }

  @Test
  fun `quita la notificacion de la cuenta`() {
    val state = StoredState(JSONObject().put("session", session(BackgroundSession.RUNNING).toJson()), 3)
    TimerStore.save(context, state)
    TimerNotifications.showCountdown(context, state, state.session!!)
    val nm = shadowOf(context.getSystemService(NotificationManager::class.java))
    assertNotNull(nm.getNotification(TimerNotifications.ID_COUNTDOWN))
    BackgroundTimer.stop(context, StopReason.NOTIFICATION_DISMISSED)
    assertNull(nm.getNotification(TimerNotifications.ID_COUNTDOWN))
  }

  @Test
  fun `la notificacion de la cuenta para al descartarla`() {
    val state = StoredState(JSONObject().put("session", session(BackgroundSession.RUNNING).toJson()), 3)
    TimerNotifications.showCountdown(context, state, state.session!!)
    val nm = shadowOf(context.getSystemService(NotificationManager::class.java))
    val n = nm.getNotification(TimerNotifications.ID_COUNTDOWN)
    assertNotNull(n.deleteIntent)
    val sent = shadowOf(n.deleteIntent).savedIntent
    assertEquals(ActionReceiver.ACTION_DISMISS, sent.action)
    // Y descartarla (el receptor) para la cuenta.
    TimerStore.save(context, state)
    ActionReceiver().onReceive(context, sent)
    assertNull(TimerStore.load(context)!!.session)
  }

  @Test
  fun `una cuenta viva pide el servicio en primer plano`() {
    val state = StoredState(JSONObject().put("session", session(BackgroundSession.RUNNING).toJson()), 3)
    TimerServiceControl.request(context, true)
    val started = shadowOf(context as Application).nextStartedService
    assertNotNull(started)
    assertEquals(TimerService::class.java.name, started.component!!.className)
    // Tras parar, se pide pararlo (cuando ya está en primer plano).
    TimerServiceControl.started()
    TimerStore.save(context, state)
    BackgroundTimer.stop(context, StopReason.TASK_REMOVED)
    val stopped = shadowOf(context as Application).nextStoppedService
    assertNotNull(stopped)
  }
}
