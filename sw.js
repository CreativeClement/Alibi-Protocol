/**
 * Alibi Protocol — Service Worker
 * Provides offline caching for landing page assets.
 * Cache-first strategy for static assets, network-first for HTML pages.
 */

const CACHE_NAME = 'alibi-v20';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/tokenomics',
  '/tokenomics.html',
  '/whitepaper',
  '/whitepaper.html',
  '/pitchdeck',
  '/pitchdeck.html',
  '/privacy',
  '/privacy.html',
  '/terms',
  '/terms.html',
  '/disclaimer',
  '/disclaimer.html',
  '/Alibi_Protocol_Investor_Document',
  '/Alibi_Protocol_Investor_Document.html',
  '/Alibi_Investor_Landing',
  '/Alibi_Investor_Landing.html',
  '/alibi_viral_twitter',
  '/alibi_viral_twitter.html',
  '/alibi_data_marketplace_video',
  '/alibi_data_marketplace_video.html',
  '/alibi_media_showcase',
  '/alibi_media_showcase.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

/* Install — pre-cache core assets */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* Activate — purge old caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch — network-first for HTML, cache-first for assets */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/';

  if (isHTML) {
    /* Network-first for pages — always try fresh content */
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    /* Cache-first for static assets */
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }
});
