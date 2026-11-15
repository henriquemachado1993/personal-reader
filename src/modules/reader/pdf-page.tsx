"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { readFile } from "@/infrastructure/storage/local";
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
  onCanvas: (canvas: HTMLCanvasElement | null) => void;
  onError: (message: string) => void;
  onDocumentReady: (pdf: PDFDocumentProxy | null) => void;
  searchRef: React.MutableRefObject<
    ((query: string, start: number) => Promise<number>) | null
  >;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [width, setWidth] = useState(700);
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
    let task:
      ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | undefined;
    (async () => {
      try {
        const file = await readFile(documentId);
        if (!file)
          throw new Error(
            "Arquivo não encontrado neste navegador. Importe o documento novamente.",
          );
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
        });
        const loaded = await task.promise;
        if (cancelled) return;
        setPdf(loaded);
        onDocumentReady(loaded);
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
      onDocumentReady(null);
      void task?.destroy();
    };
  }, [documentId, onPages, onError, onDocumentReady]);
  useEffect(() => {
    if (!pdf) return;
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
          onCanvas(canvas);
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
      onCanvas(null);
    };
  }, [pdf, page, width, onCanvas, onError]);
  return (
    <div ref={hostRef} className="pdf-page" aria-busy={loading}>
      <canvas ref={canvasRef} aria-label={`Página ${page + 1} do PDF`} />
      <div ref={textRef} className="textLayer" />
      {loading && <div className="pdf-loading">Preparando a página…</div>}
    </div>
  );
}
