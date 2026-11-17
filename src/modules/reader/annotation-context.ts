import type { AnnotationKind, Point } from "@/shared/types";

export const annotationLabels: Record<AnnotationKind, string> = {
  highlight: "Destaque",
  underline: "Sublinhado",
  note: "Anotação",
  pen: "Caneta",
  pencil: "Lápis",
  rectangle: "Retângulo",
  circle: "Círculo",
  arrow: "Seta",
  clipping: "Captura",
  text: "Texto",
  image: "Imagem",
};

export function annotationBounds(points: readonly Point[]) {
  if (!points.length) return null;
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const point of points) {
    x = Math.min(x, point.x);
    y = Math.min(y, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

type TextBounds = { x: number; y: number; width: number; height: number };

export function glyphIsMarked(
  glyph: TextBounds,
  points: readonly Point[],
  kind: AnnotationKind,
) {
  const x = glyph.x + glyph.width / 2;
  const y = glyph.y + glyph.height / 2;
  if (kind === "underline") {
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return false;
    const baseline = Math.max(first.y, last.y);
    return (
      x >= Math.min(first.x, last.x) &&
      x <= Math.max(first.x, last.x) &&
      baseline >= y &&
      baseline <= glyph.y + glyph.height * 1.4
    );
  }
  if (kind !== "highlight") return false;
  for (let index = 0; index + 1 < points.length; index += 2) {
    const first = points[index];
    const last = points[index + 1];
    if (
      x >= Math.min(first.x, last.x) &&
      x <= Math.max(first.x, last.x) &&
      y >= Math.min(first.y, last.y) &&
      y <= Math.max(first.y, last.y)
    )
      return true;
  }
  return false;
}

/** Read glyph geometry, rather than guessing character offsets from PDF items. */
export function textInAnnotation(
  page: HTMLElement,
  points: readonly Point[],
  kind: AnnotationKind,
) {
  if (!["highlight", "underline"].includes(kind) || points.length < 2)
    return "";
  const content = page.querySelector(".textLayer, .prose-page");
  if (!content) return "";
  const bounds = page.getBoundingClientRect();
  const marked = annotationBounds(points)!;
  if (!bounds.width || !bounds.height) return "";
  const owner = page.ownerDocument;
  const walker = owner.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const range = owner.createRange();
  const normalize = (rect: DOMRect): TextBounds => ({
    x: (rect.left - bounds.left) / bounds.width,
    y: (rect.top - bounds.top) / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  });
  let previous: TextBounds | undefined;
  let result = "";
  const intersectsMarkedArea = () =>
    Array.from(range.getClientRects()).some((rect) => {
      const box = normalize(rect);
      return (
        box.x <= marked.x + marked.width &&
        box.x + box.width >= marked.x &&
        box.y <= marked.y + marked.height + box.height &&
        box.y + box.height * 1.4 >= marked.y
      );
    });
  let node;
  while ((node = walker.nextNode())) {
    range.selectNodeContents(node);
    // Avoid measuring every character on pages with large text layers.
    if (!intersectsMarkedArea()) continue;
    const text = node.textContent ?? "";
    let offset = 0;
    while (offset < text.length) {
      let end = Math.min(offset + 64, text.length);
      if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end])) end--;
      range.setStart(node, offset);
      range.setEnd(node, end);
      if (!intersectsMarkedArea()) {
        offset = end;
        continue;
      }
      for (const character of text.slice(offset, end)) {
        range.setStart(node, offset);
        offset += character.length;
        range.setEnd(node, offset);
        const box = normalize(range.getBoundingClientRect());
        if (!box.height || !glyphIsMarked(box, points, kind)) continue;
        if (
          previous &&
          !/\s$/.test(result) &&
          !/\s/.test(character) &&
          (Math.abs(box.y - previous.y) >
            Math.max(box.height, previous.height) * 0.5 ||
            (box.x - previous.x - previous.width) * bounds.width >
              box.height * bounds.height * 0.15)
        )
          result += " ";
        result += character;
        previous = box;
      }
    }
  }
  return result.replace(/\s+/g, " ").trim();
}
