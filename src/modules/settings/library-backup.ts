import { useLibrary } from "@/modules/library/store";
import {
  portableAssetSource,
  readDocumentContent,
} from "@/modules/library/library-assets";
import { downloadBlob } from "@/modules/reader/export";

export async function exportLibraryBackup() {
  const {
    ownerId,
    documents,
    annotations,
    collections,
    bookmarks,
    preferences,
    readingSeconds,
    readingDays,
  } = useLibrary.getState();
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    documents: await Promise.all(
      documents.map(async ({ contentAsset, ...book }) => ({
        ...book,
        cover: await portableAssetSource(book.cover, ownerId),
        content: contentAsset
          ? await readDocumentContent(contentAsset, ownerId)
          : book.content,
      })),
    ),
    annotations: await Promise.all(
      annotations.map(async (annotation) => ({
        ...annotation,
        image: annotation.image
          ? await portableAssetSource(annotation.image, ownerId)
          : undefined,
      })),
    ),
    collections,
    bookmarks,
    preferences,
    readingSeconds,
    readingDays,
  };
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    "personal-reader-backup.json",
  );
}
