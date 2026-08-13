// service-worker.js
// ----------------------------------------------------
// Full pre-cache of app shell + cache-first runtime
// ----------------------------------------------------
const CACHE_VERSION = 'edf-precache-v29'; // bump when files change

// Every entry must match the URL the HTML actually requests, query string
// included — cacheFirstExact() does an exact match, and any 404 here rejects
// cache.addAll() and aborts the whole install.
const PRECACHE_URLS = [
  './',
  './index.html',
  './Ranger.html',
  './Wingdiver.html',
  './AirRaider.html',
  './Fencer.html',

  './edf-hud.css?v=28',
  './Main.js?v=27',
  './edf-page.js?v=27',
  './sw-register.js?v=26',
  './Ranger.js',
  './Wingdiver.js',
  './AirRaider.js',
  './Fencer.js',

  './manifest.webmanifest',

  './orbitron.ttf',
  './rajdhani-medium.ttf',
  './rajdhani-semibold.ttf',
  './rajdhani-bold.ttf',

  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

// Deliberately not precached: EDF_Logo.gif (1.4MB) and perfect-future.ttf are
// unreferenced now that the menu uses the gradient wordmark and the HUD fonts.
// The files are kept in the repo so the logo is easy to reinstate.

const isSameOrigin = (url) => (new URL(url, self.location.href)).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // HTML navigations → cache-first, ignore search so /, /index.html, etc. are equivalent
  if (req.mode === 'navigate' || (req.destination === '' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Same-origin static assets → cache-first, DO NOT ignore search (so ?v= works)
  if (isSameOrigin(req.url)) {
    const dest = req.destination; // 'style' | 'script' | 'font' | 'image' | ...
    if (['style', 'script', 'font', 'image'].includes(dest)) {
      event.respondWith(cacheFirstExact(req));
      return;
    }
  }

  // Everything else → cache, then network
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

async function handleNavigation(req) {
  const cache = await caches.open(CACHE_VERSION);

  // Try cache first; ignoreSearch keeps /index.html working even with query appends
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok && isSameOrigin(req.url)) cache.put(req, res.clone());
    return res;
  } catch (_) {
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
    return new Response('<h1>Offline</h1><p>Please reconnect.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function cacheFirstExact(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req); // exact — respects ?v=
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok && isSameOrigin(req.url)) cache.put(req, res.clone());
    return res;
  } catch (err) {
    throw err;
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});