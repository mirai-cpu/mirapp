// sw.js - Service Worker (Cache-First Strategy)

const CACHE_NAME = 'batting-stats-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/i18n.js',
  '/js/storage.js',
  '/js/stats.js',
  '/js/field.js',
  '/js/charts.js',
  '/js/share.js',
  '/js/app.js',
  '/locales/ja.json',
  '/locales/en.json',
  '/manifest.json',
  '/icons/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.7/chart.umd.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // AdSense / Analytics はキャッシュしない
  if (url.includes('googlesyndication') ||
      url.includes('googletagmanager') ||
      url.includes('analytics') ||
      url.includes('doubleclick')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
