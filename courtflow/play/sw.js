const CACHE_NAME = 'ff-courtflow-cache-v39';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  '/assets/js/leagues-registry.js',
  '/assets/images/courtflow/icon-courtflow.svg',
  '/assets/images/courtflow/icon-courtflow.png'
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
          if (cacheName !== CACHE_NAME) {
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
        return caches.match(event.request, { ignoreSearch: true });
      }).catch(() => {
        return caches.match(event.request, { ignoreSearch: true });
      })
    );
  }
});
