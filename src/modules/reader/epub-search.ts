import type { Book } from "epubjs";
import type Section from "epubjs/types/section";
export async function searchEpub(
  book: Book,
  query: string,
): Promise<{ cfi: string; excerpt: string }[]> {
  const sections: Section[] = [];
  book.spine.each((section: Section) => sections.push(section));
  const results: { cfi: string; excerpt: string }[] = [];
  for (const section of sections) {
    const alreadyLoaded = Boolean(section.document);
    await section.load(book.load.bind(book));
    // EPUB.js' declarations incorrectly type find() results as DOM elements.
    const matches = section.find(query) as unknown as {
      cfi: string;
      excerpt: string;
    }[];
    results.push(...matches);
    if (!alreadyLoaded) section.unload();
  }
  return results;
}
