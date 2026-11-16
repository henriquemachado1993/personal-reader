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

for (const format of ["PDF", "EPUB", "TXT", "DOCX"] as const) {
  test(`${format}: the latest reading position wins atomically, including backwards reading`, () => {
    const base = initialState(),
      ours = structuredClone(base),
      theirs = structuredClone(base);
    const location =
      format === "PDF"
        ? ({ type: format, pageIndex: 0 } as const)
        : format === "EPUB"
          ? ({
              type: format,
              cfi: "epubcfi(/6/2!/4/2)",
              href: "chapter.xhtml",
            } as const)
          : ({ type: format, blockIndex: 0, offset: 0 } as const);
    Object.assign(ours.documents[0], {
      page: 2,
      progress: 100,
      readingPositionUpdatedAt: "2026-11-16T12:00:00.000Z",
    });
    Object.assign(theirs.documents[0], {
      page: 0,
      progress: 33,
      location,
      readingPositionUpdatedAt: "2026-11-16T12:01:00.000Z",
    });
    ours.documents[0].title = "Título independente";
    const merged = mergeLibrary(base, ours, theirs).documents[0];
    assert.equal(merged.title, "Título independente");
    assert.equal(merged.page, 0);
    assert.equal(merged.progress, 33);
    assert.deepEqual(merged.location, location);
    assert.equal(
      merged.readingPositionUpdatedAt,
      theirs.documents[0].readingPositionUpdatedAt,
    );
    assert.deepEqual(mergeLibrary(base, theirs, ours).documents[0], merged);
  });
}

test("opening a stale reader cannot replace a newer reading position", () => {
  const base = initialState(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.documents[0].lastReadAt = "2026-11-16T13:00:00.000Z";
  Object.assign(remote.documents[0], {
    page: 2,
    progress: 100,
    readingPositionUpdatedAt: "2026-11-16T12:59:00.000Z",
    lastReadAt: "2026-11-16T12:59:00.000Z",
  });
  const merged = mergeLibrary(base, local, remote).documents[0];
  assert.equal(merged.page, 2);
  assert.equal(merged.lastReadAt, local.documents[0].lastReadAt);
});

test("identical clock timestamps converge without mixing location fields", () => {
  const base = initialState(),
    local = structuredClone(base),
    remote = structuredClone(base);
  for (const book of [local.documents[0], remote.documents[0]])
    book.readingPositionUpdatedAt = "2026-11-16T12:00:00.000Z";
  Object.assign(local.documents[0], {
    page: 2,
    progress: 100,
    location: { type: "TXT", blockIndex: 2, offset: 30 },
  });
  Object.assign(remote.documents[0], {
    page: 0,
    progress: 33,
    location: { type: "TXT", blockIndex: 0, offset: 0 },
  });
  const left = mergeLibrary(base, local, remote).documents[0];
  assert.deepEqual(left, mergeLibrary(base, remote, local).documents[0]);
  assert.ok(
    (left.page === 2 &&
      left.progress === 100 &&
      left.location?.type === "TXT" &&
      left.location.blockIndex === 2) ||
      (left.page === 0 &&
        left.progress === 33 &&
        left.location?.type === "TXT" &&
        left.location.blockIndex === 0),
  );
});

test("reading reconciliation preserves conflicts in edited metadata", () => {
  const base = initialState(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.documents[0].title = "Local";
  remote.documents[0].title = "Remoto";
  local.documents[0].readingPositionUpdatedAt = "2026-11-16T12:00:00.000Z";
  assert.throws(() => mergeLibrary(base, local, remote), /Conflito/);
});

test('document tombstones remove stale books and dependent notes without a sync base',()=>{
 const base=initialState();base.documents=[];
 const local=initialState(),remote=initialState();remote.documents=[];
 local.bookmarks=[{id:'mark',documentId:local.documents[0].id,page:0,location:{type:'TXT',blockIndex:0,offset:0},createdAt:'2026-11-16T12:00:00.000Z'}];
 const merged=mergeLibrary(base,local,remote,[],local.documents.map(book=>book.id));
 assert.deepEqual(merged.documents,[]);assert.deepEqual(merged.bookmarks,[]);
 assert.equal(local.documents.length,3);
});
