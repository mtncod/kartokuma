// Bu sürüm numarası, public/ altındaki herhangi bir sayfa kabuğu dosyası
// (ör. app.js, style.css, index.html) her değiştiğinde MUTLAKA artırılmalı.
// Aksi halde kullanıcılar eski, önbelleğe alınmış sürümde takılı kalır —
// özellikle iOS'ta "Ana Ekrana Ekle" ile yüklenmiş standalone modda,
// yenileme (reload) butonu olmadığı için bu durumdan kurtulmanın kolay bir
// yolu yoktur.
const CACHE_NAME = 'kartokuma-shell-v1';
const SHELL_FILES = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return; // GET olmayan istekler önbellekleme mantığına dahil edilmez
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return; // farklı origin'e giden istekler önbellekleme mantığına dahil edilmez
  }

  if (url.pathname.startsWith('/api/')) {
    return; // /api/ altındaki hiçbir istek önbellekten karşılanmaz — her zaman ağa git
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
