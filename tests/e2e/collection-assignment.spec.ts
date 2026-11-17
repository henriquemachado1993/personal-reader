import { test, expect, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { initialState } from "../reader-fixture";
import { seedReaderLibrary } from "./seed-library";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ context }) => {
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

async function openCollectionAssignment(page: Page) {
  await page.goto("/library");
  await page
    .locator(".book-card")
    .filter({ hasText: "A metamorfose" })
    .getByRole("button", { name: "Opções do livro", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Adicionar à coleção" }).click();
  return page.getByRole("dialog", { name: "Organizar em coleções" });
}

for (const width of [1440, 393]) {
  test(`create a collection while assigning a book preserves selections (${width}px)`, async ({
    page,
    context,
  }, testInfo) => {
    await seedReaderLibrary(context);
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openCollectionAssignment(page);
    await expect(
      dialog.getByRole("checkbox", { name: "Literatura" }),
    ).toBeChecked();
    await dialog.getByRole("checkbox", { name: "Filosofia & ideias" }).check();
    const newCollection = dialog.getByRole("button", { name: "Nova coleção" });
    await newCollection.click();
    const collectionName = dialog.getByLabel("Nome da coleção");
    const create = dialog.getByRole("button", { name: "Criar e adicionar" });
    await expect(collectionName).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Concluir" })).toHaveCount(0);
    await expect(create).toBeDisabled();
    await collectionName.fill("   ");
    await expect(create).toBeDisabled();
    await collectionName.fill("Rascunho");
    await page.screenshot({ path: testInfo.outputPath("create-form.png") });
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(newCollection).toBeFocused();
    await expect(
      dialog.getByRole("checkbox", { name: "Rascunho" }),
    ).toHaveCount(0);
    await newCollection.click();
    await expect(collectionName).toBeEmpty();
    await collectionName.fill("  Ficção científica  ");
    await collectionName.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/library$/);
    for (const name of [
      "Literatura",
      "Filosofia & ideias",
      "Ficção científica",
    ])
      await expect(
        dialog.getByRole("checkbox", { name, exact: true }),
      ).toBeChecked();
    await expect(collectionName).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("collection-created.png"),
    });
    await dialog.getByRole("button", { name: "Concluir" }).click();
    await page.reload();
    const reopened = await openCollectionAssignment(page);
    for (const name of [
      "Literatura",
      "Filosofia & ideias",
      "Ficção científica",
    ])
      await expect(
        reopened.getByRole("checkbox", { name, exact: true }),
      ).toBeChecked();
  });

  test(`create the first collection without leaving the book (${width}px)`, async ({
    page,
    context,
  }) => {
    const snapshot = initialState();
    snapshot.collections = [];
    snapshot.documents = snapshot.documents.map((book) => ({
      ...book,
      collections: [],
    }));
    await seedReaderLibrary(context, snapshot);
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openCollectionAssignment(page);
    await expect(
      dialog.getByText("Você ainda não tem coleções. Crie a primeira abaixo."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Nova coleção" }).click();
    await dialog.getByLabel("Nome da coleção").fill("Minha primeira coleção");
    await dialog.getByRole("button", { name: "Criar e adicionar" }).click();
    await expect(
      dialog.getByRole("checkbox", { name: "Minha primeira coleção" }),
    ).toBeChecked();
    await expect(
      dialog.getByText("Você ainda não tem coleções. Crie a primeira abaixo."),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/library$/);
    await dialog.getByRole("button", { name: "Concluir" }).click();
    await page.goto("/collections");
    await page
      .locator(".collection-item")
      .filter({ hasText: "Minha primeira coleção" })
      .click();
    await expect(page.locator(".book-card")).toHaveCount(1);
    await expect(page.locator(".book-title")).toHaveText("A metamorfose");
  });
}
