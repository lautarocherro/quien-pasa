/* Service worker — makes the app installable and usable offline.
 * Network-first for same-origin requests (so a deploy is picked up immediately
 * online), falling back to cache when offline. Cross-origin requests (the ESPN
 * live API) are left untouched so live scores always hit the network. */

const CACHE = 'quien-pasa-v1';
const CORE = [
  './', 'index.html',
  'css/styles.css',
  'js/i18n.js', 'js/engine.js', 'js/data.js', 'js/allocations.js',
  'js/bracket.js', 'js/live.js', 'js/app.js',
  'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
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
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
