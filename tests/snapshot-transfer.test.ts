import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./library-fixture";
import { saveLibrarySnapshot } from "../src/modules/library/snapshot-transfer";
import { replicaResponse } from "../src/modules/library/replica-response";

test("small snapshots use one API request", async (t) => {
  const calls: RequestInit[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      calls.push(options);
      return Response.json({ revision: 1 });
    },
  );
  const payload = {
    revision: 0,
    operationId: crypto.randomUUID(),
    snapshot: initialState(),
  };
  await saveLibrarySnapshot(payload);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].body as string), payload);
});

test("snapshots exceeding the function limit bypass the API body, including multibyte text", async (t) => {
  const calls: { url: string; options: RequestInit }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      return calls.length === 1
        ? Response.json({ url: "https://storage.test/snapshot" })
        : new Response(null, { status: 200 });
    },
  );
  const snapshot = initialState();
  snapshot.documents[0].cover = "á".repeat(2_100_000);
  const operationId = crypto.randomUUID();
  await saveLibrarySnapshot({ revision: 3, operationId, snapshot });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, `/api/library/snapshots/${operationId}`);
  assert.equal(calls[1].url, "https://storage.test/snapshot");
  assert.ok(calls[1].options.body instanceof Blob);
  assert.ok((calls[1].options.body as Blob).size > 4_000_000);
  assert.deepEqual(JSON.parse(calls[2].options.body as string), {
    revision: 3,
    operationId,
    snapshotId: operationId,
  });
});

test("failed snapshot authorization or transfer does not commit a reference", async (t) => {
  const snapshot = initialState();
  snapshot.documents[0].cover = "x".repeat(4_100_000);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(null, { status: 503 });
  });
  await assert.rejects(
    saveLibrarySnapshot({
      revision: 1,
      operationId: crypto.randomUUID(),
      snapshot,
    }),
    /cópia local está preservada/,
  );
  assert.equal(calls, 1);
});

test("large replica responses stream JSON with private no-store headers", async () => {
  const snapshot = initialState();
  snapshot.documents[0].cover = "x".repeat(5_000_000);
  const response = replicaResponse({ revision: 1, snapshot });
  assert.ok(response.body instanceof ReadableStream);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (await response.json()).snapshot.documents[0].cover.length,
    5_000_000,
  );
});
