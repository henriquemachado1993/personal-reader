import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearAppCache,
  measureAppCache,
  formatCacheSize,
} from "../src/modules/settings/app-cache";

test("manual cleanup deletes only reader shell and asset caches across generations", async () => {
  const deleted: string[] = [];
  await clearAppCache({
    keys: async () => [
      "reader-shell-old",
      "reader-assets-current",
      "other-app",
      "reader-notes",
    ],
    delete: async (name) => {
      deleted.push(name);
      return true;
    },
  });
  assert.deepEqual(deleted, ["reader-shell-old", "reader-assets-current"]);
});

test("empty caches and already deleted entries are safe", async () => {
  await clearAppCache({
    keys: async () => [],
    delete: async () => {
      throw new Error("must not delete");
    },
  });
  await clearAppCache({
    keys: async () => ["reader-shell-old"],
    delete: async () => false,
  });
});

test("partial failure waits for all deletions and reports failure for a retry", async () => {
  let completed = false;
  await assert.rejects(
    clearAppCache({
      keys: async () => ["reader-shell-old", "reader-assets-old"],
      delete: async (name) => {
        if (name.startsWith("reader-shell")) throw new Error("denied");
        await new Promise((resolve) => setTimeout(resolve, 5));
        completed = true;
        return true;
      },
    }),
  );
  assert.equal(completed, true);
});

test("cache size counts response bodies across reader generations only", async () => {
  const opened: string[] = [];
  const storage = {
    keys: async () => ["reader-assets-one", "other-app", "reader-shell-two"],
    open: async (name: string) => {
      opened.push(name);
      return {
        keys: async () => [new Request("https://reader.test/asset")],
        match: async () =>
          new Response(name.startsWith("reader-assets") ? "á" : "abc", {
            headers: { "Content-Length": "999" },
          }),
      } as unknown as Cache;
    },
  };
  assert.equal(await measureAppCache(storage), 5);
  assert.deepEqual(opened, ["reader-assets-one", "reader-shell-two"]);
  assert.equal(formatCacheSize(0), "0 B");
  assert.equal(formatCacheSize(3072), "3 KB");
  assert.equal(formatCacheSize(1572864), "1,5 MB");
});

test("cache size reports failures and stops an obsolete measurement", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    measureAppCache(
      {
        keys: async () => ["reader-assets-one"],
        open: async () => {
          throw new Error("must not open");
        },
      },
      controller.signal,
    ),
    { name: "AbortError" },
  );
  await assert.rejects(
    measureAppCache({
      keys: async () => {
        throw new Error("denied");
      },
      open: async () => {
        throw new Error("must not open");
      },
    }),
  );
});
