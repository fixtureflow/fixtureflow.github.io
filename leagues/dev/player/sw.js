const CACHE_NAME = 'ff-player-dev-cache-v140';
const CACHE_PREFIX = 'ff-player-dev-cache-';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  '/assets/js/leagues-registry.js',
  '/assets/images/leagues/icon-player-dev-180.png',
  '/assets/images/leagues/icon-player-dev.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Evict only this portal's own superseded caches. caches.keys() is
          // origin-wide, and fixtureflow.github.io serves the Leagues player,
          // captain and club portals alongside CourtFlow from a single origin.
          // Deleting every non-matching cache here would wipe each sibling
          // app's offline shell the moment this worker activated.
          if (name !== CACHE_NAME && name.startsWith(CACHE_PREFIX)) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Portal URLs carry a ?c=<club> query string, but only './index.html'
        // is precached, so an exact-URL match never hits and the offline shell
        // was never served. ignoreSearch lets the one cached shell answer for
        // every club.
        return caches.match(event.request, { ignoreSearch: true });
      })
    );
  }
});
