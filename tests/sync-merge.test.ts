import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./library-fixture";
import { mergeLibrary } from "../src/modules/library/sync-merge";
test("independent fields of the same entity merge without losing either edit", () => {
  const base = initialState(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.documents[0].title = "Novo título";
  remote.documents[0].page = 2;
  const merged = mergeLibrary(base, local, remote);
  assert.equal(merged.documents[0].title, "Novo título");
  assert.equal(merged.documents[0].page, 2);
});

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
