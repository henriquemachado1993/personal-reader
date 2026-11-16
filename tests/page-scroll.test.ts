import { test } from "node:test";
import assert from "node:assert/strict";
import { findVisiblePage } from "../src/modules/reader/page-scroll";

test("reading line identifies variable page heights and boundaries in logarithmic work", () => {
  const pages = Array.from({ length: 2048 }, (_, i) => (i + 1) * 100);
  let measures = 0;
  assert.equal(
    findVisiblePage(
      pages,
      (bottom) => {
        measures++;
        return bottom;
      },
      204700,
    ),
    204800,
  );
  assert.ok(measures <= 12);
  assert.equal(
    findVisiblePage([100, 250, 300], (x) => x, 100),
    250,
  );
  assert.equal(
    findVisiblePage([], (x) => x, 20),
    undefined,
  );
});
