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
  try {
    const permission =
      Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission === 'granted') void notificationWorker();
    return permission;
  } catch {
    return 'denied';
  }
}

async function notificationWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (!('serviceWorker' in navigator)) return null;
    const script = new URL('hourglass-notifications.js', new URL(import.meta.env.BASE_URL, location.origin));
    // Conserva cualquier service worker que la web ya tenga registrado.
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.active) return registration;
    if (!registration) await navigator.serviceWorker.register(script);
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
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
  const options = { body: note.body, lang, tag: 'hourglass-phase', silent: false };
  try {
    const notification = new Notification(note.title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // En navegador móvil el constructor puede fallar aun con permiso concedido.
    void notificationWorker()
      .then((registration) => {
        if (document.hidden && Notification.permission === 'granted') {
          return registration?.showNotification(note.title, options);
        }
      })
      .catch(() => undefined);
  }
}

export function documentTitle(snap: SessionSnapshot): string {
  const time = formatDuration(snap.remainingMs);
  return `${time} · Hourglass Pomodoro`;
}
