import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { PDFDocument } from "pdf-lib";
import { seedReaderLibrary } from "./seed-library";

test.use({ isMobile: true, hasTouch: true });

test.beforeEach(async ({ context }) => {
  await seedReaderLibrary(context);
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
  await context.route("**/api/library", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

const viewportCases = [
  { name: "phone-safe", width: 393, height: 852, top: 59, bottom: 34, side: 0 },
  { name: "phone-zero", width: 320, height: 740, top: 0, bottom: 0, side: 0 },
  { name: "landscape", width: 852, height: 393, top: 0, bottom: 21, side: 59 },
  { name: "desktop", width: 1440, height: 1000, top: 0, bottom: 0, side: 0 },
];

for (const format of ["text", "pdf"] as const) {
  test(`${format} scrolls to the viewport edge while controls respect the safe area`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    if (format === "text") {
      await page.goto("/reader/dom-casmurro");
    } else {
      const pdf = await PDFDocument.create();
      for (let i = 0; i < 3; i++) {
        const pdfPage = pdf.addPage([600, 800]);
        for (let line = 0; line < 55; line++)
          pdfPage.drawText(`Reading line ${line + 1} on page ${i + 1}`, {
            x: 30,
            y: 770 - line * 14,
            size: 12,
          });
      }
      await page.goto("/library");
      await page
        .getByRole("button", { name: "Importar arquivos", exact: true })
        .click();
      await page.locator('input[type="file"]').setInputFiles({
        name: "Viewport.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(await pdf.save()),
      });
      await page.getByRole("button", { name: "Concluir", exact: true }).click();
      await page.getByRole("link", { name: "Viewport", exact: true }).click();
      await expect(page.locator(".pdf-page").first()).toHaveAttribute(
        "aria-busy",
        "false",
      );
    }
    await expect(page.locator(".reader-page").first()).toBeVisible();
    await mkdir(".impeccable/review/reader-edge", { recursive: true });
    for (const viewport of viewportCases) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      // Desktop Chromium does not provide iPhone safe-area env values.
      await page.evaluate(({ top, bottom, side }) => {
        const root = document.documentElement.style;
        root.setProperty("--app-safe-top", `${top}px`);
        root.setProperty("--app-safe-bottom", `${bottom}px`);
        root.setProperty("--app-safe-left", `${side}px`);
        root.setProperty("--app-safe-right", `${side}px`);
      }, viewport);
      await page
        .locator(".reader-scroll-area")
        .evaluate((node) => (node.scrollTop = 400));
      const geometry = await page.evaluate(() => {
        const box = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect().toJSON();
        return {
          scroll: box(".reader-scroll-area"),
          footer: box(".reader-footer"),
          documentHeight: document.documentElement.scrollHeight,
          edgeInReader: !!document
            .elementFromPoint(innerWidth / 2, innerHeight - 2)
            ?.closest(".reader-scroll-area"),
        };
      });
      expect(geometry.scroll.top).toBe(viewport.top);
      expect(geometry.scroll.bottom).toBeCloseTo(viewport.height, 0);
      expect(geometry.footer.bottom).toBeLessThanOrEqual(
        viewport.height - viewport.bottom + 1,
      );
      expect(geometry.documentHeight).toBeLessThanOrEqual(viewport.height);
      expect(geometry.edgeInReader).toBe(true);
      await page.screenshot({
        path: `.impeccable/review/reader-edge/${format}-${viewport.name}.png`,
      });
    }
    await page.goto("/library");
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--app-safe-bottom", "34px"),
    );
    await expect(page.locator("body")).toHaveCSS("padding-bottom", "34px");
  });
}
