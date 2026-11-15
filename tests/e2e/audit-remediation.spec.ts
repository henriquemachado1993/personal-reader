import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";

test.beforeEach(async ({ context }) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const name = "authjs.session-token";
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: name,
    token: { id: "00000000-0000-4000-8000-000000000001", name: "QA" },
  });
  await context.addCookies([
    { name, value: token, url: "http://127.0.0.1:3000", httpOnly: true },
  ]);
  await context.route("**/api/library", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});
test("320px navigation remains inside the physical viewport and opens by touch", async ({
  browser,
  context,
}) => {
  const mobile = await browser.newContext({
    viewport: { width: 320, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  await mobile.addCookies(await context.cookies());
  await mobile.route("**/api/library", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  const page = await mobile.newPage();
  try {
    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: "Biblioteca", exact: true }),
    ).toBeVisible();
    const menu = page.getByRole("button", { name: "Mais opções", exact: true });
    const bounds = await menu.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await menu.tap();
    await expect(page.getByRole("menu")).toBeVisible();
    await page
      .getByRole("menuitem", { name: "Configurações", exact: true })
      .tap();
    await expect(page).toHaveURL(/settings$/);
    await mkdir(".impeccable/review/remediation", { recursive: true });
    await page.screenshot({
      path: ".impeccable/review/remediation/narrow-settings.png",
      animations: "disabled",
    });
  } finally {
    await mobile.close();
  }
});
test("filters expose selection and reset without a token offers a new link", async ({
  page,
}) => {
  await page.goto("/knowledge");
  await page.getByRole("button", { name: "Destaques", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Destaques", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Tudo/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.goto("/reset-password");
  await expect(
    page.getByRole("alert").filter({ hasText: "Este link de recuperação" }),
  ).toContainText("inválido");
  await page.getByRole("link", { name: "Solicitar outro link" }).click();
  await expect(page).toHaveURL(/forgot-password$/);
});

test("configured database does not claim successful synchronization", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: { database: true, storage: true },
    }),
  );
  await page.goto("/settings");
  await expect(
    page.getByText(
      "Conexão configurada. Consulte o estado da sincronização acima.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Biblioteca sincronizada com sua conta", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("time")).toHaveCount(0);
});
test("editing history restores moved objects and deleted final annotation", async ({
  page,
}) => {
  await page.goto("/reader/metamorfose");
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await page
    .getByRole("button", { name: "Inserir texto", exact: true })
    .click();
  await page.getByLabel("Texto", { exact: true }).fill("Objeto para desfazer");
  const box = (await page.locator(".annotation-overlay").boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 150);
  await page.mouse.up();
  const object = page.locator(".annotation-overlay text");
  await expect(object).toBeVisible();
  const originalX = await object.getAttribute("x");
  const shape = (await object.boundingBox())!;
  await page.mouse.move(shape.x + 5, shape.y + 5);
  await page.mouse.down();
  await page.mouse.move(shape.x + 45, shape.y + 25);
  await page.mouse.up();
  await expect(object).not.toHaveAttribute("x", originalX!);
  await page.getByRole("button", { name: "Desfazer anotação" }).click();
  await expect(object).toHaveAttribute("x", originalX!);
  await page.getByRole("button", { name: "Borracha", exact: true }).click();
  await object.click();
  await expect(object).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Desfazer anotação" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Desfazer anotação" }).click();
  await expect(object).toBeVisible();
});

test("reader keeps contrast, inline pagination and accessible colors across themes", async ({
  page,
}) => {
  await mkdir(".impeccable/review/remediation", { recursive: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await page.goto("/reader/dom-casmurro");
  const ink = await page
    .locator(".reader-title strong")
    .evaluate((e) => getComputedStyle(e).color);
  expect(ink).not.toBe("rgb(245, 245, 245)");
  const field = (await page
    .getByRole("spinbutton", { name: "Número da página" })
    .boundingBox())!;
  const total = (await page
    .locator(".reader-pagination label > span")
    .boundingBox())!;
  expect(
    Math.abs(field.y + field.height / 2 - total.y - total.height / 2),
  ).toBeLessThan(10);
  await page.screenshot({
    path: ".impeccable/review/remediation/desktop-reader-dark.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await page.getByRole("button", { name: "Cor Rosa", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cor Rosa", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    (await page.getByLabel("Espessura do traço").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await page.getByLabel("Espessura do traço").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Espessura do traço")).toHaveValue("3");
  await page.screenshot({
    path: ".impeccable/review/remediation/mobile-reader-tools.png",
    animations: "disabled",
  });
});
