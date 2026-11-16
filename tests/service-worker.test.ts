import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function worker() {
  const stores = new Map<string, Map<string, Response>>();
  const listeners = new Map<string, (event: any) => void>();
  let online = true;
  let target = "https://reader.test/library";
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name)!;
      return {
        match: async (request: { url: string }) =>
          entries.get(request.url)?.clone(),
        put: async (request: { url: string }, response: Response) => {
          entries.set(request.url, response.clone());
        },
      };
    },
  };
  vm.runInNewContext(await readFile("public/sw.js", "utf8"), {
    URL,
    Response,
    caches,
    fetch: async () => {
      if (!online) throw new Error("offline");
      const response = new Response("network");
      Object.defineProperty(response, "url", { value: target });
      return response;
    },
    self: {
      location: {
        href: "https://reader.test/sw.js?v=current",
        origin: "https://reader.test",
      },
      clients: { claim: async () => {} },
      skipWaiting: () => {
        throw new Error("Must preserve existing tabs");
      },
      addEventListener: (name: string, listener: (event: any) => void) =>
        listeners.set(name, listener),
    },
  });
  async function seed(name: string, path: string, body: string) {
    await (
      await caches.open(name)
    ).put({ url: `https://reader.test${path}` }, new Response(body));
  }
  return {
    caches,
    seed,
    offline: () => {
      online = false;
    },
    login: () => {
      target = "https://reader.test/login";
    },
    activate: async () => {
      let pending!: Promise<unknown>;
      listeners.get("activate")!({
        waitUntil: (promise: Promise<unknown>) => {
          pending = promise;
        },
      });
      await pending;
    },
    request: async (path: string, mode = "navigate", method = "GET") => {
      let pending: Promise<Response> | undefined;
      listeners.get("fetch")!({
        request: { url: `https://reader.test${path}`, mode, method },
        respondWith: (promise: Promise<Response>) => {
          pending = promise;
        },
      });
      return pending;
    },
  };
}

test("worker retires older generations but preserves current, previous and unrelated caches", async () => {
  const sw = await worker();
  for (const version of ["old", "previous", "current"]) {
    await sw.seed(`reader-shell-${version}`, "/library", version);
    await sw.seed(`reader-assets-${version}`, "/_next/static/book.js", version);
  }
  await sw.seed("another-app", "/other", "keep");
  await sw.activate();
  assert.deepEqual(await sw.caches.keys(), [
    "reader-shell-previous",
    "reader-assets-previous",
    "reader-shell-current",
    "reader-assets-current",
    "another-app",
  ]);
});

test("previous generation remains usable offline after activation", async () => {
  const sw = await worker();
  await sw.seed("reader-shell-previous", "/library", "cached page");
  await sw.seed(
    "reader-assets-previous",
    "/_next/static/book.js",
    "cached chunk",
  );
  await sw.seed(
    "reader-assets-previous",
    "/pdf.worker.min.mjs",
    "cached worker",
  );
  await sw.activate();
  sw.offline();
  assert.equal(await (await sw.request("/library"))!.text(), "cached page");
  assert.equal(
    await (await sw.request("/_next/static/book.js", "cors"))!.text(),
    "cached chunk",
  );
  assert.equal(
    await (await sw.request("/pdf.worker.min.mjs", "cors"))!.text(),
    "cached worker",
  );
  assert.equal((await sw.request("/unvisited"))!.status, 503);
});

test("login clears shell caches of every generation and APIs remain uncached", async () => {
  const sw = await worker();
  await sw.seed("reader-shell-previous", "/library", "private");
  await sw.seed("reader-shell-current", "/library", "private");
  sw.login();
  await sw.request("/library");
  assert.deepEqual(await sw.caches.keys(), []);
  assert.equal(await sw.request("/api/library"), undefined);
  assert.equal(await sw.request("/library", "navigate", "POST"), undefined);
});

test("new stable assets are fetched instead of serving a previous worker online", async () => {
  const sw = await worker();
  await sw.seed("reader-assets-previous", "/pdf.worker.min.mjs", "old worker");
  assert.equal(
    await (await sw.request("/pdf.worker.min.mjs", "cors"))!.text(),
    "network",
  );
});

test("reused hashed assets are carried forward before the older generation is retired", async () => {
  const sw = await worker();
  await sw.seed(
    "reader-assets-previous",
    "/_next/static/shared.js",
    "shared chunk",
  );
  const response = await sw.request("/_next/static/shared.js", "cors");
  assert.equal(await response!.text(), "shared chunk");
  await sw.caches.delete("reader-assets-previous");
  sw.offline();
  assert.equal(
    await (await sw.request("/_next/static/shared.js", "cors"))!.text(),
    "shared chunk",
  );
});
