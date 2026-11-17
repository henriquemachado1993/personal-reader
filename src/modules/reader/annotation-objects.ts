import type { Point } from "@/shared/types";
import { annotationBounds } from "./annotation-context";

export function moveAnnotationPoints(
  points: readonly Point[],
  dx: number,
  dy: number,
) {
  const bounds = annotationBounds(points);
  if (!bounds) return [];
  const x = Math.max(-bounds.x, Math.min(1 - bounds.x - bounds.width, dx));
  const y = Math.max(-bounds.y, Math.min(1 - bounds.y - bounds.height, dy));
  return points.map((point) => ({ ...point, x: point.x + x, y: point.y + y }));
}

export function fitImagePoints(
  first: Point,
  last: Point,
  aspect: number,
  pageWidth: number,
  pageHeight: number,
) {
  const ratio = (aspect * pageHeight) / pageWidth;
  const dragging =
    Math.abs(last.x - first.x) * pageWidth +
      Math.abs(last.y - first.y) * pageHeight >
    24;
  let width = dragging
    ? Math.abs(last.x - first.x)
    : Math.min(0.45, 320 / pageWidth, (240 * aspect) / pageWidth);
  if (dragging && width < 0.001) width = Math.abs(last.y - first.y) * ratio;
  let height = width / ratio;
  if (
    dragging &&
    Math.abs(last.y - first.y) > 0 &&
    height > Math.abs(last.y - first.y)
  ) {
    height = Math.abs(last.y - first.y);
    width = height * ratio;
  }
  const scale = Math.min(
    1,
    0.9 / Math.max(width, 0.001),
    0.8 / Math.max(height, 0.001),
  );
  width *= scale;
  height = width / ratio;
  const x = Math.max(
    0,
    Math.min(dragging ? Math.min(first.x, last.x) : first.x, 1 - width),
  );
  const y = Math.max(
    0,
    Math.min(dragging ? Math.min(first.y, last.y) : first.y, 1 - height),
  );
  return [
    { x, y },
    { x: x + width, y: y + height },
  ];
}

export function wrapAnnotationText(
  text: string,
  width: number,
  measure: (text: string) => number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const token of paragraph.split(/(\s+)/)) {
      if (line && measure(line + token) > width) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const symbol of token) {
        if (line && measure(line + symbol) > width) {
          lines.push(line.trimEnd());
          line = "";
        }
        if (line || symbol.trim()) line += symbol;
      }
    }
    lines.push(line);
  }
  return lines;
}

let measuringContext: CanvasRenderingContext2D | null = null;
export function annotationTextLines(
  text: string,
  width: number,
  fontSize: number,
) {
  measuringContext ??= document.createElement("canvas").getContext("2d");
  if (!measuringContext) return text.split("\n");
  measuringContext.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  return wrapAnnotationText(
    text,
    Math.max(16, width - fontSize * 0.5),
    (value) => measuringContext!.measureText(value).width,
  );
}

export function resizeAnnotationPoints(
  points: readonly Point[],
  target: Point,
  pageWidth: number,
  pageHeight: number,
  text?: { value: string; fontSize: number },
) {
  const bounds = annotationBounds(points);
  if (!bounds || !bounds.width || !bounds.height) return [...points];
  let width = Math.max(
    Math.min(48 / pageWidth, 1 - bounds.x),
    Math.min(1 - bounds.x, target.x - bounds.x),
  );
  let height = text
    ? (annotationTextLines(text.value, width * pageWidth, text.fontSize)
        .length *
        text.fontSize *
        1.35 +
        text.fontSize * 0.5) /
      pageHeight
    : (width * bounds.height) / bounds.width;
  if (height > 1 - bounds.y) {
    if (text) return [...points];
    height = 1 - bounds.y;
    width = (height * bounds.width) / bounds.height;
  }
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + width, y: bounds.y + height },
  ];
}
