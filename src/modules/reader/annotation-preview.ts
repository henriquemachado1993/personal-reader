import type { Annotation, Point } from "@/shared/types";
import { annotationBounds } from "./annotation-context";

export function annotationPreviewCrop(
  points: readonly Point[],
  width: number,
  height: number,
) {
  const bounds = annotationBounds(points);
  if (!bounds || width <= 0 || height <= 0) return null;
  const x = Math.max(0, bounds.x * width - 12);
  const y = Math.max(0, bounds.y * height - 12);
  const right = Math.min(width, (bounds.x + bounds.width) * width + 12);
  const bottom = Math.min(height, (bounds.y + bounds.height) * height + 12);
  const scale = Math.min(1, 480 / (right - x), 240 / (bottom - y));
  return { x, y, width: right - x, height: bottom - y, scale };
}

/** Reuse the existing PDF bitmap; generating a preview never renders the PDF again. */
export function captureAnnotationPreview(
  source: HTMLCanvasElement,
  annotation: Pick<
    Annotation,
    "points" | "kind" | "color" | "thickness" | "opacity"
  >,
) {
  const points = annotation.points ?? [];
  const crop = annotationPreviewCrop(points, source.width, source.height);
  if (!crop) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(480, Math.max(1, Math.ceil(crop.width * crop.scale)));
  canvas.height = Math.min(
    240,
    Math.max(1, Math.ceil(crop.height * crop.scale)),
  );
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  context.scale(crop.scale, crop.scale);
  context.translate(-crop.x, -crop.y);
  context.strokeStyle = annotation.color;
  context.fillStyle = annotation.color;
  context.globalAlpha = annotation.opacity ?? 1;
  const displayWidth = source.getBoundingClientRect().width || source.width;
  context.lineWidth =
    ((annotation.thickness ?? 2) * source.width) / displayWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  const bounds = annotationBounds(points)!;
  const first = points[0];
  const last = points.at(-1)!;
  const x = bounds.x * source.width,
    y = bounds.y * source.height;
  const width = bounds.width * source.width,
    height = bounds.height * source.height;
  context.beginPath();
  if (annotation.kind === "highlight") {
    context.globalAlpha *= 0.3;
    for (let index = 0; index + 1 < points.length; index += 2) {
      const a = points[index],
        b = points[index + 1];
      context.fillRect(
        Math.min(a.x, b.x) * source.width,
        Math.min(a.y, b.y) * source.height,
        Math.abs(a.x - b.x) * source.width,
        Math.abs(a.y - b.y) * source.height,
      );
    }
  } else if (annotation.kind === "circle") {
    context.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      0,
      2 * Math.PI,
    );
    context.stroke();
  } else if (annotation.kind === "rectangle") {
    context.strokeRect(x, y, width, height);
  } else {
    const path =
      annotation.kind === "underline"
        ? [first, last].map((point) => ({
            ...point,
            y: Math.max(first.y, last.y),
          }))
        : points;
    if (annotation.kind === "pencil") context.lineWidth *= 0.5;
    path.forEach((point, index) => {
      if (index === 0)
        context.moveTo(point.x * source.width, point.y * source.height);
      else context.lineTo(point.x * source.width, point.y * source.height);
    });
    context.stroke();
    if (annotation.kind === "arrow") {
      const angle = Math.atan2(
        (last.y - first.y) * source.height,
        (last.x - first.x) * source.width,
      );
      const length = (8 * source.width) / displayWidth;
      for (const direction of [-0.45, 0.45]) {
        context.moveTo(last.x * source.width, last.y * source.height);
        context.lineTo(
          last.x * source.width - length * Math.cos(angle + direction),
          last.y * source.height - length * Math.sin(angle + direction),
        );
      }
      context.stroke();
    }
  }
  return canvas.toDataURL("image/webp", 0.8);
}
