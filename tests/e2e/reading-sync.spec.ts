import { test, expect, testBook } from "./library-sync-fixture";
import { initialState } from "../../src/modules/library/initial-state";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "Requer um banco de teste descartável",
);

for (const format of ["PDF", "EPUB", "TXT", "DOCX"] as const) {
  test(`${format} opens its R2 file on a second device and resumes from synchronized position`, async ({
    createAccount,
    browser,
  }) => {
    test.skip(!process.env.TEST_R2, "Requer um bucket de teste no R2");
    const account = await createAccount();
    const book = {
      ...testBook(format),
      contentAsset: undefined as string | undefined,
    };
    if (format === "PDF") {
      const pdf = await PDFDocument.create();
      for (let index = 0; index < 4; index++) pdf.addPage([612, 792]);
      await account.upload(
        book.id,
        Buffer.from(await pdf.save()),
        "application/octet-stream",
      );
    } else if (format === "EPUB") {
      const zip = new JSZip();
      zip.file("mimetype", "application/epub+zip");
      zip.file(
        "META-INF/container.xml",
        '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      );
      zip.file(
        "content.opf",
        '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="book"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book">reader-test</dc:identifier><dc:title>Teste EPUB</dc:title><dc:language>pt</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
      );
      zip.file(
        "chapter.xhtml",
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Teste</title></head><body><h1>Capítulo sincronizado</h1></body></html>',
      );
      await account.upload(
        book.id,
        await zip.generateAsync({ type: "nodebuffer" }),
        "application/octet-stream",
      );
    } else {
      book.contentAsset = `asset-${crypto.randomUUID()}`;
      await account.upload(
        book.contentAsset,
        Buffer.from(
          JSON.stringify(
            Array.from({ length: 4 }, (_, i) => `Página de teste ${i + 1}`),
          ),
        ),
        "application/json",
      );
      await account.upload(
        book.id,
        Buffer.from("Arquivo original"),
        "application/octet-stream",
      );
    }
    await account.seed({ ...initialState(), documents: [book] });
    const a = await account.browser(browser);
    const b = await account.browser(browser);
    try {
      const page = await a.newPage();
      await page.goto(`/reader/${book.id}`);
      const second = await b.newPage();
      if (format === "EPUB") {
        await expect(
          page.frameLocator("iframe").getByText("Capítulo sincronizado"),
        ).toBeVisible();
        await second.goto(`/reader/${book.id}`);
        await expect(
          second.frameLocator("iframe").getByText("Capítulo sincronizado"),
        ).toBeVisible();
        await expect
          .poll(async () => (await account.state()).documents[0].status)
          .toBe("reading");
        return;
      }
      const field = (reader: typeof page) =>
        reader.getByRole("spinbutton", { name: "Número da página" });
      await expect(field(page)).toHaveValue("1");
      if (format === "TXT" || format === "DOCX")
        await expect(
          page.getByText("Página de teste 1", { exact: true }).first(),
        ).toBeVisible();
      await field(page).fill("3");
      await field(page).blur();
      await expect(field(page)).toHaveValue("3");
      await expect
        .poll(async () => (await account.state()).documents[0].page)
        .toBe(2);
      await second.goto(`/reader/${book.id}`);
      await expect(field(second)).toHaveValue("3");

      await field(page).fill("2");
      await field(page).blur();
      await page.close();
      await expect
        .poll(async () => (await account.state()).documents[0].page)
        .toBe(1);
      if (!process.env.TEST_REALTIME)
        await second.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(field(second)).toHaveValue("2");
    } finally {
      await a.close();
      await b.close();
    }
  });
}

test("a browser import uploads the TXT original and rendition together with lightweight metadata", async ({
  createAccount,
  browser,
  libraryDb,
}) => {
  test.skip(!process.env.TEST_R2, "Requer um bucket de teste no R2");
  const account = await createAccount();
  const a = await account.browser(browser);
  const b = await account.browser(browser);
  const contents = "Texto disponível no segundo aparelho.";
  try {
    const page = await a.newPage();
    await page.goto("/library");
    await page.getByRole("button", { name: "Importar arquivos" }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "arquivo-sync.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(contents),
    });
    await expect
      .poll(async () => (await account.state()).documents.length)
      .toBe(1);
    const [book] = (await account.state()).documents;
    expect(book.contentAsset).toMatch(/^asset-/);
    account.files.add(book.id);
    account.files.add(book.contentAsset!);
    const entities = await libraryDb.libraryEntity.findMany({
      where: { ownerId: account.id },
    });
    expect(JSON.stringify(entities)).not.toContain(contents);

    const second = await b.newPage();
    await second.goto(`/reader/${book.id}`);
    await expect(
      second.getByText(contents, { exact: true }).first(),
    ).toBeVisible();
    await b.setOffline(true);
    await expect(
      second.getByText(contents, { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});
