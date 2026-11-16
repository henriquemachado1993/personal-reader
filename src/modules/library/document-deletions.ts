import type { LibraryState } from "@/shared/types";

export function removeDeletedDocuments(
  snapshot: LibraryState,
  ids: readonly string[],
): LibraryState {
  if (!ids.length) return snapshot;
  const deleted = new Set(ids);
  return {
    ...snapshot,
    documents: snapshot.documents.filter((book) => !deleted.has(book.id)),
    annotations: snapshot.annotations.filter(
      (note) => !deleted.has(note.documentId),
    ),
    bookmarks: snapshot.bookmarks.filter(
      (mark) => !deleted.has(mark.documentId),
    ),
  };
}
