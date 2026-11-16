"use client";
import { useEffect, useRef, useState } from "react";
import type { Book, Rendition, Contents } from "epubjs";
import { readFile } from "@/infrastructure/storage/local";
import { useLibrary } from "@/modules/library/store";
import type { DocumentLocation } from "@/shared/types";
import { searchEpub } from "./epub-search";

export function EpubPage({
  documentId,
  fontSize,
  onLocation,
  onSelected,
  onError,
  navigationRef,
  onTap,
}: {
  documentId: string;
  fontSize: number;
  onLocation: (location: DocumentLocation, percentage: number) => void;
  onSelected: (text: string, location: DocumentLocation) => void;
  onError: (message: string) => void;
  onTap: () => void;
  navigationRef: React.MutableRefObject<{
    next: () => void;
    prev: () => void;
    go: (cfi: string) => void;
    search: (query: string) => Promise<number>;
  } | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);
  const [ready, setReady] = useState(false);
  const suppressLocation = useRef(true);
  const userNavigating = useRef(false);
  const remotePositionVersion = useLibrary(
    (s) => s.remotePositionVersion[documentId] ?? 0,
  );
  const savedLocation = useRef(
    useLibrary.getState().documents.find((d) => d.id === documentId)?.location,
  );
  if (typeof window !== "undefined") {
    const annotationId = new URLSearchParams(window.location.search).get(
      "annotation",
    );
    const annotation = useLibrary
      .getState()
      .annotations.find(
        (a) => a.id === annotationId && a.documentId === documentId,
      );
    if (annotation?.location.type === "EPUB")
      savedLocation.current = annotation.location;
  }
  const annotations = useLibrary((s) => s.annotations);
  const readerTheme = useLibrary((s) => s.preferences.readerTheme);
  useEffect(() => {
    let disposed = false;
    let book: Book | undefined;
    let tapTimer: ReturnType<typeof setTimeout> | undefined;
    const markNavigation = () => {
      userNavigating.current = true;
    };
    const contentListeners: Document[] = [];
    host.current?.addEventListener("wheel", markNavigation, { passive: true });
    host.current?.addEventListener("touchstart", markNavigation, {
      passive: true,
    });
    host.current?.addEventListener("pointerdown", markNavigation);
    (async () => {
      try {
        const blob = await readFile(documentId);
        if (!blob) throw new Error("EPUB não encontrado neste navegador.");
        const { default: ePub } = await import("epubjs");
        if (disposed || !host.current) return;
        book = ePub(await blob.arrayBuffer());
        await book.ready;
        if (disposed) return;
        const view = book.renderTo(host.current, {
          width: "100%",
          height: "100%",
          flow: "scrolled-doc",
          manager: "continuous",
          spread: "none",
          allowScriptedContent: false,
        });
        rendition.current = view;
        view.on("touchstart", markNavigation);
        view.on("mousedown", markNavigation);
        view.on("keydown", markNavigation);
        view.hooks.content.register((contents: Contents) => {
          contents.document.addEventListener("wheel", markNavigation, {
            passive: true,
          });
          contentListeners.push(contents.document);
        });
        view.on("click", (event: MouseEvent, contents: { window: Window }) => {
          if (tapTimer) clearTimeout(tapTimer);
          if (
            event.detail > 1 ||
            (event.target as Element)?.closest(
              "a, button, input, textarea, select",
            )
          )
            return;
          tapTimer = setTimeout(() => {
            if (contents.window.getSelection()?.isCollapsed !== false) onTap();
          }, 220);
        });
        const reportLocation = (loc: {
          start: { cfi: string; href: string; percentage: number };
          atEnd?: boolean;
        }) => {
          if (disposed || suppressLocation.current || !userNavigating.current)
            return;
          const indexed = book!.locations.percentageFromCfi(loc.start.cfi);
          const progression = loc.atEnd
            ? 1
            : Number.isFinite(indexed) && indexed >= 0 && indexed <= 1
              ? indexed
              : (loc.start.percentage ?? 0);
          onLocation(
            {
              type: "EPUB",
              cfi: loc.start.cfi,
              href: loc.start.href,
              progression,
            },
            Math.round(progression * 100),
          );
        };
        view.on("relocated", reportLocation);
        view.on("selected", (cfi: string, contents: { window: Window }) => {
          const text = contents.window.getSelection()?.toString();
          if (text) onSelected(text, { type: "EPUB", cfi, href: "" });
        });
        navigationRef.current = {
          search: async (query) => {
            const matches = await searchEpub(book!, query);
            if (matches[0]) {
              markNavigation();
              await view.display(matches[0].cfi);
            }
            return matches.length;
          },
          next: () => {
            markNavigation();
            void view.next();
          },
          prev: () => {
            markNavigation();
            void view.prev();
          },
          go: (cfi) => {
            markNavigation();
            void view.display(cfi);
          },
        };
        await view.display(
          savedLocation.current?.type === "EPUB"
            ? savedLocation.current.cfi
            : undefined,
        );
        const latest = useLibrary
          .getState()
          .documents.find((d) => d.id === documentId)?.location;
        if (
          latest?.type === "EPUB" &&
          latest.cfi &&
          latest.cfi !== view.location?.start?.cfi
        )
          await view.display(latest.cfi);
        if (!disposed) {
          suppressLocation.current = false;
          setReady(true);
        }
        // Index in the background so long books can open before all chapters are parsed.
        void book.locations
          .generate(1500)
          .then(() => {
            if (disposed) return;
            const current = view.location;
            if (current?.start) reportLocation(current);
          })
          .catch(() => {
            if (!disposed)
              useLibrary
                .getState()
                .notify(
                  "Não foi possível calcular o progresso deste EPUB. Sua posição de leitura continua salva.",
                );
          });
      } catch (error) {
        if (!disposed)
          onError(
            error instanceof Error
              ? error.message
              : "Não foi possível abrir este EPUB.",
          );
      }
    })();
    return () => {
      disposed = true;
      host.current?.removeEventListener("wheel", markNavigation);
      host.current?.removeEventListener("touchstart", markNavigation);
      host.current?.removeEventListener("pointerdown", markNavigation);
      contentListeners.forEach((document) =>
        document.removeEventListener("wheel", markNavigation),
      );
      if (tapTimer) clearTimeout(tapTimer);
      navigationRef.current = null;
      rendition.current = null;
      try {
        book?.destroy();
      } catch {}
    };
  }, [documentId, onLocation, onSelected, onError, navigationRef, onTap]);
  useEffect(() => {
    const location = useLibrary
      .getState()
      .documents.find((d) => d.id === documentId)?.location;
    savedLocation.current = location;
    const view = rendition.current;
    if (
      !ready ||
      !view ||
      location?.type !== "EPUB" ||
      !location.cfi ||
      view.location?.start?.cfi === location.cfi
    )
      return;
    suppressLocation.current = true;
    userNavigating.current = false;
    void view
      .display(location.cfi)
      .catch(() => onError("Não foi possível restaurar a posição deste EPUB."))
      .finally(() => {
        if (rendition.current === view) suppressLocation.current = false;
      });
  }, [documentId, remotePositionVersion, ready, onError]);
  useEffect(() => {
    const view = rendition.current;
    if (!view || !ready) return;
    view.themes.default({
      body: {
        "font-family": "Georgia, serif !important",
        "font-size": `${fontSize}px !important`,
        "line-height": "1.8 !important",
        color:
          readerTheme === "night" ? "#ece5d8 !important" : "#2c2923 !important",
        background:
          readerTheme === "night"
            ? "#252525 !important"
            : readerTheme === "paper"
              ? "#faf7ef !important"
              : "#fff !important",
      },
    });
  }, [fontSize, readerTheme, ready]);
  useEffect(() => {
    if (!ready || !rendition.current) return;
    const view = rendition.current;
    const ids: string[] = [];
    annotations
      .filter(
        (a) =>
          a.documentId === documentId &&
          a.kind === "highlight" &&
          a.location.type === "EPUB",
      )
      .forEach((a) => {
        if (a.location.type !== "EPUB") return;
        try {
          view.annotations.highlight(
            a.location.cfi,
            {},
            undefined,
            "saved-highlight",
            {
              fill: a.color,
              "fill-opacity": "0.35",
              "mix-blend-mode": "multiply",
            },
          );
          ids.push(a.location.cfi);
        } catch {}
      });
    return () => {
      ids.forEach((cfi) => {
        try {
          view.annotations.remove(cfi, "highlight");
        } catch {}
      });
    };
  }, [annotations, documentId, ready]);
  return (
    <div ref={host} className="epub-page" aria-label="Conteúdo do livro EPUB" />
  );
}
