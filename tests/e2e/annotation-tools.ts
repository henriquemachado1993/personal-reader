import type { Page } from "@playwright/test";

export async function chooseAnnotationTool(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    await page
      .getByRole("button", { name: "Mais ferramentas", exact: true })
      .click();
  }
  await button.click();
}

export async function insertTextAnnotation(page: Page, text: string) {
  await chooseAnnotationTool(page, "Inserir texto");
  await page
    .locator('.reader-page[aria-current="page"] .annotation-overlay')
    .click({ position: { x: 60, y: 100 } });
  const editor = page.getByRole("dialog", {
    name: "Inserir texto na página",
    exact: true,
  });
  await editor
    .getByRole("textbox", { name: "Texto na página", exact: true })
    .fill(text);
  await editor
    .getByRole("button", { name: "Salvar texto", exact: true })
    .click();
}
