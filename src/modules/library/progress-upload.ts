import type { ReaderDocument } from "@/shared/types";
import { readingPosition } from "./reading-position";

export function flushReadingProgress(documents: ReaderDocument[]) {
  const positions = documents
    .filter((book) => book.readingPositionUpdatedAt)
    .sort((a, b) =>
      b.readingPositionUpdatedAt!.localeCompare(a.readingPositionUpdatedAt!),
    );
  const batch: unknown[] = [];
  // Browsers share a 64 KiB keepalive budget. Prioritize the most recent reading.
  for (const book of positions) {
    const next = {
      id: book.id,
      ...readingPosition(book),
      lastReadAt: book.lastReadAt,
    };
    if (batch.length >= 100) break;
    if (
      new TextEncoder().encode(JSON.stringify({ positions: [...batch, next] }))
        .length > 60_000
    )
      continue;
    batch.push(next);
  }
  if (!batch.length) return;
  void fetch("/api/library/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions: batch }),
    keepalive: true,
  }).catch(() => {
    /* IndexedDB retains the position for the next full synchronization. */
  });
}
