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
  SyncRevisionError,
  readLibraryForConflict,
  type SyncRecord,
} from "./synchronize";
import { mergeLibrary } from "./sync-merge";
import { canonicalJson } from "./canonical-json";
import { readingPosition, nextReadingTimestamp } from "./reading-position";
import { addDailySeconds } from "./reading-calendar";
import {
  readState,
  readSyncRecord,
  writeState,
  removeFile,
  setStorageScope,
  writeSynchronizedState,
} from "@/infrastructure/storage/local";

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
  synchronize: () => Promise<void>;
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
let persistence = Promise.resolve();
export const useLibrary = create<Store>((set, get) => {
  let inFlight: Promise<void> | undefined;
  const snapshotOf = (state: LibraryState): LibraryState => ({
    documents: state.documents,
    collections: state.collections,
    annotations: state.annotations,
    bookmarks: state.bookmarks,
    preferences: state.preferences,
    readingSeconds: state.readingSeconds,
    readingDays: state.readingDays,
  });
  const persist = () => {
    const ownerId = get().ownerId;
    set({
      syncMessage: "Alterações salvas neste navegador. Sincronização pendente.",
      changeVersion: get().changeVersion + 1,
    });
    const {
      documents,
      collections,
      annotations,
      bookmarks,
      preferences,
      readingSeconds,
      readingDays,
    } = get();
    const snapshot = {
      documents,
      collections,
      annotations,
      bookmarks,
      preferences,
      readingSeconds,
      readingDays,
    };
    persistence = persistence
      .catch(() => {})
      .then(async () => {
        try {
          await writeState(
            get().ownerId === ownerId ? snapshotOf(get()) : snapshot,
            ownerId,
          );
          if (get().ownerId === ownerId) set({ storageError: "" });
        } catch {
          if (get().ownerId !== ownerId) return;
          set({
            storageError:
              "Não foi possível salvar neste navegador. Verifique o espaço disponível e exporte suas notas antes de fechar.",
          });
        }
      });
  };
  return {
    ...initialState(),
    hydrated: false,
    changeVersion: 0,
    remotePositionVersion: {},
    storageError: "",
    notice: "",
    ownerId: "",
    ownerName: "Leitor",
    syncMessage: "Alterações salvas neste navegador.",
    synchronizing: false,
    lastSyncedAt: null,
    synchronize: async () => {
      if (!navigator.onLine || !get().hydrated) return;
      if (inFlight) return inFlight;
      const ownerId = get().ownerId;
      const perform = async () => {
        if (get().ownerId !== ownerId) return;
        set({ synchronizing: true });
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await persistence.catch(() => {});
            if (get().ownerId !== ownerId) return;
            if (get().storageError) {
              await writeState(snapshotOf(get()), ownerId);
              set({ storageError: "" });
            }
            const result = await synchronizeLibrary(ownerId);
            if (!result || get().ownerId !== ownerId) return;
            persistence = persistence
              .catch(() => {})
              .then(async () => {
                if (get().ownerId !== ownerId) return;
                // Rebase both network-time and disk-time edits before updating the reader.
                const beforeCommit = snapshotOf(get());
                const snapshot = mergeLibrary(
                  result.before,
                  beforeCommit,
                  result.snapshot,
                  result.deletedCollectionIds,
                  result.deletedDocumentIds,
                );
                try {
                  await writeSynchronizedState(
                    snapshot,
                    result.record,
                    ownerId,
                  );
                } catch {
                  set({
                    storageError:
                      "Não foi possível salvar a sincronização neste navegador. A cópia local foi preservada.",
                  });
                  throw new Error(
                    "Não foi possível salvar a sincronização neste navegador. Tente novamente.",
                  );
                }
                if (get().ownerId !== ownerId) return;
                const current = snapshotOf(get());
                const applied = mergeLibrary(
                  beforeCommit,
                  current,
                  snapshot,
                  result.deletedCollectionIds,
                  result.deletedDocumentIds,
                );
                const remotePositionVersion = {
                  ...get().remotePositionVersion,
                };
                for (const book of applied.documents) {
                  const prior = current.documents.find(
                    (item) => item.id === book.id,
                  );
                  if (
                    !prior ||
                    canonicalJson(readingPosition(prior)) !==
                      canonicalJson(readingPosition(book))
                  )
                    remotePositionVersion[book.id] =
                      (remotePositionVersion[book.id] ?? 0) + 1;
                }
                set({ ...applied, remotePositionVersion, storageError: "" });
                if (canonicalJson(applied) !== canonicalJson(snapshot))
                  await writeState(applied, ownerId);
              });
            await persistence;
            if (get().ownerId !== ownerId) return;
            const pendingChanges =
              canonicalJson(snapshotOf(get())) !==
              canonicalJson(result.record.base);
            if ((pendingChanges || result.retry) && attempt < 2) continue;
            set({
              syncMessage: pendingChanges
                ? "Novas alterações locais aguardam sincronização."
                : result.pendingOriginals
                  ? "Leitura sincronizada. Há arquivos originais pendentes de envio."
                  : "Biblioteca sincronizada.",
              lastSyncedAt: new Date().toISOString(),
            });
            return;
          } catch (error) {
            if (get().ownerId !== ownerId) return;
            if (error instanceof SyncRevisionError && attempt < 2) continue;
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
      };
      inFlight = (
        navigator.locks
          ? navigator.locks.request(`reader-sync-${ownerId}`, perform)
          : perform()
      )
        .then(() => {})
        .finally(() => {
          inFlight = undefined;
          if (get().ownerId === ownerId) set({ synchronizing: false });
        });
      return inFlight;
    },
    resolveConflict: async (preferLocal) => {
      const ownerId = get().ownerId;
      await inFlight;
      if (get().ownerId !== ownerId) return;
      const perform = async () => {
        await persistence.catch(() => {});
        const remote = await readLibraryForConflict();
        if (get().ownerId !== ownerId) return;
        const record = await readSyncRecord<SyncRecord>(ownerId);
        persistence = persistence
          .catch(() => {})
          .then(async () => {
            const snapshot = preferLocal ? snapshotOf(get()) : remote.snapshot;
            await writeSynchronizedState(
              snapshot,
              {
                revision: remote.revision,
                base: remote.snapshot,
                uploaded: record?.uploaded ?? [],
              },
              ownerId,
            );
            if (get().ownerId === ownerId && !preferLocal) set(snapshot);
          });
        await persistence;
      };
      inFlight = (
        navigator.locks
          ? navigator.locks.request(`reader-sync-${ownerId}`, perform)
          : perform()
      )
        .then(() => {})
        .finally(() => {
          inFlight = undefined;
        });
      await inFlight;
      await get().synchronize();
    },
    hydrate: async (userId, name) => {
      if (!userId || (get().hydrated && get().ownerId === userId)) return;
      set({
        ...initialState(),
        hydrated: false,
        remotePositionVersion: {},
        synchronizing: false,
        lastSyncedAt: null,
        ownerId: userId,
        ownerName: name ?? "Leitor",
      });
      setStorageScope(userId);
      try {
        const saved = await readState(userId);
        if (get().ownerId !== userId) return;
        if (saved) set(saved);
        else await writeState(initialState(), userId);
      } catch {
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
      persist();
    },
  };
});
