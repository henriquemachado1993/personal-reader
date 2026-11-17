import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { seedReaderLibrary } from "./seed-library";
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
  test(`PDF highlights align with the exact searched glyphs (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const sheet = pdf.addPage([600, 800]);
    const sizes = [12, 26, 42];
    const expected = sizes.map((size, index) => {
      const x = 40 + font.widthOfTextAtSize("Antes ", size);
      sheet.drawText("Antes ", {
        x: 40,
        y: 720 - index * 100,
        size,
        font,
      });
      sheet.drawText("ALVO", { x, y: 720 - index * 100, size, font });
      sheet.drawText(" outras palavras", {
        x: x + font.widthOfTextAtSize("ALVO", size),
        y: 720 - index * 100,
        size,
        font,
      });
      return { left: x, width: font.widthOfTextAtSize("ALVO", size) };
    });
    await page.goto("/library");
    await page
      .getByRole("button", { name: "Importar arquivos", exact: true })
      .click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "Alinhamento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
    await page.getByRole("link", { name: "Alinhamento", exact: true }).click();
    await expect(page.locator(".pdf-page")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    // Already rendered layers may only have the original scale variable.
    await page.locator(".textLayer").evaluate((layer) => {
      (layer as HTMLElement).style.removeProperty("--total-scale-factor");
    });
    await page
      .getByRole("button", { name: "Buscar no documento", exact: true })
      .click();
    await page.getByLabel("Buscar texto neste documento").fill("ALVO");
    await page.getByLabel("Buscar texto neste documento").press("Enter");
    await expect(page.getByLabel("Ocorrências encontradas")).toHaveText("1/3");
    await expect
      .poll(() =>
        page.evaluate(() => CSS.highlights.get("reader-search-0")?.size ?? 0),
      )
      .toBe(3);
    const actual = await page.evaluate(() => {
      const canvas = document
        .querySelector(".pdf-page canvas")!
        .getBoundingClientRect();
      const scale = canvas.width / 600;
      return Array.from(CSS.highlights.get("reader-search-0")!).map((range) => {
        const rect = (range as Range).getBoundingClientRect();
        return {
          text: range.toString(),
          left: (rect.left - canvas.left) / scale,
          width: rect.width / scale,
        };
      });
    });
    for (let index = 0; index < expected.length; index++) {
      expect(actual[index].text).toBe("ALVO");
      expect(Math.abs(actual[index].left - expected[index].left)).toBeLessThan(
        2,
      );
      expect(
        Math.abs(actual[index].width - expected[index].width),
      ).toBeLessThan(2);
    }
  });
}
