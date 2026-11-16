import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { initialState } from "../library-fixture";

test.setTimeout(90000);

test("progress writes are private, ordered, idempotent and cannot restore deleted books", async ({
  request,
  baseURL,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  const ownerId = crypto.randomUUID(),
    otherId = crypto.randomUUID(),
    origin = new URL(baseURL!).origin;
  const cookie = async (id: string) =>
    `authjs.session-token=${await encode({ secret: env.AUTH_SECRET, salt: "authjs.session-token", token: { id, sub: id } })}`;
  const headers = { Cookie: await cookie(ownerId), Origin: origin };
  const other = { Cookie: await cookie(otherId), Origin: origin };
  try {
    await db.user.create({
      data: { id: ownerId, email: `${ownerId}@example.test` },
    });
    const snapshot = initialState();
    const operationId = crypto.randomUUID();
    const saved = await request.put("/api/library", {
      headers,
      data: { revision: 0, operationId, snapshot },
    });
    expect(saved.status()).toBe(200);
    const position = {
      id: snapshot.documents[0].id,
      page: 2,
      progress: 100,
      location: { type: "TXT", blockIndex: 2, offset: 0 },
      readingPositionUpdatedAt: "2026-11-16T12:00:00.000Z",
    };
    const send = (positions: unknown[], customHeaders = headers) =>
      request.post("/api/library/progress", {
        headers: customHeaders,
        data: { positions },
      });
    expect(
      (
        await request.post("/api/library/progress", {
          data: { positions: [position] },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await send([position], { ...headers, Origin: "https://evil.test" })
      ).status(),
    ).toBe(403);
    expect((await send([{ ...position, progress: 200 }])).status()).toBe(400);
    expect((await send([position], other)).status()).toBe(204);
    const get = async () =>
      (await request.get("/api/library", { headers })).json();
    expect((await get()).snapshot.documents[0].page).toBe(1);
    expect((await send([position])).status()).toBe(204);
    const progressed = await get();
    expect(progressed.snapshot.documents[0].page).toBe(2);
    expect(progressed.revision).toBe(2);
    expect((await send([position])).status()).toBe(204);
    expect((await get()).revision).toBe(2);
    expect(
      (
        await send([
          {
            ...position,
            page: 0,
            progress: 33,
            readingPositionUpdatedAt: "2026-11-16T11:59:00.000Z",
          },
        ])
      ).status(),
    ).toBe(204);
    expect((await get()).snapshot.documents[0].page).toBe(2);
    expect(
      (
        await send([
          {
            ...position,
            page: 0,
            progress: 33,
            location: { type: "TXT", blockIndex: 0, offset: 0 },
            readingPositionUpdatedAt: "2026-11-16T12:01:00.000Z",
          },
        ])
      ).status(),
    ).toBe(204);
    const backwards = await get();
    expect(backwards.snapshot.documents[0].page).toBe(0);
    const receipt = await (
      await request.get(`/api/library?operationId=${operationId}`, { headers })
    ).json();
    expect(receipt.acknowledgedOperationId).toBe(operationId);
    const duplicate = await request.put("/api/library", {
      headers,
      data: { revision: 0, operationId, snapshot },
    });
    expect(duplicate.status()).toBe(200);
    expect((await duplicate.json()).revision).toBe(backwards.revision);
    const removed = structuredClone(backwards.snapshot);
    removed.documents.shift();
    expect(
      (
        await request.put("/api/library", {
          headers,
          data: {
            revision: backwards.revision,
            operationId: crypto.randomUUID(),
            snapshot: removed,
          },
        })
      ).status(),
    ).toBe(200);
    const deleted = await get();
    expect(deleted.deletedDocumentIds).toContain(position.id);
    expect(
      (
        await send([
          { ...position, readingPositionUpdatedAt: "2026-11-16T13:00:00.000Z" },
        ])
      ).status(),
    ).toBe(204);
    const legacy = await request.put("/api/library", {
      headers,
      data: {
        revision: deleted.revision,
        operationId: crypto.randomUUID(),
        snapshot,
      },
    });
    expect(legacy.status()).toBe(200);
    expect(
      (await legacy.json()).snapshot.documents.some(
        (book: { id: string }) => book.id === position.id,
      ),
    ).toBe(false);
  } finally {
    await db.libraryEntity.deleteMany({ where: { ownerId } });
    await db.libraryReplica.deleteMany({ where: { ownerId } });
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  }
});

test("large snapshots transfer through R2 and replay safely after temporary object cleanup", async ({
  request,
  baseURL,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  const ownerId = crypto.randomUUID(),
    operationId = crypto.randomUUID(),
    origin = new URL(baseURL!).origin;
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: { id: ownerId, sub: ownerId },
  });
  const headers = { Cookie: `authjs.session-token=${token}`, Origin: origin };
  try {
    await db.user.create({
      data: { id: ownerId, email: `${ownerId}@example.test` },
    });
    const snapshot = initialState();
    snapshot.documents[0].cover = "x".repeat(5_000_000);
    const original = Buffer.from(JSON.stringify(snapshot));
    const authorized = await request.post(
      `/api/library/snapshots/${operationId}`,
      { headers, data: { size: original.length } },
    );
    expect(authorized.status()).toBe(200);
    const { url } = await authorized.json();
    expect(
      (
        await request.put(url, {
          headers: {
            "Content-Type": "application/octet-stream",
            "If-None-Match": "*",
          },
          data: original,
        })
      ).ok(),
    ).toBe(true);
    const envelope = { revision: 0, operationId, snapshotId: operationId };
    const saved = await request.put("/api/library", {
      headers,
      data: envelope,
    });
    expect(saved.status()).toBe(200);
    expect((await saved.json()).snapshot.documents[0].cover.length).toBe(
      5_000_000,
    );
    const downloaded = await request.get("/api/library", { headers });
    expect(downloaded.headers()["cache-control"]).toBe("private, no-store");
    expect((await downloaded.json()).snapshot.documents[0].cover.length).toBe(
      5_000_000,
    );
    expect(
      (await request.put("/api/library", { headers, data: envelope })).status(),
    ).toBe(200);
    expect(
      (
        await request.post(`/api/library/snapshots/${crypto.randomUUID()}`, {
          headers,
          data: { size: 26_000_000 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post(`/api/library/snapshots/${crypto.randomUUID()}`, {
          data: { size: 1 },
        })
      ).status(),
    ).toBe(401);
  } finally {
    await db.libraryEntity.deleteMany({ where: { ownerId } });
    await db.libraryReplica.deleteMany({ where: { ownerId } });
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  }
});
