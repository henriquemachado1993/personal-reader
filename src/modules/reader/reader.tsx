"use client";
import { Slider, Popover } from "@mantine/core";

import { Button, TextField, TextArea } from "@/components/ui/controls";
import "./reader-controls.css";
import "./editor-controls.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelRight,
  Bookmark,
  Search,
  Download,
  MousePointer2,
  PenLine,
  Pencil,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Square,
  Circle,
  MoveUpRight,
  ScanLine,
  StickyNote,
  X,
  Plus,
  Minus,
  BookOpen,
  PenTool,
  Check,
  LoaderCircle,
  Palette,
  Hand,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "@/modules/library/store";
import { IconButton, EmptyState } from "@/components/ui";
import { AnnotationOverlay } from "./annotation-overlay";
import { createLatestSearch } from "./latest-search";
import { PdfPage } from "./pdf-page";
import "./reader-refinements.css";
import "./annotation-toolbar.css";
import "./reader-panels.css";
import { AnnotationColorPicker } from "./annotation-color-picker";
import { findVisiblePage, scrollToReaderPage } from "./page-scroll";
import { EpubPage } from "./epub-page";
import { downloadBlob, exportPdf } from "./export";
import { readFile } from "@/infrastructure/storage/local";
import { sameLocation } from "./location";
import { useAnnotationHistory } from "./use-annotation-history";
import { PageFilmstrip } from "./page-filmstrip";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type {
  Annotation,
  AnnotationKind,
  DocumentLocation,
  Point,
  ReaderDocument,
} from "@/shared/types";

function pageLocation(book: ReaderDocument, page: number): DocumentLocation {
  if (book.format === "PDF") return { type: "PDF", pageIndex: page };
  if (book.format === "EPUB")
    return (
      book.location ?? {
        type: "EPUB",
        cfi: "",
        href: "",
        progression: page / Math.max(1, book.pages),
      }
    );
  return { type: book.format, blockIndex: page, offset: 0 };
}
const colors = ["#e8bb45", "#db7f88", "#6a997d", "#7f9fc4", "#3e3830"];
const colorNames: Record<string, string> = {
  "#e8bb45": "Amarelo",
  "#db7f88": "Rosa",
  "#6a997d": "Verde",
  "#7f9fc4": "Azul",
  "#3e3830": "Grafite",
};
const annotationTools = [
  {
    id: "select",
    label: "Selecionar texto",
    icon: MousePointer2,
    primary: true,
  },
  { id: "pen", label: "Caneta", icon: PenLine, primary: true },
  { id: "pencil", label: "Lápis", icon: Pencil, primary: true },
  { id: "highlight", label: "Marca-texto", icon: Highlighter, primary: true },
  { id: "eraser", label: "Borracha", icon: Eraser, primary: true },
  { id: "hand", label: "Mover página", icon: Hand, primary: true },
  { id: "underline", label: "Sublinhar", icon: Highlighter, primary: false },
  { id: "rectangle", label: "Retângulo", icon: Square, primary: false },
  { id: "circle", label: "Círculo", icon: Circle, primary: false },
  { id: "arrow", label: "Seta", icon: MoveUpRight, primary: false },
  { id: "clipping", label: "Capturar trecho", icon: ScanLine, primary: false },
  { id: "text", label: "Inserir texto", icon: StickyNote, primary: false },
  { id: "image", label: "Inserir imagem", icon: Plus, primary: false },
];

