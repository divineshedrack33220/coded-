const CACHE_NAME = 'coded-signals-v2'; // 👈 increase version whenever you update

const RESOURCES_TO_CACHE = [
  '/',
  '/home.html',
  '/explore.html',
  '/chat.html',
  '/profile.html',
  '/profile-view.html',
  '/login.html',
  '/Uploads/placeholder.jpg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://unpkg.com/feather-icons@4.29.1/dist/feather.min.js',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js'
];

// ✅ INSTALL
self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate new SW immediately

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const resource of RESOURCES_TO_CACHE) {
        try {
          await cache.add(resource);
          console.log(`Cached: ${resource}`);
        } catch (error) {
          console.error(`Failed to cache ${resource}:`, error);
        }
      }
    })
  );
});

// ✅ ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ✅ FETCH
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() => caches.match('/home.html'))
      );
    })
  );
});
