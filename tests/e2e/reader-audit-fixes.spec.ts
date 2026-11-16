import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

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
  await context.addCookies([
    { name, value, url: "http://127.0.0.1:3000", httpOnly: true },
  ]);
  await context.route("**/api/library", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

test.describe("mobile reading controls", () => {
  test.use({
    viewport: { width: 320, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  test("font, protected chapter start, note contrast and color palette", async ({
    page,
  }) => {
    await page.goto("/library");
    await page
      .getByRole("button", { name: "Importar arquivos", exact: true })
      .click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "Texto.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Capítulo\n\n" + "Um parágrafo de leitura. ".repeat(250),
      ),
    });
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
    await page.locator(".book-cover-link").click();
    const chapter = page.locator(".prose-page h1").first();
    await expect(chapter).toBeVisible();
    const headerBottom = await page
      .locator(".reader-header")
      .evaluate((e) => e.getBoundingClientRect().bottom);
    expect((await chapter.boundingBox())!.y).toBeGreaterThanOrEqual(
      headerBottom,
    );
    const before = await page
      .locator(".prose-page")
      .first()
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    await page.getByRole("button", { name: "Ajustar aparência" }).click();
    await page.getByRole("button", { name: "Aumentar fonte" }).click();
    expect(
      await page
        .locator(".prose-page")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBe(before + 1);
    const readingPage = page.locator(".reader-page").first();
    const originalWidth = (await readingPage.boundingBox())!.width;
    await page.getByRole("button", { name: "Aumentar zoom" }).click();
    expect((await readingPage.boundingBox())!.width).toBeGreaterThan(
      originalWidth,
    );
    expect(
      await page
        .locator(".reader-scroll-area")
        .evaluate((node) => node.scrollWidth > node.clientWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Diminuir zoom" }).click();
    await page.getByRole("button", { name: "Fechar aparência" }).click();
    await page.getByRole("button", { name: "Mostrar anotações" }).click();
    await page.getByLabel("Sua anotação", { exact: true }).fill("Nota legível");
    await page.getByRole("button", { name: "Salvar anotação" }).click();
    expect(
      await page
        .locator(".reader-note-kind")
        .first()
        .evaluate((e) => getComputedStyle(e).color),
    ).toBe("rgb(16, 16, 16)");
    await expect(page.locator(".panel-annotations article p")).toHaveCSS(
      "font-size",
      "14px",
    );
    await page.getByRole("button", { name: "Fechar anotações" }).click();
    await page
      .getByRole("button", { name: "Abrir ferramentas de anotação" })
      .click();
    const palette = (await page.locator(".annotation-toolbar").boundingBox())!;
    for (const color of ["Amarelo", "Rosa", "Verde", "Azul", "Grafite"]) {
      const box = (await page
        .getByRole("button", { name: `Cor ${color}`, exact: true })
        .boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(palette.x);
      expect(box.x + box.width).toBeLessThanOrEqual(palette.x + palette.width);
    }
  });
});

test("EPUB progress advances and survives reload", async ({ page }) => {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    "content.opf",
    '<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Livro EPUB</dc:title><dc:identifier id="id">epub-regression</dc:identifier><dc:language>pt-BR</dc:language></metadata><manifest>' +
      [0, 1, 2]
        .map(
          (i) =>
            `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`,
        )
        .join("") +
      "</manifest><spine>" +
      [0, 1, 2].map((i) => `<itemref idref="c${i}"/>`).join("") +
      "</spine></package>",
  );
  for (let i = 0; i < 3; i++)
    zip.file(
      `c${i}.xhtml`,
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo</title></head><body><h1>Capítulo ${i + 1}</h1>${"<p>Uma leitura longa para verificar o progresso do livro em todos os dispositivos.</p>".repeat(80)}</body></html>`,
    );
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Livro.epub",
    mimeType: "application/epub+zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.locator(".book-cover-link").click();
  await expect(
    page.frameLocator("iframe").first().locator("p").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  await expect
    .poll(async () =>
      parseInt((await page.locator(".reader-page-counter").textContent())!),
    )
    .toBeGreaterThan(0);
  const progress = parseInt(
    (await page.locator(".reader-page-counter").textContent())!,
  );
  await page.getByRole("button", { name: "Buscar no documento" }).click();
  await page.getByLabel("Buscar texto neste documento").fill("Capítulo 2");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect
    .poll(async () =>
      parseInt((await page.locator(".reader-page-counter").textContent())!),
    )
    .toBeGreaterThan(progress);
  const chapterProgress = parseInt(
    (await page.locator(".reader-page-counter").textContent())!,
  );
  await page.reload();
  await expect
    .poll(async () =>
      parseInt((await page.locator(".reader-page-counter").textContent())!),
    )
    .toBeGreaterThanOrEqual(chapterProgress);
});

test("changing PDF page does not repaint already rendered canvases", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 12; i++)
    pdf.addPage([600, 800]).drawText(`Page ${i + 1}`);
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Leitura.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.locator(".book-cover-link").click();
  for (const index of [0, 1, 0]) {
    await page
      .locator(`[data-reader-page="${index}"]`)
      .evaluate((node) => node.scrollIntoView());
    await expect(
      page.locator(`[data-reader-page="${index}"] .pdf-page`),
    ).toHaveAttribute("aria-busy", "false");
  }
  const pageBox = await page.locator('[data-reader-page="0"]').boundingBox();
  const canvasBox = await page
    .locator('[data-reader-page="0"] .pdf-page canvas')
    .boundingBox();
  expect(Math.abs(pageBox!.height - canvasBox!.height)).toBeLessThan(1);
  await page.evaluate(() => {
    let resets = 0;
    document.documentElement.dataset.readerCanvasResets = "0";
    const observer = new MutationObserver((records) => {
      resets += records.length;
      document.documentElement.dataset.readerCanvasResets = String(resets);
    });
    document
      .querySelectorAll(
        '[data-reader-page="0"] .pdf-page canvas,[data-reader-page="1"] .pdf-page canvas',
      )
      .forEach((node) =>
        observer.observe(node, {
          attributes: true,
          attributeFilter: ["width", "height"],
        }),
      );
  });
  await page
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Número da página" }),
  ).toHaveValue("2");
  await expect(
    page.locator('[data-reader-page="1"] .pdf-page'),
  ).toHaveAttribute("aria-busy", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.readerCanvasResets,
    ),
  ).toBe("0");
});