export function Reader({ documentId }: { documentId: string }) {
  const library = useLibrary(
    useShallow((store) => ({
      annotations: store.annotations,
      bookmarks: store.bookmarks,
      dismissNotice: store.dismissNotice,
      documents: store.documents,
      hydrated: store.hydrated,
      notice: store.notice,
      notify: store.notify,
      preferences: store.preferences,
      setPreferences: store.setPreferences,
      storageError: store.storageError,
      toggleBookmark: store.toggleBookmark,
      updateDocument: store.updateDocument,
      remotePositionVersion: store.remotePositionVersion[documentId] ?? 0,
    })),
  );
  const book = library.documents.find((d) => d.id === documentId);
  useEffect(() => {
    document.title = `${book?.title ?? "Leitor"} · Le-Books`;
  }, [book?.title]);
  const [page, setPage] = useState<number | null>(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [focus, setFocus] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [extraToolsOpen, setExtraToolsOpen] = useState(false);
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState(colors[0]);
  const [thickness, setThickness] = useState(2);
  const [opacity, setOpacity] = useState(1);
  const [stampText, setStampText] = useState("");
  const [stampImage, setStampImage] = useState<string>();
  const [selectedObject, setSelectedObject] = useState<string>();
  const [draft, setDraft] = useState<Point[]>([]);
  const [selection, setSelection] = useState<{
    text: string;
    points: Point[];
    location?: DocumentLocation;
  } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [latestPdfSearch] = useState(createLatestSearch);
  useEffect(
    () => () => latestPdfSearch.invalidate(),
    [latestPdfSearch, documentId, searching, query],
  );
  const [appearance, setAppearance] = useState(false);
  const {
    editAnnotation,
    eraseAnnotation,
    undo,
    redoAction,
    canUndo,
    canRedo,
  } = useAnnotationHistory(documentId);
  const pageHost = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const pdfSearch = useRef<
    ((query: string, start: number) => Promise<number>) | null
  >(null);
  const scrollHost = useRef<HTMLDivElement>(null);
  const restoredDocument = useRef<string | null>(null);
  const tap = useRef<{
    x: number;
    y: number;
    time: number;
    moved: boolean;
    pointerType: string;
  } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleChrome = useCallback(() => {
    setFocus((value) => !value);
    setToolsOpen(false);
    setExtraToolsOpen(false);
    setCustomColorOpen(false);
    setTool("select");
    setDraft([]);
    setLeft(false);
    setRight(false);
    setAppearance(false);
    setSearching(false);
    setSelection(null);
  }, []);
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );
  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (
      tool !== "select" ||
      (tap.current?.pointerType !== "touch" && event.detail > 1) ||
      (event.target as Element).closest("button, a, input, textarea, select") ||
      tap.current?.moved ||
      (tap.current && performance.now() - tap.current.time > 450)
    )
      return;
    tapTimer.current = setTimeout(
      () => {
        const selected = window.getSelection();
        if (selected && !selected.isCollapsed && selected.toString().trim())
          return;
        toggleChrome();
      },
      tap.current?.pointerType === "touch" ? 0 : 220,
    );
  };
  const epubNav = useRef<{
    next: () => void;
    prev: () => void;
    go: (cfi: string) => void;
    search: (query: string) => Promise<number>;
  } | null>(null);
  useEffect(() => {
    if (!toolsOpen || focus || extraToolsOpen) return;
    const rail = document.querySelector<HTMLElement>(
      ".annotation-primary-tools",
    );
    if (!rail) return;
    const revealSelection = () =>
      rail.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "instant",
      });
    revealSelection();
    const observer = new ResizeObserver(revealSelection);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [tool, toolsOpen, focus, extraToolsOpen]);
  const currentPage = page ?? book?.page ?? 0;
  const realPdf = book?.format === "PDF" && !book.demo;
  const realEpub = book?.format === "EPUB" && !book.demo;
  const annotations = useMemo(
    () => library.annotations.filter((a) => a.documentId === documentId),
    [library.annotations, documentId],
  );
  const visibleAnnotations = annotations.filter((annotation) =>
    ["note", "highlight", "clipping"].includes(annotation.kind),
  );
  const documentBookmarks = useMemo(
    () =>
      library.bookmarks.filter(
        (bookmark) => bookmark.documentId === documentId,
      ),
    [library.bookmarks, documentId],
  );
  const currentAnnotations = annotations.filter((a) => a.page === currentPage);
  const selectedAnnotation = currentAnnotations.find(
    (annotation) => annotation.id === selectedObject,
  );
  const annotationStyleKind =
    tool === "select" ? selectedAnnotation?.kind : tool;
  const showStrokeThickness =
    !realEpub &&
    ["pen", "pencil", "underline", "rectangle", "circle", "arrow"].includes(
      annotationStyleKind ?? "",
    );
  const showAnnotationOpacity =
    !realEpub &&
    [
      "pen",
      "pencil",
      "underline",
      "rectangle",
      "circle",
      "arrow",
      "highlight",
      "text",
      "image",
    ].includes(annotationStyleKind ?? "");
  const updateSelectedAnnotationStyle = (
    style: Partial<Pick<Annotation, "thickness" | "opacity">>,
  ) => {
    if (tool === "select" && selectedAnnotation)
      editAnnotation({
        ...selectedAnnotation,
        ...style,
        updatedAt: new Date().toISOString(),
      });
  };
  const changeAnnotationColor = (nextColor: string) => {
    setColor(nextColor);
    if (tool === "select" && selectedAnnotation)
      editAnnotation({
        ...selectedAnnotation,
        color: nextColor,
        updatedAt: new Date().toISOString(),
      });
  };
  const bookmarked = library.bookmarks.some(
    (b) =>
      b.documentId === documentId &&
      (realEpub && book
        ? sameLocation(b.location, pageLocation(book, currentPage))
        : b.page === currentPage),
  );
  useEffect(() => {
    if (!book) return;
    const target = new URLSearchParams(window.location.search).get("page");
    if (
      target &&
      Number.isInteger(Number(target)) &&
      Number(target) > 0 &&
      Number(target) <= book.pages
    )
      setPage(Number(target) - 1);
  }, [documentId, library.hydrated]);
  useEffect(() => {
    const host = scrollHost.current;
    if (!host || !book || realEpub) return;
    const pages = Array.from(
      host.querySelectorAll<HTMLElement>("[data-reader-page]"),
    );
    let initialized = false;
    let scheduled = 0;
    let viewportWidth = host.clientWidth;
    let viewportHeight = host.clientHeight;
    let contentHeight = host.scrollHeight;
    let readingAnchor: { index: number; fraction: number } | null = null;
    const track = () => {
      scheduled = 0;
      if (!initialized) return;
      if (
        host.clientWidth !== viewportWidth ||
        host.clientHeight !== viewportHeight ||
        host.scrollHeight !== contentHeight
      ) {
        preservePosition();
      }
      const top = host.getBoundingClientRect().top + host.clientHeight * 0.35;
      const active = findVisiblePage(
        pages,
        (node) => node.getBoundingClientRect().bottom,
        top,
      );
      if (!active) return;
      const index = Number(active.dataset.readerPage);
      const bounds = active.getBoundingClientRect();
      readingAnchor = {
        index,
        fraction: Math.max(0, Math.min(1, (top - bounds.top) / bounds.height)),
      };
      setPage((previous) => (previous === index ? previous : index));
      const current = useLibrary
        .getState()
        .documents.find((d) => d.id === documentId);
      if (current && current.page !== index)
        useLibrary.getState().updateDocument(documentId, {
          page: index,
          progress: Math.round(((index + 1) / current.pages) * 100),
          location: pageLocation(current, index),
        });
    };
    const schedule = () => {
      if (!scheduled) scheduled = requestAnimationFrame(track);
    };
    // Restore after each geometry change, including asynchronous PDF sizing.
    // Applying it inside ResizeObserver leaves subsequent user/script scrolls free.
    const preservePosition = () => {
      viewportWidth = host.clientWidth;
      viewportHeight = host.clientHeight;
      contentHeight = host.scrollHeight;
      if (!readingAnchor) return;
      const target = pages[readingAnchor.index];
      if (!target) return;
      const bounds = target.getBoundingClientRect();
      host.scrollTop +=
        bounds.top +
        bounds.height * readingAnchor.fraction -
        host.getBoundingClientRect().top -
        host.clientHeight * 0.35;
    };
    const pageSizes = new ResizeObserver(() => {
      if (
        host.clientWidth !== viewportWidth ||
        host.clientHeight !== viewportHeight ||
        host.scrollHeight !== contentHeight
      )
        preservePosition();
    });
    pages.forEach((node) => pageSizes.observe(node));
    window.addEventListener("resize", preservePosition);
    host.addEventListener("scroll", schedule, { passive: true });
    const requested = Number(
      new URLSearchParams(window.location.search).get("page"),
    );
    const saved =
      restoredDocument.current !== documentId &&
      Number.isInteger(requested) &&
      requested > 0
        ? Math.min(requested - 1, book.pages - 1)
        : book.page;
    restoredDocument.current = documentId;
    const restore = requestAnimationFrame(() => {
      initialized = true;
      setPage(saved);
      if (pages[saved]) scrollToReaderPage(host, pages[saved]);
      track();
    });
    return () => {
      host.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", preservePosition);
      pageSizes.disconnect();
      cancelAnimationFrame(restore);
      cancelAnimationFrame(scheduled);
    };
  }, [
    documentId,
    book?.pages,
    realEpub,
    library.hydrated,
    library.remotePositionVersion,
  ]);
  const onPages = useCallback(
    (pages: number) => {
      const current = useLibrary
        .getState()
        .documents.find((d) => d.id === documentId);
      if (current && current.pages !== pages)
        useLibrary.getState().updateDocument(documentId, { pages });
    },
    [documentId],
  );
  const onCanvas = useCallback((value: HTMLCanvasElement | null) => {
    canvas.current = value;
  }, []);
  const onError = useCallback((message: string) => setError(message), []);
  const onLocation = useCallback(
    (location: DocumentLocation, progress: number) => {
      const current = useLibrary
        .getState()
        .documents.find((d) => d.id === documentId);
      const page = Math.min(
        (current?.pages ?? 1) - 1,
        Math.floor((progress / 100) * (current?.pages ?? 1)),
      );
      setPage(page);
      useLibrary
        .getState()
        .updateDocument(documentId, { location, progress, page });
    },
    [documentId],
  );
  const onEpubSelected = useCallback(
    (text: string, location: DocumentLocation) =>
      setSelection({ text, location, points: [] }),
    [],
  );
  useEffect(() => {
    if (!library.hydrated || !book) return;
    library.updateDocument(documentId, {
      lastReadAt: new Date().toISOString(),
      status: book.status === "finished" ? "finished" : "reading",
    });
  }, [library.hydrated, documentId, !!book]); // A remotely loaded book can arrive after hydration.
  useEffect(() => {
    if (!library.hydrated || !book) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible")
        useLibrary.getState().addReadingTime(10);
    }, 10000);
    return () => clearInterval(interval);
  }, [library.hydrated, documentId, !!book]);
  const go = useCallback(
    (target: number) => {
      const document = useLibrary
        .getState()
        .documents.find((d) => d.id === documentId);
      if (!document) return;
      if (document.format === "EPUB" && !document.demo) {
        if (target > currentPage) epubNav.current?.next();
        else epubNav.current?.prev();
        return;
      }
      const next = Math.max(0, Math.min(target, document.pages - 1));
      setPage(next);
      setSelection(null);
      setError("");
      useLibrary.getState().updateDocument(documentId, {
        page: next,
        progress: Math.round(((next + 1) / document.pages) * 100),
        location: pageLocation(document, next),
        lastReadAt: new Date().toISOString(),
      });
      const host = scrollHost.current;
      const targetPage = host?.querySelector<HTMLElement>(
        `[data-reader-page="${next}"]`,
      );
      if (host && targetPage) scrollToReaderPage(host, targetPage);
    },
    [documentId, currentPage],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target as HTMLElement).closest(".annotation-popup")
      )
        return;
      if (event.key === "Escape" && (extraToolsOpen || customColorOpen)) {
        setExtraToolsOpen(false);
        setCustomColorOpen(false);
        return;
      }
      if (document.querySelector(".annotation-popup")) return;
      if (
        (event.target as HTMLElement).matches(
          "input, textarea, select, [contenteditable], [role=slider], [role=combobox]",
        )
      )
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(currentPage + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(currentPage - 1);
      }
      if (event.key === "Escape") {
        setFocus(false);
        setToolsOpen(false);
        setTool("select");
        setSelection(null);
        setAppearance(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        event.preventDefault();
        event.shiftKey ? redoAction() : undo();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [currentPage, go, undo, redoAction, extraToolsOpen, customColorOpen]);
  const addAnnotation = (
    kind: AnnotationKind,
    points: Point[] = [],
    text = "",
    image?: string,
  ) => {
    if (!book) return;
    const now = new Date().toISOString();
    editAnnotation({
      id: crypto.randomUUID(),
      documentId,
      kind,
      page: currentPage,
      location: selection?.location ?? pageLocation(book, currentPage),
      text,
      quote: selection?.text,
      color,
      points,
      image,
      thickness,
      opacity,
      createdAt: now,
      updatedAt: now,
    });
    if (kind === "note" || kind === "highlight") setSelection(null);
  };
  const completeDrawing = (points: Point[], kind: AnnotationKind) => {
    if (kind === "text" || kind === "image") {
      if (
        (kind === "text" && !stampText.trim()) ||
        (kind === "image" && !stampImage)
      ) {
        library.notify(
          "Preencha o texto ou escolha uma imagem antes de marcar a página.",
        );
        return;
      }
      addAnnotation(kind, points, stampText, stampImage);
      setTool("select");
      return;
    }
    if (kind === "clipping" && canvas.current) {
      const source = canvas.current;
      const [a, b] = points;
      const crop = document.createElement("canvas");
      const w = Math.abs(b.x - a.x) * source.width,
        h = Math.abs(b.y - a.y) * source.height;
      if (w < 4 || h < 4) return;
      crop.width = Math.ceil(w);
      crop.height = Math.ceil(h);
      crop
        .getContext("2d")
        ?.drawImage(
          source,
          Math.min(a.x, b.x) * source.width,
          Math.min(a.y, b.y) * source.height,
          w,
          h,
          0,
          0,
          w,
          h,
        );
      addAnnotation(
        "clipping",
        points,
        `Captura da página ${currentPage + 1}`,
        crop.toDataURL("image/webp", 0.85),
      );
      library.notify("Captura salva na central de conhecimento.");
      setTool("select");
      return;
    }
    addAnnotation(kind, points);
  };
  const captureSelection = () => {
    if (tool !== "select" || realEpub) return;
    const selected = window.getSelection();
    if (
      !selected ||
      !selected.rangeCount ||
      !selected.toString().trim() ||
      !pageHost.current?.contains(selected.anchorNode)
    )
      return;
    const bounds = pageHost.current.getBoundingClientRect();
    const rects = Array.from(selected.getRangeAt(0).getClientRects());
    const points = rects
      .filter((r) => r.width > 0 && r.height > 0)
      .flatMap((r) => [
        {
          x: Math.max(0, (r.left - bounds.left) / bounds.width),
          y: Math.max(0, (r.top - bounds.top) / bounds.height),
        },
        {
          x: Math.min(1, (r.right - bounds.left) / bounds.width),
          y: Math.min(1, (r.bottom - bounds.top) / bounds.height),
        },
      ]);
    setSelection({ text: selected.toString().trim(), points });
  };
  const exportDocument = async () => {
    if (!book) return;
    setExporting(true);
    try {
      if (realPdf) await exportPdf(book, annotations);
      else if (!book.demo) {
        const blob = await readFile(book.id);
        if (!blob) throw new Error("Arquivo original não encontrado.");
        downloadBlob(
          blob,
          book.filename ?? `${book.title}.${book.format.toLowerCase()}`,
        );
      } else {
        downloadBlob(
          new Blob([book.content?.join("\n\n") ?? ""], {
            type: "text/plain;charset=utf-8",
          }),
          `${book.title}-amostra.txt`,
        );
      }
    } catch (e) {
      library.notify(
        e instanceof Error
          ? e.message
          : "Não foi possível exportar este documento.",
      );
    } finally {
      setExporting(false);
    }
  };
  if (!library.hydrated)
    return (
      <div className="reader-loading">
        <BookOpen size={36} strokeWidth={1.3} />
        <p>Abrindo sua leitura…</p>
      </div>
    );
  if (!book)
    return (
      <div className="reader-loading">
        <EmptyState
          title="Este livro não está nesta biblioteca"
          action={
            <Link className="button primary" href="/library">
              Voltar à biblioteca
            </Link>
          }
        >
          Se ele foi importado em outro navegador, importe o arquivo novamente
          neste dispositivo.
        </EmptyState>
      </div>
    );
  return (
    <div
      className={`reader-shell ${focus ? "focus-mode" : ""} ${toolsOpen ? "annotation-open" : ""}`}
      data-reader-theme={library.preferences.readerTheme}
    >
      <header className="reader-header" inert={focus}>
        <div className="reader-header-left">
          <Link
            className="icon-button"
            href="/library"
            aria-label="Voltar à biblioteca"
          >
            <X size={23} />
          </Link>
          <IconButton
            label="Mostrar páginas e marcadores"
            aria-pressed={left}
            onClick={() => setLeft(!left)}
          >
            <PanelLeft size={19} />
          </IconButton>
          <IconButton
            label={realPdf ? "Exportar PDF anotado" : "Baixar documento"}
            disabled={exporting}
            onClick={() => void exportDocument()}
          >
            {exporting ? (
              <LoaderCircle className="spin" size={19} />
            ) : (
              <Download size={19} />
            )}
          </IconButton>
        </div>
        <div className="reader-title">
          <strong>{book.title}</strong>
        </div>
        <div className="reader-header-right">
          <IconButton
            label={
              toolsOpen
                ? "Fechar ferramentas de anotação"
                : "Abrir ferramentas de anotação"
            }
            className={`reader-brush ${toolsOpen ? "selected" : ""}`}
            aria-expanded={toolsOpen}
            aria-controls="annotation-tools"
            onClick={() => {
              setToolsOpen((open) => !open);
              setExtraToolsOpen(false);
              setCustomColorOpen(false);
              setTool("select");
              setDraft([]);
            }}
          >
            <PenTool size={22} />
          </IconButton>
          <IconButton
            label="Buscar no documento"
            aria-pressed={searching}
            onClick={() => setSearching(!searching)}
          >
            <Search size={18} />
          </IconButton>
          <Button
            className="icon-button type-control"
            aria-label="Ajustar aparência"
            aria-expanded={appearance}
            onClick={() => setAppearance(!appearance)}
          >
            Aa
          </Button>
          <IconButton
            label={bookmarked ? "Remover marcador" : "Marcar página"}
            className={bookmarked ? "bookmarked" : ""}
            aria-pressed={bookmarked}
            onClick={() =>
              library.toggleBookmark({
                id: crypto.randomUUID(),
                documentId,
                page: currentPage,
                location: pageLocation(book, currentPage),
                createdAt: new Date().toISOString(),
              })
            }
          >
            <Bookmark size={19} fill={bookmarked ? "currentColor" : "none"} />
          </IconButton>
          <IconButton
            label="Mostrar anotações"
            className="reader-notes-toggle"
            aria-pressed={right}
            onClick={() => setRight(!right)}
          >
            <PanelRight size={19} />
          </IconButton>
        </div>
      </header>
      {focus && (
        <Button
          className="show-reader-controls"
          onClick={() => setFocus(false)}
        >
          Mostrar controles de leitura
        </Button>
      )}
      {appearance && (
        <div className="appearance-panel">
          <div>
            <strong>Sua leitura, do seu jeito</strong>
            <IconButton
              label="Fechar aparência"
              onClick={() => setAppearance(false)}
            >
              <X size={17} />
            </IconButton>
          </div>
          {book.format !== "PDF" && (
            <label>
              Tamanho do texto
              <span>
                <IconButton
                  label="Diminuir fonte"
                  disabled={library.preferences.fontSize <= 14}
                  onClick={() =>
                    library.setPreferences({
                      fontSize: Math.max(14, library.preferences.fontSize - 1),
                    })
                  }
                >
                  <Minus size={16} />
                </IconButton>
                {library.preferences.fontSize}
                <IconButton
                  label="Aumentar fonte"
                  disabled={library.preferences.fontSize >= 30}
                  onClick={() =>
                    library.setPreferences({
                      fontSize: Math.min(30, library.preferences.fontSize + 1),
                    })
                  }
                >
                  <Plus size={16} />
                </IconButton>
              </span>
            </label>
          )}
          <label>
            Zoom
            <span className="zoom-control">
              <IconButton
                label="Diminuir zoom"
                disabled={zoom <= 60}
                onClick={() => setZoom((z) => Math.max(60, z - 10))}
              >
                <Minus size={16} />
              </IconButton>
              {zoom}%
              <IconButton
                label="Aumentar zoom"
                disabled={zoom >= 160}
                onClick={() => setZoom((z) => Math.min(160, z + 10))}
              >
                <Plus size={16} />
              </IconButton>
            </span>
          </label>
          <div className="reader-theme-options">
            {(["white", "paper", "night"] as const).map((t) => (
              <Button
                key={t}
                aria-label={`Tema ${t === "white" ? "branco" : t === "paper" ? "papel" : "noturno"}`}
                aria-pressed={library.preferences.readerTheme === t}
                className={`reader-theme-${t}`}
                onClick={() => library.setPreferences({ readerTheme: t })}
              >
                Aa{library.preferences.readerTheme === t && <Check size={12} />}
              </Button>
            ))}
          </div>
        </div>
      )}
      {searching && (
        <div className="reader-search">
          <Search size={16} />
          <TextField
            autoFocus
            value={query}
            onChange={(e) => {
              latestPdfSearch.invalidate();
              setQuery(e.target.value);
            }}
            aria-label="Buscar texto neste documento"
            placeholder="O que você quer encontrar?"
          />
          <Button
            className="button secondary"
            onClick={async () => {
              if (!query.trim()) return;
              if (realPdf) {
                const search = pdfSearch.current;
                if (!search) {
                  library.notify(
                    "O PDF ainda está sendo preparado. Tente novamente.",
                  );
                  return;
                }
                const result = await latestPdfSearch.run(() =>
                  search(query, (currentPage + 1) % book.pages),
                );
                if (result.status === "obsolete") return;
                if (result.status === "error") {
                  library.notify(
                    "Não foi possível pesquisar o PDF. Tente novamente.",
                  );
                  return;
                }
                if (result.value >= 0) go(result.value);
                else library.notify("Não encontramos esse texto no PDF.");
              } else if (realEpub) {
                try {
                  const count = await epubNav.current?.search(query);
                  library.notify(
                    count
                      ? `${count} ocorrências no livro. Exibindo a primeira.`
                      : "Texto não encontrado no livro.",
                  );
                } catch {
                  library.notify(
                    "Não foi possível pesquisar o livro. Tente novamente.",
                  );
                }
              } else {
                const match =
                  book.content?.findIndex((p) =>
                    p.toLowerCase().includes(query.toLowerCase()),
                  ) ?? -1;
                if (match >= 0) go(match);
                else library.notify("Não encontramos esse texto no documento.");
              }
            }}
          >
            Buscar
          </Button>
          <IconButton label="Fechar busca" onClick={() => setSearching(false)}>
            <X size={17} />
          </IconButton>
        </div>
      )}
      <div className="reader-body">
        {left && (
          <aside
            className="reader-left-panel"
            aria-label="Páginas e marcadores"
          >
            <div className="panel-title">
              <h2>Páginas</h2>
              <IconButton label="Fechar páginas" onClick={() => setLeft(false)}>
                <X size={17} />
              </IconButton>
            </div>
            <div className="reader-panel-content">
              <div className="page-navigation-list">
                {Array.from({ length: Math.min(book.pages, 1000) }, (_, i) => (
                  <Button
                    className={currentPage === i ? "current" : ""}
                    aria-current={currentPage === i ? "page" : undefined}
                    key={i}
                    onClick={() => go(i)}
                  >
                    <span>{i + 1}</span>
                    <span>
                      {book.content?.[i]?.split("\n")[0] ?? `Página ${i + 1}`}
                    </span>
                    {documentBookmarks.some(
                      (bookmark) => bookmark.page === i,
                    ) && <Bookmark size={13} fill="currentColor" />}
                  </Button>
                ))}
              </div>
              <h3 className="panel-subheading">Marcadores</h3>
              <Button
                className="bookmark-link"
                onClick={() => {
                  setLeft(false);
                  setRight(true);
                }}
              >
                <StickyNote size={15} />
                Anotações deste livro
              </Button>
              {documentBookmarks.length ? (
                documentBookmarks.map((b) => (
                  <Button
                    key={b.id}
                    className="bookmark-link"
                    onClick={() => {
                      if (
                        b.location.type === "EPUB" &&
                        b.location.cfi &&
                        realEpub
                      )
                        epubNav.current?.go(b.location.cfi);
                      else go(b.page);
                    }}
                  >
                    <Bookmark size={15} />
                    Página {b.page + 1}
                  </Button>
                ))
              ) : (
                <p className="panel-empty">
                  Marque uma página para voltar a ela depois.
                </p>
              )}
            </div>
          </aside>
        )}
        <div className="reader-scroll-area" ref={scrollHost}>
          {error ? (
            <EmptyState
              title="Não foi possível abrir o documento"
              action={
                <Link className="button secondary" href="/library">
                  Voltar à biblioteca
                </Link>
              }
            >
              {error}
            </EmptyState>
          ) : (
            (realEpub
              ? [0]
              : Array.from({ length: book.pages }, (_, index) => index)
            ).map((pageIndex) => (
              <div
                key={pageIndex}
                data-reader-page={pageIndex}
                aria-current={
                  realEpub || pageIndex === currentPage ? "page" : undefined
                }
                className="reader-page reader-continuous-page"
                ref={pageIndex === currentPage ? pageHost : undefined}
                onPointerDownCapture={(event) => {
                  if (
                    !realEpub &&
                    toolsOpen &&
                    tool !== "select" &&
                    tool !== "hand" &&
                    pageIndex !== currentPage
                  ) {
                    setPage(pageIndex);
                    library.updateDocument(documentId, {
                      page: pageIndex,
                      progress: Math.round(
                        ((pageIndex + 1) / book.pages) * 100,
                      ),
                      location: pageLocation(book, pageIndex),
                    });
                  }
                  tap.current = {
                    x: event.clientX,
                    y: event.clientY,
                    time: performance.now(),
                    moved: false,
                    pointerType: event.pointerType,
                  };
                }}
                onPointerMoveCapture={(event) => {
                  if (
                    tap.current &&
                    Math.hypot(
                      event.clientX - tap.current.x,
                      event.clientY - tap.current.y,
                    ) > 8
                  )
                    tap.current.moved = true;
                }}
                onPointerCancel={() => {
                  tap.current = null;
                  if (tapTimer.current) clearTimeout(tapTimer.current);
                }}
                onClick={handlePageClick}
                onDoubleClick={() => {
                  if (tap.current?.pointerType !== "touch" && tapTimer.current)
                    clearTimeout(tapTimer.current);
                }}
                onMouseUp={captureSelection}
                onTouchEnd={captureSelection}
                style={
                  {
                    maxWidth: `${(760 * zoom) / 100}px`,
                    "--reader-page-width": `${zoom}%`,
                  } as React.CSSProperties
                }
              >
                {realPdf ? (
                  <PdfPage
                    documentId={documentId}
                    page={pageIndex}
                    onPages={onPages}
                    onCanvas={pageIndex === currentPage ? onCanvas : undefined}
                    onError={onError}
                    searchRef={pdfSearch}
                    onDocumentReady={
                      pageIndex === currentPage ? setPdf : undefined
                    }
                  />
                ) : realEpub ? (
                  <EpubPage
                    documentId={documentId}
                    fontSize={library.preferences.fontSize}
                    onLocation={onLocation}
                    onSelected={onEpubSelected}
                    onError={onError}
                    navigationRef={epubNav}
                    onTap={toggleChrome}
                  />
                ) : (
                  <article
                    className="prose-page"
                    style={{ fontSize: `${library.preferences.fontSize}px` }}
                  >
                    {(book.content?.[pageIndex] ?? "")
                      .split(/\n\s*\n/)
                      .map((paragraph, i) =>
                        i === 0 && paragraph.length < 100 ? (
                          <h1 key={i}>{paragraph}</h1>
                        ) : (
                          <p key={i}>
                            {query &&
                            paragraph
                              .toLowerCase()
                              .includes(query.toLowerCase())
                              ? paragraph
                                  .split(
                                    new RegExp(
                                      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                                      "gi",
                                    ),
                                  )
                                  .map((part, j) =>
                                    part.toLowerCase() ===
                                    query.toLowerCase() ? (
                                      <mark key={j}>{part}</mark>
                                    ) : (
                                      part
                                    ),
                                  )
                              : paragraph}
                          </p>
                        ),
                      )}
                  </article>
                )}
                {!realEpub && (
                  <AnnotationOverlay
                    annotations={annotations.filter(
                      (a) => a.page === pageIndex,
                    )}
                    draft={pageIndex === currentPage ? draft : []}
                    tool={pageIndex === currentPage ? tool : "hand"}
                    color={color}
                    thickness={thickness}
                    opacity={opacity}
                    onDraft={setDraft}
                    onComplete={completeDrawing}
                    onErase={(id) => eraseAnnotation(id)}
                    onObjectChange={editAnnotation}
                    onObjectSelect={(id) => {
                      setSelectedObject(id);
                      const object = annotations.find((note) => note.id === id);
                      if (object) {
                        setColor(object.color);
                        setThickness(object.thickness ?? 2);
                        setOpacity(object.opacity ?? 1);
                        setStampText(object.text);
                      }
                    }}
                  />
                )}
                {bookmarked && (
                  <div className="page-bookmark" aria-hidden="true" />
                )}
              </div>
            ))
          )}
          {selection && (
            <div className="selection-actions">
              <span>
                {selection.text.length > 35
                  ? `${selection.text.slice(0, 35)}…`
                  : selection.text}
              </span>
              <Button
                onClick={() => {
                  addAnnotation("highlight", selection.points, selection.text);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <Highlighter size={16} />
                Destacar
              </Button>
              <Button
                onClick={() => {
                  setRight(true);
                  setNote("");
                }}
              >
                <StickyNote size={16} />
                Anotar
              </Button>
              <IconButton
                label="Cancelar seleção"
                onClick={() => setSelection(null)}
              >
                <X size={15} />
              </IconButton>
            </div>
          )}
          {library.storageError && (
            <div role="alert" className="error-banner">
              {library.storageError}
            </div>
          )}
        </div>
        {right && (
          <aside className="reader-notes-panel" aria-label="Anotações do livro">
            <div className="panel-title">
              <h2>À margem da leitura</h2>
              <IconButton
                label="Fechar anotações"
                onClick={() => setRight(false)}
              >
                <X size={17} />
              </IconButton>
            </div>
            <div className="reader-panel-content">
              <p className="panel-description">
                Guarde o que merece uma segunda leitura.
              </p>
              <form
                className="note-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) {
                    addAnnotation("note", [], note.trim());
                    setNote("");
                  }
                }}
              >
                {selection && <blockquote>{selection.text}</blockquote>}
                <label className="sr-only" htmlFor="new-note">
                  Sua anotação
                </label>
                <TextArea
                  id="new-note"
                  placeholder="O que esta página fez você pensar?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={10000}
                />
                <Button className="button primary" disabled={!note.trim()}>
                  <Plus size={15} />
                  Salvar anotação
                </Button>
              </form>
              <div className="panel-annotations">
                {visibleAnnotations.map((a) => (
                  <article key={a.id}>
                    <div>
                      <span className="reader-note-kind">
                        <i
                          aria-hidden="true"
                          style={{ backgroundColor: a.color }}
                        />
                        {a.kind === "highlight"
                          ? "Destaque"
                          : a.kind === "clipping"
                            ? "Captura"
                            : "Anotação"}
                      </span>
                      <IconButton
                        label="Remover anotação"
                        onClick={() => eraseAnnotation(a.id)}
                      >
                        <X size={13} />
                      </IconButton>
                    </div>
                    {a.image && (
                      <img
                        src={a.image}
                        alt={a.text}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    {a.quote && a.quote !== a.text && (
                      <blockquote>{a.quote}</blockquote>
                    )}
                    <p>{a.text}</p>
                    <Button
                      className="text-link"
                      onClick={() => {
                        if (realEpub && a.location.type === "EPUB")
                          epubNav.current?.go(a.location.cfi);
                        else go(a.page);
                      }}
                    >
                      Página {a.page + 1}
                      <MoveUpRight size={12} />
                    </Button>
                  </article>
                ))}
                {!visibleAnnotations.length && (
                  <p className="panel-empty">
                    Suas ideias começam com uma anotação.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
      {toolsOpen && !focus && (
        <div
          id="annotation-tools"
          className="annotation-toolbar"
          role="toolbar"
          aria-label="Ferramentas de anotação"
        >
          <div className="annotation-main-row">
            <div
              className="annotation-history"
              role="group"
              aria-label="Histórico de anotações"
            >
              <IconButton
                label="Desfazer anotação"
                disabled={!canUndo}
                onClick={undo}
              >
                <Undo2 size={20} />
              </IconButton>
              <IconButton
                label="Refazer anotação"
                disabled={!canRedo}
                onClick={redoAction}
              >
                <Redo2 size={20} />
              </IconButton>
            </div>
            <div
              className="annotation-primary-tools"
              role="group"
              aria-label="Ferramentas principais"
            >
              {annotationTools
                .filter(
                  (item) =>
                    item.primary || (item.id === tool && !extraToolsOpen),
                )
                .map(({ id, label, icon: Icon }) => (
                  <IconButton
                    key={id}
                    label={label}
                    disabled={realEpub && id !== "select"}
                    aria-pressed={tool === id}
                    className={tool === id ? "selected" : ""}
                    onClick={() => setTool(id)}
                  >
                    <Icon size={22} />
                  </IconButton>
                ))}
            </div>
            <div
              className="annotation-colors"
              role="group"
              aria-label="Cores da anotação"
            >
              {colors.map((c) => (
                <Button
                  key={c}
                  aria-label={`Cor ${colorNames[c]}`}
                  aria-pressed={color === c}
                  className={color === c ? "active" : ""}
                  style={{ "--swatch-color": c } as React.CSSProperties}
                  onClick={() => changeAnnotationColor(c)}
                />
              ))}
              <Popover
                opened={customColorOpen}
                onChange={setCustomColorOpen}
                onDismiss={() => setCustomColorOpen(false)}
                position="top"
                withinPortal={false}
                width={240}
                trapFocus
                returnFocus
              >
                <Popover.Target>
                  <Button
                    className={`annotation-custom-color ${colors.includes(color) ? "" : "active"}`}
                    style={{ "--swatch-color": color } as React.CSSProperties}
                    aria-pressed={!colors.includes(color)}
                    aria-label="Escolher cor personalizada"
                    onClick={() => setCustomColorOpen((open) => !open)}
                  >
                    <Palette size={22} />
                  </Button>
                </Popover.Target>
                <Popover.Dropdown className="annotation-popup annotation-color-popup">
                  <AnnotationColorPicker
                    color={color}
                    onChange={changeAnnotationColor}
                  />
                </Popover.Dropdown>
              </Popover>
            </div>
            <div className="annotation-more">
              <Popover
                transitionProps={{ duration: 0 }}
                opened={extraToolsOpen}
                onChange={setExtraToolsOpen}
                onDismiss={() => setExtraToolsOpen(false)}
                trapFocus
                position="top-end"
                withinPortal={false}
                width={240}
                returnFocus
              >
                <Popover.Target>
                  <Button
                    className="icon-button annotation-add"
                    aria-label="Mais ferramentas"
                    aria-expanded={extraToolsOpen}
                    onClick={() => setExtraToolsOpen((open) => !open)}
                  >
                    <Plus size={24} />
                  </Button>
                </Popover.Target>
                <Popover.Dropdown className="annotation-popup annotation-extra-tools">
                  {annotationTools
                    .filter((item) => !item.primary)
                    .map(({ id, label, icon: Icon }) => (
                      <Button
                        key={id}
                        disabled={realEpub || (id === "clipping" && !realPdf)}
                        aria-label={label}
                        aria-pressed={tool === id}
                        onClick={() => {
                          setTool(id);
                          setExtraToolsOpen(false);
                        }}
                      >
                        <Icon size={20} />
                        <span>{label}</span>
                      </Button>
                    ))}
                </Popover.Dropdown>
              </Popover>
            </div>
          </div>
          <div className="annotation-options">
            {annotations.some((note) => note.id === selectedObject) && (
              <Button
                className="button secondary"
                onClick={() => {
                  const object = annotations.find(
                    (a) => a.id === selectedObject,
                  );
                  if (object)
                    editAnnotation({
                      ...object,
                      color,
                      thickness,
                      opacity,
                      text: stampText || object.text,
                      updatedAt: new Date().toISOString(),
                    });
                }}
              >
                Aplicar ao objeto selecionado
              </Button>
            )}
            {showStrokeThickness && (
              <label>
                <span className="annotation-setting-heading">
                  Espessura
                  <output
                    className="annotation-setting-value"
                    aria-hidden="true"
                  >
                    {annotationStyleKind === "pencil"
                      ? thickness * 0.5
                      : thickness}{" "}
                    px
                  </output>
                </span>
                <Slider
                  aria-label="Espessura do traço"
                  thumbLabel="Espessura do traço"
                  min={1}
                  max={12}
                  value={thickness}
                  onChange={(value) => {
                    setThickness(value);
                    updateSelectedAnnotationStyle({ thickness: value });
                  }}
                  w={110}
                />
              </label>
            )}
            {showAnnotationOpacity && (
              <label>
                <span className="annotation-setting-heading">
                  Opacidade
                  <output
                    className="annotation-setting-value"
                    aria-hidden="true"
                  >
                    {Math.round(opacity * 100)}%
                  </output>
                </span>
                <Slider
                  aria-label="Opacidade da marcação"
                  thumbLabel="Opacidade da marcação"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={opacity}
                  onChange={(value) => {
                    setOpacity(value);
                    updateSelectedAnnotationStyle({ opacity: value });
                  }}
                  label={(value) => `${Math.round(value * 100)}%`}
                  w={110}
                />
              </label>
            )}
            {tool === "text" && (
              <label>
                Texto{" "}
                <TextField
                  value={stampText}
                  maxLength={500}
                  onChange={(e) => setStampText(e.target.value)}
                />
              </label>
            )}
            {tool === "image" && (
              <label>
                Imagem{" "}
                <TextField
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || file.size > 5_000_000) return;
                    const reader = new FileReader();
                    reader.onload = () => setStampImage(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            )}
            {tool === "image" && stampImage && (
              <span role="status">Imagem pronta para inserir</span>
            )}
          </div>
        </div>
      )}
      <div className="reader-page-counter" inert={focus}>
        <div className="reader-pagination">
          {realEpub ? (
            <span>{book.progress}% lido</span>
          ) : (
            <label>
              <TextField
                aria-label="Número da página"
                type="number"
                min={1}
                max={book.pages}
                value={currentPage + 1}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (
                    Number.isInteger(value) &&
                    value > 0 &&
                    value <= book.pages
                  )
                    go(value - 1);
                }}
              />{" "}
              <span>de {book.pages}</span>
            </label>
          )}
        </div>
      </div>
      <footer className="reader-footer" inert={focus}>
        {realEpub ? (
          <nav className="epub-navigation" aria-label="Navegar pelo EPUB">
            <IconButton
              label="Página anterior"
              onClick={() => go(currentPage - 1)}
            >
              <ChevronLeft size={20} />
            </IconButton>
            <IconButton
              label="Próxima página"
              onClick={() => go(currentPage + 1)}
            >
              <ChevronRight size={20} />
            </IconButton>
          </nav>
        ) : (
          <PageFilmstrip
            book={book}
            pdf={pdf}
            currentPage={currentPage}
            onSelect={go}
          />
        )}
      </footer>
      {library.notice && (
        <div className="toast" role="status">
          {library.notice}
          <IconButton label="Fechar mensagem" onClick={library.dismissNotice}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
