import { test } from "node:test";
import assert from "node:assert/strict";
import { addDailySeconds } from "../src/modules/library/reading-calendar";
import { scopedEntityId } from "../src/modules/library/entity-persistence";
import { searchEpub } from "../src/modules/reader/epub-search";
import type { Book } from "epubjs";
import { canonicalJson } from "../src/modules/library/canonical-json";
test("entity comparison ignores JSONB key ordering", () => {
  assert.equal(
    canonicalJson({ title: "Book", page: 1 }),
    canonicalJson({ page: 1, title: "Book" }),
  );
});
test("reading time is attributed to each calendar date without moving historical totals", () => {
  const first = addDailySeconds({}, 20, new Date(2026, 10, 15));
  const second = addDailySeconds(first, 30, new Date(2026, 10, 16));
  assert.deepEqual(second, { "2026-11-15": 20, "2026-11-16": 30 });
});
test("normalized IDs remain stable and isolated between accounts and kinds", () => {
  assert.equal(
    scopedEntityId("a", "document", "sample"),
    scopedEntityId("a", "document", "sample"),
  );
  assert.notEqual(
    scopedEntityId("a", "document", "sample"),
    scopedEntityId("b", "document", "sample"),
  );
});
test("EPUB search loads every section including chapters outside the rendered iframe", async () => {
  const loaded: number[] = [];
  const book = {
    load: () => {},
    spine: {
      each: (visit: (section: unknown) => void) =>
        [0, 1].forEach((index) =>
          visit({
            unload: () => {},
            load: async () => {
              loaded.push(index);
            },
            find: () =>
              index ? [{ cfi: "chapter-two", excerpt: "match" }] : [],
          }),
        ),
    },
  } as unknown as Book;
  const matches = await searchEpub(book, "match");
  assert.deepEqual(loaded, [0, 1]);
  assert.equal(matches[0].cfi, "chapter-two");
});
