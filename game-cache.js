/* Persistent immutable assets only; each GitHub Pages repository has its own scope. */
const CACHE = 'pocket-weather-github-v1:' + self.registration.scope;
const BASE = new URL(self.registration.scope).pathname;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
        !url.pathname.startsWith(BASE)) return;
    // GitHub's HTTP cache lifetime is fixed. Revalidate navigation immediately
    // so an installed worker never hides a newly published pack URL behind it.
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(new Request(event.request, {cache: 'no-store'})));
        return;
    }
    if (url.search) return;
    const name = url.pathname.slice(BASE.length);
    const immutable = /^engine-[a-f0-9]{12}\.(wasm|js|audio\.worklet\.js|audio\.position\.worklet\.js)$/.test(name) ||
        /^game-[a-f0-9]{64}\.pck(?:\.gz)?$/.test(name);
    if (!immutable) return;
    event.respondWith((async () => {
        const started = Date.now();
        let cache;
        try {
            cache = await caches.open(CACHE);
            const saved = await cache.match(event.request);
            if (saved) { report('disk-cache'); return saved; }
        } catch (_) { /* Storage denial must not prevent playing. */ }
        const response = await fetch(event.request);
        if (response.ok && cache) {
            const copy = response.clone();
            event.waitUntil(cache.put(event.request, copy).catch(() => {}));
        }
        report('network');
        return response;
        function report(source) {
            self.clients.get(event.clientId).then(client => client && client.postMessage({
                type: 'pw-cache', file: name, source, headers_ms: Date.now() - started,
            })).catch(() => {});
        }
    })());
});
