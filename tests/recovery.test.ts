import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRecoveryToken,
  resetTokenHash,
  sessionPredatesPasswordChange,
} from "../src/modules/auth/recovery-token";
import { sendPasswordRecovery } from "../src/infrastructure/email/mailtrap";
test("recovery tokens are random, hashed and expire in thirty minutes", () => {
  const first = createRecoveryToken(),
    second = createRecoveryToken();
  assert.notEqual(first.token, second.token);
  assert.equal(first.token.length, 64);
  assert.equal(first.tokenHash, resetTokenHash(first.token));
  assert.notEqual(first.tokenHash, first.token);
  assert.ok(first.expiresAt.getTime() > Date.now() + 29 * 60000);
});
test("password changes invalidate old sessions, including tokens without issue time", () => {
  assert.equal(sessionPredatesPasswordChange(10, new Date(11000)), true);
  assert.equal(sessionPredatesPasswordChange(12, new Date(11000)), false);
  assert.equal(sessionPredatesPasswordChange(undefined, new Date()), true);
  assert.equal(sessionPredatesPasswordChange(10, null), false);
});
test("Mailtrap sends through sandbox and rejects transport failure without exposing credentials", async () => {
  const priorFetch = globalThis.fetch;
  const priorEnv = { ...process.env };
  process.env.MAILTRAP_API_TOKEN = "unit-test-token";
  process.env.MAILTRAP_FROM_EMAIL = "reader@example.test";
  process.env.MAILTRAP_SANDBOX_ID = "123";
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://sandbox.api.mailtrap.io/api/send/123");
      const mail = JSON.parse(String(options?.body));
      assert.equal(mail.to[0].email, "owner@example.test");
      assert.ok(mail.text.includes("#temporary-token"));
      return new Response("{}", { status: 200 });
    };
    await sendPasswordRecovery(
      "owner@example.test",
      "https://reader.test/reset-password#temporary-token",
    );
    globalThis.fetch = async () =>
      new Response("secret-provider-details", { status: 401 });
    await assert.rejects(
      sendPasswordRecovery("owner@example.test", "https://reader.test"),
      /Falha no envio/,
    );
  } finally {
    globalThis.fetch = priorFetch;
    process.env = priorEnv;
  }
});
