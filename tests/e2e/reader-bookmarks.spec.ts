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

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 393, height: 852 },
]) {
  for (const format of ["PDF", "TXT", "DOCX"] as const) {
    test(`${format} bookmarks stay on their own pages while scrolling (${viewport.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await importBookmarkFile(page, format);
      const pageNumber = page.getByRole("spinbutton", {
        name: "Número da página",
      });
      const firstPage = page.locator('[data-reader-page="0"]');
      const secondPage = page.locator('[data-reader-page="1"]');
      const thirdPage = page.locator('[data-reader-page="2"]');
      const markPage = page.getByRole("button", {
        name: "Marcar página",
        exact: true,
      });
      const removeBookmark = page.getByRole("button", {
        name: "Remover marcador",
        exact: true,
      });

      await expect(pageNumber).toHaveValue("1");
      await markPage.click();
      await expect(removeBookmark).toHaveAttribute("aria-pressed", "true");
      await expect(firstPage.locator(".page-bookmark")).toHaveCount(1);
      await expect(secondPage.locator(".page-bookmark")).toHaveCount(0);
      await expect(thirdPage.locator(".page-bookmark")).toHaveCount(0);

      await secondPage.evaluate((node) =>
        node.scrollIntoView({ block: "start" }),
      );
      await expect(pageNumber).toHaveValue("2");
      await expect(markPage).toHaveAttribute("aria-pressed", "false");
      await expect(firstPage.locator(".page-bookmark")).toHaveCount(1);
      await expect(secondPage.locator(".page-bookmark")).toHaveCount(0);

      await markPage.click();
      await expect(firstPage.locator(".page-bookmark")).toHaveCount(1);
      await expect(secondPage.locator(".page-bookmark")).toHaveCount(1);
      await expect(thirdPage.locator(".page-bookmark")).toHaveCount(0);

      await firstPage.evaluate((node) =>
        node.scrollIntoView({ block: "start" }),
      );
      await expect(pageNumber).toHaveValue("1");
      await expect(removeBookmark).toHaveAttribute("aria-pressed", "true");
      await removeBookmark.click();
      await expect(firstPage.locator(".page-bookmark")).toHaveCount(0);
      await expect(secondPage.locator(".page-bookmark")).toHaveCount(1);

      await page.reload();
      await expect(firstPage.locator(".page-bookmark")).toHaveCount(0);
      await expect(secondPage.locator(".page-bookmark")).toHaveCount(1);
      await expect(thirdPage.locator(".page-bookmark")).toHaveCount(0);
    });
  }

  test(`EPUB bookmarks follow their saved location (${viewport.width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await importBookmarkFile(page, "EPUB");
    const nextPage = page.getByRole("button", {
      name: "Próxima página",
      exact: true,
    });
    const markPage = page.getByRole("button", {
      name: "Marcar página",
      exact: true,
    });
    const removeBookmark = page.getByRole("button", {
      name: "Remover marcador",
      exact: true,
    });
    await nextPage.click();
    await expect(page.locator(".reader-pagination")).toHaveText(
      /^[1-9]\d*% lido$/,
    );
    await markPage.click();
    await expect(removeBookmark).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".page-bookmark")).toHaveCount(1);
    await nextPage.click();
    await expect(markPage).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".page-bookmark")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Mostrar páginas e marcadores" })
      .click();
    await page
      .locator(".reader-left-panel .bookmark-link")
      .filter({ hasText: /^Página / })
      .click();
    await expect(removeBookmark).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".page-bookmark")).toHaveCount(1);
    await removeBookmark.click();
    await expect(markPage).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".page-bookmark")).toHaveCount(0);
    await markPage.click();
    await page.reload();
    await expect(page.locator(".epub-page")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(removeBookmark).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".page-bookmark")).toHaveCount(1);
    await nextPage.click();
    await expect(markPage).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".page-bookmark")).toHaveCount(0);
  });
}
