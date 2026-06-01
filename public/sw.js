// BodyMap service worker
// IMPORTANT: bumping CACHE_NAME forces all clients to rebuild cache on next visit.
// HK Jun 1 2026: bumped to v34 + TEMPORARILY re-enabled skipWaiting + claim
// + post-activate broadcast to force every open client to reload. PWA was
// stuck on stale bundle after v32 deploys; new SW activated but the page
// kept rendering the old JS. Reverting to wait-for-close after this
// recovery deploy stabilizes.
const CACHE_NAME = 'bodymap-v34';

// HK Jun 1 2026 (recovery deploy v2): skipWaiting + claim + broadcast.
// Why broadcast: when v34 SW activates and claims clients, the page is
// still rendering the OLD bundle that v32 SW loaded. The new SW only
// affects FUTURE network requests. So we send each open client a
// postMessage telling it to reload. The client-side handler in src/index.js
// listens for this and calls window.location.reload(). One round-trip,
// no manual user action needed.
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate — clean old caches, claim all clients, then BROADCAST so any
// open page reloads itself to pick up the new bundle. Without this, the
// new SW is active but the user sees stale UI until they manually quit.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Clear all caches except the current one
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    // Take over any open pages
    await self.clients.claim();
    // Broadcast a reload command to all clients. They'll listen via the
    // navigator.serviceWorker.onmessage handler registered in src/index.js.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try {
        client.postMessage({ type: 'SW_FORCE_RELOAD', version: CACHE_NAME });
      } catch (_e) { /* noop */ }
    }
  })());
});

// Fetch — network-first, safe cache fallback. CRITICAL: respondWith() MUST
// receive a Response (or a Promise resolving to one). Returning undefined
// throws "Failed to convert value to 'Response'" and breaks navigation on
// modern Chrome. Previous bug: .catch(() => caches.match(req)) returned
// undefined on a cache miss. Never again.
//
// V4 CHANGE: stop caching HTML / navigation requests. Why: the booking
// page is the same URL (/{custom_url}) regardless of which bundle is
// referenced inside it. If we cached the HTML, a phone that fell back to
// cache once would keep loading the OLD index.html which referenced the
// OLD main.HASH.js bundle, and never see new deploys. Symptom: therapist
// edits intake schema, deploys are green, phone never updates. Fixing
// here by passing all navigation/HTML requests straight to the network.
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET, same-origin, http(s) requests. Leave everything else
  // (POST, Supabase, Stripe, Resend, cross-origin, chrome-extension:) to
  // the browser. This alone prevents most SW disasters.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.protocol.startsWith('http')) return;
  if (url.pathname.startsWith('/api/')) return;

  // V4: navigation requests (HTML page loads) go straight to network.
  // We do NOT serve HTML from cache, ever. If network fails for an
  // HTML request the browser shows its standard offline page.
  // mode === 'navigate' covers both initial navigations and SPA
  // reload paths. Accept header check is a fallback for older
  // browsers that do not set request.mode reliably.
  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    event.respondWith(
      fetch(req).catch(() => new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font-family:system-ui;padding:40px;color:#1F2937">' +
        '<h2>You appear to be offline.</h2>' +
        '<p>Please reconnect and reload this page.</p></body>',
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      ))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(response => {
        // Cache successful same-origin static assets (JS/CSS/images) only.
        if (response && response.ok && response.type === 'basic') {
          const isStatic = url.pathname.startsWith('/static/') ||
                           /\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname);
          if (isStatic) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
          }
        }
        return response;
      })
      .catch(async () => {
        // Network failed. Try cache. If cache misses, return a valid
        // error Response rather than undefined.
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'BodyMap', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'BodyMap', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'bodymap',
      data: { url: data.url || '/dashboard' },
    })
  );
});

// Notification click — open dashboard
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url || '/dashboard')
  );
});
