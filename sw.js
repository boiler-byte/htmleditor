/* =====================================================================
   HTML Editor – Service Worker
   ===================================================================== */

const CACHE_VERSION = 'v1';                       // bei Updates erhöhen!
const CACHE_NAME    = 'htmleditor-' + CACHE_VERSION;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './help.css',
  './help.js',
  './icon.svg',
  './icon-maskable.svg'
];

/* ---------- Installation: precache lokaler Assets ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const req = new Request(url, { cache: 'reload' });
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
          await cache.put(url, res);
        }
      } catch (e) {
        // Einzelne Fehler (z. B. fehlende optionale Datei) ignorieren
      }
    }));
    await self.skipWaiting();
  })());
});

/* ---------- Aktivierung: alte Caches löschen ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('htmleditor-') && n !== CACHE_NAME)
      .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ---------- Fetch-Strategie ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nur same-origin und Bootstrap Icons CDN behandeln – alles andere
  // (z. B. externe APIs im Vorschau-Frame) unangetastet lassen.
  const sameOrigin   = url.origin === self.location.origin;
  const isBootstrap  = url.hostname === 'cdn.jsdelivr.net';
  if (!sameOrigin && !isBootstrap) return;

  // 1) Navigationsanfragen: network-first, offline aus Cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Fallback: die App-Shell ausliefern
        return (await caches.match('./index.html')) ||
               (await caches.match('./'));
      }
    })());
    return;
  }

  // 2) Statische Assets: cache-first mit Runtime-Caching
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Nur erfolgreiche, vollständige Antworten cachen
      if (res && res.status === 200 &&
          (res.type === 'basic' || res.type === 'cors' || res.type === 'opaque')) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      // Fallback bei Offline-Fehler für Bilder/Schriftarten: leerer Response
      if (req.destination === 'image') {
        return new Response('', { status: 404, statusText: 'Offline' });
      }
      throw e;
    }
  })());
});

/* ---------- Optional: Message-Kanal für manuelles Update ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});