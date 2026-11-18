import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { chooseAnnotationTool } from "./annotation-tools";

test.use({ serviceWorkers: "block", hasTouch: true });
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

test("night reading starts text with a legible color", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await page.goto("/reader/metamorfose");
  await page.getByRole("button", { name: "Ajustar aparência" }).click();
  await page.getByRole("button", { name: "Tema noturno", exact: true }).click();
  await page.getByRole("button", { name: "Fechar aparência" }).click();
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await chooseAnnotationTool(page, "Inserir texto");
  await page
    .locator('.reader-page[aria-current="page"] .annotation-overlay')
    .tap({ position: { x: 60, y: 180 } });
  const editor = page.getByRole("dialog", {
    name: "Inserir texto na página",
    exact: true,
  });
  await editor
    .getByRole("textbox", { name: "Texto na página" })
    .fill("Texto noturno");
  await editor
    .getByRole("button", { name: "Salvar texto", exact: true })
    .click();
  await expect(page.locator(".annotation-overlay text")).toHaveAttribute(
    "fill",
    "#ece5d8",
  );
  await page.screenshot({ path: testInfo.outputPath("night-text.png") });
});

for (const width of [1440, 393]) {
  test(`${width}px: text supports tap placement, multiline editing, resize and cancellation`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/reader/metamorfose");
    await page
      .getByRole("button", { name: "Abrir ferramentas de anotação" })
      .click();
    const options = page.locator(".annotation-options");
    await expect(options).toBeHidden();
    await chooseAnnotationTool(page, "Inserir texto");
    await expect(options).toBeVisible();
    await expect(options).toHaveCSS("border-top-width", "1px");
    const overlay = page.locator(
      '.reader-page[aria-current="page"] .annotation-overlay',
    );
    await overlay.tap({ position: { x: 70, y: 180 } });
    const editor = page.getByRole("dialog", {
      name: "Inserir texto na página",
      exact: true,
    });
    const input = editor.getByRole("textbox", { name: "Texto na página" });
    await expect(input).toBeFocused();
    await input.fill("Olá, mundo!\nSegunda linha.");
    await input.press("Shift+Tab");
    await expect(
      editor.getByRole("button", { name: "Salvar texto", exact: true }),
    ).toBeFocused();
    await editor
      .getByRole("button", { name: "Salvar texto", exact: true })
      .press("Tab");
    await expect(input).toBeFocused();
    await editor
      .getByRole("spinbutton", { name: "Tamanho do texto" })
      .fill("22");
    await page.screenshot({
      path: testInfo.outputPath(`text-editor-${width}.png`),
    });
    await editor
      .getByRole("button", { name: "Salvar texto", exact: true })
      .click();
    const object = overlay.locator("text");
    await expect(object).toHaveAttribute(
      "aria-label",
      "Olá, mundo!\nSegunda linha.",
    );
    await expect(object.locator("tspan")).toHaveCount(2);
    expect(Number(await object.getAttribute("font-size"))).toBeCloseTo(22, 0);
    await page
      .getByRole("button", { name: "Editar texto", exact: true })
      .click();
    const editing = page.getByRole("dialog", {
      name: "Editar texto na página",
      exact: true,
    });
    await editing
      .getByRole("textbox", { name: "Texto na página" })
      .fill("Texto editado 📚");
    await editing
      .getByRole("textbox", { name: "Texto na página" })
      .press("Control+Enter");
    await expect(object).toHaveAttribute("aria-label", "Texto editado 📚");
    const frame = overlay.locator(".annotation-object-selection > rect");
    const originalWidth = Number(await frame.getAttribute("width"));
    const resize = page.getByRole("button", {
      name: "Redimensionar texto",
      exact: true,
    });
    await resize.focus();
    await resize.press("ArrowLeft");
    await expect
      .poll(async () => Number(await frame.getAttribute("width")))
      .toBeLessThan(originalWidth);
    await page.getByRole("button", { name: "Desfazer anotação" }).click();
    await expect
      .poll(async () => Number(await frame.getAttribute("width")))
      .toBeCloseTo(originalWidth, 0);
    await page
      .getByRole("button", { name: "Editar texto", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Texto na página" })
      .fill("Não salvar");
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Texto na página" })
      .press("Escape");
    await expect(object).toHaveAttribute("aria-label", "Texto editado 📚");
    await page.reload();
    await expect(page.locator(".annotation-overlay text")).toHaveAttribute(
      "aria-label",
      "Texto editado 📚",
    );
  });

  test(`${width}px: images preview, preserve proportions, resize and recover from invalid files`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/reader/metamorfose");
    await page
      .getByRole("button", { name: "Abrir ferramentas de anotação" })
      .click();
    const imageData = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 800;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#6a997d";
      context.fillRect(0, 0, 2400, 800);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const chooser = page.waitForEvent("filechooser");
    await chooseAnnotationTool(page, "Inserir imagem");
    await (
      await chooser
    ).setFiles({
      name: "Wide image.png",
      mimeType: "image/png",
      buffer: Buffer.from(imageData, "base64"),
    });
    await expect(
      page.getByRole("img", { name: "Prévia da imagem a inserir" }),
    ).toBeVisible();
    const overlay = page.locator(
      '.reader-page[aria-current="page"] .annotation-overlay',
    );
    await overlay.click({ position: { x: 60, y: 250 } });
    const image = overlay.locator("image");
    await expect(image).toHaveCount(1);
    const before = (await image.boundingBox())!;
    expect(before.width / before.height).toBeCloseTo(3, 1);
    const resize = page.getByRole("button", {
      name: "Redimensionar imagem",
      exact: true,
    });
    await resize.focus();
    await resize.press("Shift+ArrowRight");
    await expect
      .poll(async () => (await image.boundingBox())!.width)
      .toBeGreaterThan(before.width);
    const after = (await image.boundingBox())!;
    expect(after.width / after.height).toBeCloseTo(3, 1);
    const source = await image.getAttribute("href");
    const dimensions = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source!;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, source);
    expect(Math.max(dimensions.width, dimensions.height)).toBeLessThanOrEqual(
      1600,
    );
    await page.screenshot({
      path: testInfo.outputPath(`image-selected-${width}.png`),
    });
    const invalidChooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Trocar imagem", exact: true })
      .click();
    await (
      await invalidChooser
    ).setFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await expect(
      page.locator('.annotation-toolbar [role="alert"]'),
    ).toContainText("Não foi possível abrir esta imagem");
    await expect(image).toHaveAttribute("href", source!);
    const replacementData = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 600;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#7f9fc4";
      context.fillRect(0, 0, 300, 600);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const replacementChooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Trocar imagem", exact: true })
      .click();
    await (
      await replacementChooser
    ).setFiles({
      name: "Tall image.png",
      mimeType: "image/png",
      buffer: Buffer.from(replacementData, "base64"),
    });
    await expect(image).not.toHaveAttribute("href", source!);
    await expect(
      page.locator('.annotation-toolbar [role="alert"]'),
    ).toHaveCount(0);
    const replacementBounds = (await image.boundingBox())!;
    expect(replacementBounds.width / replacementBounds.height).toBeCloseTo(
      0.5,
      1,
    );
    await expect(image).toHaveAttribute("href", /^blob:/);
    const replacementBytes = await image.evaluate(async (element) =>
      Array.from(
        new Uint8Array(
          await (await fetch(element.getAttribute("href")!)).arrayBuffer(),
        ),
      ),
    );
    await page
      .getByRole("button", { name: "Remover objeto selecionado" })
      .click();
    await expect(image).toHaveCount(0);
    await page.getByRole("button", { name: "Desfazer anotação" }).click();
    await expect(image).toHaveCount(1);
    await page.reload();
    const restored = page.locator(".annotation-overlay image");
    await expect(restored).toHaveAttribute("href", /^blob:/);
    const restoredBytes = await restored.evaluate(async (element) => {
      const response = await fetch(element.getAttribute("href")!);
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    });
    expect(restoredBytes).toEqual(replacementBytes);
  });
}
