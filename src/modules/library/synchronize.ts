import type { LibraryState } from "@/shared/types";
import { assetIdPattern } from "@/infrastructure/r2/file-key";
import {
  getStorageScope,
  readCachedFile,
  readState,
  readSyncRecord,
  writeSyncRecord,
} from "@/infrastructure/storage/local";
import { mergeLibrary } from "./sync-merge";
import { initialState } from "./initial-state";
import { readUnsentAsset } from "./library-assets";
import { uploadOriginal } from "./upload-original";
import {
  applyDelta,
  diffLibrary,
  intendedChanges,
  MAX_KEEPALIVE_BYTES,
  MAX_SYNC_BYTES,
  noDeletions,
  type LibraryChange,
  type LibraryDeletions,
  type LibraryDelta,
  type SyncBatch,
} from "./sync-protocol";

interface SynchronizationStorage {
  readState: typeof readState;
  readSyncRecord: typeof readSyncRecord;
  readCachedFile: typeof readCachedFile;
  readUnsentAsset: typeof readUnsentAsset;
  writeSyncRecord: (record: SyncRecord, ownerId: string) => Promise<unknown>;
}

export interface SyncRecord {
  revision: number;
  base: LibraryState;
  uploaded: string[];
  deleted: LibraryDeletions;
  pending?: SyncBatch;
}
export interface SyncOptions {
  pull?: boolean;
  keepalive?: boolean;
  includeReadingTime?: boolean;
  skipPositions?: boolean;
}
export interface SynchronizationResult {
  before: LibraryState;
  snapshot: LibraryState;
  record: SyncRecord;
  pendingOriginals: number;
  retry?: boolean;
  deletedDocumentIds?: string[];
  deletedCollectionIds?: string[];
}

const endpoint = "/api/library/sync";

export function emptySyncRecord(): SyncRecord {
  return {
    revision: 0,
    base: initialState(),
    uploaded: [],
    deleted: noDeletions(),
  };
}

async function errorFor(response: Response): Promise<Error> {
  if (response.status === 401)
    return new Error(
      "Sua sessão não permite sincronizar. Entre novamente na mesma conta.",
    );
  if (response.status === 422)
    return new Error(
      "Um arquivo referenciado está indisponível. Suas alterações continuam neste navegador.",
    );
  return new Error(
    "Sincronização indisponível. Suas alterações continuam neste navegador.",
  );
}

