import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { PDFDocument, rgb } from "pdf-lib";
import { seedReaderLibrary } from "./seed-library";
import { chooseAnnotationTool } from "./annotation-tools";

test.use({ serviceWorkers: "block" });
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
  await context.route(/\/api\/library(?:\/|\?|$)/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

for (const width of [1440, 393]) {
  test(`${width}px: new PDF marks save their exact excerpt or a bounded visual preview`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const pdf = await PDFDocument.create();
    const sheet = pdf.addPage([600, 800]);
    sheet.drawText("Antes ALVO depois", { x: 40, y: 650, size: 24 });
    sheet.drawText("Antes NOVO depois", { x: 40, y: 550, size: 24 });
    sheet.drawRectangle({
      x: 40,
      y: 450,
      width: 160,
      height: 60,
      color: rgb(0.7, 0.2, 0.1),
    });
    await page.goto("/library");
    await page
      .getByRole("button", { name: "Importar arquivos", exact: true })
      .click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "Trechos.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
    await page.getByRole("link", { name: "Trechos", exact: true }).click();
    await expect(page.locator(".pdf-page")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page
      .getByRole("button", { name: "Fechar mensagem", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir ferramentas de anotação" })
      .click();
    for (const [tool, word] of [
      ["Marca-texto", "ALVO"],
      ["Sublinhar", "depois"],
    ]) {
      await chooseAnnotationTool(page, tool);
      const box = await page
        .locator(".textLayer span")
        .filter({ hasText: "Antes ALVO depois" })
        .evaluate((element, word) => {
          const node = element.firstChild!;
          const offset = node.textContent!.indexOf(word);
          const range = document.createRange();
          range.setStart(node, offset);
          range.setEnd(node, offset + word.length);
          return range.getBoundingClientRect().toJSON();
        }, word);
      const underline = tool === "Sublinhar";
      await page.mouse.move(
        box.left + 0.5,
        underline ? box.bottom + 1 : box.top + 0.5,
      );
      await page.mouse.down();
      await page.mouse.move(
        box.right - 0.5,
        underline ? box.bottom + 1 : box.bottom - 0.5,
        { steps: 3 },
      );
      await page.mouse.up();
    }
    await chooseAnnotationTool(page, "Retângulo");
    const bounds = (await page.locator(".annotation-overlay").boundingBox())!;
    await page.mouse.move(
      bounds.x + bounds.width * 0.06,
      bounds.y + bounds.height * 0.35,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width * 0.35,
      bounds.y + bounds.height * 0.45,
      { steps: 3 },
    );
    await page.mouse.up();
    await page
      .getByRole("button", { name: "Fechar ferramentas de anotação" })
      .click();
    await page.getByRole("button", { name: "Mostrar anotações" }).click();
    const entries = page.locator(".panel-annotations article");
    const highlights = entries.filter({
      has: page.getByText("Destaque", { exact: true }),
    });
    const underlines = entries.filter({
      has: page.getByText("Sublinhado", { exact: true }),
    });
    const rectangles = entries.filter({
      has: page.getByText("Retângulo", { exact: true }),
    });
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(0).locator(".reader-note-kind")).toHaveText(
      "Destaque",
    );
    await expect(entries.nth(0).locator("blockquote")).toHaveText("ALVO");
    await expect(entries.nth(1).locator(".reader-note-kind")).toHaveText(
      "Sublinhado",
    );
    await expect(entries.nth(1).locator("blockquote")).toHaveText("depois");
    await expect(entries.nth(2).locator(".reader-note-kind")).toHaveText(
      "Retângulo",
    );
    const preview = entries.nth(2).getByRole("img");
    await preview.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        preview.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);
    const dimensions = await preview.evaluate((element: HTMLImageElement) => ({
      width: element.naturalWidth,
      height: element.naturalHeight,
    }));
    expect(dimensions.width).toBeLessThanOrEqual(480);
    expect(dimensions.height).toBeLessThanOrEqual(240);
    await page.screenshot({
      path: testInfo.outputPath(`excerpts-${width}.png`),
    });
    await page
      .getByRole("button", { name: "Fechar anotações", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir ferramentas de anotação" })
      .click();
    await chooseAnnotationTool(page, "Selecionar texto");
    const highlight = (await page
      .locator('.annotation-overlay rect[fill-opacity="0.3"]')
      .boundingBox())!;
    const destination = await page
      .locator(".textLayer span")
      .filter({ hasText: "Antes NOVO depois" })
      .evaluate((element) => {
        const range = document.createRange();
        range.setStart(element.firstChild!, 6);
        range.setEnd(element.firstChild!, 10);
        return range.getBoundingClientRect().toJSON();
      });
    await page.mouse.move(
      highlight.x + highlight.width / 2,
      highlight.y + highlight.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + destination.height / 2,
      { steps: 3 },
    );
    await page.mouse.up();
    await page
      .getByRole("button", { name: "Fechar ferramentas de anotação" })
      .click();
    await page.getByRole("button", { name: "Mostrar anotações" }).click();
    await expect(highlights.locator("blockquote")).toHaveText("NOVO");
    await page.reload();
    await page.getByRole("button", { name: "Mostrar anotações" }).click();
    await expect(highlights.locator("blockquote")).toHaveText("NOVO");
    await expect(underlines.locator("blockquote")).toHaveText("depois");
    await expect(rectangles.getByRole("img")).toHaveAttribute(
      "src",
      /^data:image\/webp/,
    );
  });
}
