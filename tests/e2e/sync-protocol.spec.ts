import { test, expect, testBook } from "./library-sync-fixture";
import { initialState } from "../../src/modules/library/initial-state";
import { diffLibrary } from "../../src/modules/library/sync-protocol";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "Requer um banco de teste descartável",
);

test("positions, receipts, aggregate time, deletion and account isolation are atomic", async ({
  createAccount,
  request,
  libraryDb,
}) => {
  const account = await createAccount();
  const other = await createAccount();
  const book = { ...testBook("PDF"), demo: true };
  await account.seed({ ...initialState(), documents: [book] });
  expect(await account.read(1)).toEqual({ revision: 1, changes: [] });

  const position = {
    page: 2,
    progress: 75,
    location: { type: "PDF" as const, pageIndex: 2 },
    readingPositionUpdatedAt: "2026-11-17T20:00:02.000Z",
  };
  const batch = {
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    changes: [{ kind: "positions" as const, id: book.id, value: position }],
    time: { seconds: 10, days: { "2026-11-17": 10 } },
  };
  expect((await account.write(batch)).status()).toBe(200);
  expect(await (await account.write(batch)).json()).toMatchObject({
    revision: 2,
    replayed: true,
  });
  expect(
    (await account.read(1)).changes.map(({ kind }) => kind).sort(),
  ).toEqual(["days", "positions", "seconds"]);
  expect((await account.state()).readingSeconds).toBe(10);
  expect((await other.read()).changes).toEqual([]);
  expect((await request.get("/api/library/sync")).status()).toBe(401);
  expect(
    (
      await request.post("/api/library/sync", {
        headers: { ...account.headers, Origin: "https://example.test" },
        data: batch,
      })
    ).status(),
  ).toBe(403);

  const stalePage = {
    ...position,
    page: 1,
    readingPositionUpdatedAt: "2026-11-17T20:00:01.000Z",
  };
  expect(
    (
      await account.write({
        ...batch,
        operationId: crypto.randomUUID(),
        time: undefined,
        changes: [{ kind: "positions", id: book.id, value: stalePage }],
      })
    ).status(),
  ).toBe(200);
  expect((await account.state()).documents[0].page).toBe(2);

  const backward = {
    ...position,
    page: 0,
    location: { type: "PDF" as const, pageIndex: 0 },
    readingPositionUpdatedAt: "2026-11-17T20:00:03.000Z",
  };
  expect(
    (
      await account.write({
        ...batch,
        operationId: crypto.randomUUID(),
        time: undefined,
        changes: [{ kind: "positions", id: book.id, value: backward }],
      })
    ).status(),
  ).toBe(200);
  expect((await account.state()).documents[0].page).toBe(0);
  expect(
    (
      await account.write({
        baseRevision: 1,
        operationId: crypto.randomUUID(),
        changes: [{ kind: "documents", id: book.id, value: null }],
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await account.write({
        baseRevision: 3,
        operationId: crypto.randomUUID(),
        changes: [{ kind: "documents", id: book.id, value: null }],
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await account.write({
        ...batch,
        operationId: crypto.randomUUID(),
        time: undefined,
      })
    ).status(),
  ).toBe(200);
  expect((await account.state()).documents).toEqual([]);
  expect(
    await libraryDb.storageDeletion.count({ where: { ownerId: account.id } }),
  ).toBe(1);
});

test("signed transfers store originals and images outside Postgres and isolate other accounts", async ({
  createAccount,
  request,
  libraryDb,
}) => {
  test.skip(!process.env.TEST_R2, "Requer um bucket de teste no R2");
  const account = await createAccount();
  const other = await createAccount();
  const cover = `asset-${crypto.randomUUID()}` as const;
  const book = { ...testBook("PDF"), cover };
  const coverBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRocAAAAASUVORK5CYII=",
    "base64",
  );
  const original = Buffer.alloc(6 * 1024 * 1024, 42);
  const snapshot = { ...initialState(), documents: [book] };
  const changes = diffLibrary(initialState(), snapshot).changes;
  expect(
    (
      await account.write({
        baseRevision: 0,
        operationId: crypto.randomUUID(),
        changes,
      })
    ).status(),
  ).toBe(422);
  await account.upload(cover, coverBytes, "image/png");
  await account.upload(book.id, original, "application/octet-stream");
  await account.seed(snapshot);
  const rows = await libraryDb.libraryEntity.findMany({
    where: { ownerId: account.id },
  });
  expect(JSON.stringify(rows)).toContain(cover);
  expect(JSON.stringify(rows)).not.toContain(coverBytes.toString("base64"));
  for (const [id, bytes] of [
    [cover, coverBytes],
    [book.id, original],
  ] as const) {
    const authorized = await request.get(`/api/library/files/${id}`, {
      headers: account.headers,
      maxRedirects: 0,
    });
    expect(authorized.status()).toBe(307);
    const download = await request.get(authorized.headers().location);
    expect(await download.body()).toEqual(bytes);
    expect(
      (
        await request.get(`/api/library/files/${id}`, {
          headers: other.headers,
        })
      ).status(),
    ).toBe(404);
  }
});
