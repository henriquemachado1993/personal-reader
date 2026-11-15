import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFormat, paginateText } from "../src/modules/documents/import";
test("detects supported extensions without accepting disguised executables", () => {
  assert.equal(detectFormat("Book.PDF"), "PDF");
  assert.equal(detectFormat("notes.docx"), "DOCX");
  assert.equal(detectFormat("book.epub"), "EPUB");
  assert.equal(detectFormat("notes.txt"), "TXT");
  assert.equal(detectFormat("notes.pdf.exe"), undefined);
  assert.equal(detectFormat("README"), undefined);
});
test("pagination retains complete text, including long paragraphs and unicode", () => {
  const text = "Uma reflexão sobre atenção e leitura. ".repeat(500);
  const pages = paginateText(text);
  assert.ok(pages.length > 1);
  assert.equal(
    pages.join(" ").replace(/\s+/g, " ").trim(),
    text.replace(/\s+/g, " ").trim(),
  );
  assert.ok(pages.every((page) => page.length <= 2500));
});
test("empty files have a readable state and CRLF is normalized", () => {
  assert.equal(paginateText("").length, 1);
  assert.deepEqual(paginateText("Primeiro\r\n\r\nSegundo"), [
    "Primeiro\n\nSegundo",
  ]);
});
