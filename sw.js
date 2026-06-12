/* MathFlow Arcade service worker.
   Network-first so updates always land, with a cache fallback for offline play. */
const CACHE = "mathflow-arcade-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const fresh = await fetch(e.request);
        if (new URL(e.request.url).origin === self.location.origin) {
          cache.put(e.request, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await cache.match(e.request);
        return cached || Response.error();
      }
    })
  );
});
