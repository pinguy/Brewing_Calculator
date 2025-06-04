/*  service-worker.js
    Simple “cache-first, update in background” strategy       */

const CACHE_VERSION = 'v1';            // bump when you change file list
const CACHE_NAME    = `brewcalc-${CACHE_VERSION}`;

const OFFLINE_ASSETS = [
  './index.html',
  './manifest.json',
  './service-worker.js',
  /* external resources you host locally: */
  './css/calculator.css',
  './js/calculator.js',
  /* dark-mode icons, etc. */
  './icons/icon-192.png',
  './icons/icon-512.png',
  /* CDNs already provide their own caching;
     include them here only if you want 100 % offline certainty. */
];

/* INSTALL – pre-cache essential assets */
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
          .then(cache => cache.addAll(OFFLINE_ASSETS))
          .then(() => self.skipWaiting())
  );
});

/* ACTIVATE – tidy old caches */
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key.startsWith('brewcalc-') && key !== CACHE_NAME)
        .map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

/* FETCH – cache-first, fall back to network-then-cache */
self.addEventListener('fetch', evt => {
  const { request } = evt;
  // Only GET requests are safe to cache
  if (request.method !== 'GET') return;

  evt.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        /* kick off a background update so next launch is fresh */
        evt.waitUntil(updateCache(request));
        return cached;
      }
      return fetch(request).then(networkResp => {
        // opaque cross-origin responses can’t be cached in some browsers
        if (networkResp && networkResp.status === 200 && networkResp.type === 'basic') {
          updateCache(request, networkResp.clone());
        }
        return networkResp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

/* helper */
function updateCache(request, response) {
  if (!response) {
    return fetch(request).then(resp => updateCache(request, resp));
  }
  return caches.open(CACHE_NAME).then(cache => cache.put(request, response));
}

