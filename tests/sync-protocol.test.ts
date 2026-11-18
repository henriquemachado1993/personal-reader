import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/modules/library/initial-state";
import { initialState as fixture } from "./library-fixture";
import {
  applyDelta,
  diffLibrary,
  noDeletions,
  syncBatchSchema,
} from "../src/modules/library/sync-protocol";

test("reading position traffic stays constant as the library grows", () => {
  const base = fixture();
  base.documents = Array.from({ length: 2000 }, (_, index) => ({
    ...base.documents[0],
    id: `book-${index}`,
  }));
  const next = structuredClone(base);
  next.documents[12].page++;
  next.documents[12].readingPositionUpdatedAt = "2026-11-17T15:00:00.000Z";
  const { changes } = diffLibrary(base, next);
  assert.deepEqual(
    changes.map(({ id, kind }) => [id, kind]),
    [["book-12", "positions"]],
  );
  assert.ok(JSON.stringify(changes).length < 250);
});

test("the sync API rejects embedded covers, images, document content and extra location fields", () => {
  const book = fixture().documents[0];
  const [metadata, position] = diffLibrary(initialState(), {
    ...initialState(),
    documents: [book],
  }).changes;
  const validate = (changes: unknown[]) =>
    syncBatchSchema.safeParse({
      baseRevision: 0,
      operationId: crypto.randomUUID(),
      changes,
    }).success;
  assert.equal(validate([metadata, position]), true);
  assert.equal(
    validate([
      {
        ...metadata,
        value: { ...metadata.value, cover: "data:image/png;base64,AAAA" },
      },
    ]),
    false,
  );
  assert.equal(
    validate([
      {
        ...metadata,
        value: { ...metadata.value, content: ["arquivo completo"] },
      },
    ]),
    false,
  );
  assert.equal(
    validate([
      {
        ...metadata,
        value: {
          ...metadata.value,
          contentAsset: "https://external.example/path",
        },
      },
    ]),
    false,
  );
  const annotation = {
    id: "note",
    documentId: book.id,
    page: 0,
    location: { type: "PDF", pageIndex: 0 },
    kind: "image",
    text: "",
    color: "#222222",
    createdAt: book.addedAt,
    updatedAt: book.addedAt,
  };
  assert.equal(
    validate([
      {
        kind: "annotations",
        id: "note",
        value: { ...annotation, image: "data:image/png;base64,AAAA" },
      },
    ]),
    false,
  );
  assert.equal(
    validate([
      {
        ...position,
        value: {
          ...position.value,
          location: { type: "PDF", pageIndex: 0, blob: "AAAA" },
        },
      },
    ]),
    false,
  );
});

test("the metadata and preferences schemas reject invalid records", () => {
  const operationId = crypto.randomUUID();
  assert.equal(
    syncBatchSchema.safeParse({
      baseRevision: 0,
      operationId,
      changes: [{ kind: "documents", id: "broken", value: { id: "broken" } }],
    }).success,
    false,
  );
  assert.equal(
    syncBatchSchema.safeParse({
      baseRevision: 0,
      operationId,
      changes: [
        {
          kind: "preferences",
          id: "account",
          value: { ...initialState().preferences, fontSize: -1 },
        },
      ],
    }).success,
    false,
  );
});

test("bootstrap joins metadata and positions regardless of order and honors deletion records", () => {
  const base = fixture();
  base.documents[1].collections = ["old"];
  const [metadata, position] = diffLibrary(initialState(), {
    ...initialState(),
    documents: [base.documents[1]],
  }).changes;
  const { state, deleted } = applyDelta(initialState(), noDeletions(), [
    position,
    { kind: "documents", id: "another", value: null },
    metadata,
    { kind: "collections", id: "old", value: null },
  ]);
  assert.equal(state.documents[0].page, base.documents[1].page);
  assert.deepEqual(state.documents[0].collections, []);
  assert.deepEqual(deleted, { documents: ["another"], collections: ["old"] });
});
