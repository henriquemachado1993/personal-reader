import type { LibraryState } from "@/shared/types";
import {
  readState,
  readSyncRecord,
  writeSyncRecord,
  readCachedFile,
} from "@/infrastructure/storage/local";
import { mergeLibrary } from "./sync-merge";
import { initialState } from "./initial-state";

interface SyncRecord {
  revision: number;
  base: LibraryState;
  uploaded: string[];
  pending?: { operationId: string; revision: number; snapshot: LibraryState };
}
interface Replica {
  revision: number;
  snapshot: LibraryState;
  operationId: string;
}

export async function resolveLibraryConflict(preferLocal: boolean) {
  const response = await fetch("/api/library", { cache: "no-store" });
  if (!response.ok) throw new Error("Conecte-se para resolver o conflito.");
  const remote: Replica = await response.json();
  const record = await readSyncRecord<SyncRecord>();
  await writeSyncRecord({
    revision: remote.revision,
    base: remote.snapshot,
    uploaded: record?.uploaded ?? [],
  });
  return preferLocal ? null : remote.snapshot;
}

export async function synchronizeLibrary(): Promise<{
  before: LibraryState;
  snapshot: LibraryState;
} | null> {
  const local = await readState();
  if (!local) return null;
  const response = await fetch("/api/library", { cache: "no-store" });
  if (!response.ok)
    throw new Error(
      "Sincronização indisponível. Suas alterações continuam neste navegador.",
    );
  const remote: Replica | null = await response.json();
  let record = await readSyncRecord<SyncRecord>();
  if (record?.pending && remote?.operationId === record.pending.operationId) {
    record = {
      ...record,
      revision: remote.revision,
      base: record.pending.snapshot,
      pending: undefined,
    };
    await writeSyncRecord(record);
  }
  // A newly connected browser adopts remote state; existing local libraries merge by ID.
  const snapshot = remote
    ? mergeLibrary(record?.base ?? initialState(), local, remote.snapshot)
    : local;
  const uploaded = record?.uploaded ?? [];
  for (const book of snapshot.documents.filter(
    (book) => !book.demo && !uploaded.includes(book.id),
  )) {
    const original = await readCachedFile(book.id);
    if (!original) continue; // Remote originals are fetched lazily by the reader.
    const result = await fetch(
      `/api/library/files/${encodeURIComponent(book.id)}`,
      { method: "PUT", body: original },
    );
    if (!result.ok)
      throw new Error(
        "Não foi possível enviar os originais. A sincronização tentará novamente.",
      );
    uploaded.push(book.id);
    await writeSyncRecord({
      ...record,
      revision: record?.revision ?? 0,
      base: record?.base ?? initialState(),
      uploaded,
    });
  }
  if (remote && JSON.stringify(snapshot) === JSON.stringify(remote.snapshot)) {
    await writeSyncRecord({
      revision: remote.revision,
      base: snapshot,
      uploaded,
    });
    return { before: local, snapshot };
  }
  const pending = {
    revision: remote?.revision ?? 0,
    snapshot,
    operationId: crypto.randomUUID(),
  };
  await writeSyncRecord({
    revision: record?.revision ?? 0,
    base: record?.base ?? initialState(),
    uploaded,
    pending,
  });
  const saved = await fetch("/api/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pending),
  });
  if (!saved.ok)
    throw new Error(
      saved.status === 409
        ? "Outra sessão atualizou a biblioteca. Tentando conciliar novamente."
        : "Não foi possível sincronizar. A cópia local está preservada.",
    );
  const replica: Replica = await saved.json();
  await writeSyncRecord({
    revision: replica.revision,
    base: snapshot,
    uploaded,
  });
  return { before: local, snapshot };
}
