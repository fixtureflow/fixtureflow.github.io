// CourtPay Standalone Service Worker (dev - dev-v8)
const CACHE_NAME = 'ff-courtpay-dev-cache-v8';
const CACHE_PREFIX = 'ff-courtpay-dev-cache-';
const ASSETS = [
  '/courtpay/dev/',
  '/courtpay/dev/index.html',
  '/courtpay/dev/manifest.json',
  '/assets/images/courtpay/icon-courtpay-dev.svg',
  '/assets/images/courtpay/icon-courtpay-dev-180.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k.startsWith(CACHE_PREFIX))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
