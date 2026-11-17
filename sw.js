// Offline cache. Pages are network-first so a new build shows on the next launch. Hashed build files and fonts
// are cache-first (their names change with their content); other files (portrait, PDF) refresh in the background.
const CACHE = 'shnzn-v10';
// the page itself is stored at install, so the app opens offline after a single visit
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])).catch(() => {}).then(() => self.skipWaiting()));
});
// the page then lists the files it loaded before this worker took control (scripts, styles, fonts, pictures)
self.addEventListener('message', (e) => {
  const urls = e.data && e.data.cache;
  if (!Array.isArray(urls)) return;
  const mine = [...new Set(urls)].filter((u) => typeof u === 'string' && u.startsWith(self.location.origin)).slice(0, 200);
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(mine.map((u) => c.match(u).then((hit) => hit || fetch(u).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null))))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const put = (r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; };
  const url = new URL(req.url);
  if (req.mode === 'navigate' || url.pathname.endsWith('/sw.js') || url.pathname.endsWith('.webmanifest')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).then(put).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))));
    return;
  }
  if (url.pathname.startsWith('/assets/index-') || url.pathname.startsWith('/fonts/') || /^\/assets\/.+-[A-Za-z0-9_-]{8}\./.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(put)));
    return;
  }
  // stale-while-revalidate
  e.respondWith(caches.match(req).then((hit) => { const net = fetch(req).then(put).catch(() => hit); return hit || net; }));
});
