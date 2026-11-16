import { useLibrary } from "@/modules/library/store";
import { downloadBlob } from "@/modules/reader/export";

export function exportLibraryBackup() {
  const {
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
    documents,
    annotations,
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
