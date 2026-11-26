self.addEventListener('notificationclick', (event) => {
  if (event.notification.tag !== 'hourglass-phase') return;
  event.notification.close();
  event.waitUntil((async () => {
    const home = new URL(self.registration.scope);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const clock = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === home.origin && url.pathname === home.pathname;
    });
    if (clock) await clock.focus();
    else await self.clients.openWindow(home.href);
  })());
});
