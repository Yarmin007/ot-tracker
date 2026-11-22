// Service worker: shows the monthly OT sheet reminder and opens the app when tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'ހަމަދު ސުކޫލް';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'އިތުރުގަޑީގެ ޝީޓު ހުށަހެޅުއްވުމަށް ހަނދާންކޮށްއަރުވަމެވެ',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: data.dir || 'auto',
      lang: data.lang || 'dv',
      tag: 'ot-monthly-reminder',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
