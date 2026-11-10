/* Replace previous Workbox workers so old event pages no longer win over the network. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const legacyCaches = (await caches.keys().catch(() => [])).filter((name) =>
        name.startsWith('workbox-precache-'),
      );
      const windows = legacyCaches.length
        ? await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        : [];

      await self.clients.claim();

      // Do not await navigation here: the new navigation may itself wait for activation.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          void client.navigate(client.url).catch(() => {});
        }
      }
      await Promise.allSettled(legacyCaches.map((name) => caches.delete(name)));
    })(),
  );
});