export async function readLibraryDelta(
  revision?: number,
): Promise<LibraryDelta> {
  const url =
    revision === undefined ? endpoint : `${endpoint}?since=${revision}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw await errorFor(response);
  return response.json();
}

function applyRemote(record: SyncRecord, delta: LibraryDelta): SyncRecord {
  const { state, deleted } = applyDelta(
    delta.reset ? initialState() : record.base,
    delta.reset ? noDeletions() : record.deleted,
    delta.changes,
  );
  return {
    revision: delta.revision,
    base: state,
    deleted,
    uploaded: record.uploaded,
  };
}

export async function readLibraryForConflict(): Promise<SyncRecord> {
  return applyRemote(emptySyncRecord(), await readLibraryDelta());
}

function reconcile(
  base: LibraryState,
  local: LibraryState,
  record: SyncRecord,
) {
  return mergeLibrary(
    base,
    local,
    record.base,
    record.deleted.collections,
    record.deleted.documents,
  );
}

export function sendSyncBatch(batch: SyncBatch, keepalive = false) {
  const body = JSON.stringify(batch);
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    keepalive:
      keepalive && new TextEncoder().encode(body).length <= MAX_KEEPALIVE_BYTES,
    body,
  });
}

function assetRefs(change: LibraryChange) {
  if (change.kind === "documents")
    return [change.value?.cover, change.value?.contentAsset];
  if (change.kind === "annotations") return [change.value?.image];
  return [];
}

function knownAssets(state: LibraryState) {
  return new Set([
    ...state.documents.flatMap((book) => [book.cover, book.contentAsset]),
    ...state.annotations.map((annotation) => annotation.image),
  ]);
}

function selectBatch(
  base: SyncRecord,
  changes: LibraryChange[],
  time: SyncBatch["time"],
  limit: number,
) {
  const batch: SyncBatch = {
    baseRevision: base.revision,
    operationId: crypto.randomUUID(),
    changes: [],
    time,
  };
  const encoder = new TextEncoder();
  let bytes = encoder.encode(JSON.stringify(batch)).length;
  for (const change of changes) {
    const changeBytes = encoder.encode(JSON.stringify(change)).length + 1;
    if (batch.changes.length >= 250 || bytes + changeBytes > limit) break;
    batch.changes.push(change);
    bytes += changeBytes;
  }
  return batch;
}

export async function synchronizeLibrary(
  ownerId = getStorageScope(),
  options: SyncOptions = {},
  storage: SynchronizationStorage = {
    readState,
    readSyncRecord,
    readCachedFile,
    readUnsentAsset,
    writeSyncRecord,
  },
): Promise<SynchronizationResult | null> {
  const local = await storage.readState(ownerId);
  if (!local) return null;

  let record =
    (await storage.readSyncRecord<SyncRecord>(ownerId)) ?? emptySyncRecord();
  let desired = local;
  let pendingOriginals = 0;
  const uploaded = new Set(record.uploaded);
  const result = (retry = false): SynchronizationResult => ({
    before: local,
    snapshot: desired,
    record: { ...record, uploaded: [...uploaded] },
    pendingOriginals,
    retry,
    deletedDocumentIds: record.deleted.documents,
    deletedCollectionIds: record.deleted.collections,
  });

  // Replay the exact persisted operation first. A fresh ID could count an accepted duration twice.
  const pending = record.pending;
  if (pending) {
    const response = await sendSyncBatch(pending, options.keepalive);
    if (response.status === 409) {
      const current = applyRemote(
        record,
        await readLibraryDelta(record.revision),
      );
      desired = reconcile(record.base, local, current);
      record = current;
    } else {
      if (!response.ok) throw await errorFor(response);
      const accepted: LibraryDelta = await response.json();
      const intended = applyDelta(
        record.base,
        record.deleted,
        intendedChanges(record.base, pending),
      ).state;
      const current = applyRemote(
        record,
        accepted.replayed ? await readLibraryDelta(record.revision) : accepted,
      );
      // Commit the receipt and its rebase locally before producing another operation.
      desired = reconcile(intended, local, current);
      record = current;
    }
    return result(true);
  }

  if (options.pull) {
    const current = applyRemote(
      record,
      await readLibraryDelta(record.revision),
    );
    desired = reconcile(record.base, local, current);
    record = current;
    // The caller must persist both the new base and rebased local changes before writing again.
    const remaining = diffLibrary(record.base, desired);
    if (
      remaining.changes.length ||
      (remaining.time && options.includeReadingTime !== false)
    )
      return result(true);
  }

  const candidate = diffLibrary(record.base, desired);
  const existingBooks = new Set(record.base.documents.map((book) => book.id));
  const ready: LibraryChange[] = [];
  const ordered = [...candidate.changes].sort((a, b) => {
    const priorities = [
      "positions",
      "collections",
      "documents",
      "annotations",
      "bookmarks",
      "preferences",
    ];
    return priorities.indexOf(a.kind) - priorities.indexOf(b.kind);
  });
  const available = knownAssets(record.base);
  const existingPositions = ordered.filter(
    (change) => change.kind === "positions" && existingBooks.has(change.id),
  );
  // A file upload can take longer or fail. Commit independent progress before starting it.
  const sendPositionsFirst =
    !options.keepalive &&
    existingPositions.length > 0 &&
    ordered.some((change) =>
      assetRefs(change).some(
        (id) => id && assetIdPattern.test(id) && !available.has(id),
      ),
    );
  const deferredPositions: LibraryChange[] = [];
  for (const change of sendPositionsFirst ? existingPositions : ordered) {
    if (options.skipPositions && change.kind === "positions") continue;
    if (change.kind === "positions" && !existingBooks.has(change.id)) {
      deferredPositions.push(change);
      continue;
    }
    if (options.keepalive && change.kind !== "positions") continue;
    let failed = false;
    for (const id of assetRefs(change)) {
      if (!id || !assetIdPattern.test(id) || available.has(id)) continue;
      try {
        const file = await storage.readUnsentAsset(id, ownerId);
        if (!file) throw new Error("Arquivo local indisponível.");
        await uploadOriginal(id, file);
        available.add(id);
      } catch {
        pendingOriginals++;
        failed = true;
        break;
      }
    }
    if (!failed) ready.push(change);
  }
  const created = new Set(
    ready
      .filter((change) => change.kind === "documents" && change.value)
      .map((change) => change.id),
  );
  if (!options.keepalive)
    ready.push(...deferredPositions.filter((change) => created.has(change.id)));
  const changes = ready.filter(
    (change) =>
      (change.kind !== "annotations" && change.kind !== "bookmarks") ||
      !change.value ||
      existingBooks.has(change.value.documentId) ||
      created.has(change.value.documentId),
  );
  const batch = selectBatch(
    record,
    changes,
    options.includeReadingTime === false ? undefined : candidate.time,
    options.keepalive ? MAX_KEEPALIVE_BYTES : MAX_SYNC_BYTES,
  );

  if (batch.changes.length || batch.time) {
    // Disk persistence and server commit are separate. The ID survives a lost response and reload.
    await storage.writeSyncRecord({ ...record, pending: batch }, ownerId);
    const response = await sendSyncBatch(batch, options.keepalive);
    if (response.status === 409) {
      const current = applyRemote(
        record,
        await readLibraryDelta(record.revision),
      );
      desired = reconcile(record.base, desired, current);
      record = current;
      return result(true);
    }
    if (!response.ok) throw await errorFor(response);
    const accepted: LibraryDelta = await response.json();
    const intended = applyDelta(
      record.base,
      record.deleted,
      intendedChanges(record.base, batch),
    ).state;
    const current = applyRemote(
      record,
      accepted.replayed ? await readLibraryDelta(record.revision) : accepted,
    );
    desired = reconcile(intended, desired, current);
    record = current;
  }

  if (!options.keepalive) {
    const live = new Set(record.base.documents.map((book) => book.id));
    for (const book of desired.documents) {
      if (book.demo || !live.has(book.id) || uploaded.has(book.id)) continue;
      const original = await storage.readCachedFile(book.id, ownerId);
      if (!original) continue;
      try {
        await uploadOriginal(book.id, original);
        uploaded.add(book.id);
      } catch {
        pendingOriginals++;
      }
    }
  }
  return result(
    sendPositionsFirst ||
      (!options.keepalive && changes.length > batch.changes.length),
  );
}
