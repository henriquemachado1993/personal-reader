import { test, expect } from "@playwright/test";

test("Mantine emits deterministic CSS variables and hydrates without mismatches", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|didn't match|did not match/i.test(message.text())
    )
      hydrationErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/hydrat/i.test(error.message)) hydrationErrors.push(error.message);
  });
  const server = await page.request.get("/forgot-password");
  const markup = await server.text();
  expect(markup).toContain("--mantine-scale: 1.1428571428571428");
  // Keeping default variables makes this output independent of deduplication's baseline.
  expect(markup).toContain("--mantine-color-white: #fff");
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Recupere seu acesso" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "E-mail" })
    .fill("reader@example.test");
  await page.getByRole("link", { name: "Voltar para entrar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(hydrationErrors).toEqual([]);
});
