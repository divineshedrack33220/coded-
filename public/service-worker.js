// service-worker.js – FIXED VERSION
const VERSION = 'v3';
const BUILD_TIME = new Date().toISOString();
const CACHE_NAME = `coded-signals-${VERSION}-${BUILD_TIME}`;

const RESOURCES_TO_CACHE = [
  '/',
  '/home.html',
  '/explore.html',
  '/chat.html',
  '/messages.html',
  '/profile.html',
  '/profile-view.html',
  '/login.html',
  '/auth.html',                    // ← add your auth page too
  '/Uploads/placeholder.jpg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js',  // ← only this one (working)
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(RESOURCES_TO_CACHE);
    }).catch(err => console.error('[SW] Cache addAll failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.map(n => n !== CACHE_NAME && caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).catch(() => {
        // fallback for navigation pages
        if (event.request.destination === 'document') {
          return caches.match('/auth.html');
        }
      });
    })
  );
});
