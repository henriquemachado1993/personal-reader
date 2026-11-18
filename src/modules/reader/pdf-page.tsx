"use client";
import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { acquirePdf } from "./pdf-resource";
import { findPdfText } from "./pdf-search";

export const PdfPage = memo(function PdfPage({
  documentId,
  page,
  onPages,
  onCanvas,
  onError,
  searchRef,
  onDocumentReady,
}: {
  documentId: string;
  page: number;
  onPages: (n: number) => void;
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
  onError: (message: string) => void;
  onDocumentReady?: (pdf: PDFDocumentProxy | null) => void;
  searchRef: React.MutableRefObject<
    ((query: string, start: number) => Promise<number>) | null
  >;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [width, setWidth] = useState(700);
  const [aspect, setAspect] = useState(Math.SQRT2);
  const rendered = useRef<{
    pdf: PDFDocumentProxy;
    page: number;
    width: number;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0].isIntersecting),
      {
        root: hostRef.current?.closest(".reader-scroll-area"),
        rootMargin: "1000px",
      },
    );
    if (hostRef.current) observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  useEffect(() => {
    if (!pdf) return;
    searchRef.current = (query, start) => findPdfText(pdf, query, start);
    return () => {
      searchRef.current = null;
    };
  }, [pdf, searchRef]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(200, entries[0].contentRect.width)),
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const resource = acquirePdf(documentId);
    (async () => {
      try {
        const loaded = await resource.promise;
        if (cancelled) return;
        setPdf(loaded);
        onPages(loaded.numPages);
      } catch (error) {
        if (!cancelled)
          onError(
            error instanceof Error
              ? error.message
              : "Não foi possível abrir o PDF.",
          );
      }
    })();
    return () => {
      cancelled = true;
      resource.release();
    };
  }, [documentId, onPages, onError]);
  useEffect(() => {
    if (pdf) onDocumentReady?.(pdf);
  }, [pdf, onDocumentReady]);
  useEffect(() => {
    if (!pdf || !visible) {
      rendered.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      textRef.current?.replaceChildren();
      return;
    }
    if (
      rendered.current?.pdf === pdf &&
      rendered.current.page === page &&
      rendered.current.width === width
    )
      return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    let textLayer: { cancel: () => void } | undefined;
    setLoading(true);
    setPageError(false);
    (async () => {
      try {
        const pdfPage = await pdf.getPage(Math.min(page + 1, pdf.numPages));
        if (cancelled || !canvasRef.current || !textRef.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        setAspect(base.height / base.width);
        const viewport = pdfPage.getViewport({ scale: width / base.width });
        const canvas = canvasRef.current;
        const dpr = Math.min(
          window.devicePixelRatio || 1,
          2,
          4096 / Math.max(viewport.width, viewport.height),
          Math.sqrt(4_194_304 / (viewport.width * viewport.height)),
        );
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponível.");
        textRef.current.innerHTML = "";
        textRef.current.style.setProperty(
          "--scale-factor",
          String(viewport.scale),
        );
        textRef.current.style.setProperty(
          "--total-scale-factor",
          String(viewport.scale * viewport.userUnit),
        );
        renderTask = pdfPage.render({
          canvasContext: context,
          canvas,
          viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        });
        await renderTask.promise;
        if (cancelled) return;
        const textContainer = textRef.current;
        try {
          const { TextLayer } = await import("pdfjs-dist");
          const textContentSource = await pdfPage.getTextContent();
          if (cancelled) return;
          const layer = new TextLayer({
            textContentSource,
            container: textContainer,
            viewport,
          });
          textLayer = layer;
          await layer.render();
        } catch {
          // The canvas is already readable if the selectable text layer fails.
          if (!cancelled) textContainer.replaceChildren();
        }
        if (!cancelled) {
          rendered.current = { pdf, page, width };
          setLoading(false);
        }
      } catch (error) {
        if (
          !cancelled &&
          !(
            error instanceof Error &&
            error.name === "RenderingCancelledException"
          )
        ) {
          setPageError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, width, visible]);
  // Selecting another page only changes which canvas the editor uses, not its pixels.
  useEffect(() => {
    if (visible && !loading && !pageError) onCanvas?.(canvasRef.current);
    return () => onCanvas?.(null);
  }, [loading, onCanvas, pageError, visible]);
  return (
    <div
      ref={hostRef}
      className="pdf-page"
      style={{ minHeight: width * aspect }}
      aria-busy={loading}
    >
      <canvas ref={canvasRef} aria-label={`Página ${page + 1} do PDF`} />
      <div ref={textRef} className="textLayer" />
      {pageError ? (
        <div className="pdf-loading" role="status">
          Não foi possível renderizar a página {page + 1}.
        </div>
      ) : (
        loading && <div className="pdf-loading">Preparando a página…</div>
      )}
    </div>
  );
});
