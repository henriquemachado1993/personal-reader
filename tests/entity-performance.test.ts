import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { persistLibraryEntities } from "../src/modules/library/entity-persistence";
import { initialState } from "./library-fixture";

test("entity projection reads existing rows once and preserves changes and tombstones", async () => {
  const previous = initialState();
  const next = structuredClone(previous);
  next.documents[0].title = "Alterado";
  const removed = next.documents.pop()!;
  let reads = 0;
  const writes: any[] = [];
  const deletions: any[] = [];
  const tx = {
    libraryEntity: {
      findMany: async (query: unknown) => {
        reads++;
        assert.deepEqual(query, {
          where: {
            ownerId: "owner",
            kind: {
              in: ["documents", "collections", "annotations", "bookmarks"],
            },
          },
          select: { kind: true, entityId: true, payload: true },
        });
        return (
          ["documents", "collections", "annotations", "bookmarks"] as const
        ).flatMap((kind) =>
          previous[kind].map((item) => ({
            kind,
            entityId: item.id,
            payload: item,
          })),
        );
      },
      upsert: async (write: unknown) => writes.push(write),
    },
    storageDeletion: {
      upsert: async (write: unknown) => deletions.push(write),
    },
    user: { findUnique: async () => null },
  } as unknown as Prisma.TransactionClient;
  await persistLibraryEntities(tx, "owner", previous, next);
  assert.equal(reads, 1);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].update.payload.title, "Alterado");
  assert.equal(writes[0].update.version.increment, 1);
  assert.equal(writes[1].where.ownerId_kind_entityId.entityId, removed.id);
  assert.equal(writes[1].update.deleted, true);
  assert.equal(deletions.length, 1);
});

test("one batch read covers a thousand unchanged entities without writes", async () => {
  const snapshot = initialState();
  snapshot.documents = Array.from({ length: 1000 }, (_, index) => ({
    ...snapshot.documents[0],
    id: `book-${index}`,
  }));
  let reads = 0;
  let writes = 0;
  const tx = {
    libraryEntity: {
      findMany: async () => {
        reads++;
        return (
          ["documents", "collections", "annotations", "bookmarks"] as const
        ).flatMap((kind) =>
          snapshot[kind].map((item) => ({
            kind,
            entityId: item.id,
            payload: item,
          })),
        );
      },
      upsert: async () => {
        writes++;
      },
    },
    user: { findUnique: async () => null },
  } as unknown as Prisma.TransactionClient;
  await persistLibraryEntities(tx, "owner", snapshot, snapshot);
  assert.equal(reads, 1);
  assert.equal(writes, 0);
});
