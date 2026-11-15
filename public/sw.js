const shellCache = "reader-shell-v1";
const assetCache = "reader-assets-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(shellCache);
        try {
          const response = await fetch(request);
          if (new URL(response.url).pathname === "/login") {
            await caches.delete(shellCache);
          } else if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(request);
          return (
            cached ||
            new Response(
              "Abra esta página com conexão antes de usá-la offline.",
              {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              },
            )
          );
        }
      })(),
    );
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/covers/") ||
    url.pathname === "/pdf.worker.min.mjs"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(assetCache);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
