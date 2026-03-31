// Service Worker for PWA
const CACHE_NAME = 'dokon-static-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

const isStaticAsset = (request) => {
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return false;
  }

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.includes('/functions/v1/')) {
    return false;
  }

  if (url.pathname.startsWith('/api/')) {
    return false;
  }

  if (request.mode === 'navigate') {
    return true;
  }

  return /\.(js|css|png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(url.pathname);
};

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Cache failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache only static assets, never cache API calls
self.addEventListener('fetch', (event) => {
  if (!isStaticAsset(event.request)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }

        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }

        return Response.error();
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
