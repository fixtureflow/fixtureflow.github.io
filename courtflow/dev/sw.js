const CACHE_NAME = 'ff-courtflow-dev-cache-v73';
const CACHE_PREFIX = 'ff-courtflow-dev-cache-';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  '/assets/js/leagues-registry.js',
  '/assets/images/courtflow/icon-courtflow-dev.svg',
  '/assets/images/courtflow/icon-courtflow-dev-180.png'
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
        cacheNames.map((cacheName) => {
          // Evict only CourtFlow's own superseded caches. caches.keys() is
          // origin-wide and fixtureflow.github.io also serves the Leagues
          // player, captain and club portals, whose offline shells an
          // unguarded delete would destroy every time this worker activated.
          if (cacheName !== CACHE_NAME && cacheName.startsWith(CACHE_PREFIX)) {
            return caches.delete(cacheName);
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
          return response;
        }
        // A non-200 (a GitHub Pages 404 during a deploy window, say) is treated
        // as a miss rather than propagated, so the cached shell keeps serving.
        return caches.match(event.request, { ignoreSearch: true });
      }).catch(() => {
        // Portal URLs carry a ?c=<club> query string, but only './index.html'
        // is precached, so an exact-URL match never hits. ignoreSearch lets the
        // one cached shell answer for every club.
        return caches.match(event.request, { ignoreSearch: true });
      })
    );
  }
});
