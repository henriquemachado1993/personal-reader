import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/modules/library/demo";
import { mergeLibrary } from "../src/modules/library/sync-merge";

test("sync merges independent edits and propagates remote deletion", () => {
  const base = initialState(),
    ours = structuredClone(base),
    theirs = structuredClone(base);
  ours.documents[0].title = "Título local";
  theirs.documents[1].title = "Título remoto";
  theirs.documents.pop();
  const merged = mergeLibrary(base, ours, theirs);
  assert.equal(merged.documents[0].title, "Título local");
  assert.equal(merged.documents[1].title, "Título remoto");
  assert.equal(merged.documents.length, base.documents.length - 1);
});
test("sync refuses concurrent edits to the same document without discarding either copy", () => {
  const base = initialState(),
    ours = structuredClone(base),
    theirs = structuredClone(base);
  ours.documents[0].page = 2;
  theirs.documents[0].page = 0;
  assert.throws(() => mergeLibrary(base, ours, theirs), /Conflito/);
  assert.equal(ours.documents[0].page, 2);
});
