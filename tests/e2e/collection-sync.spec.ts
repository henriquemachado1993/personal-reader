import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { initialState } from "../library-fixture";

test("deleted legacy collections stay deleted on another browser without a sync base", async ({
  browser,
  request,
  baseURL,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  const ownerId = crypto.randomUUID();
  const origin = new URL(baseURL!).origin;
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    await db.user.create({
      data: { id: ownerId, email: `${ownerId}@example.test` },
    });
    const token = await encode({
      secret: env.AUTH_SECRET,
      salt: "authjs.session-token",
      token: { id: ownerId, sub: ownerId },
    });
    const headers = { Cookie: `authjs.session-token=${token}`, Origin: origin };
    const snapshot = initialState();
    const legacy = {
      id: "filosofia",
      name: "Filosofia & ideias",
      color: "#b39470",
    };
    snapshot.collections = [legacy];
    snapshot.documents[0].collections = [legacy.id];
    const save = (revision: number, value: typeof snapshot) =>
      request.put("/api/library", {
        headers,
        data: { revision, snapshot: value, operationId: crypto.randomUUID() },
      });
    expect((await save(0, snapshot)).status()).toBe(200);
    const deleted = structuredClone(snapshot);
    deleted.collections = [];
    deleted.documents[0].collections = [];
    expect((await save(1, deleted)).status()).toBe(200);
    const remote = await (
      await request.get("/api/library", { headers })
    ).json();
    expect(remote.deletedCollectionIds).toContain("filosofia");
    // The second browser still has the initial collection and no sync record.
    const stale = structuredClone(snapshot);
    stale.collections.push({
      id: "new-local",
      name: "Coleção nova",
      color: "#819275",
    });
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: token,
        url: origin,
        httpOnly: true,
      },
    ]);
    await context.addInitScript(
      ({ ownerId, stale }) => {
        const request = indexedDB.open(`personal-reader-${ownerId}`, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("state");
          request.result.createObjectStore("files");
        };
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("state", "readwrite");
          const store = transaction.objectStore("state");
          const existing = store.get("library");
          existing.onsuccess = () => {
            if (!existing.result) store.put(stale, "library");
          };
          transaction.oncomplete = () => database.close();
        };
      },
      { ownerId, stale },
    );
    const page = await context.newPage();
    await page.goto(`${origin}/settings`);
    await expect(
      page.getByText("Biblioteca sincronizada.", { exact: true }),
    ).toBeVisible();
    const synchronized = await (
      await request.get("/api/library", { headers })
    ).json();
    expect(
      synchronized.snapshot.collections.map((item: { id: string }) => item.id),
    ).toEqual(["new-local"]);
    expect(synchronized.snapshot.documents[0].collections).toEqual([]);
    await page.goto(`${origin}/collections`);
    await expect(
      page.getByRole("link", { name: /Coleção nova/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Filosofia & ideias/ }),
    ).toHaveCount(0);
    // An older client that does not understand deletion metadata must not restore it either.
    synchronized.snapshot.collections.push(legacy);
    synchronized.snapshot.documents[0].collections.push("filosofia");
    expect(
      (await save(synchronized.revision, synchronized.snapshot)).status(),
    ).toBe(200);
    const final = await (await request.get("/api/library", { headers })).json();
    expect(
      final.snapshot.collections.map((item: { id: string }) => item.id),
    ).toEqual(["new-local"]);
    expect(final.snapshot.documents[0].collections).toEqual([]);
    expect(final.deletedCollectionIds).toContain("filosofia");
    expect(await db.collection.count({ where: { ownerId } })).toBe(1);
    expect(await db.document.count({ where: { ownerId } })).toBe(3);
    const tombstone = await db.libraryEntity.findUniqueOrThrow({
      where: {
        ownerId_kind_entityId: {
          ownerId,
          kind: "collections",
          entityId: "filosofia",
        },
      },
    });
    expect(tombstone.deleted).toBe(true);
  } finally {
    await context.close();
    await db.libraryEntity.deleteMany({ where: { ownerId } });
    await db.libraryReplica.deleteMany({ where: { ownerId } });
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  }
});
