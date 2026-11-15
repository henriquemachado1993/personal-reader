import { openDB } from "idb";
import type { LibraryState } from "@/shared/types";
let scope = "uninitialized";
export function setStorageScope(userId: string) {
  scope = userId;
}
const db = () =>
  openDB(`personal-reader-${scope}`, 1, {
    upgrade(database) {
      database.createObjectStore("state");
      database.createObjectStore("files");
    },
  });
export async function readState(): Promise<LibraryState | undefined> {
  return (await db()).get("state", "library");
}
export async function writeState(state: LibraryState) {
  return (await db()).put("state", structuredClone(state), "library");
}
export async function saveFile(id: string, file: Blob) {
  return (await db()).put("files", file, id);
}
export async function readFile(id: string): Promise<Blob | undefined> {
  const database = await db();
  const cached = await database.get("files", id);
  if (cached) return cached;
  const response = await fetch(`/api/library/files/${encodeURIComponent(id)}`);
  if (!response.ok) return undefined;
  const file = await response.blob();
  await database.put("files", file, id);
  return file;
}
export async function removeFile(id: string) {
  return (await db()).delete("files", id);
}

export async function readSyncRecord<T>(): Promise<T | undefined> {
  return (await db()).get("state", "sync");
}
export async function writeSyncRecord(record: unknown) {
  return (await db()).put("state", structuredClone(record), "sync");
}
export async function readCachedFile(id: string): Promise<Blob | undefined> {
  return (await db()).get("files", id);
}
