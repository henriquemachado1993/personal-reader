import type { PDFDocumentProxy } from "pdfjs-dist";

// The document owns its cache; closing it allows all cached text to be collected.
const documentText = new WeakMap<
  PDFDocumentProxy,
  Map<number, Promise<string>>
>();
const MAX_CACHED_PAGES = 128;

export async function findPdfText(
  pdf: PDFDocumentProxy,
  query: string,
  start: number,
) {
  let cache = documentText.get(pdf);
  if (!cache) {
    cache = new Map();
    documentText.set(pdf, cache);
  }
  const normalized = query.toLocaleLowerCase("pt-BR");
  for (let offset = 0; offset < pdf.numPages; offset++) {
    const index = (start + offset) % pdf.numPages;
    let pending = cache.get(index);
    if (!pending) {
      pending = pdf
        .getPage(index + 1)
        .then((page) => page.getTextContent())
        .then((text) =>
          text.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .toLocaleLowerCase("pt-BR"),
        );
      cache.set(index, pending);
      const currentCache = cache;
      const currentPending = pending;
      void pending.catch(() => {
        if (currentCache.get(index) === currentPending)
          currentCache.delete(index);
      });
      if (cache.size > MAX_CACHED_PAGES)
        cache.delete(cache.keys().next().value!);
    }
    if ((await pending).includes(normalized)) return index;
  }
  return -1;
}

export async function findPdfOccurrences(pdf: PDFDocumentProxy, query: string) {
  const { findTextMatches } = await import("./search-matches");
  const results: { page: number; occurrence: number }[] = [];
  for (let page = 0; page < pdf.numPages; page++) {
    const content = await (await pdf.getPage(page + 1)).getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("");
    findTextMatches(text, query).forEach((_, occurrence) =>
      results.push({ page, occurrence }),
    );
  }
  return results;
}
