/* Writy offline helper.
   It keeps a copy of Writy's own files on the device, so Writy opens and works without internet.
   It only looks after Writy (its files all start with "writy"); the rest of the website is not touched.
   When you put a new writy.html on the website, Writy picks it up the next time it opens online. */
const CACHE = 'writy-offline-2';
const PAGE = new URL('writy.html', location).href;
const FILES = ['writy.html', 'writy-store.js', 'writy.webmanifest', 'writy-192.png', 'writy-512.png',
  'writy-maskable-512.png', 'writy-apple-180.png', 'writy-32.png'];

self.addEventListener('install', e => {
  /* each file on its own, so one missing icon does not stop the rest */
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('writy-offline-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* the internet, but only if it answers within a few seconds */
function fromNet(req, ms) {
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('slow')), ms);
    fetch(req).then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); no(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Writy itself: the newest copy when online, the saved copy when not */
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/writy\.html$/.test(url.pathname))) {
    e.respondWith(fromNet(req, 4000)
      .then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(PAGE, copy)); }
        return r;
      })
      .catch(() => caches.match(PAGE).then(r => r || caches.match(req, { ignoreSearch: true }))));
    return;
  }

  /* Writy's icons, and the fonts and eye tracking library it loads: the saved copy first */
  const mine = url.origin === location.origin && /\/writy[^/]*$/.test(url.pathname);
  const extra = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(url.hostname);
  if (!mine && !extra) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
