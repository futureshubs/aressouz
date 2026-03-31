/* ARESSO PWA — precache shell + runtime cache + offline */
const VERSION = 'aressouz-sw-6';
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
  '/widgets/ares-template.json',
  '/widgets/ares-data.json',
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
      try {
        const api = widgetsApi();
        if (api?.getByTag && api?.updateByTag) {
          const w = await api.getByTag('aressouz-quick');
          const def = w?.definition;
          if (def) {
            const tKey = def.msAcTemplate ?? def.ms_ac_template;
            const dKey = def.data;
            if (tKey && dKey) {
              const template = await (await fetch(tKey)).text();
              const data = await (await fetch(dKey)).text();
              await api.updateByTag('aressouz-quick', { template, data });
            }
          }
        }
      } catch (_) {}
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

// ---------- PWABuilder / ilg‘or PWA: fon sinxroni, push, vidjetlar (Edge) ----------
function widgetsApi() {
  return self.widgets;
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'ares-background-sync') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('periodicsync', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const api = widgetsApi();
        if (!api?.getByTag || !api?.updateByTag) return;
        const widget = await api.getByTag(event.tag);
        const def = widget?.definition;
        if (!def) return;
        const tKey = def.msAcTemplate ?? def.ms_ac_template;
        const dKey = def.data;
        if (!tKey || !dKey) return;
        const template = await (await fetch(tKey)).text();
        const data = await (await fetch(dKey)).text();
        await api.updateByTag(event.tag, { template, data });
      } catch (_) {
        /* brauzer ruxsati yoki API yo‘q */
      }
    })(),
  );
});

self.addEventListener('widgetinstall', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const api = widgetsApi();
        if (!api?.updateByTag) return;
        const widget = event.widget;
        const def = widget?.definition;
        if (!def) return;
        const tag = def.tag;
        if (self.registration.periodicSync?.register && tag && def.update) {
          const tags = await self.registration.periodicSync.getTags();
          if (!tags.includes(tag)) {
            await self.registration.periodicSync.register(tag, {
              minInterval: def.update,
            });
          }
        }
        const tKey = def.msAcTemplate ?? def.ms_ac_template;
        const dKey = def.data;
        if (!tKey || !dKey) return;
        const template = await (await fetch(tKey)).text();
        const data = await (await fetch(dKey)).text();
        await api.updateByTag(tag, { template, data });
      } catch (_) {}
    })(),
  );
});

self.addEventListener('widgetuninstall', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const widget = event.widget;
        const tag = widget?.definition?.tag;
        if (!tag || !self.registration.periodicSync?.unregister) return;
        await self.registration.periodicSync.unregister(tag);
      } catch (_) {}
    })(),
  );
});

self.addEventListener('widgetclick', () => {});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const body = event.data ? event.data.text() : '';
        await self.registration.showNotification('ARESSO', {
          body: (body || 'Yangilanish').slice(0, 200),
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        });
      } catch (_) {}
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (all.length) {
        all[0].focus();
        return;
      }
      await self.clients.openWindow('/');
    })(),
  );
});
