import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signedReadUrl,
  signedUploadUrl,
} from "../src/infrastructure/r2/client";

test("signed transfers scope the object to its owner, expire and prevent overwrites", async (t) => {
  for (const [key, value] of Object.entries({
    R2_ACCOUNT_ID: "account",
    R2_BUCKET_NAME: "private-books",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const upload = new URL(
    await signedUploadUrl(
      "owner/originals/book",
      "application/octet-stream",
      6 * 1024 * 1024,
    ),
  );
  assert.equal(
    upload.hostname,
    "private-books.account.r2.cloudflarestorage.com",
  );
  assert.equal(upload.pathname, "/owner/originals/book");
  assert.equal(upload.searchParams.get("X-Amz-Expires"), "300");
  const signedHeaders = upload.searchParams
    .get("X-Amz-SignedHeaders")!
    .split(";");
  assert.ok(signedHeaders.includes("content-length"));
  assert.ok(signedHeaders.includes("if-none-match"));
  const download = new URL(await signedReadUrl("owner/originals/book"));
  assert.equal(download.pathname, upload.pathname);
  assert.equal(download.searchParams.get("X-Amz-Expires"), "300");
  assert.notEqual(
    download.searchParams.get("X-Amz-Signature"),
    upload.searchParams.get("X-Amz-Signature"),
  );
});
