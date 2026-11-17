import { test } from "node:test";
import assert from "node:assert/strict";
import { findTextMatches } from "../src/modules/reader/search-matches";
test("search occurrences preserve exact offsets and treat regex syntax literally", () => {
  assert.deepEqual(findTextMatches("Ação AÇÃO", "ação"), [
    { start: 0, end: 4 },
    { start: 5, end: 9 },
  ]);
  assert.deepEqual(findTextMatches("a.b a-b", "a.b"), [{ start: 0, end: 3 }]);
  assert.deepEqual(findTextMatches("aaaa", "aa"), [
    { start: 0, end: 2 },
    { start: 2, end: 4 },
  ]);
  assert.deepEqual(findTextMatches("texto", "  "), []);
});
