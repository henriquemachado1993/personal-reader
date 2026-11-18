import { openDB, type IDBPDatabase } from "idb";
import type { LibraryState } from "@/shared/types";
let scope = "uninitialized";
export function setStorageScope(userId: string) {
  scope = userId;
}
const connections = new Map<string, Promise<IDBPDatabase>>();
export function getStorageScope() {
  return scope;
}
function db(ownerId = scope) {
  const name = `personal-reader-${ownerId}`;
  const existing = connections.get(name);
  if (existing) return existing;
  const connection = openDB(name, 1, {
    upgrade(database) {
      database.createObjectStore("state");
      database.createObjectStore("files");
    },
    blocking() {
      connections.delete(name);
      void connection.then((database) => database.close());
    },
    terminated() {
      connections.delete(name);
    },
  });
  connections.set(name, connection);
  void connection.catch(() => {
    if (connections.get(name) === connection) connections.delete(name);
  });
  return connection;
}
export async function readState(
  ownerId?: string,
): Promise<LibraryState | undefined> {
  return (await db(ownerId)).get("state", "library");
}
export async function writeState(state: LibraryState, ownerId?: string) {
  return (await db(ownerId)).put("state", structuredClone(state), "library");
}
export async function saveFile(id: string, file: Blob, ownerId?: string) {
  return (await db(ownerId)).put("files", file, id);
}
export async function readFile(
  id: string,
  ownerId = scope,
): Promise<Blob | undefined> {
  const database = await db(ownerId);
  const cached = await database.get("files", id);
  if (cached) return cached;
  if (ownerId !== scope) return undefined;
  const response = await fetch(`/api/library/files/${encodeURIComponent(id)}`);
  if (!response.ok) return undefined;
  const file = await response.blob();
  await database.put("files", file, id);
  return file;
}
export async function removeFile(id: string) {
  return (await db()).delete("files", id);
}

export async function readSyncRecord<T>(
  ownerId?: string,
): Promise<T | undefined> {
  return (await db(ownerId)).get("state", "sync");
}
export async function writeSyncRecord(record: unknown, ownerId?: string) {
  return (await db(ownerId)).put("state", structuredClone(record), "sync");
}
export async function readCachedFile(
  id: string,
  ownerId?: string,
): Promise<Blob | undefined> {
  return (await db(ownerId)).get("files", id);
}

const editKey = (id: string) => `local-edit:${id}`;

export async function pruneLocalEditReceipts(ownerId: string) {
  const database = await db(ownerId);
  const tx = database.transaction("state", "readwrite");
  const cutoff = Date.now() - 7 * 86_400_000;
  const range = IDBKeyRange.bound(
    editKey(""),
    editKey(String(cutoff)),
    false,
    true,
  );
  for (
    let cursor = await tx.store.openKeyCursor(range);
    cursor;
    cursor = await cursor.continue()
  ) {
    await tx.store.delete(cursor.primaryKey);
  }
  await tx.done;
}

export async function updateLibraryState(
  update: (current: LibraryState | undefined) => LibraryState,
  ownerId: string,
  syncRecord?: unknown,
  editId?: string,
) {
  const database = await db(ownerId);
  const transaction = database.transaction("state", "readwrite");
  try {
    const current = await transaction.store.get("library");
    if (current && editId && (await transaction.store.get(editKey(editId)))) {
      await transaction.done;
      return current as LibraryState;
    }
    const next = update(current as LibraryState | undefined);
    await transaction.store.put(next, "library");
    if (syncRecord) await transaction.store.put(syncRecord, "sync");
    if (editId) await transaction.store.put(true, editKey(editId));
    await transaction.done;
    return next;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* Transaction already closed. */
    }
    await transaction.done.catch(() => {});
    throw error;
  }
}

export async function replaceLocalLibrary(
  ownerId: string,
  state: LibraryState,
  record: unknown,
) {
  const database = await db(ownerId);
  const tx = database.transaction(["state", "files"], "readwrite");
  const stateStore = tx.objectStore("state");
  await Promise.all([
    stateStore.clear(),
    tx.objectStore("files").clear(),
    stateStore.put(state, "library"),
    stateStore.put(record, "sync"),
    tx.done,
  ]);
}
