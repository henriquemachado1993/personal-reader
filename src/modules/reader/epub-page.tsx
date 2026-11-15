"use client";
import { useEffect, useRef, useState } from "react";
import type { Book, Rendition } from "epubjs";
import { readFile } from "@/infrastructure/storage/local";
import { useLibrary } from "@/modules/library/store";
import type { DocumentLocation } from "@/shared/types";

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
  } | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);
  const [ready, setReady] = useState(false);
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
          height: 700,
          flow: "paginated",
          spread: "none",
          allowScriptedContent: false,
        });
        rendition.current = view;
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
        view.on(
          "relocated",
          (loc: {
            start: { cfi: string; href: string; percentage: number };
          }) => {
            onLocation(
              {
                type: "EPUB",
                cfi: loc.start.cfi,
                href: loc.start.href,
                progression: loc.start.percentage,
              },
              Math.round(loc.start.percentage * 100),
            );
          },
        );
        view.on("selected", (cfi: string, contents: { window: Window }) => {
          const text = contents.window.getSelection()?.toString();
          if (text) onSelected(text, { type: "EPUB", cfi, href: "" });
        });
        navigationRef.current = {
          next: () => {
            void view.next();
          },
          prev: () => {
            void view.prev();
          },
          go: (cfi) => {
            void view.display(cfi);
          },
        };
        await view.display(
          savedLocation.current?.type === "EPUB"
            ? savedLocation.current.cfi
            : undefined,
        );
        if (!disposed) setReady(true);
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
      if (tapTimer) clearTimeout(tapTimer);
      navigationRef.current = null;
      rendition.current = null;
      try {
        book?.destroy();
      } catch {}
    };
  }, [documentId, onLocation, onSelected, onError, navigationRef, onTap]);
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
