import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await seedReaderLibrary(context);
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const value = await encode({
    secret: env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: { id: "00000000-0000-4000-8000-000000000001" },
  });
  await context.addCookies([
    { name: "authjs.session-token", value, url: "http://127.0.0.1:3000" },
  ]);
  await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

for (const width of [1440, 393]) {
  test(`cache cleanup ${width} preserves library and originals`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/settings");
    await expect(
      page.getByRole("button", { name: "Limpar cache", exact: true }),
    ).toBeVisible();
    const before = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open(
          "personal-reader-00000000-0000-4000-8000-000000000001",
          1,
        );
        request.onsuccess = () => resolve(request.result);
      });
      const transaction = database.transaction(["state", "files"], "readwrite");
      transaction
        .objectStore("files")
        .put(new Blob(["original content"]), "cache-test-original");
      const snapshot = await new Promise((resolve) => {
        const request = transaction.objectStore("state").get("library");
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise((resolve) => {
        transaction.oncomplete = resolve;
      });
      database.close();
      for (const [name, bytes] of [
        ["reader-shell-old", 1024],
        ["reader-assets-new", 2048],
        ["other-app", 4096],
      ] as const) {
        await (
          await caches.open(name)
        ).put("/cache-fixture", new Response("x".repeat(bytes)));
      }
      return snapshot;
    });
    await page.reload();
    await expect(page.locator(".settings-cache-size")).toHaveText(
      "Tamanho aproximado: 3 KB",
    );
    await page
      .getByRole("button", { name: "Limpar cache", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Cache limpo." }),
    ).toBeVisible();
    expect(await page.evaluate(() => caches.keys())).toEqual(["other-app"]);
    await expect(page.locator(".settings-cache-size")).toHaveText(
      "Tamanho aproximado: 0 B",
    );
    const after = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open(
          "personal-reader-00000000-0000-4000-8000-000000000001",
          1,
        );
        request.onsuccess = () => resolve(request.result);
      });
      const transaction = database.transaction(["state", "files"]);
      const snapshot = await new Promise((resolve) => {
        const request = transaction.objectStore("state").get("library");
        request.onsuccess = () => resolve(request.result);
      });
      const file = await new Promise<Blob>((resolve) => {
        const request = transaction
          .objectStore("files")
          .get("cache-test-original");
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      return { snapshot, file: await file.text() };
    });
    expect(after.snapshot).toEqual(before);
    expect(after.file).toBe("original content");
    await mkdir(".impeccable/review/settings", { recursive: true });
    await page.screenshot({
      path: `.impeccable/review/settings/cache-${width}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Limpar cache", exact: true }),
    ).toBeVisible();
  });
}

test("cache cleanup failure is recoverable", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Limpar cache", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await caches.open("reader-assets-test");
    const original = CacheStorage.prototype.delete;
    CacheStorage.prototype.delete = function (name) {
      CacheStorage.prototype.delete = original;
      return Promise.reject(new Error("denied"));
    };
  });
  await page.getByRole("button", { name: "Limpar cache", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Não foi possível concluir a limpeza" }),
  ).toContainText("Não foi possível concluir a limpeza");
  await page.getByRole("button", { name: "Limpar cache", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cache limpo." }),
  ).toBeVisible();
});

test("reset keeps local data if the account is unavailable and replaces it with the remote library on retry", async ({
  page,
  context,
}) => {
  const route = /\/api\/library\/sync(?:\?.*)?$/;
  await context.unroute(route);
  let available = false;
  let writes = 0;
  await context.route(route, async (request) => {
    if (request.request().method() === "POST") writes++;
    await request.fulfill(
      available
        ? { json: { revision: 4, changes: [], reset: true } }
        : { status: 503, body: "{}" },
    );
  });

  await page.goto("/settings");
  const readLocal = (seed: boolean) =>
    page.evaluate(async (seed) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(
          "personal-reader-00000000-0000-4000-8000-000000000001",
        );
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const tx = db.transaction(["state", "files"], "readwrite");
      const files = tx.objectStore("files");
      if (seed) files.put(new Blob(["offline"]), "offline-file");
      const result = {
        library: tx.objectStore("state").get("library"),
        files: files.count(),
      };
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return {
        books: result.library.result.documents.length,
        files: result.files.result,
      };
    }, seed);

  expect(await readLocal(true)).toEqual({ books: 8, files: 1 });
  await page
    .getByRole("button", { name: "Limpar dados locais", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Limpar dados locais?" });
  const confirm = dialog.getByRole("button", {
    name: "Limpar e ressincronizar",
  });
  await confirm.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Sincronização indisponível",
  );
  expect(await readLocal(false)).toEqual({ books: 8, files: 1 });

  available = true;
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Biblioteca sincronizada.", { exact: true }),
  ).toBeVisible();
  expect(await readLocal(false)).toEqual({ books: 0, files: 0 });
  expect(writes).toBe(0);
});
