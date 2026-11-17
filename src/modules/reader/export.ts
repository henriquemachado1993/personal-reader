import { readFile } from "@/infrastructure/storage/local";
import type { Annotation, ReaderDocument } from "@/shared/types";
import { renderUnicodeNote } from "./unicode-note";
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
  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await file.arrayBuffer());
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
    const points =
      annotation.kind === "underline"
        ? (annotation.points ?? []).map((point) => ({
            ...point,
            y: Math.max(...(annotation.points ?? []).map((p) => p.y)),
          }))
        : (annotation.points ?? []);
    const p1 = points[0];
    const p2 = points.at(-1);
    const opacity = annotation.opacity ?? 1;
    const thickness =
      (annotation.thickness ?? 1.5) * (annotation.kind === "pencil" ? 0.5 : 1);
    if (
      (annotation.kind === "image" || annotation.kind === "clipping") &&
      annotation.image &&
      p1 &&
      p2
    ) {
      let source = annotation.image;
      if (
        !source.startsWith("data:image/png") &&
        !source.startsWith("data:image/jpeg")
      ) {
        const bitmap = await createImageBitmap(
          await (await fetch(source)).blob(),
        );
        const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
        surface.getContext("2d")!.drawImage(bitmap, 0, 0);
        bitmap.close();
        const png = await surface.convertToBlob({ type: "image/png" });
        const image = await pdf.embedPng(await png.arrayBuffer());
        page.drawImage(image, {
          x: Math.min(p1.x, p2.x) * width,
          y: (1 - Math.max(p1.y, p2.y)) * height,
          width: Math.abs(p2.x - p1.x) * width,
          height: Math.abs(p2.y - p1.y) * height,
          opacity,
        });
        continue;
      }
      const image = source.startsWith("data:image/png")
        ? await pdf.embedPng(source)
        : await pdf.embedJpg(source);
      page.drawImage(image, {
        x: Math.min(p1.x, p2.x) * width,
        y: (1 - Math.max(p1.y, p2.y)) * height,
        width: Math.abs(p2.x - p1.x) * width,
        height: Math.abs(p2.y - p1.y) * height,
        opacity,
      });
    }
    if (
      annotation.kind === "pen" ||
      annotation.kind === "pencil" ||
      annotation.kind === "underline" ||
      annotation.kind === "arrow"
    ) {
      for (let i = 1; i < points.length; i++)
        page.drawLine({
          start: {
            x: points[i - 1].x * width,
            y: (1 - points[i - 1].y) * height,
          },
          end: { x: points[i].x * width, y: (1 - points[i].y) * height },
          thickness,
          opacity,
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
            ? { color, opacity: 0.3 * opacity }
            : { borderColor: color, borderWidth: thickness, opacity }),
        });
      }
    } else if (annotation.kind === "circle" && p1 && p2) {
      page.drawEllipse({
        x: ((p1.x + p2.x) / 2) * width,
        y: (1 - (p1.y + p2.y) / 2) * height,
        xScale: Math.max(1, (Math.abs(p2.x - p1.x) / 2) * width),
        yScale: Math.max(1, (Math.abs(p2.y - p1.y) / 2) * height),
        borderColor: color,
        borderWidth: thickness,
        opacity,
      });
    } else if (annotation.kind === "note" || annotation.kind === "text") {
      const rendered = await renderUnicodeNote(
        annotation.text,
        annotation.color,
        annotation.kind === "text" && p1 && p2
          ? {
              width: Math.max(
                16,
                Math.round(Math.abs(p2.x - p1.x) * width * 2),
              ),
              fontSize: (((annotation.fontSize ?? 24) * width) / 1000) * 2,
            }
          : undefined,
      );
      const image = await pdf.embedPng(rendered.bytes);
      const targetWidth =
        annotation.kind === "text" && p1 && p2
          ? Math.abs(p2.x - p1.x) * width
          : Math.min(width - 48, (height - 48) / rendered.aspect);
      const targetHeight = targetWidth * rendered.aspect;
      page.drawImage(image, {
        x: Math.min(p1 ? p1.x * width : 24, width - targetWidth),
        y: Math.max(0, (p1 ? (1 - p1.y) * height : height - 24) - targetHeight),
        width: targetWidth,
        height: targetHeight,
        opacity,
      });
      await pdf.attach(
        new TextEncoder().encode(annotation.text),
        `nota-${annotation.id}.txt`,
        {
          mimeType: "text/plain",
          description: "Texto original UTF-8 da anotação",
        },
      );
    }
  }
  const bytes = await pdf.save();
  downloadBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `${document.title}-anotado.pdf`,
  );
}
