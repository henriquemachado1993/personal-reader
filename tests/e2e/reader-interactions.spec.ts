import { chooseAnnotationTool } from "./annotation-tools";
import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { PDFDocument } from "pdf-lib";
import { seedReaderLibrary } from "./seed-library";

test.use({ actionTimeout: 5000 });

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

for (const device of [
  { name: "iphone", width: 393, height: 852 },
  { name: "ipad", width: 820, height: 1180 },
]) {
  test.describe(device.name, () => {
    test.use({ isMobile: true, hasTouch: true, viewport: device });
    for (const format of ["text", "pdf"]) {
      test(`${format}: controls, rotation, scrolling and persistence`, async ({
        page,
        context,
      }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        if (format === "pdf") {
          const pdf = await PDFDocument.create();
          for (let i = 1; i <= 8; i++)
            pdf
              .addPage([600, 800])
              .drawText(`Reading page ${i}`, { x: 50, y: 650 });
          await page.goto("/library");
          await page
            .getByRole("button", { name: "Importar arquivos", exact: true })
            .click();
          await page.locator('input[type="file"]').setInputFiles({
            name: "Rotation.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from(await pdf.save()),
          });
          await page
            .getByRole("button", { name: "Concluir", exact: true })
            .click();
          await page
            .getByRole("link", { name: "Rotation", exact: true })
            .click();
          await expect(page.locator(".pdf-page").first()).toHaveAttribute(
            "aria-busy",
            "false",
          );
          await page.getByRole("button", { name: "Fechar mensagem" }).click();
        } else await page.goto("/reader/dom-casmurro");
        const input = page.getByRole("spinbutton", {
          name: "Número da página",
          includeHidden: true,
        });
        await expect(input).toBeVisible();
        const cdp = await context.newCDPSession(page);
        await mkdir(".impeccable/review/reader-interactions", {
          recursive: true,
        });
        for (const landscape of [false, true, false]) {
          const width = landscape ? device.height : device.width;
          const height = landscape ? device.width : device.height;
          const pageBeforeRotation = await input.inputValue();
          await page.setViewportSize({ width, height });
          await page.evaluate(async () => {
            for (let frame = 0; frame < 4; frame++)
              await new Promise(requestAnimationFrame);
          });
          await expect(input).toHaveValue(pageBeforeRotation);
          await expect
            .poll(async () => {
              const bounds = await page
                .locator(
                  `[data-reader-page="${Number(pageBeforeRotation) - 1}"]`,
                )
                .boundingBox();
              return (
                !!bounds && bounds.y < height && bounds.y + bounds.height > 0
              );
            })
            .toBe(true);
          await input.fill("1");
          await input.blur();
          await expect(
            page.getByRole("button", { name: "Página anterior", exact: true }),
          ).toBeDisabled();
          await page
            .getByRole("button", { name: "Próxima página", exact: true })
            .tap();
          await expect(input).toHaveValue("2");
          await page
            .getByRole("button", { name: "Página anterior", exact: true })
            .tap();
          await expect(input).toHaveValue("1");
          await page
            .getByRole("button", { name: "Ir para página 3", exact: true })
            .tap();
          await expect(input).toHaveValue("3");
          await page
            .getByRole("button", { name: "Marcar página", exact: true })
            .tap();
          await expect(
            page.getByRole("button", { name: "Remover marcador", exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Remover marcador", exact: true })
            .tap();
          await page
            .getByRole("button", { name: "Mostrar páginas e marcadores" })
            .tap();
          await expect(page.locator(".reader-left-panel")).toBeVisible();
          await page.locator(".page-navigation-list button").first().tap();
          await expect(input).toHaveValue("1");
          await page
            .getByRole("button", { name: "Fechar páginas", exact: true })
            .tap();
          await page.getByRole("button", { name: "Ajustar aparência" }).tap();
          for (const theme of ["papel", "noturno", "branco"]) {
            const button = page.getByRole("button", {
              name: `Tema ${theme}`,
              exact: true,
            });
            await button.tap();
            await expect(button).toHaveAttribute("aria-pressed", "true");
          }
          await page.getByRole("button", { name: "Aumentar zoom" }).tap();
          await page.getByRole("button", { name: "Diminuir zoom" }).tap();
          await page.getByRole("button", { name: "Fechar aparência" }).tap();
          await page.getByRole("button", { name: "Buscar no documento" }).tap();
          await page
            .getByLabel("Buscar texto neste documento")
            .fill(format === "pdf" ? "Reading page 2" : "denúncia");
          await page.getByRole("button", { name: "Buscar", exact: true }).tap();
          await expect(input).toHaveValue(format === "pdf" ? "2" : "3");
          await page
            .getByRole("button", { name: "Fechar busca", exact: true })
            .tap();
          await page.getByRole("button", { name: "Mostrar anotações" }).tap();
          await expect(
            page.getByLabel("Sua anotação", { exact: true }),
          ).toBeVisible();
          await page.getByRole("button", { name: "Fechar anotações" }).tap();
          await page
            .getByRole("button", { name: "Abrir ferramentas de anotação" })
            .tap();
          for (const tool of [
            "Selecionar texto",
            "Marca-texto",
            "Caneta",
            "Mover página",
            "Sublinhar",
            "Lápis",
            "Borracha",
            "Retângulo",
            "Círculo",
            "Seta",
            "Inserir texto",
            "Inserir imagem",
          ]) {
            const button = page.getByRole("button", {
              name: tool,
              exact: true,
            });
            await chooseAnnotationTool(page, tool);
            await expect(button).toHaveAttribute("aria-pressed", "true");
          }
          await page
            .getByRole("button", { name: "Fechar ferramentas de anotação" })
            .tap();
          await input.fill("1");
          await input.blur();
          for (
            let swipe = 0;
            swipe < 12 && Number(await input.inputValue()) === 1;
            swipe++
          ) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ x: width / 2, y: height * 0.65 }],
            });
            for (let step = 1; step <= 6; step++) {
              await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [
                  { x: width / 2, y: height * (0.65 - step * 0.065) },
                ],
              });
              await page.evaluate(() => new Promise(requestAnimationFrame));
            }
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
            await page.evaluate(() => new Promise(requestAnimationFrame));
          }
          await expect
            .poll(async () => Number(await input.inputValue()))
            .toBeGreaterThan(1);
          let previousScroll = -1;
          let stableFrames = 0;
          await expect
            .poll(
              async () => {
                const scroll = await page
                  .locator(".reader-scroll-area")
                  .evaluate((node) => node.scrollTop);
                stableFrames =
                  Math.abs(scroll - previousScroll) < 1 ? stableFrames + 1 : 0;
                previousScroll = scroll;
                return stableFrames;
              },
              { intervals: [100], timeout: 5000 },
            )
            .toBeGreaterThanOrEqual(3);
          const saved = await input.inputValue();
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  new Promise<number | undefined>((resolve, reject) => {
                    const request = indexedDB.open(
                      "personal-reader-00000000-0000-4000-8000-000000000001",
                    );
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => {
                      const database = request.result;
                      const transaction = database.transaction(
                        "state",
                        "readonly",
                      );
                      const snapshot = transaction
                        .objectStore("state")
                        .get("library");
                      snapshot.onsuccess = () =>
                        resolve(
                          snapshot.result?.documents.find(
                            (document: { id: string; page: number }) =>
                              document.id ===
                              location.pathname.split("/").pop(),
                          )?.page,
                        );
                      transaction.oncomplete = () => database.close();
                    };
                  }),
              ),
            )
            .toBe(Number(saved) - 1);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          const scrollBounds = await page
            .locator(".reader-scroll-area")
            .boundingBox();
          expect(scrollBounds!.y + scrollBounds!.height).toBeCloseTo(height, 0);
          await page.screenshot({
            path: `.impeccable/review/reader-interactions/${device.name}-${format}-${landscape ? "landscape" : "portrait"}.png`,
          });
          await page.reload();
          await expect(input).toHaveValue(saved);
        }
        expect(errors).toEqual([]);
      });
    }
  });
}

