"use client";
import { create } from "zustand";
import type {
  Annotation,
  Bookmark,
  Collection,
  LibraryState,
  Preferences,
  ReaderDocument,
} from "@/shared/types";
import { initialState } from "./initial-state";
import { sameLocation } from "@/modules/reader/location";
import {
  synchronizeLibrary,
  sendSyncBatch,
  type SyncOptions,
  readLibraryForConflict,
  type SyncRecord,
} from "./synchronize";
import { mergeLibrary } from "./sync-merge";
import { canonicalJson } from "./canonical-json";
import {
  applyDelta,
  diffLibrary,
  MAX_KEEPALIVE_BYTES,
  type SyncBatch,
} from "./sync-protocol";
import { readingPosition, nextReadingTimestamp } from "./reading-position";
import {
  applyLocalEdit,
  clearLocalEdits,
  localResetKey,
  finishLocalEdit,
  recordLocalEdit,
  recoverLocalEdits,
} from "./local-edit-journal";
import { addDailySeconds } from "./reading-calendar";
import {
  readState,
  replaceLocalLibrary,
  readSyncRecord,
  writeState,
  removeFile,
  setStorageScope,
  updateLibraryState,
} from "@/infrastructure/storage/local";

import { clearAppCache } from "@/modules/settings/app-cache";

