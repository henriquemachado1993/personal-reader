import { chooseAnnotationTool, insertTextAnnotation } from "./annotation-tools";
import { test, expect } from "@playwright/test";
import { seedReaderLibrary } from "./seed-library";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";
import JSZip from "jszip";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ context }) => {
  await seedReaderLibrary(context);
  // Reader tests isolate local behavior; remote persistence has its own integration suite.
  await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const name = "authjs.session-token";
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: name,
    token: {
      id: "00000000-0000-4000-8000-000000000001",
      sub: "00000000-0000-4000-8000-000000000001",
      name: "Leitor QA",
      email: "qa@example.test",
    },
  });
  await context.addCookies([
    {
      name,
      value: token,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test("compact reader search submits with Enter or the search icon", async ({
  page,
}, testInfo) => {
  for (const width of [1440, 393]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/reader/metamorfose?page=1");
    await page
      .getByRole("button", { name: "Buscar no documento", exact: true })
      .click();
    const search = page.getByRole("search", { name: "Busca no documento" });
    const input = search.getByLabel("Buscar texto neste documento");
    const submit = search.getByRole("button", { name: "Buscar", exact: true });
    await expect(input).toBeFocused();
    await expect(submit).toBeDisabled();
    const startingPage = await page
      .getByRole("spinbutton", { name: "Número da página" })
      .inputValue();
    await input.fill("Depois da leitura");
    await expect(
      page.getByRole("spinbutton", { name: "Número da página" }),
    ).toHaveValue(startingPage);
    await input.press("Enter");
    await expect(
      page.getByRole("spinbutton", { name: "Número da página" }),
    ).toHaveValue("3");
    await input.fill("Para ler com atenção");
    await submit.click();
    await expect(
      page.getByRole("spinbutton", { name: "Número da página" }),
    ).toHaveValue("2");
    expect((await search.boundingBox())!.width).toBeGreaterThan(width - 60);
    await page.screenshot({ path: testInfo.outputPath(`search-${width}.png`) });
    await search.getByRole("button", { name: "Fechar busca" }).click();
    await expect(search).toHaveCount(0);
  }
});

test("workspace action and filter buttons use the knowledge font size", async ({
  page,
}) => {
  await page.goto("/knowledge");
  const referenceSize = await page
    .locator(".knowledge-types button")
    .first()
    .evaluate((button) => getComputedStyle(button).fontSize);
  expect(referenceSize).toBe("14px");
  for (const route of ["/library", "/collections", "/settings"]) {
    await page.goto(route);
    const buttons = page.locator(".button, .format-filters button");
    await expect(buttons.first()).toBeVisible();
    for (const button of await buttons.all()) {
      await expect(button).toHaveCSS("font-size", referenceSize);
      const label = button.locator(".mantine-Button-label");
      if (await label.count())
        await expect(label).toHaveCSS("font-size", referenceSize);
    }
  }
});

test("library view preference survives reloads and navigation on this device", async ({
  page,
}) => {
  await page.goto("/library");
  const grid = page.getByRole("button", { name: "Visualizar em grade" });
  const list = page.getByRole("button", { name: "Visualizar em lista" });
  await grid.click();
  await page.reload();
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await page.goto("/collections");
  await page.goto("/library");
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await list.click();
  await page.reload();
  await expect(list).toHaveAttribute("aria-pressed", "true");
});

test("search, list/grid and collection membership work", async ({ page }) => {
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Biblioteca", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Visualizar em grade" }).click();
  await expect(page.locator(".book-card")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Buscar na biblioteca", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar", exact: true })
    .fill("Kafka");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Fechar busca" }).click();
  const first = page.locator(".book-card").first();
  await first.getByRole("button", { name: "Opções do livro" }).click();
  await page.getByRole("menuitem", { name: "Adicionar à coleção" }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.reload();
  await expect(page.locator(".book-card")).toHaveCount(8);
});
test("an opened book moves from Quero Ler to Continuar", async ({ page }) => {
  await page.goto("/");
  const continuing = page.getByRole("region", { name: "Continuar" });
  const title = "Frankenstein";
  await expect(
    continuing.getByRole("link", { name: new RegExp(title) }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Número da página" }),
  ).toHaveValue("1");
  await page.goto("/");
  await expect(
    continuing.getByRole("link", { name: new RegExp(title) }),
  ).toBeVisible();
});

test("Continuar shows its only book at a tablet viewport", async ({ page }) => {
  await page.setViewportSize({ width: 950, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Continuar" })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(
          "personal-reader-00000000-0000-4000-8000-000000000001",
        );
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("state", "readwrite");
          const store = tx.objectStore("state");
          const read = store.get("library");
          read.onsuccess = () => {
            const snapshot = read.result;
            for (const book of snapshot.documents) {
              if (book.status === "reading" && book.id !== "dom-casmurro")
                book.status = "want";
            }
            store.put(snapshot, "library");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  await page.reload();
  const cards = page
    .getByRole("region", { name: "Continuar" })
    .locator(".continue-book");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toBeVisible();
  await expect(cards.first()).toContainText("Dom Casmurro");
});

test("notes, bookmarks, progress and drawings survive a reload and undo/redo", async ({
  page,
}) => {
  await page.goto("/reader/dom-casmurro");
  await expect(page.getByRole("heading", { name: "Do livro" })).toBeVisible();
  await page
    .getByRole("button", { name: "Marcar página", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remover marcador" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mostrar anotações" }).click();
  await page
    .getByRole("textbox", { name: "Sua anotação" })
    .fill("Uma conexão que merece outra leitura.");
  await page.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(page.locator(".panel-annotations")).toContainText("Uma conexão");
  await page.getByRole("button", { name: "Fechar anotações" }).click();
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await page.getByRole("button", { name: "Caneta", exact: true }).click();
  const box = await page
    .locator(".reader-page[aria-current=page] .annotation-overlay")
    .boundingBox();
  if (!box) throw new Error("missing page");
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 150, { steps: 10 });
  await page.mouse.up();
  await expect(
    page.locator(
      ".reader-page[aria-current=page] .annotation-overlay polyline",
    ),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Desfazer anotação" }).click();
  await expect(
    page.locator(
      ".reader-page[aria-current=page] .annotation-overlay polyline",
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Refazer anotação" }).click();
  await expect(
    page.locator(
      ".reader-page[aria-current=page] .annotation-overlay polyline",
    ),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remover marcador" }),
  ).toBeVisible();
  await expect(
    page.locator(
      ".reader-page[aria-current=page] .annotation-overlay polyline",
    ),
  ).toHaveCount(1);
  await page.goto("/knowledge");
  await expect(page.locator(".knowledge-entry")).toContainText("Uma conexão");
  await page.locator(".entry-source").click();
  await expect(
    page.getByRole("spinbutton", { name: "Número da página" }),
  ).toHaveValue("2");
});
test("a PDF canvas failure stays on its page and other pages render", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (this.getAttribute("aria-label") === "Página 1 do PDF")
        throw new Error("Canvas indisponível no teste");
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addPage().drawText("Página seguinte disponível");
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "pdf-local.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("link", { name: "pdf-local", exact: true }).click();
  await expect(
    page.getByText("Não foi possível renderizar a página 1."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ir para página 2", exact: true })
    .click();
  const second = page.locator('[data-reader-page="1"] .pdf-page');
  await expect(second).toHaveAttribute("aria-busy", "false");
  await expect(second.locator(".textLayer")).toContainText(
    "Página seguinte disponível",
  );
});

test("imports and reads TXT, DOCX, PDF and EPUB and exports annotated PDF", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("A real PDF page for the reading test.", {
    x: 50,
    y: 700,
    size: 16,
    font,
  });
  pdf
    .addPage()
    .drawText("Second page and searchable text.", { x: 50, y: 700, font });
  const docx = new JSZip();
  docx.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  docx.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  docx.file(
    "word/document.xml",
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Documento de estudo em DOCX.</w:t></w:r></w:p></w:body></w:document>',
  );
  const epub = new JSZip();
  epub.file("mimetype", "application/epub+zip");
  epub.file(
    "META-INF/container.xml",
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  epub.file(
    "OEBPS/content.opf",
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">qa-epub</dc:identifier><dc:title>EPUB de teste</dc:title><dc:language>pt-BR</dc:language><dc:creator>Leitor QA</dc:creator></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
  );
  epub.file(
    "OEBPS/chapter.xhtml",
    '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Teste</title></head><body><h1>Um EPUB real</h1><p>Um capítulo para testar a leitura.</p></body></html>',
  );
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "leitura.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Leitura TXT\n\nUm documento de estudo que deve persistir.",
      ),
    },
    {
      name: "estudo.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: await docx.generateAsync({ type: "nodebuffer" }),
    },
    {
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    },
    {
      name: "teste.epub",
      mimeType: "application/epub+zip",
      buffer: await epub.generateAsync({ type: "nodebuffer" }),
    },
  ]);
  await expect(page.locator(".import-results li")).toHaveCount(4);
  await expect(page.locator(".import-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("link", { name: "leitura", exact: true }).click();
  await expect(page.locator(".prose-page")).toContainText(
    "Um documento de estudo",
  );
  await page.goto("/library");
  await page.getByRole("link", { name: "estudo", exact: true }).click();
  await expect(page.locator(".prose-page")).toContainText(
    "Documento de estudo em DOCX",
  );
  await page.goto("/library");
  await page.getByRole("link", { name: "documento", exact: true }).click();
  await expect(
    page.locator(".reader-page[aria-current=page] .pdf-page"),
  ).toHaveAttribute("aria-busy", "false");
  await expect(
    page.locator(".reader-page[aria-current=page] .textLayer"),
  ).toContainText("A real PDF page");
  await expect(page.locator(".page-thumbnail canvas")).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator(".page-thumbnail canvas")
        .first()
        .evaluate((canvas: HTMLCanvasElement) => canvas.width),
    )
    .toBe(80);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Mostrar anotações" }).click();
  await page
    .getByLabel("Sua anotação", { exact: true })
    .fill("Ação — Ελληνικά 中文 📚");
  await page.getByRole("button", { name: "Salvar anotação" }).click();
  await page.getByRole("button", { name: "Fechar anotações" }).click();
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await chooseAnnotationTool(page, "Inserir imagem");
  await page.locator('.annotation-toolbar input[type="file"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("img", { name: "Prévia da imagem a inserir" }),
  ).toBeVisible();
  const surface = await page
    .locator(".reader-page[aria-current=page] .annotation-overlay")
    .boundingBox();
  if (!surface) throw new Error("Página indisponível");
  await page.mouse.move(surface.x + 50, surface.y + 100);
  await page.mouse.down();
  await page.mouse.move(surface.x + 150, surface.y + 180);
  await page.mouse.up();
  await expect(
    page.locator(".reader-page[aria-current=page] .annotation-overlay image"),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Fechar ferramentas de anotação" })
    .click();
  await page.getByRole("button", { name: "Exportar PDF anotado" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("documento-anotado.pdf");
  const parsedExport = await PDFDocument.load(
    await readFile((await exported.path())!),
  );
  expect(parsedExport.catalog.has(PDFName.of("Names"))).toBe(true);
  expect(
    parsedExport.getPage(0).node.Resources()?.has(PDFName.of("XObject")),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Ir para página 2", exact: true })
    .click();
  await expect(
    page.locator(".reader-page[aria-current=page] .textLayer"),
  ).toContainText("Second page");
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "Número da página" }),
  ).toHaveValue("2");
  await page.goto("/library");
  await page.getByRole("link", { name: "EPUB de teste", exact: true }).click();
  await expect(
    page.locator("iframe").contentFrame().locator("body"),
  ).toContainText("Um capítulo para testar");
  await page.locator("iframe").contentFrame().locator("h1").click();
  await expect(page.locator(".reader-header")).not.toBeVisible();
  await page.locator("iframe").contentFrame().locator("h1").click();
  await expect(page.locator(".reader-header")).toBeVisible();
});

test("reader controls match the reference in normal, focus and drawing states", async ({
  page,
}) => {
  await mkdir(".impeccable/review/reader-refinement", { recursive: true });
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/reader/dom-casmurro");
    const paragraph = page
      .locator(".reader-page[aria-current=page] .prose-page p")
      .first();
    await expect(paragraph).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "Ferramentas de anotação" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Miniaturas das páginas" }),
    ).toBeVisible();
    await expect(
      page.locator(
        ".reader-page-meta, .prose-running-title, .prose-page-number, .save-indicator",
      ),
    ).toHaveCount(0);
    expect(
      await page
        .getByRole("spinbutton", { name: "Número da página" })
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBe(viewport.width <= 760 ? 16 : 13);
    await page.screenshot({
      path: `.impeccable/review/reader-refinement/${viewport.name}-normal.png`,
      animations: "disabled",
    });
    const top = await paragraph.evaluate((e) => e.getBoundingClientRect().top);
    await paragraph.click({ position: { x: 20, y: 12 } });
    await expect(page.locator(".reader-header")).not.toBeVisible();
    await expect(page.locator(".reader-footer")).not.toBeVisible();
    await expect(page.locator(".reader-page-counter")).not.toBeVisible();
    await expect(paragraph).toBeVisible();
    expect(await paragraph.evaluate((e) => e.getBoundingClientRect().top)).toBe(
      top,
    );
    await page.screenshot({
      path: `.impeccable/review/reader-refinement/${viewport.name}-focus.png`,
      animations: "disabled",
    });
    await paragraph.click({ position: { x: 20, y: 12 } });
    await expect(page.locator(".reader-header")).toBeVisible();
    await page
      .getByRole("button", { name: "Abrir ferramentas de anotação" })
      .click();
    await expect(
      page.getByRole("toolbar", { name: "Ferramentas de anotação" }),
    ).toBeVisible();
    await expect(page.locator(".reader-footer")).not.toBeVisible();
    await page.screenshot({
      path: `.impeccable/review/reader-refinement/${viewport.name}-drawing.png`,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Fechar ferramentas de anotação" })
      .click();
    await expect(page.locator(".reader-header")).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "Ferramentas de anotação" }),
    ).toHaveCount(0);
    await paragraph.dblclick({ position: { x: 30, y: 12 } });
    await page.waitForTimeout(280); // Outwait the single-tap delay: double-click selection must not enter focus.
    await expect(page.locator(".reader-header")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("touch toggles reader chrome and Escape restores keyboard access", async ({
  browser,
  context,
}) => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await seedReaderLibrary(mobile);
  await mobile.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await mobile.addCookies(await context.cookies());
  const page = await mobile.newPage();
  try {
    await page.goto("/reader/dom-casmurro");
    const paragraph = page
      .locator(".reader-page[aria-current=page] .prose-page p")
      .first();
    await paragraph.tap({ position: { x: 20, y: 12 } });
    await expect(page.locator(".reader-header")).not.toBeVisible();
    await paragraph.tap({ position: { x: 20, y: 12 } });
    await expect(page.locator(".reader-header")).toBeVisible();
    await paragraph.tap({ position: { x: 20, y: 12 } });
    await expect(page.locator(".reader-header")).not.toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir ferramentas de anotação" }),
    ).toBeVisible();
  } finally {
    await mobile.close();
  }
});
test("private routes and APIs require NextAuth", async ({ context, page }) => {
  await context.clearCookies();
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login/);
  const response = await page.request.get("/api/status");
  expect(response.status()).toBe(401);
});

test("home count, named dialogs and missing collections expose correct state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Início · Le-Books");
  const shelf = page.locator(".books-home-shelf");
  await expect(shelf.locator(".document-count")).toHaveText("4 documentos");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Importar arquivos" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/collections/missing");
  await expect(page).toHaveTitle("Coleções · Le-Books");
  await expect(
    page.getByRole("link", { name: "Ver minhas coleções" }),
  ).toBeVisible();
});

test("advanced annotation controls persist text and stroke properties", async ({
  page,
}) => {
  await page.goto("/reader/metamorfose");
  await page
    .getByRole("button", { name: "Abrir ferramentas de anotação" })
    .click();
  await page.getByRole("button", { name: "Caneta", exact: true }).click();
  await page.getByRole("slider", { name: "Espessura do traço" }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("slider", { name: "Opacidade da marcação" }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await insertTextAnnotation(page, "Nota na página");
  await expect(
    page.locator(".reader-page[aria-current=page] .annotation-overlay text"),
  ).toHaveText("Nota na página");
  const beforeMove = await page
    .locator(".reader-page[aria-current=page] .annotation-overlay text")
    .getAttribute("x");
  const objectBox = await page
    .locator(".reader-page[aria-current=page] .annotation-overlay text")
    .boundingBox();
  if (!objectBox) throw new Error("Objeto indisponível");
  await page.mouse.move(objectBox.x + 4, objectBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(objectBox.x + 40, objectBox.y + 25, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.locator(".reader-page[aria-current=page] .annotation-overlay text"),
  ).not.toHaveAttribute("x", beforeMove!);
  await page.reload();
  await expect(
    page.locator(".reader-page[aria-current=page] .annotation-overlay text"),
  ).toHaveText("Nota na página");
});

test("visited reader reloads offline from the application cache", async ({
  page,
  context,
}) => {
  await page.goto("/reader/dom-casmurro");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.locator(".reader-page[aria-current=page] .prose-page"),
  ).toContainText("Do livro");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.locator(".reader-page[aria-current=page] .prose-page"),
  ).toContainText("Do livro");
  await context.setOffline(false);
});

test("mobile workspace controls retain touch targets without horizontal overflow", async ({
  browser,
  context,
}) => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await mobile.addCookies(await context.cookies());
  await mobile.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  const page = await mobile.newPage();
  try {
    for (const route of [
      "/library",
      "/knowledge",
      "/settings",
      "/statistics",
    ]) {
      await page.goto(route);
      await expect(page.locator(".books-main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const small = await page
        .locator(".books-app button,.books-app summary,.books-app select")
        .evaluateAll((elements) =>
          elements
            .filter((e) => e.checkVisibility() && !e.hasAttribute("disabled"))
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width < 43.9 || r.height < 43.9;
            })
            .map((e) => e.getAttribute("aria-label") || e.textContent?.trim()),
        );
      expect(small).toEqual([]);
    }
  } finally {
    await mobile.close();
  }
});

test("knowledge date filters narrow saved notes and restore them when cleared", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-15T12:00:00Z"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge");
  await page.getByRole("button", { name: "Nova anotação" }).click();
  await page
    .getByLabel("Sua anotação", { exact: true })
    .fill("Ideia para filtrar por data");
  await page.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(page.locator(".knowledge-entry")).toHaveCount(1);
  await page.getByLabel("Período", { exact: true }).click();
  await page.screenshot({
    path: ".impeccable/review/workspace-update/knowledge-period.png",
    fullPage: true,
    animations: "disabled",
  });
  const day = page
    .locator(
      ".mantine-DatePickerInput-day:not([data-outside]):not([data-hidden])",
    )
    .first();
  await day.click();
  await day.click();
  await expect(page.locator(".knowledge-entry")).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar período" }).click();
  await expect(page.locator(".knowledge-entry")).toHaveCount(1);
  await page.getByLabel("Período", { exact: true }).click();
  const today = page.locator('.mantine-DatePickerInput-day[data-today="true"]');
  await today.click();
  await today.click();
  await expect(page.locator(".knowledge-entry")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Limpar período" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Destaques", exact: true }).click();
  await page.goto("/notes");
  await expect(page.locator(".knowledge-entry")).toHaveCount(1);
});

test("supporting text stays smaller than fields without changing button typography", async ({
  page,
}) => {
  for (const width of [1440, 393]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/settings");
    await expect(page.locator(".page-heading p")).toHaveCSS(
      "font-size",
      "14px",
    );
    for (const description of await page.locator(".preference-row p").all())
      await expect(description).toHaveCSS("font-size", "14px");
    await expect(
      page.getByRole("button", { name: "Exportar backup", exact: true }),
    ).toHaveCSS("font-size", "14px");
    await expect(
      page.getByRole("combobox", { name: "Meta diária em minutos" }),
    ).toHaveCSS("font-size", "16px");
  }
});
