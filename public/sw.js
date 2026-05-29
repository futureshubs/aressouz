/* ARESSO PWA — precache shell + build assets + runtime cache + offline support */
const VERSION = 'aressouz-sw-20';
const PRECACHE = `precache-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;

/** Doimiy statik yo‘llar (dev: faqat shular; prod: vite closeBundle to‘ldiradi) */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-day.png',
  '/icons/icon-512-day.png',
  '/icons/icon-192-night.png',
  '/icons/icon-512-night.png',
  '/icons/icon-kuryer.png',
  '/icons/icon-tayyorlovchi.png',
  '/branding/aresso-logo.png',
  '/branding/aresso-logo-day.png',
  '/branding/aresso-logo-night.png',
  '/widgets/ares-template.json',
  '/widgets/ares-data.json',
];

/** Production build: barcha dist assetlari (JS/CSS/HTML, …) — oflayn ilova po‘shog‘i */
const BUILD_PRECACHE_URLS = []; // AUTO-PRECACHE-DIST-ASSETS

function sameOrigin(url) {
  try {
    return new URL(url, self.location.href).origin === self.location.origin;
  } catch {
    return false;
  }
}

/** Dev (Vite) va API — SW aralashmasin; aks holda eski TSX keshi va proxy xatolari chiqadi. */
function shouldBypassServiceWorker(url) {
  try {
    const u = new URL(url, self.location.href);
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    const p = u.pathname;
    if (p.startsWith('/functions/v1/')) return true;
    if (p.startsWith('/src/') || p.startsWith('/@vite/') || p.startsWith('/@fs/') || p.startsWith('/@id/')) {
      return true;
    }
    if (p.includes('/node_modules/')) return true;
    return false;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      const allPrecache = [...new Set([...PRECACHE_URLS, ...BUILD_PRECACHE_URLS])];
      await Promise.all(
        allPrecache.map((url) =>
          cache.add(url).catch(() => {
            /* dev / eski kesh */
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

/**
 * Navigatsiya: onlayn — tarmoqdan olib RUNTIME ga yozamiz; oflayn — keshdan (offline support).
 * SPA: har qanday marshrut uchun index.html po‘shog‘i.
 */
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, networkResponse.clone()).catch(() => {});
      const precache = await caches.open(PRECACHE);
      const url = new URL(request.url);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        precache.put('/index.html', networkResponse.clone()).catch(() => {});
      }
    }
    return networkResponse;
  } catch {
    const fromNetworkFail = await caches.match(request, { ignoreSearch: false });
    if (fromNetworkFail) return fromNetworkFail;
    const ignoreQuery = await caches.match(request, { ignoreSearch: true });
    if (ignoreQuery) return ignoreQuery;
    const shell =
      (await caches.match('/index.html')) ||
      (await caches.match('/')) ||
      (await caches.match(new Request('/index.html')));
    if (shell) return shell;
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    return offlineResponse();
  }
}

/** Faqat navigatsiya / oflayn sahifa uchun — 503. Assetlarga 503 bermaymiz (ilova sinmaydi). */
function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** Tarmoq xatosi — brauzer qayta urinadi / aniq xato, 503 emas */
function networkErrorResponse() {
  try {
    return Response.error();
  } catch {
    return new Response('', { status: 0, statusText: 'Network Error' });
  }
}

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
    const fromCache = await caches.match(request);
    return fromCache || networkErrorResponse();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = request.url;
  if (shouldBypassServiceWorker(url)) return;
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
      handleAsset(request).then(async (r) => {
        if (r) return r;
        const precache = await caches.open(PRECACHE);
        const p = await precache.match(request);
        if (p) return p;
        try {
          return await fetch(request);
        } catch {
          return Response.error();
        }
      }),
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const runtime = await caches.open(RUNTIME);
        const r1 = await runtime.match(request);
        if (r1) return r1;
        const precache = await caches.open(PRECACHE);
        const r2 = await precache.match(request);
        if (r2) return r2;
        const any = await caches.match(request);
        return any || Response.error();
      }
    })(),
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

function parsePushPayload(event) {
  const fallback = { title: 'ARESSO', body: 'Yangilanish', url: '/', tag: 'aresso-push', icon: '/icons/icon-192.png' };
  if (!event?.data) return fallback;
  try {
    const raw = event.data.text();
    const parsed = JSON.parse(raw);
    return {
      title: String(parsed.title || fallback.title).slice(0, 64),
      body: String(parsed.body || raw || fallback.body).slice(0, 200),
      url: String(parsed.url || fallback.url).slice(0, 256),
      tag: String(parsed.tag || fallback.tag).slice(0, 64),
      icon: String(parsed.icon || fallback.icon).slice(0, 256),
    };
  } catch {
    const text = event.data.text() || '';
    return { ...fallback, body: text.slice(0, 200) || fallback.body };
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const p = parsePushPayload(event);
        await self.registration.showNotification(p.title, {
          body: p.body,
          tag: p.tag,
          icon: p.icon,
          badge: '/icons/icon-192.png',
          data: { url: p.url },
        });
      } catch (_) {}
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = String(event.notification?.data?.url || '/');
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && targetUrl && targetUrl !== '/') {
            try {
              await client.navigate(targetUrl);
            } catch (_) {}
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
