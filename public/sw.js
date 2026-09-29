// Red West offline cache. Network first so playtesters always get the latest build when online;
// the cached copy is only used when the network is unavailable.
const CACHE = 'red-west-v3';

self.addEventListener('install', () => self.skipWaiting());
// Old caches (from earlier builds) are dropped so a stale copy can never come back.
self.addEventListener('activate', event => event.waitUntil(
    caches.keys()
        .then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name))))
        .then(() => self.clients.claim())
));

self.addEventListener('fetch', event => {
    const request = event.request;
    if(request.method !== 'GET') return;
    const url = new URL(request.url);
    if(url.origin !== self.location.origin) return;

    event.respondWith(
        // The page itself always asks the server again (no browser-cached copy), so a new build shows at once.
        fetch(request, request.mode === 'navigate' ? { cache: 'no-cache' } : undefined)
            .then(response => {
                if(response.ok || response.type === 'opaque') {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('./') : undefined)))
    );
});
