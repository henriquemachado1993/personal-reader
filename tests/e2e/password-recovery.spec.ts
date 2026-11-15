import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { createRecoveryToken } from "../../src/modules/auth/recovery-token";

test("password reset consumes its token and revokes prior sessions", async ({
  request,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  const userId = crypto.randomUUID();
  try {
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.test`,
        passwordHash: await hash("old-password-123", 4),
      },
    });
    const name = "authjs.session-token";
    const session = await encode({
      secret: env.AUTH_SECRET,
      salt: name,
      token: { id: userId, sub: userId },
    });
    const token = createRecoveryToken();
    await db.passwordReset.create({
      data: { tokenHash: token.tokenHash, userId, expiresAt: token.expiresAt },
    });
    const headers = { Origin: "http://127.0.0.1:3000" };
    expect(
      (
        await request.get("/api/status", {
          headers: { Cookie: `${name}=${session}` },
        })
      ).status(),
    ).toBe(200);
    const payload = { token: token.token, password: "new-password-123" };
    expect(
      (
        await request.post("/api/auth/reset-password", {
          headers,
          data: payload,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post("/api/auth/reset-password", {
          headers,
          data: payload,
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.get("/api/status", {
          headers: { Cookie: `${name}=${session}` },
        })
      ).status(),
    ).toBe(401);
    const changed = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await compare(payload.password, changed.passwordHash!)).toBe(true);
    const expired = createRecoveryToken();
    await db.passwordReset.create({
      data: { tokenHash: expired.tokenHash, userId, expiresAt: new Date(0) },
    });
    expect(
      (
        await request.post("/api/auth/reset-password", {
          headers,
          data: { ...payload, token: expired.token },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});
