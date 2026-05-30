// BodyMap service worker
// IMPORTANT: bumping CACHE_NAME forces all clients to rebuild cache on next visit.
// HK May 29 2026: bumped to v10 for inline notification consolidation.
const CACHE_NAME = 'bodymap-v14';

// Install — no precache. CRA hashes filenames (main.abc123.js), so we can't
// precache by known path. We cache opportunistically in the fetch handler.
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate — clean old caches + take control immediately.
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
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
