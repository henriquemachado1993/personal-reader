import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "../src/infrastructure/database/client";

test("production reuses the Prisma client and its connection pool", async () => {
  const previousUrl = process.env.DATABASE_URL;
  const previousMode = process.env.NODE_ENV;
  process.env.DATABASE_URL =
    previousUrl ?? "postgresql://test:test@localhost:5432/test";
  Object.assign(process.env, { NODE_ENV: "production" });
  try {
    const first = database();
    assert.equal(database(), first);
    await first.$disconnect();
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousMode === undefined)
      Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: previousMode });
  }
});
