import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { DocumentFormat } from "../../src/shared/types";

export async function importBookmarkFile(page: Page, format: DocumentFormat) {
  const title = `Marcadores ${format}`;
  const paragraphs = Array.from(
    { length: 3 },
    (_, index) =>
      `Página ${index + 1}. ${"Texto para verificar os marcadores durante a leitura. ".repeat(32)}`,
  );
  let buffer: Buffer;
  let mimeType: string;
  if (format === "PDF") {
    const pdf = await PDFDocument.create();
    pdf.setTitle(title);
    for (let index = 0; index < 3; index++)
      pdf.addPage([600, 800]).drawText(`Bookmark page ${index + 1}`, {
        x: 40,
        y: 740,
      });
    buffer = Buffer.from(await pdf.save());
    mimeType = "application/pdf";
  } else if (format === "TXT") {
    buffer = Buffer.from(paragraphs.join("\n\n"));
    mimeType = "text/plain";
  } else if (format === "DOCX") {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    );
    zip.file(
      "_rels/.rels",
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map((paragraph) => `<w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`,
    );
    buffer = await zip.generateAsync({ type: "nodebuffer" });
    mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file(
      "META-INF/container.xml",
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    );
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">bookmark-epub</dc:identifier><dc:title>${title}</dc:title><dc:language>pt-BR</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>`,
    );
    zip.file(
      "OEBPS/chapter.xhtml",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Marcadores</title></head><body><h1>Marcadores EPUB</h1>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</body></html>`,
    );
    buffer = await zip.generateAsync({ type: "nodebuffer" });
    mimeType = "application/epub+zip";
  }
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Importar arquivos", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: `${title}.${format.toLowerCase()}`,
    mimeType,
    buffer,
  });
  await expect(page.locator(".import-results li")).toHaveCount(1);
  await expect(page.locator(".import-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("link", { name: title, exact: true }).click();
  if (format === "PDF")
    await expect(page.locator(".pdf-page").first()).toHaveAttribute(
      "aria-busy",
      "false",
    );
  else if (format === "EPUB") {
    await expect(page.locator(".epub-page")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(
      page.locator("iframe").first().contentFrame().locator("h1"),
    ).toHaveText("Marcadores EPUB");
  }
}
