import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { PDFDocument } from "pdf-lib";

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

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "ipad", width: 820, height: 1180 },
  { name: "ipad-landscape", width: 1180, height: 820 },
  { name: "iphone", width: 393, height: 852 },
  { name: "small-phone", width: 320, height: 740 },
  { name: "landscape", width: 852, height: 393 },
  { name: "ipad-dark", width: 820, height: 1180, dark: true },
]) {
  test(`${viewport.name}: pages, bookmarks and notes remain usable while scrolling`, async ({
    page,
  }) => {
    await mkdir(".impeccable/review/reader-panels", { recursive: true });
    await page.setViewportSize(viewport);
    if ("dark" in viewport) {
      await page.goto("/settings");
      await page.getByRole("button", { name: "Escuro", exact: true }).click();
    }
    await page.goto("/reader/dom-casmurro");
    if ("dark" in viewport) {
      await page.getByRole("button", { name: "Ajustar aparência" }).click();
      await page
        .getByRole("button", { name: "Tema noturno", exact: true })
        .click();
      await page.getByRole("button", { name: "Fechar aparência" }).click();
    }
    await page
      .getByRole("button", { name: "Marcar página", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mostrar páginas e marcadores" })
      .click();
    const pages = page.getByRole("complementary", {
      name: "Páginas e marcadores",
    });
    await expect(pages.locator('[aria-current="page"]')).toContainText(
      "Do livro",
    );
    await pages.locator(".page-navigation-list button").nth(2).click();
    await expect(
      page.getByRole("spinbutton", {
        name: "Número da página",
        includeHidden: true,
      }),
    ).toHaveValue("3");
    await page.screenshot({
      path: `.impeccable/review/reader-panels/navigation-${viewport.name}.png`,
    });
    await pages.getByRole("tab", { name: "Marcadores", exact: true }).click();
    await pages.getByRole("button", { name: "Página 2", exact: true }).click();
    await expect(
      page.getByRole("spinbutton", {
        name: "Número da página",
        includeHidden: true,
      }),
    ).toHaveValue("2");
    await pages
      .getByRole("tabpanel", { name: "Marcadores", exact: true })
      .evaluate((node) => (node.scrollTop = node.scrollHeight));
    await expect(
      pages.getByRole("button", { name: "Fechar páginas", exact: true }),
    ).toBeVisible();
    let bounds = (await pages.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width >= 1100) {
      const readingArea = (await page
        .locator(".reader-scroll-area")
        .boundingBox())!;
      expect(readingArea.x).toBeGreaterThanOrEqual(bounds.x + bounds.width);
    }
    await page.screenshot({
      path: `.impeccable/review/reader-panels/pages-${viewport.name}.png`,
    });
    await pages.getByRole("button", { name: "Anotações deste livro" }).click();
    const notes = page.getByRole("complementary", {
      name: "Anotações do livro",
    });
    await expect(pages).toHaveCount(0);
    await expect(notes.locator(".note-page-label")).toHaveText("Página 2");
    const footer = page.locator(".reader-footer");
    if (viewport.width < 700) {
      await expect(footer).toBeHidden();
    } else {
      const panelBounds = (await notes.boundingBox())!;
      const navigationBounds = (await footer
        .locator(".page-filmstrip")
        .boundingBox())!;
      expect(navigationBounds.x + navigationBounds.width).toBeLessThanOrEqual(
        panelBounds.x,
      );
      const counterBounds = (await page
        .locator(".reader-page-counter")
        .boundingBox())!;
      expect(counterBounds.x + counterBounds.width).toBeLessThanOrEqual(
        panelBounds.x,
      );
    }
    await page.screenshot({
      path: `.impeccable/review/reader-panels/empty-notes-${viewport.name}.png`,
    });
    await expect(
      notes.getByText("Suas ideias começam com uma anotação."),
    ).toBeVisible();
    await notes
      .getByRole("textbox", { name: "Sua anotação" })
      .fill("Uma reflexão para retomar. ".repeat(20) + "x".repeat(200));
    await notes.getByRole("button", { name: "Salvar anotação" }).click();
    await expect(notes.locator(".panel-annotations article")).toHaveCount(1);
    await expect(
      notes.getByText("Suas ideias começam com uma anotação."),
    ).toHaveCount(0);
    await notes
      .locator(".reader-panel-content")
      .evaluate((node) => (node.scrollTop = node.scrollHeight));
    await expect(
      notes.getByRole("button", { name: "Fechar anotações", exact: true }),
    ).toBeVisible();
    expect(
      await notes
        .locator(".reader-panel-content")
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    bounds = (await notes.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: `.impeccable/review/reader-panels/notes-${viewport.name}.png`,
    });
    await notes.getByRole("button", { name: "Remover anotação" }).click();
    await expect(
      notes.getByText("Suas ideias começam com uma anotação."),
    ).toBeVisible();
    await notes
      .getByRole("button", { name: "Fechar anotações", exact: true })
      .click();
    await expect(notes).toHaveCount(0);
  });
}

test("long PDF navigation reveals the current page and preserves it when panels switch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pdf = await PDFDocument.create();
  for (let index = 1; index <= 60; index++)
    pdf
      .addPage([600, 800])
      .drawText(`Reading page ${index}`, { x: 40, y: 740 });
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Panel navigation.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page
    .getByRole("link", { name: "Panel navigation", exact: true })
    .click();
  const pageNumber = page.getByRole("spinbutton", { name: "Número da página" });
  await pageNumber.fill("60");
  await expect(
    page.locator('[data-reader-page="59"] .pdf-page'),
  ).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("button", { name: "Mostrar páginas e marcadores" })
    .click();
  const pages = page.getByRole("complementary", {
    name: "Páginas e marcadores",
  });
  await expect(pages.locator('[aria-current="page"]')).toContainText(
    "Página 60",
  );
  await expect(pages.locator('[aria-current="page"]')).toBeInViewport();
  await expect(pageNumber).toHaveValue("60");
  await page.getByRole("button", { name: "Mostrar anotações" }).click();
  await expect(pages).toHaveCount(0);
  await expect(page.locator(".note-page-label")).toHaveText("Página 60");
  await page
    .getByRole("button", { name: "Fechar anotações", exact: true })
    .click();
  await expect(pageNumber).toHaveValue("60");
});

for (const width of [820, 393]) {
  test(`${width}px: panels switch without losing the draft or selected tab`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/reader/dom-casmurro");
    const navigationToggle = page.getByRole("button", {
      name: "Mostrar páginas e marcadores",
    });
    const notesToggle = page.getByRole("button", { name: "Mostrar anotações" });
    const pages = page.getByRole("complementary", {
      name: "Páginas e marcadores",
    });
    const notes = page.getByRole("complementary", {
      name: "Anotações do livro",
    });
    await notesToggle.click();
    await notes
      .getByRole("textbox", { name: "Sua anotação" })
      .fill("Uma ideia ainda em andamento.");
    await navigationToggle.click();
    await expect(notes).toHaveCount(0);
    await expect(notesToggle).toHaveAttribute("aria-expanded", "false");
    await pages.getByRole("tab", { name: "Marcadores", exact: true }).click();
    await pages
      .getByRole("tab", { name: "Marcadores", exact: true })
      .press("ArrowLeft");
    await expect(
      pages.getByRole("tab", { name: "Páginas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await pages.getByRole("tab", { name: "Marcadores", exact: true }).click();
    await notesToggle.click();
    await expect(pages).toHaveCount(0);
    const draft = notes.getByRole("textbox", { name: "Sua anotação" });
    await expect(draft).toHaveValue("Uma ideia ainda em andamento.");
    await draft.focus();
    await draft.press("Escape");
    await expect(notes).toHaveCount(0);
    await expect(notesToggle).toBeFocused();
    await navigationToggle.click();
    await expect(
      pages.getByRole("tab", { name: "Marcadores", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await pages
      .getByRole("button", { name: "Fechar páginas", exact: true })
      .click();
    await expect(navigationToggle).toBeFocused();
    await notesToggle.click();
    await expect(
      notes.getByRole("textbox", { name: "Sua anotação" }),
    ).toHaveValue("Uma ideia ainda em andamento.");
  });
}

test("freehand markings appear in the annotations list with their tool identified", async ({
  page,
}) => {
  await page.goto("/reader/dom-casmurro");
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await page.getByRole("button", { name: "Caneta", exact: true }).click();
  const surface = (await page
    .locator('.reader-page[aria-current="page"] .annotation-overlay')
    .boundingBox())!;
  await page.mouse.move(surface.x + 80, surface.y + 100);
  await page.mouse.down();
  await page.mouse.move(surface.x + 160, surface.y + 150, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".annotation-overlay polyline")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Fechar ferramentas de anotação" })
    .click();
  await page.getByRole("button", { name: "Mostrar anotações" }).click();
  const notes = page.getByRole("complementary", { name: "Anotações do livro" });
  await expect(notes.locator(".reader-note-kind")).toHaveText("Caneta");
  await expect(notes.locator(".annotation-excerpt")).toContainText(
    "Marcação sem trecho salvo",
  );
  await expect(
    notes.getByText("Suas ideias começam com uma anotação."),
  ).toHaveCount(0);
});
