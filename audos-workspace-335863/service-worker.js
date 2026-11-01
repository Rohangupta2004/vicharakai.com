const CACHE_NAME = 'vicharakai-shell-v1';
const STATIC_SHELL = ['/', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('vicharakai-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function isSensitiveRequest(url) {
  return url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/auth/')
    || url.pathname.startsWith('/payments/')
    || url.pathname.includes('razorpay')
    || url.hostname.includes('razorpay');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitiveRequest(url)) return;

  if (url.pathname === '/') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/')
        .then((cached) => cached || Response.error())),
    );
    return;
  }

  if (url.pathname === '/site.webmanifest') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
  }
});
