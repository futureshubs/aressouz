// PWA: eski cache-first strategiya SPA ni “qotirardi”. Tarmoq ustuvor — backend/frontend yangilanadi.
const CACHE_NAME = 'dokon-pwa-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/manifest.json']).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isDocument =
    req.mode === 'navigate' || accept.includes('text/html');

  if (isDocument) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/') || caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req)),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
