import { readFile } from "@/infrastructure/storage/local";
import type { Annotation, ReaderDocument } from "@/shared/types";
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportPdf(
  document: ReaderDocument,
  annotations: Annotation[],
) {
  const file = await readFile(document.id);
  if (!file) throw new Error("O arquivo original não está disponível.");
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const annotation of annotations.filter(
    (a) => a.documentId === document.id,
  )) {
    const page = pdf.getPage(annotation.page);
    if (!page) continue;
    const { width, height } = page.getSize();
    const hex = annotation.color.replace("#", "");
    const color = rgb(
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    );
    const points = annotation.points ?? [];
    const p1 = points[0];
    const p2 = points.at(-1);
    if (annotation.kind === "pen" || annotation.kind === "arrow") {
      for (let i = 1; i < points.length; i++)
        page.drawLine({
          start: {
            x: points[i - 1].x * width,
            y: (1 - points[i - 1].y) * height,
          },
          end: { x: points[i].x * width, y: (1 - points[i].y) * height },
          thickness: 1.5,
          color,
        });
      if (annotation.kind === "arrow" && p1 && p2) {
        const angle = Math.atan2((p2.y - p1.y) * height, (p2.x - p1.x) * width);
        for (const direction of [-0.45, 0.45])
          page.drawLine({
            start: { x: p2.x * width, y: (1 - p2.y) * height },
            end: {
              x: p2.x * width - 12 * Math.cos(angle + direction),
              y: (1 - p2.y) * height + 12 * Math.sin(angle + direction),
            },
            thickness: 1.5,
            color,
          });
      }
    } else if (
      (annotation.kind === "highlight" || annotation.kind === "rectangle") &&
      p1 &&
      p2
    ) {
      for (let i = 0; i < points.length - 1; i += 2) {
        const a = points[i],
          b = points[i + 1];
        page.drawRectangle({
          x: Math.min(a.x, b.x) * width,
          y: (1 - Math.max(a.y, b.y)) * height,
          width: Math.abs(b.x - a.x) * width,
          height: Math.abs(b.y - a.y) * height,
          ...(annotation.kind === "highlight"
            ? { color, opacity: 0.3 }
            : { borderColor: color, borderWidth: 1.5 }),
        });
      }
    } else if (annotation.kind === "circle" && p1 && p2) {
      page.drawEllipse({
        x: ((p1.x + p2.x) / 2) * width,
        y: (1 - (p1.y + p2.y) / 2) * height,
        xScale: Math.max(1, (Math.abs(p2.x - p1.x) / 2) * width),
        yScale: Math.max(1, (Math.abs(p2.y - p1.y) / 2) * height),
        borderColor: color,
        borderWidth: 1.5,
      });
    } else if (annotation.kind === "note") {
      const text = annotation.text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E\n]/g, "")
        .slice(0, 450);
      page.drawText(text, {
        x: 24,
        y: 30,
        size: 9,
        maxWidth: width - 48,
        lineHeight: 12,
        font,
        color,
      });
    }
  }
  const bytes = await pdf.save();
  downloadBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `${document.title}-anotado.pdf`,
  );
}
