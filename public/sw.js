const WOLF_SW_CACHE = 'wolf-shell-v2';
const WOLF_SW_OFFLINE_PAGE = '/no-connection.html';
const WOLF_SW_PRECACHE = [WOLF_SW_OFFLINE_PAGE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(WOLF_SW_CACHE)
      .then((cache) => cache.addAll(WOLF_SW_PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== WOLF_SW_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(WOLF_SW_CACHE);
      return cache.match(WOLF_SW_OFFLINE_PAGE);
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
