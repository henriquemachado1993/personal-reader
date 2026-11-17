import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { importBookmarkFile } from "./bookmark-files";
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ context }) => {
  await seedReaderLibrary(context);
  await context.route(/\/api\/library(?:\/|\?|$)/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const name = "authjs.session-token";
  const value = await encode({
    secret: env.AUTH_SECRET,
    salt: name,
    token: { id: "00000000-0000-4000-8000-000000000001" },
  });
  await context.addCookies([
    { name, value, url: "http://127.0.0.1:3000", httpOnly: true },
  ]);
});

for (const width of [1440, 393]) {
  for (const format of ["PDF", "TXT", "DOCX", "EPUB"] as const) {
    test(`${format} search counts and highlights occurrences (${width}px)`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await importBookmarkFile(page, format);
      await page
        .getByRole("button", { name: "Buscar no documento", exact: true })
        .click();
      const search = page.getByRole("search");
      const input = search.getByLabel("Buscar texto neste documento");
      const count = search.getByLabel("Ocorrências encontradas");
      const next = search.getByRole("button", { name: "Próxima ocorrência" });
      const previous = search.getByRole("button", {
        name: "Ocorrência anterior",
      });
      const total = format === "PDF" ? 3 : 96;
      await input.fill(format === "PDF" ? "Bookmark" : "leitura");
      await input.press("Enter");
      await expect(count).toHaveText(`1/${total}`);
      await next.click();
      await expect(count).toHaveText(`2/${total}`);
      await previous.click();
      await expect(count).toHaveText(`1/${total}`);
      await previous.click();
      await expect(count).toHaveText(`${total}/${total}`);
      await next.click();
      await expect(count).toHaveText(`1/${total}`);
      const highlightCount = () =>
        format === "EPUB"
          ? page
              .locator("iframe")
              .first()
              .contentFrame()
              .locator("body")
              .evaluate(
                () => CSS.highlights.get("reader-epub-search")?.size ?? 0,
              )
          : page.evaluate(() =>
              Array.from(CSS.highlights)
                .filter(
                  ([key]) =>
                    key.startsWith("reader-search-") &&
                    !key.endsWith("-active"),
                )
                .reduce((sum, [, highlights]) => sum + highlights.size, 0),
            );
      await expect.poll(highlightCount).toBeGreaterThan(0);
      if (format !== "EPUB") {
        await expect
          .poll(async () => {
            const bounds = await page.evaluate(() => {
              const entry = Array.from(CSS.highlights).find(
                ([key]) =>
                  key.startsWith("reader-search-") && key.endsWith("-active"),
              );
              const range = entry?.[1].values().next().value;
              const rect =
                range instanceof Range
                  ? range.getBoundingClientRect()
                  : undefined;
              return rect ? { top: rect.top, bottom: rect.bottom } : null;
            });
            const bar = await search.boundingBox();
            return (
              !!bounds &&
              bounds.top >= bar!.y + bar!.height &&
              bounds.bottom <= 900
            );
          })
          .toBe(true);
      }
      await page.screenshot({
        path: testInfo.outputPath(`search-${format}-${width}.png`),
      });
      expect((await search.boundingBox())!.width).toBeGreaterThan(width - 60);
      await input.fill("termo-inexistente-987");
      await input.press("Enter");
      await expect(count).toHaveText("0/0");
      await expect(next).toBeDisabled();
      await expect(previous).toBeDisabled();
      await expect.poll(highlightCount).toBe(0);
      await search.getByRole("button", { name: "Fechar busca" }).click();
      await expect(search).toHaveCount(0);
    });
  }
}
