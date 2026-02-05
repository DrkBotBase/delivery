const CACHE_NAME = 'mjfood-repartidor-v4.0.1';

const urlsToCache = [
    '/',
    '/panel',
    '/route',
    '/auth/login',
    '/auth/register',
    '/offline',
    '/css/route.css',
    '/css/style.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/route.js',
    '/js/pwa-handler.js',
    '/manifest.json',
    '/banner.jpg',
    '/manual.png',
    '/icons/192.png',
    '/icons/512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                //console.log('[SW] Cache abierto:', CACHE_NAME);
                return cache.addAll(urlsToCache)
                    .then(() => {
                        //console.log('[SW] Todos los recursos cacheados');
                        return self.skipWaiting();
                    });
            })
            .catch(error => {
                console.error('[SW] Error en instalación:', error);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        //console.log('[SW] Eliminando:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            //console.log('[SW] Service Worker activado:', CACHE_NAME);
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    if (url.pathname.startsWith('/auth/')) {
        return; 
    }
    
    if (request.method !== 'GET') {
        return;
    }
    
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.status === 200 && request.method === 'GET') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, responseClone))
                            .catch(err => console.warn('Error caching API response:', err));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then(cached => cached || new Response(
                            JSON.stringify({ error: 'Sin conexión', offline: true }),
                            { 
                                headers: { 'Content-Type': 'application/json' },
                                status: 503 
                            }
                        ));
                })
        );
        return;
    }
    
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match('/offline'))
                .then(response => response || caches.match('/'))
        );
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    event.waitUntil(
                        fetch(request).then(response => {
                            if (response.ok) {
                                return caches.open(CACHE_NAME)
                                    .then(cache => cache.put(request, response))
                                    .catch(err => console.warn('Error updating cache:', err));
                            }
                        }).catch(() => { /*Errores de actualización*/ })
                    );
                    return cachedResponse;
                }
                
                return fetch(request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, responseToCache))
                            .catch(err => console.warn('Error caching response:', err));
                        
                        return response;
                    })
                    .catch(() => {
                        return null;
                    });
            })
    );
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-deliveries') {
        //console.log('[SW] Sincronizando entregas');
        event.waitUntil(syncDeliveries());
    }
});
async function syncDeliveries() {
    //console.log('[SW] Sincronizando datos pendientes...');
}

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_CACHE_INFO') {
        caches.keys().then(cacheNames => {
            event.ports[0].postMessage({
                cacheNames: cacheNames,
                currentCache: CACHE_NAME
            });
        });
    }
});

self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-cache') {
        //console.log('[SW] Actualizando cache periódicamente');
        event.waitUntil(updateCache());
    }
});

async function updateCache() {
    const cache = await caches.open(CACHE_NAME);
    for (const url of urlsToCache) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response);
            }
        } catch (error) {
            //console.log(`[SW] Error actualizando ${url}:`, error);
        }
    }
}