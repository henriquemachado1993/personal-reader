import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./library-fixture";
import {
  synchronizeLibrary,
  SyncRevisionError,
  type SyncRecord,
} from "../src/modules/library/synchronize";

function memoryStorage() {
  const baseline = initialState();
  let snapshot = structuredClone(baseline);
  let record: SyncRecord = { revision: 1, base: baseline, uploaded: [] };
  const files = new Map<string, Blob>();
  return {
    readState: async () => snapshot,
    readSyncRecord: async <T>() => record as T,
    writeSyncRecord: async (next: unknown) => {
      record = structuredClone(next) as SyncRecord;
    },
    readCachedFile: async (id: string) => files.get(id),
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

test("a failed original never blocks metadata or marks the file as uploaded", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.documents[0].page = 2;
  storage.files.set(storage.snapshot.documents[0].id, new Blob(["original"]));
  const methods: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options?: RequestInit) => {
      const method = options?.method ?? "GET";
      methods.push(method);
      if (method === "GET")
        return Response.json({
          revision: 1,
          operationId: "prior",
          snapshot: storage.record.base,
        });
      if (method === "POST") return new Response(null, { status: 503 });
      const saved = JSON.parse(options!.body as string);
      return Response.json({ ...saved, revision: 2 });
    },
  );
  const result = await synchronizeLibrary("owner", storage);
  assert.deepEqual(methods, ["GET", "PUT", "POST"]);
  assert.equal(result?.snapshot.documents[0].page, 2);
  assert.equal(result?.pendingOriginals, 1);
  assert.deepEqual(result?.record.uploaded, []);
  assert.equal(
    storage.record.revision,
    1,
    "acknowledgment awaits the atomic local commit",
  );
  assert.ok(storage.record.pending);
});

test("revision races retain the pending operation and request a bounded retry", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.documents[0].title = "Local";
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options?: RequestInit) =>
      options?.method === "PUT"
        ? new Response(null, { status: 409 })
        : Response.json({
            revision: 1,
            operationId: "prior",
            snapshot: storage.record.base,
          }),
  );
  await assert.rejects(synchronizeLibrary("owner", storage), SyncRevisionError);
  assert.ok(storage.record.pending);
  assert.equal(storage.record.base.documents[0].title, "Documento 0");
});

for (const anotherDeviceWrote of [false, true]) {
  test(`accepted writes recover after a lost response${anotherDeviceWrote ? " and a later remote write" : ""} without counting reading twice`, async (t) => {
    const storage = memoryStorage();
    storage.record.base.readingSeconds = 10;
    storage.snapshot.readingSeconds = 20;
    let remote = {
      revision: 1,
      operationId: "prior",
      snapshot: storage.record.base,
      acknowledgedOperationId: "",
    };
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: string, options?: RequestInit) => {
        if (options?.method !== "PUT") return Response.json(remote);
        const saved = JSON.parse(options.body as string);
        remote = {
          ...saved,
          revision: 2,
          acknowledgedOperationId: saved.operationId,
        };
        throw new TypeError("Response interrupted");
      },
    );
    await assert.rejects(synchronizeLibrary("owner", storage), /interrupted/);
    storage.snapshot.readingSeconds = 25;
    if (anotherDeviceWrote)
      remote = {
        ...remote,
        revision: 3,
        operationId: "other-device",
        snapshot: { ...remote.snapshot, readingSeconds: 27 },
      };
    const recovered = await synchronizeLibrary("owner", storage);
    assert.equal(
      recovered?.snapshot.readingSeconds,
      anotherDeviceWrote ? 32 : 25,
    );
    assert.equal(
      recovered?.record.base.readingSeconds,
      anotherDeviceWrote ? 27 : 20,
    );
    assert.equal(recovered?.record.pending, undefined);
    assert.equal(recovered?.retry, true);
    assert.equal(
      storage.snapshot.readingSeconds,
      25,
      "the protocol leaves persistence to the atomic local commit",
    );
  });
}

test("the server's canonical snapshot is applied instead of the submitted snapshot", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.collections.push({
    id: "deleted",
    name: "Apagada",
    color: "#abcdef",
  });
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options?: RequestInit) =>
      options?.method === "PUT"
        ? Response.json({
            revision: 2,
            operationId: "accepted",
            snapshot: { ...storage.snapshot, collections: [] },
          })
        : Response.json({
            revision: 1,
            operationId: "prior",
            snapshot: storage.record.base,
          }),
  );
  const result = await synchronizeLibrary("owner", storage);
  assert.deepEqual(result?.snapshot.collections, []);
  assert.deepEqual(result?.record.base.collections, []);
});

test("legacy pending records preserve remote-only entries and do not count accepted totals again", async (t) => {
  const storage = memoryStorage();
  storage.snapshot.readingSeconds = 20;
  storage.snapshot.collections.push({
    id: "local",
    name: "Local",
    color: "#abcdef",
  });
  const accepted = structuredClone(storage.snapshot);
  accepted.readingSeconds = 30;
  accepted.collections.push({ id: "remote", name: "Remota", color: "#abcdef" });
  const operationId = crypto.randomUUID();
  storage.record.pending = { revision: 1, snapshot: accepted, operationId };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ revision: 2, snapshot: accepted, operationId }),
  );
  const result = await synchronizeLibrary("owner", storage);
  assert.deepEqual(
    result?.snapshot.collections.map((item) => item.id),
    ["local", "remote"],
  );
  assert.equal(result?.snapshot.readingSeconds, 30);
});
