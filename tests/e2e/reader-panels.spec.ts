import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";

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
  { name: "iphone", width: 393, height: 852 },
  { name: "small-phone", width: 320, height: 740 },
  { name: "landscape", width: 852, height: 393 },
]) {
  test(`${viewport.name}: pages, bookmarks and notes remain usable while scrolling`, async ({
    page,
  }) => {
    await mkdir(".impeccable/review/reader-panels", { recursive: true });
    await page.setViewportSize(viewport);
    await page.goto("/reader/dom-casmurro");
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
      page.getByRole("spinbutton", { name: "Número da página" }),
    ).toHaveValue("3");
    await pages.getByRole("button", { name: "Página 2", exact: true }).click();
    await expect(
      page.getByRole("spinbutton", { name: "Número da página" }),
    ).toHaveValue("2");
    await pages
      .locator(".reader-panel-content")
      .evaluate((node) => (node.scrollTop = node.scrollHeight));
    await expect(
      pages.getByRole("button", { name: "Fechar páginas", exact: true }),
    ).toBeVisible();
    let bounds = (await pages.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: `.impeccable/review/reader-panels/pages-${viewport.name}.png`,
    });
    await pages.getByRole("button", { name: "Anotações deste livro" }).click();
    const notes = page.getByRole("complementary", {
      name: "Anotações do livro",
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

test("a drawing does not suppress the empty state of the notes list", async ({
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
  await expect(
    page.getByText("Suas ideias começam com uma anotação."),
  ).toBeVisible();
});
