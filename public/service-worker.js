// service-worker.js – ALWAYS CLEARS CACHE ON UPDATE
const VERSION = 'v2';
const BUILD_TIME = new Date().toISOString(); // Unique every deploy
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
  '/Uploads/placeholder.jpg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://unpkg.com/feather-icons@4.29.1/dist/feather.min.js',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js',
  'https://cdn.tailwindcss.com'
];

// INSTALL – Cache everything fresh
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version with clean cache...');
  self.skipWaiting(); // Take control immediately

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching all resources with new cache name:', CACHE_NAME);
      return cache.addAll(RESOURCES_TO_CACHE).catch(err => {
        console.error('[SW] Failed to cache some resources:', err);
      });
    })
  );
});

// ACTIVATE – DELETE ALL OLD CACHES (100% clean every time)
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating and clearing ALL old caches...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('[SW] All old caches deleted. Fresh start!');
      return self.clients.claim();
    })
  );
});

// FETCH – Serve from cache first, fallback to network
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Optional: fallback offline page
        return caches.match('/home.html');
      });
    })
  );
});