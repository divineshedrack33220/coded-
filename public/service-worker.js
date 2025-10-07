self.addEventListener('install', async (event) => {
  const resourcesToCache = [
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
  event.waitUntil(
    caches.open('coded-signals-v1').then(async (cache) => {
      for (const resource of resourcesToCache) {
        try {
          await cache.add(resource);
          console.log(`Cached: ${resource}`); // Fixed backticks
        } catch (error) {
          console.error(`Failed to cache ${resource}:`, error);
        }
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        return caches.match('/home.html');
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = ['coded-signals-v1'];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});