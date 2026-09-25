// CourtPay Standalone Service Worker (dev - v1.0.0)
const CACHE_NAME = 'courtpay-dev-v1.0.0-1790296412133';
const ASSETS = [
  '/courtpay/dev/',
  '/courtpay/dev/index.html',
  '/courtpay/dev/manifest.json',
  '/assets/images/icon-courtpay.svg'
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
