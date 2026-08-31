// Service Worker for LiquidityHunter — full offline support
// v6: fixes stale-bundle crashes. HTML/build assets are served network-first
// and never served stale while online, so a deploy always reaches the user.
const CACHE_NAME = 'liqhunter-v6';

// Core app shell to cache on install (NOTE: index.html is intentionally NOT
// pre-cached here — it is handled network-first in fetch so hashed bundle
// references never go stale).
const APP_SHELL = [
  '/vite.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/manifest.json',
];

// Install — cache app shell, take over immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate — purge ALL old caches (this is what clears a stale bundle), claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Is this a request for the HTML document or a hashed build asset?
// These must always come from the network when online so new deploys apply.
function isFreshnessCritical(url, request) {
  if (request.mode === 'navigate') return true;              // page navigations
  if (url.pathname === '/' || url.pathname === '/index.html') return true;
  if (url.pathname.startsWith('/assets/')) return true;      // Vite hashed JS/CSS
  return false;
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // TradingView scripts — network only (they need live data)
  if (url.hostname.includes('tradingview.com') || url.hostname.includes('s3.tradingview.com')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Same-origin requests
  if (url.origin === self.location.origin) {
    // HTML + hashed build assets: NETWORK FIRST, cache only as an offline fallback.
    // Never serve a stale copy while the network succeeds — this prevents the
    // "old bundle keeps running after a deploy" crash.
    if (isFreshnessCritical(url, request)) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() =>
            caches.match(request).then((cached) => {
              if (cached) return cached;
              if (request.mode === 'navigate') return caches.match('/index.html');
              return new Response('Offline', { status: 503 });
            })
          )
      );
      return;
    }

    // Other same-origin static assets (svg/manifest/etc): network-first with cache fallback
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            if (request.mode === 'navigate') return caches.match('/index.html');
            return new Response('Offline', { status: 503 });
          })
        )
    );
    return;
  }

  // External resources — network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 })))
  );
});

// Message channel — lets the page tell a waiting SW to activate immediately
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
