export async function clearAppCache(
  storage: Pick<CacheStorage, "keys" | "delete">,
) {
  const names = (await storage.keys()).filter(
    (name) =>
      name.startsWith("reader-shell-") || name.startsWith("reader-assets-"),
  );
  // Wait for every deletion before reporting failure so a retry cannot overlap it.
  const results = await Promise.allSettled(
    names.map((name) => storage.delete(name)),
  );
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Não foi possível concluir a limpeza do cache.");
  }
}

export async function measureAppCache(
  storage: Pick<CacheStorage, "keys" | "open">,
  signal?: AbortSignal,
) {
  let bytes = 0;
  const names = (await storage.keys()).filter(
    (name) =>
      name.startsWith("reader-shell-") || name.startsWith("reader-assets-"),
  );
  // Read one response at a time so measuring a large cache does not retain all bodies.
  for (const name of names) {
    signal?.throwIfAborted();
    const cache = await storage.open(name);
    for (const request of await cache.keys()) {
      signal?.throwIfAborted();
      const response = await cache.match(request);
      if (response) bytes += (await response.blob()).size;
    }
  }
  signal?.throwIfAborted();
  return bytes;
}

export function formatCacheSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  const index =
    bytes > 0
      ? Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
      : 0;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(bytes / 1024 ** index)} ${units[index]}`;
}
