import type { LibraryState } from "@/shared/types";

export function removeDeletedCollections(
  snapshot: LibraryState,
  deletedIds: readonly string[],
): LibraryState {
  if (!deletedIds.length) return snapshot;
  const deleted = new Set(deletedIds);
  return {
    ...snapshot,
    collections: snapshot.collections.filter((item) => !deleted.has(item.id)),
    documents: snapshot.documents.map((item) =>
      item.collections.some((id) => deleted.has(id))
        ? {
            ...item,
            collections: item.collections.filter((id) => !deleted.has(id)),
          }
        : item,
    ),
  };
}
