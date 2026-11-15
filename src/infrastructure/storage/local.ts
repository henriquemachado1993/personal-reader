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
  return (await db()).get("files", id);
}
export async function removeFile(id: string) {
  return (await db()).delete("files", id);
}
