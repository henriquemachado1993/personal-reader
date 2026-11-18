import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  commitLibraryBatch,
  readLibraryDelta,
} from "../src/modules/library/sync-persistence";

function withTransaction(tx: unknown) {
  return {
    $transaction: (work: (client: unknown) => Promise<unknown>) => work(tx),
  } as unknown as PrismaClient;
}

test("a matching revision touches only account metadata", async () => {
  const db = withTransaction({
    user: {
      findUnique: async (query: unknown) => {
        assert.deepEqual(query, {
          where: { id: "owner" },
          select: { libraryRevision: { select: { revision: true } } },
        });
        return { libraryRevision: { revision: 7 } };
      },
    },
  });
  assert.deepEqual(await readLibraryDelta("owner", 7, db), {
    revision: 7,
    changes: [],
  });
});

test("a change of page only reads the target position and checks whether its document exists", async () => {
  const reads: unknown[] = [];
  const writes: unknown[] = [];
  const db = withTransaction({
    $executeRaw: async () => {},
    user: { findUnique: async () => ({ id: "owner" }) },
    libraryRevision: {
      findUnique: async () => ({ revision: 8 }),
      upsert: async () => {},
    },
    syncOperation: { findUnique: async () => null, create: async () => {} },
    libraryEntity: {
      findUnique: async (query: { select: { payload?: true } }) => {
        reads.push(query);
        return query.select.payload ? null : { deleted: false };
      },
      upsert: async (query: unknown) => writes.push(query),
    },
  });
  const position = {
    page: 3,
    progress: 15,
    readingPositionUpdatedAt: new Date().toISOString(),
  };
  const result = await commitLibraryBatch(
    "owner",
    {
      baseRevision: 8,
      operationId: crypto.randomUUID(),
      changes: [{ kind: "positions", id: "book", value: position }],
    },
    db,
  );
  assert.equal(result.status, 200);
  assert.equal(reads.length, 2);
  assert.deepEqual(reads[1], {
    where: {
      ownerId_kind_entityId: {
        ownerId: "owner",
        kind: "documents",
        entityId: "book",
      },
    },
    select: { deleted: true },
  });
  assert.equal(writes.length, 1);
  assert.equal(result.status === 200 && result.delta.revision, 9);
});
