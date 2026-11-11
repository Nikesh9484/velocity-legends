// Velocity Legends — service worker: the installed game plays from the tablet's storage (fast, works offline)
const C = 'vl-game';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const key = u.origin + u.pathname;
  if (u.pathname.includes('/assets/')) {
    // big files (cars, textures, sounds): from storage first, download only if missing
    e.respondWith(caches.open(C).then(async c => { const hit = r.cache === 'reload' || r.cache === 'no-store' ? null : await c.match(key); if (hit) return hit; const res = await fetch(r); if (res.ok) c.put(key, res.clone()); return res; }));
  } else if (!u.pathname.endsWith('files.json')) {
    // code & pages: newest version when online, stored copy when offline
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cl = res.clone(); caches.open(C).then(c => c.put(key, cl)); } return res; })
      .catch(() => caches.open(C).then(async c => (await c.match(key)) || (await c.match(new URL('./', location.href).href)) || (await c.match(new URL('./index.html', location.href).href)) || Response.error())));
  }
});
