/* ARESSO PWA — precache shell + runtime cache + offline */
const VERSION = 'aressouz-sw-5';
const PRECACHE = `precache-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;

/** Must be same-origin; keep small. app-version.json — buildda dist ga yoziladi */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

function sameOrigin(url) {
  try {
    return new URL(url, self.location.href).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            /* dev: index.html / app-version yo‘q bo‘lishi mumkin */
          }),
        ),
      );
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key === PRECACHE || key === RUNTIME) return Promise.resolve();
          return caches.delete(key);
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/** Navigatsiya: tarmoq → keshdagi / → offline.html */
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;
    const shell = (await caches.match('/')) || (await caches.match('/index.html'));
    if (shell) return shell;
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Statik asset: avval kesh, keyin tarmoq; muvaffaqiyatli javobni keshga */
async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          caches.open(RUNTIME).then((c) => c.put(request, res)).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => {});
    }
    return res;
  } catch {
    return caches.match(request);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = request.url;
  if (!sameOrigin(url)) return;

  const accept = request.headers.get('accept') || '';
  const isNavigation =
    request.mode === 'navigate' ||
    (request.destination === 'document' && accept.includes('text/html'));

  if (isNavigation) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.includes('/assets/')
  ) {
    event.respondWith(
      handleAsset(request).then((r) => r || fetch(request)),
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
