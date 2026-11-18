import type { LibraryState } from "@/shared/types";
import {
  pruneLocalEditReceipts,
  readSyncRecord,
  updateLibraryState,
} from "@/infrastructure/storage/local";
import type { SyncRecord } from "./synchronize";
import { initialState } from "./initial-state";
import {
  applyDelta,
  intendedChanges,
  noDeletions,
  type SyncBatch,
} from "./sync-protocol";

const prefix = (ownerId: string) => `reader-local-edit:${ownerId}:`;
let sequence = 0;

// A synchronous record covers the interval before IndexedDB commits when a tab closes.
export function recordLocalEdit(ownerId: string, edit: SyncBatch) {
  const id = `${Date.now()}-${String(++sequence).padStart(8, "0")}-${edit.operationId}`;
  try {
    localStorage.setItem(prefix(ownerId) + id, JSON.stringify(edit));
  } catch {
    // IndexedDB still persists the edit when localStorage has reached its quota.
  }
  return id;
}

export function finishLocalEdit(ownerId: string, id: string) {
  try {
    localStorage.removeItem(prefix(ownerId) + id);
  } catch {
    // The IndexedDB receipt prevents applying it again during restoration.
  }
}

export function applyLocalEdit(
  state: LibraryState,
  edit: SyncBatch,
  deleted = noDeletions(),
) {
  return applyDelta(state, deleted, intendedChanges(state, edit)).state;
}

export async function recoverLocalEdits(ownerId: string) {
  const accountPrefix = prefix(ownerId);
  let keys: string[];
  try {
    keys = Object.keys(localStorage)
      .filter((key) => key.startsWith(accountPrefix))
      .sort();
  } catch {
    return;
  }
  const record = await readSyncRecord<SyncRecord>(ownerId);
  for (const key of keys) {
    const body = localStorage.getItem(key);
    if (!body) continue;
    const id = key.slice(accountPrefix.length);
    // Journal entries originate in this browser, but interrupted storage or old dev data can be invalid.
    let batch: SyncBatch;
    try {
      batch = JSON.parse(body);
      if (!batch || !Array.isArray(batch.changes)) continue;
    } catch {
      continue;
    }
    await updateLibraryState(
      (state) =>
        applyLocalEdit(state ?? initialState(), batch, record?.deleted),
      ownerId,
      undefined,
      id,
    );
    finishLocalEdit(ownerId, id);
  }
  void pruneLocalEditReceipts(ownerId).catch(() => {});
}

export const localResetKey = (ownerId: string) =>
  `reader-local-reset:${ownerId}`;

export function clearLocalEdits(ownerId: string) {
  const accountPrefix = prefix(ownerId);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(accountPrefix)) localStorage.removeItem(key);
  }
}