interface Store extends LibraryState {
  hydrated: boolean;
  changeVersion: number;
  remotePositionVersion: Record<string, number>;
  storageError: string;
  notice: string;
  ownerId: string;
  ownerName: string;
  syncMessage: string;
  synchronizing: boolean;
  lastSyncedAt: string | null;
  revision: number;
  synchronize: (options?: SyncOptions) => Promise<void>;
  flush: () => void;
  resetLocal: () => Promise<void>;
  suspendLocalWrites: () => void;
  resolveConflict: (preferLocal: boolean) => Promise<void>;
  hydrate: (userId?: string, name?: string) => Promise<void>;
  dismissNotice: () => void;
  notify: (message: string) => void;
  addDocuments: (docs: ReaderDocument[]) => void;
  updateDocument: (id: string, patch: Partial<ReaderDocument>) => void;
  deleteDocument: (id: string) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  toggleBookmark: (bookmark: Bookmark) => void;
  setPreferences: (patch: Partial<Preferences>) => void;
  addReadingTime: (seconds: number) => void;
}
export const useLibrary = create<Store>((set, get) => {
  let persistence = Promise.resolve();
  let inFlight: Promise<void> | undefined;
  const positionSends = new Set<Promise<void | boolean>>();
  let queued: SyncOptions | undefined;
  let persistedView = initialState();
  let checkpoint: SyncRecord | undefined;
  let resetting = false;
  let lastFlushedPositions = "";

  const snapshotOf = (state: LibraryState): LibraryState => ({
    documents: state.documents,
    collections: state.collections,
    annotations: state.annotations,
    bookmarks: state.bookmarks,
    preferences: state.preferences,
    readingSeconds: state.readingSeconds,
    readingDays: state.readingDays,
  });

  const persist = (schedule = true) => {
    if (resetting) return;
    const state = get();
    const { ownerId } = state;
    const before = persistedView;
    const next = snapshotOf(state);
    if (canonicalJson(before) === canonicalJson(next)) return;
    persistedView = next;
    const change = diffLibrary(before, next);
    const edit = {
      ...change,
      baseRevision: 0,
      operationId: crypto.randomUUID(),
    };
    const editId = recordLocalEdit(ownerId, edit);
    set({
      syncMessage: "Alterações salvas neste navegador. Sincronização pendente.",
      changeVersion: state.changeVersion + (schedule ? 1 : 0),
    });
    persistence = persistence
      .catch(() => {})
      .then(async () => {
        await updateLibraryState(
          (current) => {
            if (!current) return next;
            try {
              return mergeLibrary(before, next, current);
            } catch {
              // Two open tabs share one cache. The last local edit wins for a field edited in both.
              return applyLocalEdit(current, edit);
            }
          },
          ownerId,
          undefined,
          editId,
        );
        finishLocalEdit(ownerId, editId);
        if (get().ownerId === ownerId) set({ storageError: "" });
      })
      .catch(() => {
        if (get().ownerId === ownerId)
          set({
            storageError:
              "Não foi possível salvar neste navegador. Verifique o espaço disponível e exporte suas notas antes de fechar.",
          });
      });
  };

  const applyToView = (snapshot: LibraryState) => {
    const current = get();
    const before = new Map(current.documents.map((book) => [book.id, book]));
    const remotePositionVersion = { ...current.remotePositionVersion };
    for (const book of snapshot.documents) {
      const prior = before.get(book.id);
      if (
        !prior ||
        canonicalJson(readingPosition(prior)) !==
          canonicalJson(readingPosition(book))
      )
        remotePositionVersion[book.id] =
          (remotePositionVersion[book.id] ?? 0) + 1;
    }
    persistedView = snapshotOf(snapshot);
    set({
      ...snapshot,
      remotePositionVersion,
      storageError: "",
      revision: checkpoint?.revision ?? 0,
    });
  };

  const runWithLock = async (ownerId: string, execute: () => Promise<void>) => {
    if (navigator.locks)
      await navigator.locks.request(`reader-sync-${ownerId}`, execute);
    else await execute();
  };

  return {
    ...initialState(),
    hydrated: false,
    changeVersion: 0,
    revision: 0,
    remotePositionVersion: {},
    storageError: "",
    notice: "",
    ownerId: "",
    ownerName: "Leitor",
    syncMessage: "Alterações salvas neste navegador.",
    synchronizing: false,
    lastSyncedAt: null,
    synchronize: async (options = { pull: true }) => {
      if (resetting || !navigator.onLine || !get().hydrated) return;
      if (inFlight) {
        queued = {
          pull: queued?.pull || options.pull,
          keepalive: queued
            ? queued.keepalive && options.keepalive
            : options.keepalive,
          skipPositions: queued
            ? queued.skipPositions && options.skipPositions
            : options.skipPositions,
          includeReadingTime:
            queued?.includeReadingTime === true ||
            options.includeReadingTime !== false,
        };
        return inFlight;
      }
      const ownerId = get().ownerId;
      inFlight = runWithLock(ownerId, async () => {
        if (get().ownerId !== ownerId) return;
        set({ synchronizing: true });
        let request = options;
        for (let attempt = 0; attempt < 20; attempt++) {
          try {
            await persistence;
            if (resetting || get().ownerId !== ownerId) return;
            if (get().storageError)
              await writeState(snapshotOf(get()), ownerId);
            const result = await synchronizeLibrary(ownerId, request);
            if (!result || get().ownerId !== ownerId) return;
            const commit = persistence.then(async () => {
              if (get().ownerId !== ownerId) return;
              const beforeCommit = snapshotOf(get());
              const integrate = (
                before: LibraryState,
                ours: LibraryState,
                theirs: LibraryState,
              ) =>
                mergeLibrary(
                  before,
                  ours,
                  theirs,
                  result.deletedCollectionIds,
                  result.deletedDocumentIds,
                );
              const disk = await updateLibraryState(
                (current) =>
                  integrate(
                    result.before,
                    current ?? result.before,
                    result.snapshot,
                  ),
                ownerId,
                result.record,
              );
              if (get().ownerId !== ownerId) return;
              checkpoint = result.record;
              applyToView(integrate(beforeCommit, snapshotOf(get()), disk));
            });
            persistence = commit.catch(() => {});
            await commit;
            if (get().ownerId !== ownerId) return;
            const next = queued;
            queued = undefined;
            if ((result.retry && !request.keepalive) || next) {
              request = next ?? { ...request, pull: false };
              continue;
            }
            const unsent = diffLibrary(result.record.base, snapshotOf(get()));
            set({
              syncMessage: result.pendingOriginals
                ? "Há arquivos pendentes de envio. Suas alterações continuam neste navegador."
                : unsent.changes.length || unsent.time
                  ? "Alterações salvas neste navegador. Sincronização pendente."
                  : "Biblioteca sincronizada.",
              lastSyncedAt: new Date().toISOString(),
            });
            return;
          } catch (error) {
            if (get().ownerId !== ownerId) return;
            set({
              syncMessage:
                error instanceof TypeError
                  ? "Não foi possível conectar à sincronização. Suas alterações continuam neste navegador."
                  : error instanceof Error
                    ? error.message
                    : "Sincronização pendente.",
            });
            return;
          }
        }
      }).finally(() => {
        inFlight = undefined;
        if (get().ownerId !== ownerId) return;
        set({ synchronizing: false });
        const next = queued;
        queued = undefined;
        if (next) void get().synchronize(next);
      });
      return inFlight;
    },
    flush: () => {
      if (resetting || !navigator.onLine || !get().hydrated) return;
      // A queued write can outlive pagehide. Position updates are safe to send independently.
      if (checkpoint) {
        const positions = diffLibrary(
          checkpoint.base,
          snapshotOf(get()),
        ).changes.filter((change) => change.kind === "positions");
        const batch: SyncBatch = {
          operationId: crypto.randomUUID(),
          baseRevision: checkpoint.revision,
          changes: [],
        };
        let bytes = new TextEncoder().encode(JSON.stringify(batch)).length;
        for (const position of positions) {
          if (
            !checkpoint.base.documents.some((book) => book.id === position.id)
          )
            continue;
          bytes +=
            new TextEncoder().encode(JSON.stringify(position)).length + 1;
          if (bytes > MAX_KEEPALIVE_BYTES || batch.changes.length >= 250) break;
          batch.changes.push(position);
        }
        const positionsKey = canonicalJson(batch.changes);
        if (batch.changes.length && positionsKey !== lastFlushedPositions) {
          lastFlushedPositions = positionsKey;
          const positionSend = sendSyncBatch(batch, true)
            .then((response) => {
              if (!response.ok && lastFlushedPositions === positionsKey)
                lastFlushedPositions = "";
            })
            .catch(() => {
              if (lastFlushedPositions === positionsKey)
                lastFlushedPositions = "";
            })
            .finally(() => positionSends.delete(positionSend));
          positionSends.add(positionSend);
        }
      }
      void get().synchronize({ keepalive: true, skipPositions: true });
    },
    suspendLocalWrites: () => {
      resetting = true;
      queued = undefined;
    },
    resetLocal: async () => {
      if (resetting) return;
      if (!navigator.onLine)
        throw new Error("Conecte-se para baixar a biblioteca da conta.");
      const { ownerId } = get();
      get().suspendLocalWrites();
      try {
        await Promise.all([inFlight, ...positionSends]);
        await runWithLock(ownerId, async () => {
          await persistence;
          const remote = await readLibraryForConflict();
          if (get().ownerId !== ownerId)
            throw new Error("A conta mudou durante a limpeza.");
          if ("caches" in window) await clearAppCache(window.caches);
          clearLocalEdits(ownerId);
          localStorage.removeItem("personal-reader:library-view");
          await replaceLocalLibrary(ownerId, remote.base, remote);
          const key = localResetKey(ownerId);
          localStorage.setItem(key, crypto.randomUUID());
          localStorage.removeItem(key);
        });
      } catch (error) {
        resetting = false;
        throw error;
      }
    },
    resolveConflict: async (preferLocal) => {
      await inFlight;
      if (resetting) return;
      const ownerId = get().ownerId;
      await runWithLock(ownerId, async () => {
        await persistence;
        if (resetting) return;
        const remote = await readLibraryForConflict();
        if (get().ownerId !== ownerId) return;
        const record = await readSyncRecord<SyncRecord>(ownerId);
        const { deleted } = remote;
        const next = { ...remote, uploaded: record?.uploaded ?? [] };
        const disk = await updateLibraryState(
          (current) =>
            preferLocal
              ? applyDelta(current ?? snapshotOf(get()), deleted, []).state
              : remote.base,
          ownerId,
          next,
        );
        if (get().ownerId !== ownerId) return;
        checkpoint = next;
        applyToView(disk);
      });
      await get().synchronize({ pull: false });
    },
    hydrate: async (userId, name) => {
      if (!userId || (get().hydrated && get().ownerId === userId)) return;
      persistedView = initialState();
      checkpoint = undefined;
      lastFlushedPositions = "";
      set({
        ...persistedView,
        hydrated: false,
        revision: 0,
        remotePositionVersion: {},
        synchronizing: false,
        lastSyncedAt: null,
        ownerId: userId,
        ownerName: name ?? "Leitor",
      });
      setStorageScope(userId);
      try {
        await recoverLocalEdits(userId);
        const [saved, record] = await Promise.all([
          readState(userId),
          readSyncRecord<SyncRecord>(userId),
        ]);
        if (get().ownerId !== userId) return;
        checkpoint = record;
        if (saved) applyToView(saved);
        else
          await updateLibraryState(
            (current) => current ?? initialState(),
            userId,
          );
      } catch {
        if (get().ownerId === userId)
          set({
            storageError:
              "O armazenamento local está indisponível. Permita os dados do site para guardar suas leituras.",
          });
      }
      if (get().ownerId === userId) set({ hydrated: true });
    },
    notify: (notice) => set({ notice }),
    dismissNotice: () => set({ notice: "" }),
    addDocuments: (docs) => {
      set((s) => ({ documents: [...docs, ...s.documents] }));
      persist();
    },
    updateDocument: (id, patch) => {
      set((s) => ({
        documents: s.documents.map((d) =>
          d.id === id
            ? (() => {
                const next = { ...d, ...patch };
                const positionChanged =
                  ["page", "progress", "location"].some(
                    (key) => key in patch,
                  ) &&
                  canonicalJson(readingPosition(d)) !==
                    canonicalJson(readingPosition(next));
                return positionChanged
                  ? {
                      ...next,
                      readingPositionUpdatedAt: nextReadingTimestamp(
                        d.readingPositionUpdatedAt,
                      ),
                      lastReadAt: new Date().toISOString(),
                    }
                  : next;
              })()
            : d,
        ),
      }));
      persist();
    },
    deleteDocument: (id) => {
      set((s) => ({
        documents: s.documents.filter((d) => d.id !== id),
        annotations: s.annotations.filter((a) => a.documentId !== id),
        bookmarks: s.bookmarks.filter((b) => b.documentId !== id),
      }));
      persist();
      void removeFile(id).catch(() =>
        get().notify(
          "Documento removido. Não foi possível liberar o arquivo local.",
        ),
      );
    },
    addAnnotation: (annotation) => {
      set((s) => ({
        annotations: [
          ...s.annotations.filter((a) => a.id !== annotation.id),
          annotation,
        ],
      }));
      persist();
    },
    removeAnnotation: (id) => {
      set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) }));
      persist();
    },
    addCollection: (collection) => {
      set((s) => ({ collections: [...s.collections, collection] }));
      persist();
    },
    updateCollection: (id, name) => {
      set((s) => ({
        collections: s.collections.map((c) =>
          c.id === id ? { ...c, name } : c,
        ),
      }));
      persist();
    },
    deleteCollection: (id) => {
      set((s) => ({
        collections: s.collections.filter((c) => c.id !== id),
        documents: s.documents.map((d) => ({
          ...d,
          collections: d.collections.filter((c) => c !== id),
        })),
      }));
      persist();
    },
    toggleBookmark: (bookmark) => {
      set((s) => ({
        bookmarks: s.bookmarks.some(
          (b) =>
            b.documentId === bookmark.documentId &&
            (bookmark.location.type === "EPUB" && bookmark.location.cfi
              ? sameLocation(b.location, bookmark.location)
              : b.page === bookmark.page),
        )
          ? s.bookmarks.filter(
              (b) =>
                !(
                  b.documentId === bookmark.documentId &&
                  (bookmark.location.type === "EPUB" && bookmark.location.cfi
                    ? sameLocation(b.location, bookmark.location)
                    : b.page === bookmark.page)
                ),
            )
          : [...s.bookmarks, bookmark],
      }));
      persist();
    },
    setPreferences: (patch) => {
      set((s) => ({ preferences: { ...s.preferences, ...patch } }));
      persist();
    },
    addReadingTime: (seconds) => {
      set((s) => ({
        readingSeconds: s.readingSeconds + seconds,
        readingDays: addDailySeconds(s.readingDays, seconds),
      }));
      persist(false);
    },
  };
});
