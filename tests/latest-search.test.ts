import { test } from "node:test";
import assert from "node:assert/strict";
import { createLatestSearch } from "../src/modules/reader/latest-search";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("only the latest PDF search may deliver a result", async () => {
  const search = createLatestSearch();
  const first = deferred<number>();
  const old = search.run(() => first.promise);
  assert.deepEqual(await search.run(async () => 5), {
    status: "success",
    value: 5,
  });
  first.resolve(2);
  assert.deepEqual(await old, { status: "obsolete" });
});

test("PDF search handles failures and ignores outdated errors", async () => {
  const search = createLatestSearch();
  const first = deferred<number>();
  const old = search.run(() => first.promise);
  assert.deepEqual(
    await search.run(() => {
      throw new Error("falha");
    }),
    { status: "error" },
  );
  first.reject(new Error("erro antigo"));
  assert.deepEqual(await old, { status: "obsolete" });
  assert.deepEqual(await search.run(async () => 3), {
    status: "success",
    value: 3,
  });
});

test("editing, closing or leaving invalidates pending PDF searches", async () => {
  const search = createLatestSearch();
  const first = deferred<number>();
  const pending = search.run(() => first.promise);
  search.invalidate();
  first.resolve(1);
  assert.deepEqual(await pending, { status: "obsolete" });
});
