/* ══════════════════════════════════════════════════════════
   SERVICE WORKER — cache do app shell para abertura instantânea
   e uso básico offline. Só entra em ação quando o guia é
   servido por HTTPS (ou localhost); em file:// o navegador não
   registra service workers, e o app funciona normalmente sem ele.
═══════════════════════════════════════════════════════════ */
const CACHE_NAME = 'guia-hospede-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/layout.css',
  './css/responsive.css',
  './js/app.js',
  './js/navigation.js',
  './js/components.js',
  './js/site-nav.js',
  './js/data.js',
  './database/guide.json',
  './assets/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Conteúdo do guia: tenta a rede primeiro, para refletir atualizações,
  // com o cache como reserva quando estiver offline.
  if (request.url.endsWith('guide.json')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell e imagens: cache primeiro, para abertura instantânea.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
