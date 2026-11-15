import { test } from "node:test";
import assert from "node:assert/strict";
import { sameLocation } from "../src/modules/reader/location";
test("EPUB bookmarks distinguish CFIs even when their displayed page is the same", () => {
  assert.equal(
    sameLocation(
      { type: "EPUB", cfi: "epubcfi(/6/2!/4/2:0)", href: "chapter.xhtml" },
      { type: "EPUB", cfi: "epubcfi(/6/2!/4/2:40)", href: "chapter.xhtml" },
    ),
    false,
  );
  assert.equal(
    sameLocation(
      { type: "PDF", pageIndex: 3 },
      { type: "PDF", pageIndex: 3, x: 0.4 },
    ),
    true,
  );
  assert.equal(
    sameLocation(
      { type: "TXT", blockIndex: 1, offset: 10 },
      { type: "TXT", blockIndex: 1, offset: 20 },
    ),
    false,
  );
});
