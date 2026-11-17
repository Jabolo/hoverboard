/* Only the clearly labelled offline programme is cached; live pages stay network-first. */
const OFFLINE_CACHE = 'devfest-offline-__OFFLINE_SNAPSHOT_VERSION__';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.add(new Request(OFFLINE_PAGE, { cache: 'reload' }));
      await self.skipWaiting();
    })(),
  );
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
      const oldOfflineCaches = (await caches.keys().catch(() => [])).filter(
        (name) => name.startsWith('devfest-offline-') && name !== OFFLINE_CACHE,
      );
      await Promise.allSettled(oldOfflineCaches.map((name) => caches.delete(name)));
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      return (await cache.match(OFFLINE_PAGE)) || Response.error();
    }),
  );
});
