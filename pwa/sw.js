// pwa/sw.js — plantilla del service worker. `pwa/integration.mjs` la copia a dist/sw.js al compilar
// rellenando los dos marcadores de abajo con el hash y la lista de archivos de la compilación.
// en GitHub Pages el origen se comparte con las demás webs de la cuenta: el prefijo debe ser propio de esta
const PREFIX = 'facturas-ods-';
const CACHE = PREFIX + '__VERSION__';
const FILES = __FILES__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la caché: la app entera está precacheada y una versión nueva llega con un sw.js nuevo.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE)
      .then(c => c.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true }))
      .then(hit => hit ?? fetch(req)),
  );
});
