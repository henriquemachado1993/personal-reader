import { test } from "node:test";
import assert from "node:assert/strict";
import { fileKey, uploadType } from "../src/infrastructure/r2/file-key";

test("files are isolated by account and role within the selected bucket", () => {
  const asset = `asset-${crypto.randomUUID()}`;
  assert.equal(fileKey("owner-a", asset), `owner-a/assets/${asset}`);
  assert.equal(fileKey("owner-b", "document"), "owner-b/originals/document");
  assert.equal(uploadType(asset, "text/html"), null);
  assert.equal(uploadType(asset, "image/svg+xml"), null);
  assert.equal(uploadType(asset, "application/json"), "application/json");
  assert.equal(uploadType("document", "text/html"), "application/octet-stream");
});
