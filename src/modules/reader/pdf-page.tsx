"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { acquirePdf } from "./pdf-resource";
import { useLibrary } from "@/modules/library/store";

export function PdfPage({
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
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0].isIntersecting),
      { rootMargin: "1000px" },
    );
    if (hostRef.current) observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!pdf) return;
    searchRef.current = async (query, start) => {
      const normalized = query.toLocaleLowerCase("pt-BR");
      for (let offset = 0; offset < pdf.numPages; offset++) {
        const index = (start + offset) % pdf.numPages;
        const text = await (await pdf.getPage(index + 1)).getTextContent();
        if (
          text.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(normalized)
        )
          return index;
      }
      return -1;
    };
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
    if (!pdf || !visible) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    let textLayer: { cancel: () => void } | undefined;
    setLoading(true);
    (async () => {
      try {
        const pdfPage = await pdf.getPage(Math.min(page + 1, pdf.numPages));
        if (cancelled || !canvasRef.current || !textRef.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: width / base.width });
        const canvas = canvasRef.current;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        const context = canvas.getContext("2d");
        if (!context) return;
        textRef.current.innerHTML = "";
        textRef.current.style.setProperty(
          "--scale-factor",
          String(viewport.scale),
        );
        renderTask = pdfPage.render({
          canvasContext: context,
          canvas,
          viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        });
        await renderTask.promise;
        if (cancelled) return;
        const { TextLayer } = await import("pdfjs-dist");
        const layer = new TextLayer({
          textContentSource: await pdfPage.getTextContent(),
          container: textRef.current,
          viewport,
        });
        textLayer = layer;
        await layer.render();
        if (!cancelled) {
          onCanvas?.(canvas);
          setLoading(false);
        }
      } catch (error) {
        if (
          !cancelled &&
          !(
            error instanceof Error &&
            error.name === "RenderingCancelledException"
          )
        )
          onError("Não foi possível renderizar esta página do PDF.");
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      onCanvas?.(null);
    };
  }, [pdf, page, width, onCanvas, onError, visible]);
  return (
    <div
      ref={hostRef}
      className="pdf-page"
      style={{ minHeight: width * 1.414 }}
      aria-busy={loading}
    >
      <canvas ref={canvasRef} aria-label={`Página ${page + 1} do PDF`} />
      <div ref={textRef} className="textLayer" />
      {loading && <div className="pdf-loading">Preparando a página…</div>}
    </div>
  );
}
