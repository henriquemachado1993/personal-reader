"use client";
import { Button } from "@/components/ui/controls";
import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui";
import { Tooltip } from "@mantine/core";
import type { ReaderDocument } from "@/shared/types";

function PdfThumbnail({
  pdf,
  index,
}: {
  pdf: PDFDocumentProxy;
  index: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | undefined;
    const element = canvas.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void (async () => {
        try {
          const page = await pdf.getPage(index + 1);
          if (cancelled) return;
          const viewport = page.getViewport({
            scale: 80 / page.getViewport({ scale: 1 }).width,
          });
          element.width = viewport.width;
          element.height = viewport.height;
          const context = element.getContext("2d");
          if (!context) return;
          task = page.render({
            canvas: element,
            canvasContext: context,
            viewport,
          });
          await task.promise;
        } catch {
          /* The full-size page owns document errors; cancelled previews are disposable. */
        }
      })();
    });
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
    };
  }, [pdf, index]);
  return <canvas ref={canvas} aria-hidden="true" />;
}

export function PageFilmstrip({
  book,
  currentPage,
  pdf,
  onSelect,
}: {
  book: ReaderDocument;
  currentPage: number;
  pdf: PDFDocumentProxy | null;
  onSelect: (page: number) => void;
}) {
  const selected = useRef<HTMLButtonElement>(null);
  const start = Math.min(
    Math.max(0, currentPage - 15),
    Math.max(0, book.pages - 32),
  );
  const indices = Array.from(
    { length: Math.min(32, book.pages) },
    (_, i) => start + i,
  );
  useEffect(() => {
    selected.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "instant",
    });
  }, [currentPage]);
  return (
    <nav className="page-filmstrip" aria-label="Miniaturas das páginas">
      <IconButton
        label="Página anterior"
        disabled={currentPage === 0}
        onClick={() => onSelect(currentPage - 1)}
      >
        <ChevronLeft size={20} />
      </IconButton>
      <div className="page-filmstrip-track">
        {indices.map((index) => (
          <Tooltip
            key={index}
            label={`Página ${index + 1}`}
            events={{ hover: true, focus: true, touch: false }}
          >
            <Button
              key={index}
              ref={index === currentPage ? selected : undefined}
              className={`page-thumbnail ${index === currentPage ? "current" : ""}`}
              aria-label={`Ir para página ${index + 1}`}
              aria-current={index === currentPage ? "page" : undefined}
              onClick={() => onSelect(index)}
            >
              {pdf ? (
                <PdfThumbnail pdf={pdf} index={index} />
              ) : (
                <div className="text-thumbnail" aria-hidden="true">
                  <strong>{book.content?.[index]?.split("\n")[0]}</strong>
                  <span>
                    {book.content?.[index]
                      ?.split(/\n\s*\n/)
                      .slice(1)
                      .join("\n\n")}
                  </span>
                </div>
              )}
            </Button>
          </Tooltip>
        ))}
      </div>
      <IconButton
        label="Próxima página"
        disabled={currentPage >= book.pages - 1}
        onClick={() => onSelect(currentPage + 1)}
      >
        <ChevronRight size={20} />
      </IconButton>
    </nav>
  );
}
