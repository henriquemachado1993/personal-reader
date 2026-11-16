import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadOriginal } from "../src/modules/library/upload-original";

test("large originals go directly to storage; the API receives only their size", async (t) => {
  const original = new Blob([new Uint8Array(6 * 1024 * 1024)]);
  const calls: { url: string; options?: RequestInit }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      return calls.length === 1
        ? Response.json({ url: "https://storage.test/signed" })
        : new Response(null, { status: 200 });
    },
  );
  await uploadOriginal("book", original);
  assert.equal(calls[0].url, "/api/library/files/book");
  assert.equal(calls[0].options?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options?.body as string), {
    size: original.size,
  });
  assert.equal(calls[1].url, "https://storage.test/signed");
  assert.equal(calls[1].options?.body, original);
  assert.equal(calls[1].options?.credentials, "omit");
  assert.equal(
    new Headers(calls[1].options?.headers).get("If-None-Match"),
    "*",
  );
});

test("a second device or retry skips an original already stored remotely", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ exists: true }),
  );
  await uploadOriginal("book", new Blob(["original"]));
  assert.equal(fetch.mock.callCount(), 1);
});

for (const status of [200, 412, 403, 500]) {
  test(`upload status ${status} ${status === 200 || status === 412 ? "completes" : "fails for retry"}`, async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () =>
      ++calls === 1
        ? Response.json({ url: "https://storage.test/signed" })
        : new Response(null, { status }),
    );
    const upload = uploadOriginal("book", new Blob(["original"]));
    if (status === 200 || status === 412) await upload;
    else await assert.rejects(upload, /sincronização tentará novamente/);
  });
}

test("failed authorization never sends bytes", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 401 }),
  );
  await assert.rejects(
    uploadOriginal("book", new Blob(["original"])),
    /sincronização tentará novamente/,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test("network failure preserves the failed upload for retry", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1)
      return Response.json({ url: "https://storage.test/signed" });
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    uploadOriginal("book", new Blob(["original"])),
    /Failed to fetch/,
  );
});