test("page input rejects fractional pages and navigation survives keyboard shortcuts", async ({
  page,
}) => {
  await page.goto("/reader/dom-casmurro");
  const input = page.getByRole("spinbutton", { name: "Número da página" });
  await input.fill("2");
  for (const invalid of ["1.5", "0", "-1", "9999"]) {
    await input.fill(invalid);
    await input.blur();
    await expect(input).toHaveValue("2");
    await expect(
      page.locator('.reader-page[aria-current="page"]'),
    ).toHaveAttribute("data-reader-page", "1");
  }
  await page.locator(".reader-shell").click({ position: { x: 10, y: 200 } });
  await page.keyboard.press("ArrowRight");
  await expect(input).toHaveValue("3");
  await expect(
    page.getByRole("button", { name: "Próxima página", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(input).toHaveValue("2");
});

for (const viewport of [
  { width: 393, height: 852 },
  { width: 820, height: 1180 },
]) {
  test.describe(`touch drawing ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test("drawing tools, undo/redo, eraser and interrupted touch", async ({
      page,
      context,
    }) => {
      await page.goto("/reader/dom-casmurro");
      await page
        .getByRole("spinbutton", { name: "Número da página" })
        .fill("1");
      await page
        .getByRole("button", { name: "Abrir ferramentas de anotação" })
        .tap();
      const overlay = page.locator(
        '.reader-page[data-reader-page="0"] .annotation-overlay',
      );
      const groups = overlay.locator(":scope > g");
      const session = await context.newCDPSession(page);
      const stroke = async (cancel = false) => {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: 100, y: 270 }],
        });
        for (let step = 1; step <= 5; step++)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: 100 + step * 10, y: 270 + step * 8 }],
          });
        await session.send("Input.dispatchTouchEvent", {
          type: cancel ? "touchCancel" : "touchEnd",
          touchPoints: [],
        });
      };
      for (const tool of [
        "Caneta",
        "Lápis",
        "Marca-texto",
        "Sublinhar",
        "Retângulo",
        "Círculo",
        "Seta",
      ]) {
        await chooseAnnotationTool(page, tool);
        await stroke();
        await expect(groups).toHaveCount(2);
        if (tool === "Lápis") {
          const width = await overlay
            .locator("polyline")
            .getAttribute("stroke-width");
          await expect(
            page.locator(".annotation-setting-value").first(),
          ).toHaveText(`${width} px`);
        }
        await page.getByRole("button", { name: "Desfazer anotação" }).tap();
        await expect(groups).toHaveCount(1);
        await page.getByRole("button", { name: "Refazer anotação" }).tap();
        await expect(groups).toHaveCount(2);
        await page.getByRole("button", { name: "Desfazer anotação" }).tap();
      }
      await page.getByRole("button", { name: "Caneta", exact: true }).tap();
      await stroke(true);
      await expect(groups).toHaveCount(1);
      await stroke();
      await expect(groups).toHaveCount(2);
      await page.getByRole("button", { name: "Borracha", exact: true }).tap();
      await page.touchscreen.tap(120, 286);
      await expect(groups).toHaveCount(1);
      await page
        .getByRole("button", { name: "Fechar ferramentas de anotação" })
        .tap();
      await page.reload();
      await expect(groups).toHaveCount(1);
    });
  });
}

test("text selection creates a persistent highlight", async ({ page }) => {
  await page.goto("/reader/dom-casmurro");
  await page
    .locator('.reader-page[aria-current="page"] .prose-page p')
    .first()
    .dblclick({ position: { x: 70, y: 12 } });
  await page.getByRole("button", { name: "Destacar", exact: true }).click();
  await expect(
    page.locator('.reader-page[aria-current="page"] .annotation-overlay rect'),
  ).not.toHaveCount(0);
  await page.reload();
  await expect(
    page.locator('.reader-page[aria-current="page"] .annotation-overlay rect'),
  ).not.toHaveCount(0);
  await page.goto("/knowledge");
  await expect(page.locator(".knowledge-entry")).toHaveCount(1);
});

test("503-page PDF supports distant navigation, clipping and returning to the library", async ({
  page,
}) => {
  test.setTimeout(90000);
  const pdf = await PDFDocument.create();
  for (let index = 1; index <= 503; index++)
    pdf.addPage([600, 800]).drawText(`Page ${index}`, { x: 50, y: 650 });
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Long.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("link", { name: "Long", exact: true }).click();
  const input = page.getByRole("spinbutton", { name: "Número da página" });
  await expect(input).toHaveAttribute("max", "503");
  await page.getByRole("button", { name: "Fechar mensagem" }).click();
  await input.fill("503");
  await expect(
    page.locator('[data-reader-page="502"] .pdf-page'),
  ).toHaveAttribute("aria-busy", "false");
  await expect(
    page.getByRole("button", { name: "Próxima página", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Página anterior", exact: true })
    .click();
  await expect(input).toHaveValue("502");
  await input.fill("49");
  await expect(
    page.locator('[data-reader-page="48"] .pdf-page'),
  ).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await chooseAnnotationTool(page, "Capturar trecho");
  const box = (await page
    .locator('[data-reader-page="48"] .annotation-overlay')
    .boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 180, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByText("Captura salva na central de conhecimento."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar à biblioteca" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goto("/knowledge");
  await expect(page.locator(".clipping-image")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".clipping-image")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("PDF exposes only applicable controls and selected strokes update immediately", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]).drawText("PDF controls", { x: 50, y: 650 });
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Controls.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("link", { name: "Controls", exact: true }).click();
  await expect(page.locator(".pdf-page")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Fechar mensagem" }).click();
  await page.getByRole("button", { name: "Ajustar aparência" }).click();
  await expect(
    page.getByRole("button", { name: "Aumentar fonte" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Diminuir fonte" }),
  ).toHaveCount(0);
  const originalWidth = (await page.locator(".reader-page").boundingBox())!
    .width;
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  await expect
    .poll(async () => (await page.locator(".reader-page").boundingBox())!.width)
    .toBeGreaterThan(originalWidth);
  await page.getByRole("button", { name: "Diminuir zoom" }).click();
  await page.getByRole("button", { name: "Fechar aparência" }).click();
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  const thickness = page.getByRole("slider", { name: "Espessura do traço" });
  const opacity = page.getByRole("slider", { name: "Opacidade da marcação" });
  for (const tool of [
    "Selecionar texto",
    "Mover página",
    "Borracha",
    "Capturar trecho",
  ]) {
    await chooseAnnotationTool(page, tool);
    await expect(thickness).toHaveCount(0);
    await expect(opacity).toHaveCount(0);
  }
  for (const tool of ["Marca-texto", "Inserir texto", "Inserir imagem"]) {
    await chooseAnnotationTool(page, tool);
    await expect(thickness).toHaveCount(0);
    await expect(opacity).toBeVisible();
  }
  for (const tool of [
    "Lápis",
    "Sublinhar",
    "Retângulo",
    "Círculo",
    "Seta",
    "Caneta",
  ]) {
    await chooseAnnotationTool(page, tool);
    await expect(thickness).toBeVisible();
    await expect(opacity).toBeVisible();
  }
  const surface = (await page.locator(".annotation-overlay").boundingBox())!;
  await page.mouse.move(surface.x + 80, surface.y + 100);
  await page.mouse.down();
  await page.mouse.move(surface.x + 180, surface.y + 150, { steps: 5 });
  await page.mouse.up();
  const stroke = page.locator(".annotation-overlay polyline");
  await expect(stroke).toHaveCount(1);
  await page
    .getByRole("button", { name: "Selecionar texto", exact: true })
    .click();
  await expect(thickness).toHaveCount(0);
  await stroke.click();
  await expect(thickness).toBeVisible();
  await thickness.focus();
  await page.keyboard.press("End");
  await expect(stroke).toHaveAttribute("stroke-width", "12");
  await opacity.focus();
  await page.keyboard.press("Home");
  await expect(stroke.locator("..")).toHaveAttribute("opacity", "0.1");
  await expect(page.locator(".annotation-setting-value")).toHaveText([
    "12 px",
    "10%",
  ]);
  await page
    .getByRole("button", { name: "Escolher cor personalizada" })
    .click();
  await page
    .getByRole("textbox", { name: "Cor personalizada" })
    .fill("#8844aa");
  await page.keyboard.press("Tab");
  await expect(stroke).toHaveAttribute("stroke", "#8844aa");
  await expect(
    page.getByRole("button", { name: "Escolher cor personalizada" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(stroke).toHaveAttribute("stroke-width", "12");
  await expect(stroke.locator("..")).toHaveAttribute("opacity", "0.1");
});

test("annotation toolbar keeps history fixed, groups colors and reveals extra tools", async ({
  page,
}) => {
  await mkdir(".impeccable/review/annotation-toolbar", { recursive: true });
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "ipad", width: 820, height: 1180 },
    { name: "iphone", width: 393, height: 852 },
    { name: "small-phone", width: 320, height: 740 },
    { name: "landscape", width: 852, height: 393 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/reader/dom-casmurro");
    await page
      .getByRole("button", { name: "Abrir ferramentas de anotação" })
      .click();
    const undo = page.getByRole("button", { name: "Desfazer anotação" });
    const redo = page.getByRole("button", { name: "Refazer anotação" });
    const more = page.getByRole("button", { name: "Mais ferramentas" });
    const historyBounds = (await undo.boundingBox())!;
    expect((await redo.boundingBox())!.x).toBeGreaterThan(historyBounds.x);
    await expect(
      page.getByRole("button", { name: "Retângulo", exact: true }),
    ).toHaveCount(0);
    await page
      .locator(".annotation-primary-tools")
      .evaluate((node) => (node.scrollLeft = node.scrollWidth));
    expect((await undo.boundingBox())!.x).toBe(historyBounds.x);
    await more.click();
    await expect(
      page.getByRole("button", { name: "Retângulo", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await chooseAnnotationTool(page, "Retângulo");
    await expect(
      page.getByRole("button", { name: "Retângulo", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => {
        const selected = (await page
          .getByRole("button", { name: "Retângulo", exact: true })
          .boundingBox())!;
        const rail = (await page
          .locator(".annotation-primary-tools")
          .boundingBox())!;
        return (
          selected.x >= rail.x &&
          selected.x + selected.width <= rail.x + rail.width + 1
        );
      })
      .toBe(true);
    await page.getByRole("button", { name: "Cor Azul", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cor Azul", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const bounds = (await page.locator(".annotation-toolbar").boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height).toBeLessThan(220);
    await page.screenshot({
      path: `.impeccable/review/annotation-toolbar/${viewport.name}.png`,
    });
    await page
      .getByRole("button", { name: "Escolher cor personalizada" })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Cor personalizada" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toBeVisible();
  }
});
