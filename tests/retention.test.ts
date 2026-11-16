import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isUnreferencedOriginal,
  isExpiredSnapshotTransfer,
} from "../src/infrastructure/r2/retention.mjs";
test("retention protects referenced originals, malformed libraries and other owners", () => {
  assert.equal(
    isUnreferencedOriginal("a", "a/originals/book", {
      documents: [{ id: "book" }],
    }),
    false,
  );
  assert.equal(
    isUnreferencedOriginal("a", "b/originals/book", { documents: [] }),
    false,
  );
  assert.equal(isUnreferencedOriginal("a", "a/originals/book", null), false);
  assert.equal(
    isUnreferencedOriginal("a", "a/originals/book", { documents: [] }),
    true,
  );
});
test("snapshot cleanup protects originals, recent transfers and malformed keys", () => {
  const now = new Date("2026-11-16T12:00:00Z"),
    old = new Date("2026-11-01T12:00:00Z");
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(
    isExpiredSnapshotTransfer(`sync-snapshots/${id}/${id}`, old, now),
    true,
  );
  assert.equal(
    isExpiredSnapshotTransfer(`${id}/originals/${id}`, old, now),
    false,
  );
  assert.equal(
    isExpiredSnapshotTransfer(`sync-snapshots/${id}/${id}`, now, now),
    false,
  );
  assert.equal(
    isExpiredSnapshotTransfer("sync-snapshots/invalid/key", old, now),
    false,
  );
});
