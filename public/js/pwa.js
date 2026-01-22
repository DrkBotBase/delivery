// Service Worker
const CACHE_NAME = 'delivery-tracker-v1';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json',
    '/icons/192.png',
    '/icons/512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('/api/') || event.request.url.includes('/upload')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    if (event.request.method === 'GET') {
                        return caches.match(event.request);
                    }
                    return new Response(JSON.stringify({ error: 'Offline' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-deliveries') {
        event.waitUntil(syncDeliveries());
    }
});