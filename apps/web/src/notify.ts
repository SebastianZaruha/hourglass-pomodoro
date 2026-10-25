import {
  formatDuration,
  type Language,
  type Messages,
  type SessionCue,
  type SessionSnapshot,
} from '@reloj/core';

export function notificationSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function phaseNotification(
  t: Messages,
  cue: SessionCue,
  snap: SessionSnapshot,
): { title: string; body: string } {
  if (cue === 'finished') {
    return {
      title: snap.isCycle ? t.cyclesDone : t.timeUp,
      body: t.notifFinishedBody,
    };
  }
  return {
    title: t.phaseLabel(snap.kind, snap.round, snap.rounds),
    body: t.notifPhaseAlert(snap.kind, t.duration(snap.durationMs)),
  };
}

export function showPhaseNotification(
  t: Messages,
  cue: SessionCue,
  snap: SessionSnapshot,
  lang: Language,
): void {
  if (!notificationSupported() || Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  const note = phaseNotification(t, cue, snap);
  try {
    const notification = new Notification(note.title, {
      body: note.body,
      lang,
      tag: 'hourglass-phase',
      silent: false,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Algunos navegadores solo permiten notificaciones desde un service worker.
  }
}

export function documentTitle(snap: SessionSnapshot): string {
  const time = formatDuration(snap.remainingMs);
  return `${time} · Hourglass Pomodoro`;
}
