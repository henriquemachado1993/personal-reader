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
import { initialState } from "./demo";
import { sameLocation } from "@/modules/reader/location";
import {
  readState,
  writeState,
  removeFile,
  setStorageScope,
} from "@/infrastructure/storage/local";

interface Store extends LibraryState {
  hydrated: boolean;
  storageError: string;
  notice: string;
  ownerId: string;
  ownerName: string;
  hydrate: (userId?: string, name?: string) => Promise<void>;
  dismissNotice: () => void;
  notify: (message: string) => void;
  addDocuments: (docs: ReaderDocument[]) => void;
  updateDocument: (id: string, patch: Partial<ReaderDocument>) => void;
  deleteDocument: (id: string) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  addCollection: (collection: Collection) => void;
  toggleBookmark: (bookmark: Bookmark) => void;
  setPreferences: (patch: Partial<Preferences>) => void;
  addReadingTime: (seconds: number) => void;
}
let persistence = Promise.resolve();
export const useLibrary = create<Store>((set, get) => {
  const persist = () => {
    const {
      documents,
      collections,
      annotations,
      bookmarks,
      preferences,
      readingSeconds,
    } = get();
    const snapshot = {
      documents,
      collections,
      annotations,
      bookmarks,
      preferences,
      readingSeconds,
    };
    persistence = persistence
      .catch(() => {})
      .then(async () => {
        try {
          await writeState(snapshot);
          set({ storageError: "" });
        } catch {
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
    storageError: "",
    notice: "",
    ownerId: "",
    ownerName: "Leitor",
    hydrate: async (userId, name) => {
      if (!userId || (get().hydrated && get().ownerId === userId)) return;
      set({
        ...initialState(),
        hydrated: false,
        ownerId: userId,
        ownerName: name ?? "Leitor",
      });
      setStorageScope(userId);
      try {
        const saved = await readState();
        if (saved) set(saved);
        else await writeState(initialState());
      } catch {
        set({
          storageError:
            "O armazenamento local está indisponível. Permita os dados do site para guardar suas leituras.",
        });
      }
      set({ hydrated: true });
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
          d.id === id ? { ...d, ...patch } : d,
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
      set((s) => ({ readingSeconds: s.readingSeconds + seconds }));
      persist();
    },
  };
});
