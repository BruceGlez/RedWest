// Red West offline cache. Network first so playtesters always get the latest build when online;
// the cached copy is only used when the network is unavailable.
const CACHE = 'red-west-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
    const request = event.request;
    if(request.method !== 'GET') return;
    const url = new URL(request.url);
    if(url.origin !== self.location.origin && !FONT_HOSTS.includes(url.hostname)) return;

    event.respondWith(
        fetch(request)
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
