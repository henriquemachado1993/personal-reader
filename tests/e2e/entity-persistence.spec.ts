import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { initialState } from "../../src/modules/library/demo";
test("normalized rows and entity tombstones commit atomically with versions", async ({
  request,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8")),
    db = new PrismaClient({ datasourceUrl: env.DATABASE_URL }),
    ownerId = crypto.randomUUID();
  try {
    await db.user.create({
      data: { id: ownerId, email: `${ownerId}@example.test` },
    });
    const token = await encode({
      secret: env.AUTH_SECRET,
      salt: "authjs.session-token",
      token: { id: ownerId, sub: ownerId },
    });
    const headers = {
      Cookie: `authjs.session-token=${token}`,
      Origin: "http://127.0.0.1:3000",
    };
    const snapshot = initialState();
    const save = async (revision: number) =>
      request.put("/api/library", {
        headers,
        data: { snapshot, revision, operationId: crypto.randomUUID() },
      });
    expect((await save(0)).status()).toBe(200);
    expect(await db.document.count({ where: { ownerId } })).toBe(8);
    snapshot.documents[0].title = "Título atualizado";
    const removed = snapshot.documents.pop()!;
    expect((await save(1)).status()).toBe(200);
    expect(await db.document.count({ where: { ownerId } })).toBe(7);
    const version = await db.libraryEntity.findUniqueOrThrow({
      where: {
        ownerId_kind_entityId: {
          ownerId,
          kind: "documents",
          entityId: snapshot.documents[0].id,
        },
      },
    });
    expect(version.version).toBe(2);
    const untouched = await db.libraryEntity.findUniqueOrThrow({
      where: {
        ownerId_kind_entityId: {
          ownerId,
          kind: "documents",
          entityId: snapshot.documents[1].id,
        },
      },
    });
    expect(untouched.version).toBe(1);
    const tombstone = await db.libraryEntity.findUniqueOrThrow({
      where: {
        ownerId_kind_entityId: {
          ownerId,
          kind: "documents",
          entityId: removed.id,
        },
      },
    });
    expect(tombstone.deleted).toBe(true);
    expect(await db.storageDeletion.count({ where: { ownerId } })).toBe(1);
  } finally {
    await db.libraryEntity.deleteMany({ where: { ownerId } });
    await db.libraryReplica.deleteMany({ where: { ownerId } });
    await db.storageDeletion.deleteMany({ where: { ownerId } });
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  }
});
