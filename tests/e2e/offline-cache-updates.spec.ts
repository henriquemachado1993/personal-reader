import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

test("worker updates wait for open tabs, retain offline fallback and retire old caches", async ({
  browser,
}) => {
  const script = await readFile("public/sw.js", "utf8");
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Type",
      request.url?.startsWith("/sw.js")
        ? "application/javascript"
        : "text/html",
    );
    response.end(
      request.url?.startsWith("/sw.js")
        ? script
        : "<!doctype html><title>Cached reader</title><p>Offline reading</p>",
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const context = await browser.newContext();
  try {
    let page = await context.newPage();
    await page.goto(`${origin}/library`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js?v=one");
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.evaluate(() => fetch("/_next/static/one.js"));
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js?v=two");
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await navigator.serviceWorker.getRegistration())?.waiting
              ?.scriptURL,
        ),
      )
      .toContain("v=two");
    expect(await page.evaluate(() => caches.keys())).toContain(
      "reader-assets-one",
    );
    const waiting = context
      .serviceWorkers()
      .find((worker) => worker.url().endsWith("v=two"))!;
    await page.close();
    await expect
      .poll(() =>
        waiting.evaluate(
          () =>
            (
              self as unknown as {
                registration: { active?: { scriptURL: string } };
              }
            ).registration.active?.scriptURL,
        ),
      )
      .toContain("v=two");
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto(`${origin}/library`);
    await expect(page.locator("p")).toHaveText("Offline reading");
    expect(
      await page.evaluate(async () => (await fetch("/_next/static/one.js")).ok),
    ).toBe(true);
    await context.setOffline(false);
    // Ensure the new generation has its own shell and asset before the next update.
    await page.reload();
    await page.evaluate(() => fetch("/_next/static/two.js"));
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js?v=three");
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await navigator.serviceWorker.getRegistration())?.waiting
              ?.scriptURL,
        ),
      )
      .toContain("v=three");
    const third = context
      .serviceWorkers()
      .find((worker) => worker.url().endsWith("v=three"))!;
    await page.close();
    await expect
      .poll(() =>
        third.evaluate(
          () =>
            (
              self as unknown as {
                registration: { active?: { scriptURL: string } };
              }
            ).registration.active?.scriptURL,
        ),
      )
      .toContain("v=three");
    await expect
      .poll(() =>
        third.evaluate(async () =>
          (await caches.keys()).includes("reader-shell-one"),
        ),
      )
      .toBe(false);
    const names = await third.evaluate(() => caches.keys());
    expect(names).toContain("reader-shell-two");
    expect(names).toContain("reader-assets-two");
    expect(names).not.toContain("reader-shell-one");
    expect(names).not.toContain("reader-assets-one");
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto(`${origin}/library`);
    await expect(page.locator("p")).toHaveText("Offline reading");
    expect(
      await page.evaluate(async () => (await fetch("/_next/static/one.js")).ok),
    ).toBe(true);
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
