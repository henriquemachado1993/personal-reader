import { test, expect, testBook } from "./library-sync-fixture";
import { initialState } from "../../src/modules/library/initial-state";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "Requer um banco de teste descartável",
);

test("deleting a book tombstones its position, notes, and bookmarks in the same revision", async ({
  createAccount,
  libraryDb,
}) => {
  const account = await createAccount();
  const book = { ...testBook("PDF"), demo: true };
  const location = { type: "PDF" as const, pageIndex: 0 };
  await account.seed({
    ...initialState(),
    documents: [book],
    annotations: [
      {
        id: "note",
        documentId: book.id,
        kind: "note",
        page: 0,
        location,
        text: "Nota",
        color: "#112233",
        createdAt: book.addedAt,
        updatedAt: book.addedAt,
      },
    ],
    bookmarks: [
      {
        id: "bookmark",
        documentId: book.id,
        page: 0,
        location,
        createdAt: book.addedAt,
      },
    ],
  });
  const deleted = await account.write({
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    changes: [{ kind: "documents", id: book.id, value: null }],
  });
  expect(deleted.status(), await deleted.text()).toBe(200);
  const rows = await libraryDb.libraryEntity.findMany({
    where: { ownerId: account.id },
    orderBy: { kind: "asc" },
  });
  expect(
    rows.map(({ kind, deleted, revision, payload }) => [
      kind,
      deleted,
      revision,
      payload,
    ]),
  ).toEqual([
    ["annotations", true, 2, null],
    ["bookmarks", true, 2, null],
    ["documents", true, 2, null],
    ["positions", true, 2, null],
  ]);
});
