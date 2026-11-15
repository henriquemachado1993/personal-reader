"use client";
import "./reader-controls.css";
import "./editor-controls.css";
import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { useLibrary } from "@/modules/library/store";
import { useInitialize } from "@/components/layout/workspace";
import { IconButton, EmptyState } from "@/components/ui";
import { AnnotationOverlay } from "./annotation-overlay";
import { PdfPage } from "./pdf-page";
import { EpubPage } from "./epub-page";
import { downloadBlob, exportPdf } from "./export";
import { readFile } from "@/infrastructure/storage/local";
import { sameLocation } from "./location";
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
export function Reader({ documentId }: { documentId: string }) {
  useInitialize();
  const library = useLibrary();
  const book = library.documents.find((d) => d.id === documentId);
  useEffect(() => {
    document.title = `${book?.title ?? "Leitor"} · Personal Reader`;
  }, [book?.title]);
  const [page, setPage] = useState<number | null>(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [focus, setFocus] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState(colors[0]);
  const [thickness, setThickness] = useState(2);
  const [opacity, setOpacity] = useState(1);
  const [stampText, setStampText] = useState("");
  const [stampImage, setStampImage] = useState<string>();
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
  const [appearance, setAppearance] = useState(false);
  const [redo, setRedo] = useState<Annotation[]>([]);
  const pageHost = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const pdfSearch = useRef<
    ((query: string, start: number) => Promise<number>) | null
  >(null);
  const scrollHost = useRef<HTMLDivElement>(null);
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
  } | null>(null);
  const currentPage = page ?? book?.page ?? 0;
  const realPdf = book?.format === "PDF" && !book.demo;
  const realEpub = book?.format === "EPUB" && !book.demo;
  const annotations = library.annotations.filter(
    (a) => a.documentId === documentId,
  );
  const currentAnnotations = annotations.filter((a) => a.page === currentPage);
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
    if (target && Number(target) > 0 && Number(target) <= book.pages)
      setPage(Number(target) - 1);
  }, [documentId, library.hydrated]);
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
      useLibrary.getState().updateDocument(documentId, { location, progress });
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
  }, [library.hydrated, documentId]); // Opening is a single reading event.
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
      scrollHost.current?.scrollTo({ top: 0, behavior: "instant" });
    },
    [documentId, currentPage],
  );
  const undo = useCallback(() => {
    const all = useLibrary
      .getState()
      .annotations.filter((a) => a.documentId === documentId);
    const last = all.at(-1);
    if (last) {
      useLibrary.getState().removeAnnotation(last.id);
      setRedo((r) => [...r, last]);
    }
  }, [documentId]);
  const redoAction = useCallback(() => {
    const last = redo.at(-1);
    if (last) {
      library.addAnnotation(last);
      setRedo((r) => r.slice(0, -1));
    }
  }, [redo, library.addAnnotation]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).matches(
          "input, textarea, select, [contenteditable]",
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
  }, [currentPage, go, undo, redoAction]);
  const addAnnotation = (
    kind: AnnotationKind,
    points: Point[] = [],
    text = "",
    image?: string,
  ) => {
    if (!book) return;
    const now = new Date().toISOString();
    library.addAnnotation({
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
    setRedo([]);
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
          <button
            className="icon-button type-control"
            aria-label="Ajustar aparência"
            onClick={() => setAppearance(!appearance)}
          >
            Aa
          </button>
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
        <button
          className="show-reader-controls"
          onClick={() => setFocus(false)}
        >
          Mostrar controles de leitura
        </button>
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
              <button
                key={t}
                aria-label={`Tema ${t === "white" ? "branco" : t === "paper" ? "papel" : "noturno"}`}
                aria-pressed={library.preferences.readerTheme === t}
                className={`reader-theme-${t}`}
                onClick={() => library.setPreferences({ readerTheme: t })}
              >
                Aa{library.preferences.readerTheme === t && <Check size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}
      {searching && (
        <div className="reader-search">
          <Search size={16} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar texto neste documento"
            placeholder="O que você quer encontrar?"
          />
          <button
            className="button secondary"
            onClick={async () => {
              if (!query.trim()) return;
              if (realPdf) {
                const match = await pdfSearch.current?.(
                  query,
                  (currentPage + 1) % book.pages,
                );
                if (match !== undefined && match >= 0) go(match);
                else library.notify("Não encontramos esse texto no PDF.");
              } else if (realEpub) {
                if (!window.find?.(query))
                  library.notify("Texto não encontrado nesta página do EPUB.");
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
          </button>
          <IconButton label="Fechar busca" onClick={() => setSearching(false)}>
            <X size={17} />
          </IconButton>
        </div>
      )}
      <div className="reader-body">
        {left && (
          <aside className="reader-left-panel">
            <div className="panel-title">
              <h2>Páginas</h2>
              <IconButton label="Fechar páginas" onClick={() => setLeft(false)}>
                <X size={17} />
              </IconButton>
            </div>
            <div className="page-navigation-list">
              {Array.from({ length: Math.min(book.pages, 1000) }, (_, i) => (
                <button
                  className={currentPage === i ? "current" : ""}
                  key={i}
                  onClick={() => go(i)}
                >
                  <span>{i + 1}</span>
                  <span>
                    {book.content?.[i]?.split("\n")[0] ?? `Página ${i + 1}`}
                  </span>
                  {library.bookmarks.some(
                    (b) => b.documentId === documentId && b.page === i,
                  ) && <Bookmark size={13} fill="currentColor" />}
                </button>
              ))}
            </div>
            <h3 className="panel-subheading">Marcadores</h3>
            <button
              className="bookmark-link"
              onClick={() => {
                setLeft(false);
                setRight(true);
              }}
            >
              <StickyNote size={15} />
              Anotações deste livro
            </button>
            {library.bookmarks.filter((b) => b.documentId === documentId)
              .length ? (
              library.bookmarks
                .filter((b) => b.documentId === documentId)
                .map((b) => (
                  <button
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
                  </button>
                ))
            ) : (
              <p className="panel-empty">
                Marque uma página para voltar a ela depois.
              </p>
            )}
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
            <div
              className="reader-page"
              ref={pageHost}
              onPointerDownCapture={(event) => {
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
              style={{ maxWidth: `${(760 * zoom) / 100}px` }}
            >
              {realPdf ? (
                <PdfPage
                  documentId={documentId}
                  page={currentPage}
                  onPages={onPages}
                  onCanvas={onCanvas}
                  onError={onError}
                  searchRef={pdfSearch}
                  onDocumentReady={setPdf}
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
                  {(book.content?.[currentPage] ?? "")
                    .split(/\n\s*\n/)
                    .map((paragraph, i) =>
                      i === 0 && paragraph.length < 100 ? (
                        <h1 key={i}>{paragraph}</h1>
                      ) : (
                        <p key={i}>
                          {query &&
                          paragraph.toLowerCase().includes(query.toLowerCase())
                            ? paragraph
                                .split(
                                  new RegExp(
                                    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                                    "gi",
                                  ),
                                )
                                .map((part, j) =>
                                  part.toLowerCase() === query.toLowerCase() ? (
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
                  annotations={currentAnnotations}
                  draft={draft}
                  tool={tool}
                  color={color}
                  thickness={thickness}
                  opacity={opacity}
                  onDraft={setDraft}
                  onComplete={completeDrawing}
                  onErase={(id) => library.removeAnnotation(id)}
                />
              )}
              {bookmarked && (
                <div className="page-bookmark" aria-hidden="true" />
              )}
            </div>
          )}
          {selection && (
            <div className="selection-actions">
              <span>
                {selection.text.length > 35
                  ? `${selection.text.slice(0, 35)}…`
                  : selection.text}
              </span>
              <button
                onClick={() => {
                  addAnnotation("highlight", selection.points, selection.text);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <Highlighter size={16} />
                Destacar
              </button>
              <button
                onClick={() => {
                  setRight(true);
                  setNote("");
                }}
              >
                <StickyNote size={16} />
                Anotar
              </button>
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
          <aside className="reader-notes-panel">
            <div className="panel-title">
              <h2>À margem da leitura</h2>
              <IconButton
                label="Fechar anotações"
                onClick={() => setRight(false)}
              >
                <X size={17} />
              </IconButton>
            </div>
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
              <textarea
                id="new-note"
                placeholder="O que esta página fez você pensar?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={10000}
              />
              <button className="button primary" disabled={!note.trim()}>
                <Plus size={15} />
                Salvar anotação
              </button>
            </form>
            <div className="panel-annotations">
              {annotations
                .filter((a) =>
                  ["note", "highlight", "clipping"].includes(a.kind),
                )
                .map((a) => (
                  <article key={a.id}>
                    <div>
                      <span style={{ color: a.color }}>
                        {a.kind === "highlight"
                          ? "Destaque"
                          : a.kind === "clipping"
                            ? "Captura"
                            : "Anotação"}
                      </span>
                      <IconButton
                        label="Remover anotação"
                        onClick={() => library.removeAnnotation(a.id)}
                      >
                        <X size={13} />
                      </IconButton>
                    </div>
                    {a.image && <img src={a.image} alt={a.text} />}
                    {a.quote && a.quote !== a.text && (
                      <blockquote>{a.quote}</blockquote>
                    )}
                    <p>{a.text}</p>
                    <button
                      className="text-link"
                      onClick={() => {
                        if (realEpub && a.location.type === "EPUB")
                          epubNav.current?.go(a.location.cfi);
                        else go(a.page);
                      }}
                    >
                      Página {a.page + 1}
                      <MoveUpRight size={12} />
                    </button>
                  </article>
                ))}
              {!annotations.length && (
                <p className="panel-empty">
                  Suas ideias começam com uma anotação.
                </p>
              )}
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
          <IconButton
            label="Selecionar texto"
            aria-pressed={tool === "select"}
            className={tool === "select" ? "selected" : ""}
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={19} />
          </IconButton>
          <span className="toolbar-divider" />
          {[
            { id: "highlight", label: "Marca-texto", icon: Highlighter },
            { id: "pen", label: "Caneta", icon: PenLine },
            { id: "eraser", label: "Borracha", icon: Eraser },
            { id: "rectangle", label: "Retângulo", icon: Square },
            { id: "circle", label: "Círculo", icon: Circle },
            { id: "arrow", label: "Seta", icon: MoveUpRight },
            { id: "clipping", label: "Capturar trecho", icon: ScanLine },
            { id: "text", label: "Inserir texto", icon: StickyNote },
            { id: "image", label: "Inserir imagem", icon: Plus },
          ].map(({ id, label, icon: Icon }) => (
            <IconButton
              key={id}
              label={label}
              disabled={realEpub || (id === "clipping" && !realPdf)}
              aria-pressed={tool === id}
              className={tool === id ? "selected" : ""}
              onClick={() => setTool(id)}
            >
              <Icon size={19} />
            </IconButton>
          ))}
          <span className="toolbar-divider" />
          <div className="annotation-colors">
            <label>
              Cor{" "}
              <input
                aria-label="Cor personalizada"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            {colors.map((c) => (
              <button
                key={c}
                aria-label={`Cor ${c}`}
                className={color === c ? "active" : ""}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <label>
            Espessura{" "}
            <input
              aria-label="Espessura do traço"
              type="range"
              min="1"
              max="12"
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
            />
          </label>
          <label>
            Opacidade{" "}
            <input
              aria-label="Opacidade da marcação"
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
          {tool === "text" && (
            <label>
              Texto{" "}
              <input
                value={stampText}
                maxLength={500}
                onChange={(e) => setStampText(e.target.value)}
              />
            </label>
          )}
          {tool === "image" && (
            <label>
              Imagem{" "}
              <input
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
          <span className="toolbar-divider" />
          <IconButton
            label="Desfazer anotação"
            disabled={!annotations.length}
            onClick={undo}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label="Refazer anotação"
            disabled={!redo.length}
            onClick={redoAction}
          >
            <Redo2 size={18} />
          </IconButton>
        </div>
      )}
      <div className="reader-page-counter" inert={focus}>
        <div className="reader-pagination">
          {realEpub ? (
            <span>{book.progress}% lido</span>
          ) : (
            <label>
              <input
                aria-label="Número da página"
                type="number"
                min={1}
                max={book.pages}
                value={currentPage + 1}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value > 0 && value <= book.pages) go(value - 1);
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
