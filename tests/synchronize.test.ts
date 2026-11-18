import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./library-fixture";
import {
  emptySyncRecord,
  sendSyncBatch,
  synchronizeLibrary,
  type SyncRecord,
} from "../src/modules/library/synchronize";
import {
  intendedChanges,
  type SyncBatch,
} from "../src/modules/library/sync-protocol";

function memoryStorage() {
  const baseline = initialState();
  let snapshot = structuredClone(baseline);
  let record: SyncRecord = {
    ...emptySyncRecord(),
    revision: 1,
    base: baseline,
  };
  const files = new Map<string, Blob>();
  return {
    readState: async () => snapshot,
    readSyncRecord: async <T>() => record as T,
    writeSyncRecord: async (next: SyncRecord) => {
      record = structuredClone(next);
    },
    readCachedFile: async (id: string) => files.get(id),
    readUnsentAsset: async (id: string) => files.get(id),
    files,
    get snapshot() {
      return snapshot;
    },
    set snapshot(next) {
      snapshot = next;
    },
    get record() {
      return record;
    },
    set record(next) {
      record = next;
    },
  };
}

test("when a revision matches, a pull does no writes", async (t) => {
  const storage = memoryStorage();
  const fetch = t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "/api/library/sync?since=1");
    return Response.json({ revision: 1, changes: [] });
  });
  const result = await synchronizeLibrary("owner", { pull: true }, storage);
  assert.equal(result?.retry, false);
  assert.equal(fetch.mock.callCount(), 1);
});

test("a failed original never blocks a compact position commit", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.documents[0].page = 2;
  storage.files.set(storage.snapshot.documents[0].id, new Blob(["original"]));
  const calls: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options?: RequestInit) => {
      calls.push(url);
      if (url.includes("/files/")) return new Response(null, { status: 503 });
      const batch = JSON.parse(options!.body as string) as SyncBatch;
      assert.deepEqual(
        batch.changes.map(({ kind }) => kind),
        ["positions"],
      );
      assert.ok((options!.body as string).length < 400);
      return Response.json({ revision: 2, changes: batch.changes });
    },
  );
  const result = await synchronizeLibrary("owner", {}, storage);
  assert.deepEqual(calls, [
    "/api/library/sync",
    "/api/library/files/fixture-0",
  ]);
  assert.equal(result?.snapshot.documents[0].page, 2);
  assert.equal(result?.pendingOriginals, 1);
  assert.deepEqual(result?.record.uploaded, []);
  assert.ok(storage.record.pending);
});

test("a lost response retries the original operation and counts later local and remote duration once", async (t) => {
  const storage = memoryStorage();
  const day = "2026-11-17";
  storage.record.base.readingSeconds = 10;
  storage.record.base.readingDays = { [day]: 10 };
  storage.snapshot.readingSeconds = 20;
  storage.snapshot.readingDays = { [day]: 20 };
  let id: string | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options?: RequestInit) => {
      if (options?.method !== "POST")
        return Response.json({
          revision: 3,
          changes: [
            { kind: "seconds", id: "account", value: 27 },
            { kind: "days", id: day, value: 27 },
          ],
        });
      const batch = JSON.parse(options.body as string) as SyncBatch;
      if (id) {
        assert.equal(batch.operationId, id);
        return Response.json({ revision: 3, changes: [], replayed: true });
      }
      id = batch.operationId;
      assert.deepEqual(batch.time, { seconds: 10, days: { [day]: 10 } });
      throw new TypeError("Response interrupted");
    },
  );
  await assert.rejects(synchronizeLibrary("owner", {}, storage), /interrupted/);
  storage.snapshot.readingSeconds = 25;
  storage.snapshot.readingDays = { [day]: 25 };
  const recovered = await synchronizeLibrary("owner", {}, storage);
  assert.equal(recovered?.snapshot.readingSeconds, 32);
  assert.equal(recovered?.record.base.readingSeconds, 27);
  assert.equal(recovered?.record.pending, undefined);
  assert.equal(recovered?.retry, true);
});

test("revision races rebase independent edits", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.documents[0].title = "Local";
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options?: RequestInit) =>
      options?.method === "POST"
        ? new Response(null, { status: 409 })
        : Response.json({
            revision: 2,
            changes: [
              {
                kind: "collections",
                id: "remote",
                value: { id: "remote", name: "Remota", color: "#424242" },
              },
            ],
          }),
  );
  const result = await synchronizeLibrary("owner", {}, storage);
  assert.equal(result?.snapshot.documents[0].title, "Local");
  assert.equal(result?.snapshot.collections[0].id, "remote");
  assert.equal(result?.record.base.documents[0].title, "Documento 0");
  assert.equal(result?.retry, true);
});

test("visibility flush includes time and positions while leaving metadata in the queue", async (t) => {
  const storage = memoryStorage();
  const day = "2026-11-17";
  storage.snapshot.documents[0].title = "Alteração local";
  storage.snapshot.documents[0].page = 2;
  storage.snapshot.readingSeconds = 10;
  storage.snapshot.readingDays = { [day]: 10 };
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options?: RequestInit) => {
      assert.equal(options!.keepalive, true);
      const batch = JSON.parse(options!.body as string) as SyncBatch;
      assert.deepEqual(
        batch.changes.map(({ kind }) => kind),
        ["positions"],
      );
      return Response.json({
        revision: 2,
        changes: intendedChanges(storage.record.base, batch),
      });
    },
  );
  const result = await synchronizeLibrary(
    "owner",
    { keepalive: true },
    storage,
  );
  assert.equal(result?.record.base.documents[0].title, "Documento 0");
  assert.equal(result?.snapshot.documents[0].title, "Alteração local");
  assert.equal(result?.record.base.readingSeconds, 10);
});

test("a large batch does not consume the keepalive budget", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options?: RequestInit) => {
      assert.equal(options?.keepalive, false);
      return new Response(null, { status: 200 });
    },
  );
  await sendSyncBatch(
    {
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      changes: [
        {
          kind: "collections",
          id: "large",
          value: { id: "large", name: "目".repeat(21_000), color: "#222222" },
        },
      ],
    },
    true,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test("an invalid account preserves the local changes", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.documents[0].title = "Preservado";
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 401 }),
  );
  await assert.rejects(
    synchronizeLibrary("owner", { pull: true }, storage),
    /mesma conta/,
  );
  assert.equal(storage.snapshot.documents[0].title, "Preservado");
});

test("a pending image cannot delay progress for an already synchronized book", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.documents[0].page = 2;
  const image = `asset-${crypto.randomUUID()}`;
  storage.snapshot.documents[1].cover = image;
  storage.files.set(image, new Blob(["image"], { type: "image/png" }));
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options?: RequestInit) => {
      assert.equal(url, "/api/library/sync");
      const batch = JSON.parse(options!.body as string) as SyncBatch;
      assert.deepEqual(
        batch.changes.map(({ kind }) => kind),
        ["positions"],
      );
      return Response.json({ revision: 2, changes: batch.changes });
    },
  );
  const result = await synchronizeLibrary("owner", {}, storage);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(result?.snapshot.documents[0].page, 2);
  assert.equal(result?.snapshot.documents[1].cover, image);
  assert.equal(result?.retry, true);
});
