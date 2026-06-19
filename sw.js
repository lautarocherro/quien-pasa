/* Service worker — makes the app installable and usable offline.
 * Network-first with revalidation for same-origin requests: every fetch goes to
 * the server with `cache: 'no-cache'`, so a new deploy is always picked up and a
 * stale HTTP cache can never mask it. Falls back to the cache only when offline.
 * Cross-origin requests (the ESPN live API) are left untouched so live scores
 * always hit the network. */

const CACHE = 'quien-pasa-v2';
const CORE = [
  './', 'index.html',
  'css/styles.css',
  'js/i18n.js', 'js/engine.js', 'js/data.js', 'js/allocations.js',
  'js/bracket.js', 'js/live.js', 'js/app.js',
  'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // Precache fresh copies (bypass the HTTP cache so the worker never seeds stale assets).
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    CORE.map((u) => fetch(new Request(u, { cache: 'reload' }))
      .then((r) => (r.ok ? c.put(u, r) : null))
      .catch(() => {}))
  )));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // let ESPN / other hosts pass through
  e.respondWith(
    fetch(req, { cache: 'no-cache' })                 // always revalidate against the server
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
