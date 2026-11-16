import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./library-fixture";
import { flushReadingProgress } from "../src/modules/library/progress-upload";
import { nextReadingTimestamp } from "../src/modules/library/reading-position";

test("exit uploads only reading positions, using keepalive and the latest position first", (t) => {
  const snapshot = initialState();
  Object.assign(snapshot.documents[0], {
    readingPositionUpdatedAt: "2026-11-16T12:00:00.000Z",
  });
  Object.assign(snapshot.documents[1], {
    readingPositionUpdatedAt: "2026-11-16T12:01:00.000Z",
  });
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, _options: RequestInit) =>
      new Response(null, { status: 204 }),
  );
  flushReadingProgress(snapshot.documents);
  assert.equal(fetch.mock.callCount(), 1);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.ok(options);
  assert.equal(url, "/api/library/progress");
  assert.equal(options.keepalive, true);
  const body = JSON.parse(options.body as string);
  assert.deepEqual(
    body.positions.map((position: { id: string }) => position.id),
    [snapshot.documents[1].id, snapshot.documents[0].id],
  );
  assert.equal(body.positions[0].title, undefined);
  assert.ok(new TextEncoder().encode(options.body as string).length < 60_000);
});
test("exit payloads respect byte limits and skip libraries without reading changes", (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 204 }),
  );
  const snapshot = initialState();
  flushReadingProgress(snapshot.documents);
  assert.equal(fetch.mock.callCount(), 0);
  for (const book of snapshot.documents) {
    book.readingPositionUpdatedAt = "2026-11-16T12:00:00.000Z";
    book.location = { type: "EPUB", href: "á".repeat(20_000), cfi: "cfi" };
  }
  flushReadingProgress(snapshot.documents);
  const body = (
    fetch.mock.calls[0].arguments as unknown as [string, RequestInit]
  )[1].body as string;
  assert.equal(JSON.parse(body).positions.length, 1);
  assert.ok(new TextEncoder().encode(body).length <= 60_000);
});
test("reading timestamps advance even after a clock moves backwards", () => {
  const future = "2099-01-01T00:00:00.000Z";
  assert.ok(nextReadingTimestamp(future) > future);
});

test("the server retains the latest position when a legacy client submits stale progress", async () => {
  const { preserveLatestPositions } =
    await import("../src/modules/library/reading-position");
  const before = initialState(),
    incoming = structuredClone(before);
  Object.assign(before.documents[0], {
    page: 2,
    progress: 100,
    location: { type: "TXT", blockIndex: 2, offset: 0 },
    readingPositionUpdatedAt: "2026-11-16T12:01:00.000Z",
  });
  incoming.documents[0].title = "Título atualizado";
  const merged = preserveLatestPositions(before, incoming);
  assert.equal(merged.documents[0].title, "Título atualizado");
  assert.equal(merged.documents[0].page, 2);
  assert.equal(merged.documents[0].progress, 100);
  assert.deepEqual(merged.documents[0].location, before.documents[0].location);
});
