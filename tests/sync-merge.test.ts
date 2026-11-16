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

test("a legacy collection without a sync base cannot resurrect a remote deletion", () => {
  const base = initialState();
  base.documents = [];
  const local = structuredClone(base);
  local.collections = [
    { id: "filosofia", name: "Filosofia & ideias", color: "#b39470" },
    { id: "new-local", name: "Coleção nova", color: "#819275" },
  ];
  const remote = structuredClone(base);
  const merged = mergeLibrary(base, local, remote, ["filosofia"]);
  assert.deepEqual(
    merged.collections.map((item) => item.id),
    ["new-local"],
  );
  assert.equal(local.collections.length, 2);
});

test("collection deletion preserves independent progress and new memberships", () => {
  const base = initialState();
  base.collections = [
    { id: "filosofia", name: "Filosofia & ideias", color: "#b39470" },
  ];
  base.documents[0].collections = ["filosofia"];
  const local = structuredClone(base);
  local.documents[0].page = 2;
  local.collections.push({ id: "new-local", name: "Nova", color: "#819275" });
  local.documents[0].collections.push("new-local");
  const remote = structuredClone(base);
  remote.collections = [];
  remote.documents[0].collections = [];
  const merged = mergeLibrary(base, local, remote, ["filosofia"]);
  assert.equal(merged.documents[0].page, 2);
  assert.deepEqual(merged.documents[0].collections, ["new-local"]);
});
