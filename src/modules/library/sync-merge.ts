import type { LibraryState } from "@/shared/types";

/** Three-way merge preserves independent edits and propagates deletions. */
export function mergeLibrary(
  base: LibraryState,
  local: LibraryState,
  remote: LibraryState,
): LibraryState {
  const equal = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const mergeValue = <T>(before: T, ours: T, theirs: T): T => {
    if (equal(ours, before)) return theirs;
    if (equal(theirs, before) || equal(ours, theirs)) return ours;
    throw new Error(
      "Conflito de sincronização. Exporte os dados locais antes de resolver as alterações de outro dispositivo.",
    );
  };
  const mergeList = <T extends { id: string }>(
    before: T[],
    ours: T[],
    theirs: T[],
  ): T[] => {
    const result: T[] = [];
    for (const id of new Set(
      [...before, ...ours, ...theirs].map((item) => item.id),
    )) {
      const value = mergeValue(
        before.find((x) => x.id === id),
        ours.find((x) => x.id === id),
        theirs.find((x) => x.id === id),
      );
      if (value) result.push(value);
    }
    return result;
  };
  return {
    documents: mergeList(base.documents, local.documents, remote.documents),
    collections: mergeList(
      base.collections,
      local.collections,
      remote.collections,
    ),
    annotations: mergeList(
      base.annotations,
      local.annotations,
      remote.annotations,
    ),
    bookmarks: mergeList(base.bookmarks, local.bookmarks, remote.bookmarks),
    preferences: mergeValue(
      base.preferences,
      local.preferences,
      remote.preferences,
    ),
    readingSeconds:
      remote.readingSeconds +
      Math.max(0, local.readingSeconds - base.readingSeconds),
  };
}
