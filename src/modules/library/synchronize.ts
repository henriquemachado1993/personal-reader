import type { LibraryState } from "@/shared/types";
import {
  readState,
  readSyncRecord,
  writeSyncRecord,
  readCachedFile,
  getStorageScope,
} from "@/infrastructure/storage/local";
import { mergeLibrary } from "./sync-merge";
import { initialState } from "./initial-state";
import { canonicalJson } from "./canonical-json";
import { uploadOriginal } from "./upload-original";
import { saveLibrarySnapshot } from "./snapshot-transfer";

interface SynchronizationStorage {
  readState: typeof readState;
  readSyncRecord: typeof readSyncRecord;
  readCachedFile: typeof readCachedFile;
  writeSyncRecord: (record: unknown, ownerId?: string) => Promise<unknown>;
}

export interface SyncRecord {
  revision: number;
  base: LibraryState;
  uploaded: string[];
  pending?: {
    operationId: string;
    revision: number;
    snapshot: LibraryState;
    before?: LibraryState;
  };
}
interface Replica {
  deletedCollectionIds?: string[];
  deletedDocumentIds?: string[];
  acknowledgedOperationId?: string;
  revision: number;
  snapshot: LibraryState;
  operationId: string;
}
export class SyncRevisionError extends Error {
  constructor() {
    super("Outra sessão atualizou a biblioteca. Tentando conciliar novamente.");
  }
}
export interface SynchronizationResult {
  before: LibraryState;
  snapshot: LibraryState;
  record: SyncRecord;
  pendingOriginals: number;
  retry?: boolean;
  deletedDocumentIds?: string[];
}

export async function readLibraryForConflict(): Promise<Replica> {
  const response = await fetch("/api/library", { cache: "no-store" });
  if (!response.ok) throw new Error("Conecte-se para resolver o conflito.");
  const remote: Replica | null = await response.json();
  if (!remote) throw new Error("A biblioteca remota não está disponível.");
  return remote;
}

export async function synchronizeLibrary(
  ownerId = getStorageScope(),
  storage: SynchronizationStorage = {
    readState,
    readSyncRecord,
    writeSyncRecord,
    readCachedFile,
  },
): Promise<SynchronizationResult | null> {
  const local = await storage.readState(ownerId);
  if (!local) return null;
  const record = await storage.readSyncRecord<SyncRecord>(ownerId);
  const query = record?.pending
    ? `?operationId=${encodeURIComponent(record.pending.operationId)}`
    : "";
  const response = await fetch(`/api/library${query}`, { cache: "no-store" });
  if (!response.ok)
    throw new Error(
      "Sincronização indisponível. Suas alterações continuam neste navegador.",
    );
  const remote: Replica | null = await response.json();
  const uploaded = [...(record?.uploaded ?? [])];
  if (
    record?.pending &&
    remote &&
    (remote.operationId === record.pending.operationId ||
      remote.acknowledgedOperationId === record.pending.operationId)
  ) {
    // Recover an accepted write before sending another one, without counting it twice.
    const recovered = mergeLibrary(
      record.pending.before ?? record.base,
      local,
      remote.snapshot,
      remote.deletedCollectionIds,
      remote.deletedDocumentIds,
    );
    if (!record.pending.before) {
      // Legacy records lack the input snapshot; never count their accepted totals again.
      recovered.readingSeconds =
        remote.snapshot.readingSeconds +
        Math.max(
          0,
          local.readingSeconds - record.pending.snapshot.readingSeconds,
        );
      for (const day of Object.keys(recovered.readingDays ?? {}))
        recovered.readingDays![day] =
          (remote.snapshot.readingDays?.[day] ?? 0) +
          Math.max(
            0,
            (local.readingDays?.[day] ?? 0) -
              (record.pending.snapshot.readingDays?.[day] ?? 0),
          );
    }
    return {
      before: local,
      snapshot: recovered,
      deletedDocumentIds: remote.deletedDocumentIds,
      record: { revision: remote.revision, base: remote.snapshot, uploaded },
      pendingOriginals: 0,
      retry: true,
    };
  }
  const snapshot = remote
    ? mergeLibrary(
        record?.base ?? initialState(),
        local,
        remote.snapshot,
        remote.deletedCollectionIds,
        remote.deletedDocumentIds,
      )
    : local;
  let checkpoint: SyncRecord = {
    ...record,
    revision: record?.revision ?? 0,
    base: record?.base ?? initialState(),
    uploaded,
  };
  let acknowledged = remote;
  if (!remote || canonicalJson(snapshot) !== canonicalJson(remote.snapshot)) {
    const pending = {
      revision: remote?.revision ?? 0,
      snapshot,
      before: local,
      operationId: crypto.randomUUID(),
    };
    checkpoint = { ...checkpoint, pending };
    await storage.writeSyncRecord(checkpoint, ownerId);
    const saved = await saveLibrarySnapshot({
      revision: pending.revision,
      snapshot,
      operationId: pending.operationId,
    });
    if (saved.status === 409) throw new SyncRevisionError();
    if (!saved.ok)
      throw new Error(
        "Não foi possível sincronizar. A cópia local está preservada.",
      );
    acknowledged = await saved.json();
  }
  let pendingOriginals = 0;
  for (const book of snapshot.documents.filter(
    (book) => !book.demo && !uploaded.includes(book.id),
  )) {
    const original = await storage.readCachedFile(book.id, ownerId);
    if (!original) continue;
    try {
      await uploadOriginal(book.id, original);
      uploaded.push(book.id);
      await storage.writeSyncRecord({ ...checkpoint, uploaded }, ownerId);
    } catch {
      pendingOriginals++;
    }
  }
  const replica = acknowledged!;
  return {
    before: local,
    snapshot: replica.snapshot,
    record: { revision: replica.revision, base: replica.snapshot, uploaded },
    pendingOriginals,
    deletedDocumentIds: remote?.deletedDocumentIds,
  };
}
