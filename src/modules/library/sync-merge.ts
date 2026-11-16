import type { LibraryState, ReaderDocument } from "@/shared/types";
import { removeDeletedCollections } from "./collection-deletions";
import { canonicalJson } from "./canonical-json";
import { readingPosition, newerReadingPosition } from "./reading-position";
import { removeDeletedDocuments } from "./document-deletions";

/** Three-way merge preserves independent edits and propagates deletions. */
export function mergeLibrary(
  base: LibraryState,
  local: LibraryState,
  remote: LibraryState,
  deletedCollectionIds: readonly string[] = [],
  deletedDocumentIds: readonly string[] = [],
): LibraryState {
  base = removeDeletedDocuments(base, deletedDocumentIds);
  local = removeDeletedDocuments(local, deletedDocumentIds);
  remote = removeDeletedDocuments(remote, deletedDocumentIds);
  base = removeDeletedCollections(base, deletedCollectionIds);
  local = removeDeletedCollections(local, deletedCollectionIds);
  remote = removeDeletedCollections(remote, deletedCollectionIds);
  const equal = (a: unknown, b: unknown) =>
    canonicalJson(a) === canonicalJson(b);
  const mergeValue = <T>(before: T, ours: T, theirs: T): T => {
    if (equal(ours, before)) return theirs;
    if (equal(theirs, before) || equal(ours, theirs)) return ours;
    if (
      before &&
      ours &&
      theirs &&
      typeof before === "object" &&
      typeof ours === "object" &&
      typeof theirs === "object" &&
      !Array.isArray(before) &&
      !Array.isArray(ours) &&
      !Array.isArray(theirs)
    ) {
      const original = before as Record<string, unknown>,
        local = ours as Record<string, unknown>,
        remote = theirs as Record<string, unknown>;
      return Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(original),
            ...Object.keys(local),
            ...Object.keys(remote),
          ]),
        ].map((key) => [
          key,
          mergeValue(original[key], local[key], remote[key]),
        ]),
      ) as T;
    }
    throw new Error(
      "Conflito de sincronização. Exporte os dados locais antes de resolver as alterações de outro dispositivo.",
    );
  };
  const mergeList = <T extends { id: string }>(
    before: T[],
    ours: T[],
    theirs: T[],
    mergeItem = mergeValue<T | undefined>,
  ): T[] => {
    const result: T[] = [];
    for (const id of new Set(
      [...before, ...ours, ...theirs].map((item) => item.id),
    )) {
      const value = mergeItem(
        before.find((x) => x.id === id),
        ours.find((x) => x.id === id),
        theirs.find((x) => x.id === id),
      );
      if (value) result.push(value);
    }
    return result;
  };
  const mergeDocument = (
    before: ReaderDocument | undefined,
    ours: ReaderDocument | undefined,
    theirs: ReaderDocument | undefined,
  ): ReaderDocument | undefined => {
    if (!ours || !theirs) return mergeValue(before, ours, theirs);
    const metadata = (book: ReaderDocument | undefined) => {
      if (!book) return undefined;
      const {
        page,
        progress,
        location,
        readingPositionUpdatedAt,
        lastReadAt,
        ...rest
      } = book;
      return rest;
    };
    const originalPosition = before && readingPosition(before);
    const localPosition = readingPosition(ours),
      remotePosition = readingPosition(theirs);
    const position = equal(localPosition, originalPosition)
      ? remotePosition
      : equal(remotePosition, originalPosition) ||
          equal(localPosition, remotePosition)
        ? localPosition
        : ours.readingPositionUpdatedAt || theirs.readingPositionUpdatedAt
          ? readingPosition(newerReadingPosition(ours, theirs))
          : mergeValue(originalPosition, localPosition, remotePosition)!;
    return {
      ...mergeValue(metadata(before), metadata(ours), metadata(theirs))!,
      ...position,
      lastReadAt: [ours.lastReadAt, theirs.lastReadAt]
        .filter((value): value is string => !!value)
        .sort()
        .at(-1),
    };
  };
  return {
    readingDays: Object.fromEntries(
      [
        ...new Set([
          ...Object.keys(local.readingDays ?? {}),
          ...Object.keys(remote.readingDays ?? {}),
        ]),
      ].map((day) => [
        day,
        (remote.readingDays?.[day] ?? 0) +
          Math.max(
            0,
            (local.readingDays?.[day] ?? 0) - (base.readingDays?.[day] ?? 0),
          ),
      ]),
    ),
    documents: mergeList(
      base.documents,
      local.documents,
      remote.documents,
      mergeDocument,
    ),
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
