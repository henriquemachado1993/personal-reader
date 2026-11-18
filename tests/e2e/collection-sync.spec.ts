import { test, expect, testBook } from "./library-sync-fixture";
import { initialState } from "../../src/modules/library/initial-state";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "Requer um banco de teste descartável",
);

test("deleting a collection removes its memberships, and a later batch cannot resurrect it", async ({
  createAccount,
}) => {
  const account = await createAccount();
  const first = { id: "first", name: "Primeira", color: "#333333" };
  const second = { id: "second", name: "Segunda", color: "#cccccc" };
  const book = {
    ...testBook("PDF"),
    demo: true,
    collections: [first.id, second.id],
  };
  await account.seed({
    ...initialState(),
    documents: [book],
    collections: [first, second],
  });

  const deleted = await account.write({
    baseRevision: 1,
    operationId: crypto.randomUUID(),
    changes: [{ kind: "collections", id: first.id, value: null }],
  });
  expect(deleted.status(), await deleted.text()).toBe(200);
  expect(
    (await account.read(1)).changes.map(({ kind, id }) => [kind, id]).sort(),
  ).toEqual([
    ["collections", first.id],
    ["documents", book.id],
  ]);
  expect((await account.state()).documents[0].collections).toEqual([second.id]);
  const retry = await account.write({
    baseRevision: 2,
    operationId: crypto.randomUUID(),
    changes: [{ kind: "collections", id: first.id, value: first }],
  });
  expect(retry.status()).toBe(200);
  expect((await account.state()).collections).toEqual([second]);
});
