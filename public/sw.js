const cacheVersion = new URL(self.location.href).searchParams.get("v") || "v2";
const shellCache = `reader-shell-${cacheVersion}`;
const assetCache = `reader-assets-${cacheVersion}`;
// Wait for previous tabs to close before retiring assets they may still need.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const previous = ["reader-shell-", "reader-assets-"].map((prefix) =>
        names
          .filter(
            (name) =>
              name.startsWith(prefix) &&
              name !== shellCache &&
              name !== assetCache,
          )
          .at(-1),
      );
      await Promise.all(
        names
          .filter(
            (name) =>
              (name.startsWith("reader-shell-") ||
                name.startsWith("reader-assets-")) &&
              name !== shellCache &&
              name !== assetCache &&
              !previous.includes(name),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
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
            await Promise.all(
              (await caches.keys())
                .filter((name) => name.startsWith("reader-shell-"))
                .map((name) => caches.delete(name)),
            );
          } else if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          const cached =
            (await cache.match(request)) ||
            (await matchPrevious("reader-shell-", shellCache, request));
          if (cached) await cache.put(request, cached.clone());
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
        // Hashed chunks are immutable; stable assets must try the new deployment first.
        if (url.pathname.startsWith("/_next/static/")) {
          const previous = await matchPrevious(
            "reader-assets-",
            assetCache,
            request,
          );
          if (previous) {
            await cache.put(request, previous.clone());
            return previous;
          }
        }
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch (error) {
          const previous = await matchPrevious(
            "reader-assets-",
            assetCache,
            request,
          );
          if (previous) return previous;
          throw error;
        }
      })(),
    );
  }
});

async function matchPrevious(prefix, current, request) {
  const names = await caches.keys();
  const previous = names
    .filter((name) => name.startsWith(prefix) && name !== current)
    .at(-1);
  return previous ? (await caches.open(previous)).match(request) : undefined;
}
