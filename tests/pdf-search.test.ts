import { test } from "node:test";
import assert from "node:assert/strict";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { findPdfText } from "../src/modules/reader/pdf-search";

function fixture(pages: string[]) {
  let reads = 0;
  const pdf = {
    numPages: pages.length,
    getPage: async (page: number) => {
      reads++;
      return {
        getTextContent: async () => ({ items: [{ str: pages[page - 1] }] }),
      };
    },
  } as unknown as PDFDocumentProxy;
  return { pdf, reads: () => reads };
}

test("PDF search preserves circular results and shares text across queries", async () => {
  const { pdf, reads } = fixture(["AÇÃO", "segundo", "terceiro"]);
  assert.equal(await findPdfText(pdf, "ação", 1), 0);
  assert.equal(reads(), 3);
  assert.equal(await findPdfText(pdf, "SEGUNDO", 0), 1);
  assert.equal(await findPdfText(pdf, "ausente", 0), -1);
  assert.equal(reads(), 3);
});

test("concurrent queries share extraction and failed pages can be retried", async () => {
  const { pdf, reads } = fixture(["texto"]);
  assert.deepEqual(
    await Promise.all([
      findPdfText(pdf, "texto", 0),
      findPdfText(pdf, "texto", 0),
    ]),
    [0, 0],
  );
  assert.equal(reads(), 1);
  const getPage = pdf.getPage;
  let failed = true;
  const broken = {
    numPages: 1,
    getPage: (...args: Parameters<typeof getPage>) => {
      if (failed) {
        failed = false;
        return Promise.reject(new Error("falha"));
      }
      return getPage(...args);
    },
  } as PDFDocumentProxy;
  await assert.rejects(findPdfText(broken, "texto", 0));
  assert.equal(await findPdfText(broken, "texto", 0), 0);
});

test("text cache is bounded and isolated by document", async () => {
  const { pdf, reads } = fixture(Array(129).fill("texto"));
  assert.equal(await findPdfText(pdf, "ausente", 0), -1);
  assert.equal(reads(), 129);
  assert.equal(await findPdfText(pdf, "texto", 0), 0);
  assert.equal(reads(), 130);
  assert.equal(await findPdfText(fixture(["outro"]).pdf, "texto", 0), -1);
});

test("PDF occurrence search counts repeated matches on the same page", async () => {
  const { findPdfOccurrences } =
    await import("../src/modules/reader/pdf-search");
  const { pdf } = fixture(["Texto texto", "ausente", "TEXTO"]);
  assert.deepEqual(await findPdfOccurrences(pdf, "texto"), [
    { page: 0, occurrence: 0 },
    { page: 0, occurrence: 1 },
    { page: 2, occurrence: 0 },
  ]);
  assert.deepEqual(await findPdfOccurrences(pdf, "  "), []);
});
