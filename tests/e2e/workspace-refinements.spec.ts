import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

test.afterEach(async ({ page }, testInfo) => {
  await mkdir(".impeccable/review/workspace-update", { recursive: true });
  await page.screenshot({
    path: `.impeccable/review/workspace-update/${testInfo.title.split(" ")[0]}.png`,
    fullPage: true,
  });
});

test.beforeEach(async ({ context }) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const name = "authjs.session-token";
  const value = await encode({
    secret: env.AUTH_SECRET,
    salt: name,
    token: {
      id: "00000000-0000-4000-8000-000000000001",
      sub: "00000000-0000-4000-8000-000000000001",
    },
  });
  await context.addCookies([{ name, value, url: "http://127.0.0.1:3000" }]);
  await context.route("**/api/library", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

test("empty library, collection edit and delete keep imported documents", async ({
  page,
}) => {
  await page.goto("/library");
  await expect(page.locator(".book-card")).toHaveCount(0);
  await page.goto("/collections");
  await page.getByRole("button", { name: "Nova coleção" }).click();
  await page.getByLabel("Nome da coleção").fill("Estudos");
  await page.getByRole("button", { name: "Criar coleção" }).click();
  await page.getByRole("button", { name: "Editar Estudos" }).click();
  await page.getByLabel("Nome da coleção").fill("Pesquisa");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { name: "Pesquisa" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir Pesquisa" }).click();
  await page
    .getByRole("button", { name: "Excluir coleção", exact: true })
    .click();
  await expect(page.locator(".collection-with-actions")).toHaveCount(0);
});

test("continuous reading updates pagination and mobile notes remain available", async ({
  page,
}) => {
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Leitura.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Capítulo\n\n" + "Um parágrafo para leitura contínua. ".repeat(800),
    ),
  });
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.locator(".book-cover-link").first().click();
  await expect(page.locator("[data-reader-page]").nth(1)).toBeAttached();
  await page
    .locator('[data-reader-page="1"]')
    .evaluate((node) => node.scrollIntoView());
  await expect(
    page.getByRole("spinbutton", { name: "Número da página" }),
  ).toHaveValue("2");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mostrar anotações" }).click();
  await expect(page.getByLabel("Sua anotação")).toBeVisible();
  await page.getByLabel("Sua anotação").fill("Nota no celular");
  await page.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(page.getByText("Nota no celular")).toBeVisible();
});

test("knowledge and settings controls match the shared system", async ({
  page,
}) => {
  await mkdir(".impeccable/review/workspace-update", { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["knowledge", "settings"]) {
      await page.goto(`/${route}`);
      await expect(page.locator("h1")).toBeVisible();
      await page.screenshot({
        path: `.impeccable/review/workspace-update/${route}-${width}.png`,
        fullPage: true,
      });
    }
  }
});

test("PDF scroll, arrows and Mantine annotation controls work together", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 3; i++) pdf.addPage([600, 800]).drawText(`Page ${i + 1}`);
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "Páginas.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.locator(".book-cover-link").click();
  await page
    .locator('[data-reader-page="1"]')
    .evaluate((node) => node.scrollIntoView());
  await expect(
    page.getByRole("spinbutton", { name: "Número da página" }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Número da página" }),
  ).toHaveValue("3");
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await expect(
    page.getByRole("slider", { name: "Espessura do traço" }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Espessura do traço" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("slider", { name: "Espessura do traço" }),
  ).toHaveAttribute("aria-valuenow", "3");
});
