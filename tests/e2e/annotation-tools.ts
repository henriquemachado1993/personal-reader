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
